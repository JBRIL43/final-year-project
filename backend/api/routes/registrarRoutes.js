const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');
const { sendPaymentNotification } = require('../utils/notifications');

const router = express.Router();

function normalizePaymentModel(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  if (normalized === 'pre_payment') return 'pre_payment';
  if (normalized === 'hybrid') return 'hybrid';
  return 'post_graduation';
}

async function getAvailableColumns(tableName, columns) {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = ANY($2::text[])`,
    [tableName, columns]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function ensureDebtFinalSettlementColumn() {
  const debtColumns = await getAvailableColumns('debt_records', ['is_final_settlement']);
  if (debtColumns.has('is_final_settlement')) {
    return;
  }

  await pool.query(`
    ALTER TABLE public.debt_records
    ADD COLUMN IF NOT EXISTS is_final_settlement BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

function computeDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

async function calculateFinalWithdrawalSettlement(studentId) {
  await ensureDebtFinalSettlementColumn();

  const studentCols = await getAvailableColumns('students', [
    'student_id',
    'campus',
    'department',
    'enrollment_date',
    'created_at',
    'tuition_share_percent',
    'payment_model',
  ]);
  const semesterCols = await getAvailableColumns('semester_amounts', [
    'academic_year',
    'campus',
    'program_type',
    'tuition_cost_per_year',
    'boarding_cost_per_year',
    'food_cost_per_month',
    'effective_from',
  ]);
  const costShareCols = await getAvailableColumns('cost_shares', [
    'program',
    'academic_year',
    'campus',
    'tuition_cost_per_year',
    'boarding_cost_per_year',
    'food_cost_per_month',
  ]);
  const debtCols = await getAvailableColumns('debt_records', [
    'debt_id',
    'student_id',
    'initial_amount',
    'current_balance',
    'academic_year',
    'updated_at',
    'last_updated',
    'created_at',
    'is_final_settlement',
  ]);

  const enrollmentDateExpr = studentCols.has('enrollment_date')
    ? 's.enrollment_date'
    : studentCols.has('created_at')
    ? 's.created_at'
    : 'NOW()::timestamp';

  const studentRes = await pool.query(
    `SELECT
       s.student_id,
       ${studentCols.has('campus') ? 's.campus' : "'Main Campus'::text"} AS campus,
       ${studentCols.has('department') ? 's.department' : "''::text"} AS department,
       ${enrollmentDateExpr} AS enrollment_date,
       ${studentCols.has('tuition_share_percent') ? 's.tuition_share_percent' : '15.00::numeric'} AS tuition_share_percent,
       ${studentCols.has('payment_model') ? "COALESCE(s.payment_model, 'post_graduation')" : "'post_graduation'::text"} AS payment_model
     FROM public.students s
     WHERE s.student_id = $1
     LIMIT 1`,
    [studentId]
  );

  if (studentRes.rows.length === 0) {
    throw new Error('Student not found for settlement');
  }

  const student = studentRes.rows[0];
  const normalizedPaymentModel = normalizePaymentModel(student.payment_model);

  // Pre-payment students should not keep post-graduation debt accrual.
  if (normalizedPaymentModel === 'pre_payment') {
    await pool.query(
      `UPDATE public.debt_records
       SET is_final_settlement = TRUE,
           current_balance = 0,
           initial_amount = COALESCE(initial_amount, 0),
           ${debtCols.has('updated_at') ? 'updated_at = NOW(),' : ''}
           ${!debtCols.has('updated_at') && debtCols.has('last_updated') ? 'last_updated = NOW(),' : ''}
           ${!debtCols.has('updated_at') && !debtCols.has('last_updated') && debtCols.has('created_at') ? 'created_at = COALESCE(created_at, NOW()),' : ''}
           debt_id = debt_id
       WHERE student_id = $1`,
      [studentId]
    );
    return { finalBalance: 0, source: 'pre_payment' };
  }

  const daysEnrolled = computeDaysBetween(student.enrollment_date, new Date());
  const academicYearDays = 300;
  const monthsEnrolled = Math.max(1, Math.ceil(daysEnrolled / 30));

  let tuitionCostPerYear = 0;
  let boardingCostPerYear = 0;
  let foodCostPerMonth = 0;
  let selectedAcademicYear = null;

  const hasSemesterTable = (
    await pool.query(`SELECT to_regclass('public.semester_amounts') AS table_name`)
  ).rows[0]?.table_name;

  if (hasSemesterTable && semesterCols.has('tuition_cost_per_year') && semesterCols.has('boarding_cost_per_year')) {
    const semesterResult = await pool.query(
      `SELECT
         ${semesterCols.has('academic_year') ? 'academic_year' : "NULL::text AS academic_year"},
         tuition_cost_per_year,
         boarding_cost_per_year,
         ${semesterCols.has('food_cost_per_month') ? 'food_cost_per_month' : '0::numeric AS food_cost_per_month'}
       FROM public.semester_amounts
       WHERE LOWER(COALESCE(campus, 'main campus')) = LOWER($1)
       ORDER BY ${semesterCols.has('effective_from') ? 'effective_from DESC,' : ''} id DESC
       LIMIT 1`,
      [student.campus || 'Main Campus']
    );

    if (semesterResult.rows.length > 0) {
      tuitionCostPerYear = Number(semesterResult.rows[0].tuition_cost_per_year || 0);
      boardingCostPerYear = Number(semesterResult.rows[0].boarding_cost_per_year || 0);
      foodCostPerMonth = Number(semesterResult.rows[0].food_cost_per_month || 0);
      selectedAcademicYear = semesterResult.rows[0].academic_year || null;
    }
  }

  if (tuitionCostPerYear <= 0 && costShareCols.has('tuition_cost_per_year') && costShareCols.has('boarding_cost_per_year')) {
    const costShareRes = await pool.query(
      `SELECT
         ${costShareCols.has('academic_year') ? 'academic_year' : "NULL::text AS academic_year"},
         tuition_cost_per_year,
         boarding_cost_per_year,
         ${costShareCols.has('food_cost_per_month') ? 'food_cost_per_month' : '0::numeric AS food_cost_per_month'}
       FROM public.cost_shares
       WHERE LOWER(COALESCE(program, '')) = LOWER($1)
         AND LOWER(COALESCE(${costShareCols.has('campus') ? 'campus' : "'Main Campus'"}, 'main campus')) = LOWER($2)
       ORDER BY academic_year DESC NULLS LAST
       LIMIT 1`,
      [student.department || '', student.campus || 'Main Campus']
    );

    if (costShareRes.rows.length > 0) {
      tuitionCostPerYear = Number(costShareRes.rows[0].tuition_cost_per_year || 0);
      boardingCostPerYear = Number(costShareRes.rows[0].boarding_cost_per_year || 0);
      foodCostPerMonth = Number(costShareRes.rows[0].food_cost_per_month || 0);
      selectedAcademicYear = selectedAcademicYear || costShareRes.rows[0].academic_year || null;
    }
  }

  const tuitionSharePercent = Number(student.tuition_share_percent || 15);
  const proratedTuition = (tuitionCostPerYear * (tuitionSharePercent / 100)) * (daysEnrolled / academicYearDays);
  const proratedBoarding = boardingCostPerYear * (daysEnrolled / academicYearDays);
  const proratedFood = foodCostPerMonth * monthsEnrolled;
  const finalBalance = Number((proratedTuition + proratedBoarding + proratedFood).toFixed(2));

  const existingDebtRes = await pool.query(
    `SELECT debt_id
     FROM public.debt_records
     WHERE student_id = $1
     ORDER BY debt_id DESC
     LIMIT 1`,
    [studentId]
  );

  if (existingDebtRes.rows.length > 0) {
    const setClauses = [
      'initial_amount = $1',
      'current_balance = $2',
      'is_final_settlement = TRUE',
    ];
    if (debtCols.has('academic_year')) {
      setClauses.push('academic_year = COALESCE($3, academic_year)');
    }
    if (debtCols.has('updated_at')) {
      setClauses.push('updated_at = NOW()');
    } else if (debtCols.has('last_updated')) {
      setClauses.push('last_updated = NOW()');
    }

    await pool.query(
      `UPDATE public.debt_records
       SET ${setClauses.join(', ')}
       WHERE debt_id = $4`,
      [finalBalance, finalBalance, selectedAcademicYear, existingDebtRes.rows[0].debt_id]
    );
  } else {
    const insertColumns = ['student_id'];
    const insertValues = [studentId];
    const addDebtColumn = (col, val) => {
      if (debtCols.has(col)) {
        insertColumns.push(col);
        insertValues.push(val);
      }
    };

    addDebtColumn('initial_amount', finalBalance);
    addDebtColumn('current_balance', finalBalance);
    addDebtColumn('academic_year', selectedAcademicYear);
    addDebtColumn('is_final_settlement', true);
    addDebtColumn('created_at', new Date());
    addDebtColumn('updated_at', new Date());
    addDebtColumn('last_updated', new Date());

    const placeholders = insertValues.map((_, idx) => `$${idx + 1}`).join(', ');
    await pool.query(
      `INSERT INTO public.debt_records (${insertColumns.join(', ')})
       VALUES (${placeholders})`,
      insertValues
    );
  }

  return { finalBalance, source: 'prorated' };
}

async function validateClearanceAllowed(studentId) {
  const studentColumns = await getAvailableColumns('students', [
    'enrollment_status', 'department_withdrawal_approved',
    'withdrawal_status', 'finance_withdrawal_approved',
  ]);
  const debtColumns = await getAvailableColumns('debt_records', ['student_id', 'current_balance', 'is_final_settlement']);

  const studentRes = await pool.query(
    `SELECT 
       ${studentColumns.has('enrollment_status') ? 'enrollment_status' : "'ACTIVE'::text AS enrollment_status"},
       ${studentColumns.has('department_withdrawal_approved') ? 'department_withdrawal_approved' : 'NULL::boolean AS department_withdrawal_approved'},
       ${studentColumns.has('withdrawal_status') ? 'withdrawal_status' : "NULL::text AS withdrawal_status"},
       ${studentColumns.has('finance_withdrawal_approved') ? 'finance_withdrawal_approved' : 'NULL::boolean AS finance_withdrawal_approved'}
     FROM public.students
     WHERE student_id = $1
     LIMIT 1`,
    [studentId]
  );

  if (studentRes.rows.length === 0) {
    return { allowed: false, notFound: true };
  }

  const enrollmentStatus = String(studentRes.rows[0].enrollment_status || '').toUpperCase();
  const deptApproved = studentRes.rows[0].department_withdrawal_approved;
  // Accept both the boolean flag and the legacy withdrawal_status field
  const withdrawalStatus = String(studentRes.rows[0].withdrawal_status || '').toLowerCase();
  const isDeptApproved = deptApproved === true || withdrawalStatus === 'academic_approved';
  const isFinanceApproved = studentRes.rows[0].finance_withdrawal_approved === true
    || withdrawalStatus === 'finance_approved';

  if (enrollmentStatus === 'ACTIVE') {
    return { allowed: false, message: 'Active students cannot be cleared. Must be withdrawn or graduated.' };
  }

  if (!debtColumns.has('student_id') || !debtColumns.has('current_balance')) {
    return {
      allowed: false,
      message: 'Debt records schema is missing required columns for clearance validation',
    };
  }

  const debtRes = await pool.query(
    `SELECT
       current_balance,
       ${debtColumns.has('is_final_settlement') ? 'is_final_settlement' : 'FALSE::boolean AS is_final_settlement'}
     FROM public.debt_records
     WHERE student_id = $1
     ORDER BY debt_id DESC
     LIMIT 1`,
    [studentId]
  );

  const balance = debtRes.rows.length > 0 ? Number(debtRes.rows[0].current_balance || 0) : 0;
  const isFinalSettlement = debtRes.rows.length > 0 ? Boolean(debtRes.rows[0].is_final_settlement) : false;

  if (enrollmentStatus === 'WITHDRAWN') {
    if (!isDeptApproved) {
      return { allowed: false, message: 'Academic withdrawal must be approved by Department Head first' };
    }
    if (!isFinanceApproved) {
      return { allowed: false, message: 'Finance must approve the withdrawal after confirming full payment before clearance' };
    }
    // Auto-run settlement if not yet calculated
    if (!isFinalSettlement) {
      try {
        await calculateFinalWithdrawalSettlement(studentId);
      } catch (settlementError) {
        // Settlement failed but finance already confirmed zero balance — allow clearance
        console.error('Auto-settlement failed, proceeding since finance approved:', settlementError);
      }
      // Re-read balance after settlement attempt
      const updatedDebt = await pool.query(
        `SELECT current_balance, is_final_settlement
         FROM public.debt_records
         WHERE student_id = $1
         ORDER BY debt_id DESC LIMIT 1`,
        [studentId]
      );
      const updatedBalance = updatedDebt.rows.length > 0 ? Number(updatedDebt.rows[0].current_balance || 0) : 0;
      if (updatedBalance > 0) {
        return { allowed: false, message: `Student must settle final withdrawal balance (balance = ${updatedBalance} ETB) before clearance` };
      }
    } else if (balance > 0) {
      return { allowed: false, message: 'Student must settle final withdrawal balance (balance = 0) before clearance' };
    }
  }

  if (enrollmentStatus === 'GRADUATED') {
    if (balance > 0) {
      return { allowed: false, message: 'Graduating students must have a zero balance before clearance' };
    }
  }

  return { allowed: true };
}

router.use(authenticateRequest, requireRoles(['registrar', 'finance']));

router.get('/students', async (req, res) => {
  try {
    const statusFilter = String(req.query.status || '').trim().toUpperCase();
    const studentColumns = await getAvailableColumns('students', [
      'student_id',
      'student_number',
      'full_name',
      'email',
      'department',
      'campus',
      'enrollment_status',
      'clearance_status',
      'credits_registered',
      'tuition_share_percent',
      'withdrawal_requested_at',
      'department_withdrawal_approved',
      'registrar_withdrawal_processed',
      'graduation_date',
      'updated_at',
    ]);

    const hasRequired = ['student_id', 'student_number'].every((col) => studentColumns.has(col));
    if (!hasRequired) {
      return res.status(400).json({ error: 'students schema is missing required columns' });
    }

    const fullNameExpr = studentColumns.has('full_name') ? 's.full_name' : "''::text";
    const emailExpr = studentColumns.has('email') ? 's.email' : "''::text";
    const departmentExpr = studentColumns.has('department') ? 's.department' : "''::text";
    const campusExpr = studentColumns.has('campus') ? 's.campus' : "'Main Campus'::text";
    const enrollmentStatusExpr = studentColumns.has('enrollment_status') ? 's.enrollment_status' : "'ACTIVE'::text";
    const clearanceStatusExpr = studentColumns.has('clearance_status') ? 's.clearance_status' : "'PENDING'::text";
    const creditsRegisteredExpr = studentColumns.has('credits_registered') ? 's.credits_registered' : 'NULL::integer';
    const tuitionSharePercentExpr = studentColumns.has('tuition_share_percent')
      ? 's.tuition_share_percent'
      : '15.00::numeric';
    const withdrawalRequestedAtExpr = studentColumns.has('withdrawal_requested_at')
      ? 's.withdrawal_requested_at'
      : 'NULL::timestamp';
    const departmentWithdrawalApprovedExpr = studentColumns.has('department_withdrawal_approved')
      ? 's.department_withdrawal_approved'
      : 'NULL::boolean';
    const registrarWithdrawalProcessedExpr = studentColumns.has('registrar_withdrawal_processed')
      ? 's.registrar_withdrawal_processed'
      : 'FALSE::boolean';
    const graduationDateExpr = studentColumns.has('graduation_date') ? 's.graduation_date' : 'NULL::date';
    const updatedAtExpr = studentColumns.has('updated_at') ? 's.updated_at' : 'NULL::timestamp';

    const values = [];
    let whereClause = '';

    if (statusFilter) {
      values.push(statusFilter);
      whereClause = `WHERE UPPER(COALESCE(${enrollmentStatusExpr}, '')) = $1`;
    }

    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${fullNameExpr} AS full_name,
         ${emailExpr} AS email,
         ${departmentExpr} AS department,
         ${campusExpr} AS campus,
         ${enrollmentStatusExpr} AS enrollment_status,
         ${clearanceStatusExpr} AS clearance_status,
         ${creditsRegisteredExpr} AS credits_registered,
         ${tuitionSharePercentExpr} AS tuition_share_percent,
         ${withdrawalRequestedAtExpr} AS withdrawal_requested_at,
         ${departmentWithdrawalApprovedExpr} AS department_withdrawal_approved,
         ${registrarWithdrawalProcessedExpr} AS registrar_withdrawal_processed,
         ${graduationDateExpr} AS graduation_date,
         ${updatedAtExpr} AS updated_at
       FROM public.students s
       ${whereClause}
       ORDER BY s.student_id DESC`,
      values
    );

    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('Registrar students list error:', error);
    res.status(500).json({ error: 'Failed to load registrar students' });
  }
});

// POST /api/registrar/students/import — bulk import students from Excel
router.post('/students/import', async (req, res) => {
  const client = await pool.connect();

  try {
    if (!['registrar', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const students = Array.isArray(req.body?.students) ? req.body.students : null;

    if (!students || students.length === 0) {
      return res.status(400).json({ error: 'No student data provided' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'student_id',
      'student_number',
      'full_name',
      'email',
      'phone',
      'department',
      'campus',
      'enrollment_status',
      'clearance_status',
      'credits_registered',
      'tuition_share_percent',
      'payment_model',
      'pre_payment_amount',
      'pre_payment_date',
      'pre_payment_clearance',
      'created_at',
      'updated_at',
    ]);

    const debtColumns = await getAvailableColumns('debt_records', [
      'debt_id',
      'student_id',
      'initial_amount',
      'current_balance',
      'academic_year',
      'created_at',
      'updated_at',
      'last_updated',
    ]);

    if (!studentColumns.has('student_number')) {
      return res.status(400).json({ error: 'students.student_number column is required for import' });
    }

    await client.query('BEGIN');

    let successCount = 0;
    const errors = [];

    for (const row of students) {
      const studentNumber = String(row['Student ID'] || '').trim();
      const fullName = String(row['Full Name'] || '').trim();
      const email = String(row.Email || '').trim().toLowerCase();
      const phone = String(row.Phone || '').trim();
      const program = String(row.Program || '').trim();
      const campus = String(row.Campus || '').trim() || 'Main Campus';
      const enrollmentStatus = String(row['Enrollment Status'] || 'ACTIVE').trim().toUpperCase();
      const clearanceStatus = String(row['Clearance Status'] || 'PENDING').trim().toUpperCase();
      const creditsRaw = String(row['Credits Registered'] || '').trim();
      const credits = creditsRaw === '' ? null : Number.parseInt(creditsRaw, 10);
      const paymentModel = normalizePaymentModel(row['Payment Model'] || 'post_graduation');
      const prePaymentAmountRaw = String(
        row['Pre-Payment Amount (ETB)'] || row['Pre-Payment Amount'] || row['Pre Payment Amount'] || ''
      ).trim();
      const prePaymentAmount = prePaymentAmountRaw === '' ? 0 : Number.parseFloat(prePaymentAmountRaw);
      const prePaymentDate = String(row['Pre-Payment Date'] || row['Pre Payment Date'] || '').trim();
      const prePaymentClearanceRaw = String(row['Pre-Payment Clearance'] || row['Pre Payment Clearance'] || '')
        .trim()
        .toLowerCase();

      if (!studentNumber || !fullName || !email || !program || !campus) {
        errors.push(`Missing required fields for row with Student ID: ${studentNumber || '(empty)'}`);
        continue;
      }

      if (Number.isFinite(credits) && credits < 0) {
        errors.push(`Invalid credits for ${studentNumber}: must be non-negative`);
        continue;
      }

      if (paymentModel !== 'post_graduation' && (!Number.isFinite(prePaymentAmount) || prePaymentAmount <= 0)) {
        errors.push(`Missing or invalid pre-payment amount for ${studentNumber}`);
        continue;
      }

      let tuitionSharePercent = 15.0;
      if (Number.isFinite(credits)) {
        if (credits >= 15) tuitionSharePercent = 15.0;
        else if (credits >= 12) tuitionSharePercent = 11.25;
        else if (credits >= 8) tuitionSharePercent = 7.5;
        else if (credits >= 1) tuitionSharePercent = 3.75;
        else tuitionSharePercent = 0.0;
      }

      const existing = await client.query(
        `SELECT student_id
         FROM public.students
         WHERE student_number = $1 OR LOWER(COALESCE(email, '')) = LOWER($2)
         LIMIT 1`,
        [studentNumber, email]
      );

      if (existing.rows.length > 0) {
        errors.push(`Student ${studentNumber} already exists`);
        continue;
      }

      const insertColumns = ['student_number'];
      const insertValues = [studentNumber];

      const appendColumn = (columnName, value) => {
        if (studentColumns.has(columnName)) {
          insertColumns.push(columnName);
          insertValues.push(value);
        }
      };

      appendColumn('full_name', fullName);
      appendColumn('email', email);
      appendColumn('phone', phone || null);
      appendColumn('department', program);
      appendColumn('campus', campus);
      appendColumn('enrollment_status', enrollmentStatus);
      appendColumn('clearance_status', clearanceStatus);
      appendColumn('credits_registered', Number.isFinite(credits) ? credits : null);
      appendColumn('tuition_share_percent', tuitionSharePercent);
      appendColumn('payment_model', paymentModel);

      if (paymentModel !== 'post_graduation') {
        appendColumn('pre_payment_amount', prePaymentAmount);
        appendColumn('pre_payment_date', prePaymentDate || null);
        appendColumn('pre_payment_clearance', ['1', 'true', 'yes', 'cleared'].includes(prePaymentClearanceRaw));
      }

      if (studentColumns.has('created_at')) {
        insertColumns.push('created_at');
        insertValues.push(new Date());
      }
      if (studentColumns.has('updated_at')) {
        insertColumns.push('updated_at');
        insertValues.push(new Date());
      }

      const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
      const returningId = studentColumns.has('student_id') ? ' RETURNING student_id' : '';

      const insertStudentResult = await client.query(
        `INSERT INTO public.students (${insertColumns.join(', ')})
         VALUES (${placeholders})${returningId}`,
        insertValues
      );

      const studentId = studentColumns.has('student_id')
        ? insertStudentResult.rows[0]?.student_id
        : null;

      if (studentId && debtColumns.has('student_id')) {
        const existingDebt = await client.query(
          'SELECT 1 FROM public.debt_records WHERE student_id = $1 LIMIT 1',
          [studentId]
        );

        if (existingDebt.rows.length === 0) {
          const debtInsertColumns = ['student_id'];
          const debtInsertValues = [studentId];

          const appendDebtColumn = (columnName, value) => {
            if (debtColumns.has(columnName)) {
              debtInsertColumns.push(columnName);
              debtInsertValues.push(value);
            }
          };

          appendDebtColumn('initial_amount', 0);
          appendDebtColumn('current_balance', 0);
          appendDebtColumn('academic_year', null);
          appendDebtColumn('created_at', new Date());
          appendDebtColumn('updated_at', new Date());
          appendDebtColumn('last_updated', new Date());

          const debtPlaceholders = debtInsertValues.map((_, index) => `$${index + 1}`).join(', ');

          await client.query(
            `INSERT INTO public.debt_records (${debtInsertColumns.join(', ')})
             VALUES (${debtPlaceholders})`,
            debtInsertValues
          );
        }
      }

      successCount += 1;
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Imported ${successCount} students successfully`,
      errors,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk import error:', error);
    return res.status(500).json({ error: 'Failed to import students' });
  } finally {
    client.release();
  }
});

router.get('/students/:id/details', async (req, res) => {
  try {
    if (!['registrar', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const studentId = Number(req.params.id);

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'student_id',
      'student_number',
      'full_name',
      'email',
      'department',
      'campus',
      'enrollment_status',
      'clearance_status',
      'credits_registered',
      'tuition_share_percent',
      'payment_model',
      'pre_payment_amount',
      'pre_payment_date',
      'pre_payment_clearance',
      'graduation_date',
      'withdrawal_requested_at',
      'updated_at',
    ]);

    const debtColumns = await getAvailableColumns('debt_records', [
      'debt_id',
      'student_id',
      'initial_amount',
      'current_balance',
      'academic_year',
      'updated_at',
      'last_updated',
    ]);

    if (!studentColumns.has('student_id') || !studentColumns.has('student_number')) {
      return res.status(400).json({ error: 'students schema is missing required columns' });
    }

    const fullNameExpr = studentColumns.has('full_name') ? 's.full_name' : "''::text";
    const emailExpr = studentColumns.has('email') ? 's.email' : "''::text";
    const departmentExpr = studentColumns.has('department') ? 's.department' : "''::text";
    const campusExpr = studentColumns.has('campus') ? 's.campus' : "'Main Campus'::text";
    const enrollmentStatusExpr = studentColumns.has('enrollment_status') ? 's.enrollment_status' : "'ACTIVE'::text";
    const clearanceStatusExpr = studentColumns.has('clearance_status') ? 's.clearance_status' : "'PENDING'::text";
    const creditsRegisteredExpr = studentColumns.has('credits_registered') ? 's.credits_registered' : 'NULL::integer';
    const tuitionSharePercentExpr = studentColumns.has('tuition_share_percent')
      ? 's.tuition_share_percent'
      : '15.00::numeric';
    const paymentModelExpr = studentColumns.has('payment_model')
      ? "COALESCE(s.payment_model, 'post_graduation')"
      : "'post_graduation'::text";
    const prePaymentAmountExpr = studentColumns.has('pre_payment_amount') ? 's.pre_payment_amount' : '0::numeric';
    const prePaymentDateExpr = studentColumns.has('pre_payment_date') ? 's.pre_payment_date' : 'NULL::timestamp';
    const prePaymentClearanceExpr = studentColumns.has('pre_payment_clearance')
      ? 's.pre_payment_clearance'
      : 'FALSE::boolean';
    const graduationDateExpr = studentColumns.has('graduation_date') ? 's.graduation_date' : 'NULL::date';
    const withdrawalRequestedAtExpr = studentColumns.has('withdrawal_requested_at')
      ? 's.withdrawal_requested_at'
      : 'NULL::timestamp';
    const updatedAtExpr = studentColumns.has('updated_at') ? 's.updated_at' : 'NULL::timestamp';

    const studentResult = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${fullNameExpr} AS full_name,
         ${emailExpr} AS email,
         ${departmentExpr} AS department,
         ${campusExpr} AS campus,
         ${enrollmentStatusExpr} AS enrollment_status,
         ${clearanceStatusExpr} AS clearance_status,
         ${creditsRegisteredExpr} AS credits_registered,
         ${tuitionSharePercentExpr} AS tuition_share_percent,
         ${paymentModelExpr} AS payment_model,
         ${prePaymentAmountExpr} AS pre_payment_amount,
         ${prePaymentDateExpr} AS pre_payment_date,
         ${prePaymentClearanceExpr} AS pre_payment_clearance,
         ${graduationDateExpr} AS graduation_date,
         ${withdrawalRequestedAtExpr} AS withdrawal_requested_at,
         ${updatedAtExpr} AS updated_at
       FROM public.students s
       WHERE s.student_id = $1
       LIMIT 1`,
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const hasDebtId = debtColumns.has('debt_id');
    const hasInitialAmount = debtColumns.has('initial_amount');
    const hasCurrentBalance = debtColumns.has('current_balance');
    const hasDebtAcademicYear = debtColumns.has('academic_year');
    const hasDebtUpdatedAt = debtColumns.has('updated_at');
    const hasDebtLastUpdated = debtColumns.has('last_updated');

    let latestDebt = null;

    if (hasDebtId && hasCurrentBalance) {
      const debtAcademicYearExpr = hasDebtAcademicYear ? 'dr.academic_year::text' : "'N/A'::text";
      const debtUpdatedExpr = hasDebtUpdatedAt
        ? 'dr.updated_at'
        : hasDebtLastUpdated
        ? 'dr.last_updated'
        : 'NULL::timestamp';

      const debtResult = await pool.query(
        `SELECT
           dr.debt_id,
           dr.student_id,
           ${hasInitialAmount ? 'dr.initial_amount' : 'NULL::numeric'} AS initial_amount,
           dr.current_balance,
           ${debtAcademicYearExpr} AS academic_year,
           ${debtUpdatedExpr} AS updated_at
         FROM public.debt_records dr
         WHERE dr.student_id = $1
         ORDER BY dr.debt_id DESC
         LIMIT 1`,
        [studentId]
      );

      latestDebt = debtResult.rows[0] || null;
    }

    const student = studentResult.rows[0];
    const paymentModel = normalizePaymentModel(student.payment_model);
    const prePaymentAmount = Number(student.pre_payment_amount || 0);
    const prePaymentCleared = Boolean(student.pre_payment_clearance);
    const debtBalance = latestDebt
      ? Number(latestDebt.current_balance ?? latestDebt.initial_amount ?? 0)
      : null;
    const currentBalance = paymentModel === 'pre_payment'
      ? (prePaymentCleared ? 0 : prePaymentAmount)
      : debtBalance;
    const hasOutstandingBalance = currentBalance !== null && currentBalance > 0;

    res.json({
      success: true,
      student: {
        ...student,
        payment_model: paymentModel,
        latest_debt: latestDebt,
        debt_summary: {
          has_debt_record: Boolean(latestDebt),
          current_balance: currentBalance,
          has_outstanding_balance: hasOutstandingBalance,
          pre_payment_amount: prePaymentAmount,
          pre_payment_clearance: prePaymentCleared,
          debt_status: latestDebt
            ? hasOutstandingBalance
              ? 'OUTSTANDING'
              : 'CLEARED'
            : 'UNKNOWN',
        },
      },
    });
  } catch (error) {
    console.error('Registrar student details error:', error);
    res.status(500).json({ error: 'Failed to load student details' });
  }
});

// POST /api/registrar/students/:id/withdrawal/process — registrar finalizes withdrawal
router.post('/students/:id/withdrawal/process', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'full_name',
      'department_withdrawal_approved',
      'withdrawal_status',
      'finance_withdrawal_approved',
      'registrar_withdrawal_processed',
      'enrollment_status',
      'updated_at',
    ]);

    if (!studentColumns.has('registrar_withdrawal_processed')) {
      return res.status(400).json({
        error: 'students withdrawal workflow columns are missing. Run withdrawal workflow migration first.',
      });
    }

    const fullNameExpr = studentColumns.has('full_name') ? 'full_name' : "''::text AS full_name";

    const selectCols = [fullNameExpr];
    if (studentColumns.has('department_withdrawal_approved')) selectCols.push('department_withdrawal_approved');
    if (studentColumns.has('withdrawal_status')) selectCols.push('withdrawal_status');
    if (studentColumns.has('finance_withdrawal_approved')) selectCols.push('finance_withdrawal_approved');
    selectCols.push('registrar_withdrawal_processed');

    const studentRes = await pool.query(
      `SELECT ${selectCols.join(', ')}
       FROM public.students
       WHERE student_id = $1
       LIMIT 1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];

    if (student.registrar_withdrawal_processed === true) {
      return res.status(409).json({ error: 'Withdrawal already processed' });
    }

    // Accept both the boolean flag and the legacy withdrawal_status field
    const withdrawalStatus = String(student.withdrawal_status || '').toLowerCase();
    const isDeptApproved = student.department_withdrawal_approved === true || withdrawalStatus === 'academic_approved';

    if (!isDeptApproved) {
      return res.status(400).json({ error: 'Department approval required first' });
    }

    const isFinanceApproved = student.finance_withdrawal_approved === true
      || withdrawalStatus === 'finance_approved';

    if (!isFinanceApproved) {
      return res.status(400).json({ error: 'Finance approval required before registrar can process withdrawal' });
    }

    // finance-approve already sets enrollment_status = WITHDRAWN, so only update if not already set
    const enrollmentRes = await pool.query(
      `SELECT enrollment_status FROM public.students WHERE student_id = $1 LIMIT 1`,
      [studentId]
    );
    const alreadyWithdrawn = String(enrollmentRes.rows[0]?.enrollment_status || '').toUpperCase() === 'WITHDRAWN';

    const setParts = ['registrar_withdrawal_processed = TRUE'];
    if (!alreadyWithdrawn) {
      setParts.push("enrollment_status = 'WITHDRAWN'");
    }
    if (studentColumns.has('updated_at')) {
      setParts.push('updated_at = NOW()');
    }

    await pool.query(
      `UPDATE public.students
       SET ${setParts.join(', ')}
       WHERE student_id = $1`,
      [studentId]
    );

    const settlement = await calculateFinalWithdrawalSettlement(studentId);

    // Notify the student that their withdrawal has been fully processed
    try {
      const studentUserRes = await pool.query(
        `SELECT u.user_id FROM public.students s
         JOIN public.users u ON s.user_id = u.user_id
         WHERE s.student_id = $1 LIMIT 1`,
        [studentId]
      );
      if (studentUserRes.rows.length > 0) {
        await sendPaymentNotification(
          studentUserRes.rows[0].user_id,
          'Withdrawal Processed',
          `Your withdrawal has been fully processed by the registrar. Final settlement balance: ${settlement.finalBalance} ETB.`,
          {
            type: 'WITHDRAWAL_PROCESSED',
            studentId: String(studentId),
            finalBalance: String(settlement.finalBalance),
          }
        );
      }
    } catch (notifError) {
      console.error('Failed to send withdrawal processed notification to student:', notifError);
    }

    return res.json({
      success: true,
      message: `Withdrawal processed for ${student.full_name || 'the student'}. Student marked as WITHDRAWN.`,
      settlement: {
        final_balance: settlement.finalBalance,
        calculation_mode: settlement.source,
      },
    });
  } catch (error) {
    console.error('Registrar withdrawal processing error:', error);
    return res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// PUT /api/registrar/students/:id/status — update student enrollment status
router.put('/students/:id/status', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const enrollmentStatus = String(req.body?.enrollment_status || '').trim().toUpperCase();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    if (!['ACTIVE', 'WITHDRAWN', 'GRADUATED'].includes(enrollmentStatus)) {
      return res.status(400).json({
        error: 'enrollment_status must be one of: active, withdrawn, graduated',
      });
    }

    const studentColumns = await getAvailableColumns('students', ['enrollment_status', 'updated_at']);

    if (!studentColumns.has('enrollment_status')) {
      return res.status(400).json({ error: 'students.enrollment_status column is missing' });
    }

    const updateSql = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET enrollment_status = $2, updated_at = NOW()
         WHERE student_id = $1
         RETURNING student_id, enrollment_status, updated_at`
      : `UPDATE public.students
         SET enrollment_status = $2
         WHERE student_id = $1
         RETURNING student_id, enrollment_status, NOW()::timestamp AS updated_at`;

    const result = await pool.query(updateSql, [studentId, enrollmentStatus]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      success: true,
      message: 'Enrollment status updated',
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Registrar enrollment status update error:', error);
    res.status(500).json({ error: 'Failed to update enrollment status' });
  }
});

router.put('/students/:id/clearance', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const clearanceStatus = String(req.body?.clearance_status || '').trim().toUpperCase();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    if (!['PENDING', 'CLEARED'].includes(clearanceStatus)) {
      return res.status(400).json({ error: 'clearance_status must be one of: pending, cleared' });
    }

    if (clearanceStatus === 'CLEARED') {
      const clearanceValidation = await validateClearanceAllowed(studentId);
      if (clearanceValidation.notFound) {
        return res.status(404).json({ error: 'Student not found' });
      }
      if (!clearanceValidation.allowed) {
        return res.status(400).json({ error: clearanceValidation.message });
      }
    }

    const studentColumns = await getAvailableColumns('students', ['clearance_status', 'updated_at', 'payment_model', 'pre_payment_clearance']);
    if (!studentColumns.has('clearance_status')) {
      return res.status(400).json({ error: 'students.clearance_status column is missing' });
    }

    const currentStudent = await pool.query(
      `SELECT
         ${studentColumns.has('payment_model') ? 'payment_model' : 'NULL::text'} AS payment_model,
         ${studentColumns.has('pre_payment_clearance') ? 'pre_payment_clearance' : 'NULL::boolean'} AS pre_payment_clearance
       FROM public.students
       WHERE student_id = $1
       LIMIT 1`,
      [studentId]
    );

    if (currentStudent.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const paymentModel = normalizePaymentModel(currentStudent.rows[0].payment_model);
    const shouldUpdatePrePaymentClearance = paymentModel === 'pre_payment' && studentColumns.has('pre_payment_clearance');

    const updateSql = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET clearance_status = $2${shouldUpdatePrePaymentClearance ? ', pre_payment_clearance = $3' : ''}, updated_at = NOW()
         WHERE student_id = $1
         RETURNING student_id, clearance_status, updated_at`
      : `UPDATE public.students
         SET clearance_status = $2${shouldUpdatePrePaymentClearance ? ', pre_payment_clearance = $3' : ''}
         WHERE student_id = $1
         RETURNING student_id, clearance_status, NOW()::timestamp AS updated_at`;

    const result = await pool.query(
      updateSql,
      shouldUpdatePrePaymentClearance
        ? [studentId, clearanceStatus, clearanceStatus === 'CLEARED']
        : [studentId, clearanceStatus]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Notify student when clearance is granted
    if (clearanceStatus === 'CLEARED') {
      // Mark withdrawal as completed
      try {
        const wsCols = await getAvailableColumns('students', ['withdrawal_status', 'updated_at']);
        if (wsCols.has('withdrawal_status')) {
          await pool.query(
            `UPDATE public.students SET withdrawal_status = 'completed'${wsCols.has('updated_at') ? ', updated_at = NOW()' : ''} WHERE student_id = $1`,
            [studentId]
          );
        }
      } catch (wsErr) {
        console.error('Failed to set withdrawal_status=completed:', wsErr);
      }

      try {
        const userRes = await pool.query(
          `SELECT u.user_id FROM public.students s
           JOIN public.users u ON s.user_id = u.user_id
           WHERE s.student_id = $1 LIMIT 1`,
          [studentId]
        );
        if (userRes.rows.length > 0) {
          await sendPaymentNotification(
            userRes.rows[0].user_id,
            'Withdrawal Cleared by Registrar ✅',
            'Your withdrawal has been fully processed and you have been granted clearance by the registrar. Your withdrawal is now complete.',
            { type: 'WITHDRAWAL_CLEARED', studentId: String(studentId) }
          );
        }
      } catch (notifErr) {
        console.error('Clearance notification failed:', notifErr);
      }
    }

    res.json({
      success: true,
      message: 'Clearance updated',
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Registrar clearance update error:', error);
    res.status(500).json({ error: 'Failed to update clearance status' });
  }
});

router.post('/students/:id/clear', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const clearanceValidation = await validateClearanceAllowed(studentId);
    if (clearanceValidation.notFound) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (!clearanceValidation.allowed) {
      return res.status(400).json({ error: clearanceValidation.message });
    }

    const studentColumns = await getAvailableColumns('students', ['clearance_status', 'updated_at']);
    if (!studentColumns.has('clearance_status')) {
      return res.status(400).json({ error: 'students.clearance_status column is missing' });
    }

    const updateSql = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET clearance_status = 'CLEARED', updated_at = NOW()
         WHERE student_id = $1
         RETURNING student_id, clearance_status, updated_at`
      : `UPDATE public.students
         SET clearance_status = 'CLEARED'
         WHERE student_id = $1
         RETURNING student_id, clearance_status, NOW()::timestamp AS updated_at`;

    const result = await pool.query(updateSql, [studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Notify student that clearance is granted
    try {
      // Mark withdrawal as completed
      const wsCols = await getAvailableColumns('students', ['withdrawal_status', 'updated_at']);
      if (wsCols.has('withdrawal_status')) {
        await pool.query(
          `UPDATE public.students SET withdrawal_status = 'completed'${wsCols.has('updated_at') ? ', updated_at = NOW()' : ''} WHERE student_id = $1`,
          [studentId]
        );
      }
    } catch (wsErr) {
      console.error('Failed to set withdrawal_status=completed:', wsErr);
    }

    try {
      const userRes = await pool.query(
        `SELECT u.user_id FROM public.students s
         JOIN public.users u ON s.user_id = u.user_id
         WHERE s.student_id = $1 LIMIT 1`,
        [studentId]
      );
      if (userRes.rows.length > 0) {
        await sendPaymentNotification(
          userRes.rows[0].user_id,
          'Withdrawal Cleared by Registrar ✅',
          'Your withdrawal has been fully processed and you have been granted clearance by the registrar. Your withdrawal is now complete.',
          { type: 'WITHDRAWAL_CLEARED', studentId: String(studentId) }
        );
      }
    } catch (notifErr) {
      console.error('Clearance notification failed:', notifErr);
    }

    res.json({
      success: true,
      message: 'Student marked as cleared',
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Registrar clear student error:', error);
    res.status(500).json({ error: 'Failed to mark student as cleared' });
  }
});

// GET /api/registrar/students/:id/financial-statement
// Returns a financial statement: semester breakdown OR withdrawal settlement
// Query param: type = 'semester' | 'withdrawal' (default: 'semester')
router.get('/students/:id/financial-statement', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const type = String(req.query.type || 'semester').toLowerCase();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const studentCols = await getAvailableColumns('students', [
      'full_name', 'student_number', 'department', 'campus',
      'enrollment_status', 'withdrawal_requested_at', 'tuition_share_percent',
      'payment_model', 'enrollment_date', 'created_at',
    ]);
    const debtCols = await getAvailableColumns('debt_records', [
      'debt_id', 'initial_amount', 'current_balance', 'academic_year', 'is_final_settlement',
    ]);

    const enrollmentDateExpr = studentCols.has('enrollment_date')
      ? 's.enrollment_date'
      : studentCols.has('created_at') ? 's.created_at' : 'NOW()::timestamp';

    const studentRes = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${studentCols.has('full_name') ? 's.full_name' : 'u.full_name'} AS full_name,
         ${studentCols.has('department') ? 's.department' : "''::text"} AS department,
         ${studentCols.has('campus') ? 's.campus' : "'Main Campus'::text"} AS campus,
         ${studentCols.has('enrollment_status') ? 's.enrollment_status' : "'ACTIVE'::text"} AS enrollment_status,
         ${studentCols.has('withdrawal_requested_at') ? 's.withdrawal_requested_at' : 'NULL::timestamp'} AS withdrawal_requested_at,
         ${studentCols.has('tuition_share_percent') ? 's.tuition_share_percent' : '15.00::numeric'} AS tuition_share_percent,
         ${studentCols.has('payment_model') ? "COALESCE(s.payment_model,'post_graduation')" : "'post_graduation'::text"} AS payment_model,
         ${enrollmentDateExpr} AS enrollment_date
       FROM public.students s
       LEFT JOIN public.users u ON s.user_id = u.user_id
       WHERE s.student_id = $1
       LIMIT 1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];

    // Fetch debt record
    const debtRes = await pool.query(
      `SELECT
         ${debtCols.has('debt_id') ? 'debt_id' : 'NULL::integer AS debt_id'},
         ${debtCols.has('initial_amount') ? 'initial_amount' : '0::numeric AS initial_amount'},
         ${debtCols.has('current_balance') ? 'current_balance' : '0::numeric AS current_balance'},
         ${debtCols.has('academic_year') ? 'academic_year' : "NULL::text AS academic_year"},
         ${debtCols.has('is_final_settlement') ? 'is_final_settlement' : 'FALSE::boolean AS is_final_settlement'}
       FROM public.debt_records
       WHERE student_id = $1
       ORDER BY debt_id DESC LIMIT 1`,
      [studentId]
    );
    const debt = debtRes.rows[0] || null;

    // Fetch payment history
    const paymentsRes = await pool.query(
      `SELECT ph.payment_id, ph.amount, ph.payment_method, ph.transaction_ref,
              ph.status, ph.payment_date
       FROM public.payment_history ph
       JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
       WHERE dr.student_id = $1
       ORDER BY ph.payment_date DESC`,
      [studentId]
    );
    const payments = paymentsRes.rows;

    // Fetch cost breakdown from semester_amounts or cost_shares
    let tuitionCostPerYear = 0;
    let boardingCostPerYear = 0;
    let foodCostPerMonth = 0;
    let academicYear = debt?.academic_year || null;
    const tuitionSharePercent = Number(student.tuition_share_percent || 15);

    const hasSemesterTable = (
      await pool.query(`SELECT to_regclass('public.semester_amounts') AS t`)
    ).rows[0]?.t;

    if (hasSemesterTable) {
      const semRes = await pool.query(
        `SELECT tuition_cost_per_year, boarding_cost_per_year, food_cost_per_month, academic_year
         FROM public.semester_amounts
         WHERE LOWER(COALESCE(campus,'main campus')) = LOWER($1)
         ORDER BY effective_from DESC NULLS LAST, id DESC LIMIT 1`,
        [student.campus || 'Main Campus']
      );
      if (semRes.rows.length > 0) {
        tuitionCostPerYear = Number(semRes.rows[0].tuition_cost_per_year || 0);
        boardingCostPerYear = Number(semRes.rows[0].boarding_cost_per_year || 0);
        foodCostPerMonth = Number(semRes.rows[0].food_cost_per_month || 0);
        academicYear = academicYear || semRes.rows[0].academic_year;
      }
    }

    const tuitionShare = tuitionCostPerYear * (tuitionSharePercent / 100);
    const foodAnnual = foodCostPerMonth * 10;
    const totalAnnualObligation = tuitionShare + boardingCostPerYear + foodAnnual;

    const totalPaid = payments
      .filter(p => ['SUCCESS', 'APPROVED', 'success', 'approved'].includes(String(p.status)))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const currentBalance = Number(debt?.current_balance || 0);

    let statementData;

    if (type === 'withdrawal') {
      // Prorated settlement up to withdrawal request date
      const cutoffDate = student.withdrawal_requested_at
        ? new Date(student.withdrawal_requested_at)
        : new Date();
      const enrollmentDate = student.enrollment_date
        ? new Date(student.enrollment_date)
        : new Date();

      const daysEnrolled = Math.max(1, Math.ceil(
        (cutoffDate.getTime() - enrollmentDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
      const monthsEnrolled = Math.max(1, Math.ceil(daysEnrolled / 30));
      const academicYearDays = 300;

      const proratedTuition = tuitionShare * (daysEnrolled / academicYearDays);
      const proratedBoarding = boardingCostPerYear * (daysEnrolled / academicYearDays);
      const proratedFood = foodCostPerMonth * monthsEnrolled;
      const settlementAmount = Number((proratedTuition + proratedBoarding + proratedFood).toFixed(2));
      const settlementBalance = Math.max(0, settlementAmount - totalPaid);

      statementData = {
        type: 'withdrawal',
        withdrawalRequestedAt: student.withdrawal_requested_at,
        enrollmentDate: student.enrollment_date,
        daysEnrolled,
        monthsEnrolled,
        proratedTuition: Number(proratedTuition.toFixed(2)),
        proratedBoarding: Number(proratedBoarding.toFixed(2)),
        proratedFood: Number(proratedFood.toFixed(2)),
        settlementAmount,
        totalPaid: Number(totalPaid.toFixed(2)),
        settlementBalance,
        isSettled: settlementBalance <= 0,
      };
    } else {
      // Semester statement
      statementData = {
        type: 'semester',
        academicYear,
        tuitionFullCost: tuitionCostPerYear,
        tuitionSharePercent,
        tuitionStudentShare: Number(tuitionShare.toFixed(2)),
        boardingCost: boardingCostPerYear,
        foodCostMonthly: foodCostPerMonth,
        foodCostAnnual: Number(foodAnnual.toFixed(2)),
        totalObligation: Number(totalAnnualObligation.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        currentBalance,
        isCleared: currentBalance <= 0,
      };
    }

    res.json({
      success: true,
      student: {
        studentId: student.student_id,
        studentNumber: student.student_number,
        fullName: student.full_name,
        department: student.department,
        campus: student.campus,
        enrollmentStatus: student.enrollment_status,
        paymentModel: normalizePaymentModel(student.payment_model),
      },
      statement: statementData,
      payments,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financial statement error:', error);
    res.status(500).json({ error: 'Failed to generate financial statement' });
  }
});

// GET /api/registrar/withdrawals/pending-finance — list withdrawals awaiting finance approval
router.get('/withdrawals/pending-finance', async (req, res) => {
  try {
    const studentCols = await getAvailableColumns('students', [
      'full_name', 'student_number', 'department', 'campus',
      'withdrawal_requested_at', 'withdrawal_status', 'department_withdrawal_approved',
      'finance_withdrawal_approved',
    ]);

    const fullNameExpr = studentCols.has('full_name') ? 's.full_name' : 'u.full_name';
    const financeApprovedExpr = studentCols.has('finance_withdrawal_approved')
      ? 's.finance_withdrawal_approved'
      : 'NULL::boolean AS finance_withdrawal_approved';

    // Students where dept approved but finance hasn't approved yet
    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${fullNameExpr} AS full_name,
         ${studentCols.has('department') ? 's.department' : "''::text"} AS department,
         ${studentCols.has('campus') ? 's.campus' : "'Main Campus'::text"} AS campus,
         ${studentCols.has('withdrawal_requested_at') ? 's.withdrawal_requested_at' : 'NULL::timestamp'} AS withdrawal_requested_at,
         ${studentCols.has('withdrawal_status') ? 's.withdrawal_status' : "NULL::text"} AS withdrawal_status,
         ${financeApprovedExpr},
         dr.current_balance
       FROM public.students s
       LEFT JOIN public.users u ON s.user_id = u.user_id
       LEFT JOIN public.debt_records dr ON dr.student_id = s.student_id
       WHERE (
         s.department_withdrawal_approved = TRUE
         OR ${studentCols.has('withdrawal_status') ? "s.withdrawal_status = 'academic_approved'" : 'FALSE'}
       )
       AND (
         ${studentCols.has('finance_withdrawal_approved')
           ? 's.finance_withdrawal_approved IS NOT TRUE'
           : 'TRUE'}
       )
       ORDER BY s.student_id DESC`,
      []
    );

    res.json({ success: true, withdrawals: result.rows });
  } catch (error) {
    console.error('Pending finance withdrawals error:', error);
    res.status(500).json({ error: 'Failed to load pending withdrawals' });
  }
});

// POST /api/registrar/students/:id/withdrawal/finance-approve
// Finance approves withdrawal after confirming full payment
router.post('/students/:id/withdrawal/finance-approve', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    // Ensure finance_withdrawal_approved column exists
    await pool.query(`
      ALTER TABLE public.students
      ADD COLUMN IF NOT EXISTS finance_withdrawal_approved BOOLEAN DEFAULT NULL
    `);

    const studentCols = await getAvailableColumns('students', [
      'full_name', 'department_withdrawal_approved', 'withdrawal_status',
      'finance_withdrawal_approved', 'updated_at',
    ]);

    const studentRes = await pool.query(
      `SELECT
         ${studentCols.has('full_name') ? 'full_name' : "''::text AS full_name"},
         ${studentCols.has('department_withdrawal_approved') ? 'department_withdrawal_approved' : 'NULL::boolean AS department_withdrawal_approved'},
         ${studentCols.has('withdrawal_status') ? 'withdrawal_status' : "NULL::text AS withdrawal_status"},
         ${studentCols.has('finance_withdrawal_approved') ? 'finance_withdrawal_approved' : 'NULL::boolean AS finance_withdrawal_approved'}
       FROM public.students
       WHERE student_id = $1 LIMIT 1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];
    const withdrawalStatus = String(student.withdrawal_status || '').toLowerCase();
    const isDeptApproved = student.department_withdrawal_approved === true
      || withdrawalStatus === 'academic_approved';

    if (!isDeptApproved) {
      return res.status(400).json({ error: 'Department approval required before finance can approve' });
    }

    if (student.finance_withdrawal_approved === true) {
      return res.status(409).json({ error: 'Finance has already approved this withdrawal' });
    }

    // Verify the student has zero outstanding balance
    const debtRes = await pool.query(
      `SELECT current_balance FROM public.debt_records
       WHERE student_id = $1 ORDER BY debt_id DESC LIMIT 1`,
      [studentId]
    );
    const balance = debtRes.rows.length > 0 ? Number(debtRes.rows[0].current_balance || 0) : 0;

    if (balance > 0) {
      return res.status(400).json({
        error: `Student still has an outstanding balance of ${balance} ETB. Full payment required before finance approval.`,
        outstandingBalance: balance,
      });
    }

    // Mark finance approved, update withdrawal_status, and set enrollment to WITHDRAWN
    const enrollmentCols = await getAvailableColumns('students', ['enrollment_status', 'registrar_withdrawal_processed']);
    const setParts = ['finance_withdrawal_approved = TRUE'];
    if (studentCols.has('withdrawal_status')) {
      setParts.push("withdrawal_status = 'finance_approved'");
    }
    if (enrollmentCols.has('enrollment_status')) {
      setParts.push("enrollment_status = 'WITHDRAWN'");
    }
    if (enrollmentCols.has('registrar_withdrawal_processed')) {
      setParts.push('registrar_withdrawal_processed = TRUE');
    }
    if (studentCols.has('updated_at')) {
      setParts.push('updated_at = NOW()');
    }

    await pool.query(
      `UPDATE public.students SET ${setParts.join(', ')} WHERE student_id = $1`,
      [studentId]
    );

    // Run the final settlement calculation so is_final_settlement is set
    // before the registrar attempts clearance
    try {
      await calculateFinalWithdrawalSettlement(studentId);
    } catch (settlementErr) {
      console.error('Settlement calculation failed during finance approval:', settlementErr);
      // Non-fatal — registrar clearance will retry automatically
    }

    // Notify student
    try {
      const userRes = await pool.query(
        `SELECT u.user_id FROM public.students s
         JOIN public.users u ON s.user_id = u.user_id
         WHERE s.student_id = $1 LIMIT 1`,
        [studentId]
      );
      if (userRes.rows.length > 0) {
        await sendPaymentNotification(
          userRes.rows[0].user_id,
          'Finance Approved Your Withdrawal',
          'Your payment has been confirmed and your withdrawal has been approved by finance. The registrar will finalize your withdrawal shortly.',
          { type: 'WITHDRAWAL_FINANCE_APPROVED', studentId: String(studentId) }
        );
      }
    } catch (notifErr) {
      console.error('Notification failed:', notifErr);
    }

    // Notify registrar(s)
    try {
      const registrars = await pool.query(
        `SELECT user_id FROM public.users WHERE UPPER(role) IN ('REGISTRAR', 'REGISTRY')`
      );
      for (const reg of registrars.rows) {
        await sendPaymentNotification(
          reg.user_id,
          'Withdrawal Ready for Processing',
          `Student ${student.full_name || ''} has been finance-approved for withdrawal. Please finalize.`,
          { type: 'WITHDRAWAL_READY_FOR_REGISTRAR', studentId: String(studentId) }
        );
      }
    } catch (notifErr) {
      console.error('Registrar notification failed:', notifErr);
    }

    res.json({
      success: true,
      message: `Finance approval granted for ${student.full_name || 'student'}. Registrar can now finalize.`,
    });
  } catch (error) {
    console.error('Finance withdrawal approval error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

// POST /api/registrar/students/:id/withdrawal/notify-payment
// Finance sends a payment reminder to the student
router.post('/students/:id/withdrawal/notify-payment', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    // Get student name and current balance
    const studentRes = await pool.query(
      `SELECT
         ${(await getAvailableColumns('students', ['full_name'])).has('full_name') ? 's.full_name' : 'u.full_name'} AS full_name,
         dr.current_balance
       FROM public.students s
       LEFT JOIN public.users u ON s.user_id = u.user_id
       LEFT JOIN public.debt_records dr ON dr.student_id = s.student_id
       WHERE s.student_id = $1
       ORDER BY dr.debt_id DESC
       LIMIT 1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const balance = Number(studentRes.rows[0].current_balance || 0);
    const name = studentRes.rows[0].full_name || 'Student';

    // Look up the student's user_id
    const userRes = await pool.query(
      `SELECT u.user_id FROM public.students s
       JOIN public.users u ON s.user_id = u.user_id
       WHERE s.student_id = $1 LIMIT 1`,
      [studentId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student user account not found' });
    }

    const balanceFormatted = new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(balance);

    await sendPaymentNotification(
      userRes.rows[0].user_id,
      'Payment Required for Withdrawal',
      balance > 0
        ? `Your withdrawal has been reviewed. Please pay your outstanding balance of ${balanceFormatted} to proceed with your withdrawal.`
        : 'Your withdrawal has been reviewed by finance. Please check your account status.',
      {
        type: 'WITHDRAWAL_PAYMENT_REMINDER',
        studentId: String(studentId),
        outstandingBalance: String(balance),
      }
    );

    res.json({
      success: true,
      message: `Payment reminder sent to ${name}`,
      outstandingBalance: balance,
    });
  } catch (error) {
    console.error('Withdrawal payment notification error:', error);
    res.status(500).json({ error: 'Failed to send payment reminder' });
  }
});

module.exports = router;