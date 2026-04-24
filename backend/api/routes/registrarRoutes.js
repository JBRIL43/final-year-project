const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

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

      if (!studentNumber || !fullName || !email || !program || !campus) {
        errors.push(`Missing required fields for row with Student ID: ${studentNumber || '(empty)'}`);
        continue;
      }

      if (Number.isFinite(credits) && credits < 0) {
        errors.push(`Invalid credits for ${studentNumber}: must be non-negative`);
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
    const debtBalance = latestDebt
      ? Number(latestDebt.current_balance ?? latestDebt.initial_amount ?? 0)
      : null;
    const hasOutstandingBalance = debtBalance !== null && debtBalance > 0;

    res.json({
      success: true,
      student: {
        ...student,
        latest_debt: latestDebt,
        debt_summary: {
          has_debt_record: Boolean(latestDebt),
          current_balance: debtBalance,
          has_outstanding_balance: hasOutstandingBalance,
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
      'registrar_withdrawal_processed',
      'enrollment_status',
      'updated_at',
    ]);

    if (!studentColumns.has('department_withdrawal_approved') || !studentColumns.has('registrar_withdrawal_processed')) {
      return res.status(400).json({
        error: 'students withdrawal workflow columns are missing. Run withdrawal workflow migration first.',
      });
    }

    const fullNameExpr = studentColumns.has('full_name') ? 'full_name' : "''::text AS full_name";

    const studentRes = await pool.query(
      `SELECT
         ${fullNameExpr},
         department_withdrawal_approved,
         registrar_withdrawal_processed
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

    if (student.department_withdrawal_approved !== true) {
      return res.status(400).json({ error: 'Department approval required first' });
    }

    const setParts = [
      "enrollment_status = 'WITHDRAWN'",
      'registrar_withdrawal_processed = TRUE',
    ];
    if (studentColumns.has('updated_at')) {
      setParts.push('updated_at = NOW()');
    }

    await pool.query(
      `UPDATE public.students
       SET ${setParts.join(', ')}
       WHERE student_id = $1`,
      [studentId]
    );

    return res.json({
      success: true,
      message: `Withdrawal processed for ${student.full_name || 'the student'}. Student marked as WITHDRAWN.`,
    });
  } catch (error) {
    console.error('Registrar withdrawal processing error:', error);
    return res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

// PUT /api/registrar/students/:id/credits — update credits and auto-calculate tuition share
router.put('/students/:id/credits', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    let { credits_registered } = req.body || {};

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'credits_registered',
      'tuition_share_percent',
      'updated_at',
    ]);

    if (!studentColumns.has('credits_registered') || !studentColumns.has('tuition_share_percent')) {
      return res.status(400).json({
        error: 'students credit columns are missing. Run the credit load migration first.',
      });
    }

    if (credits_registered === '') {
      credits_registered = null;
    }

    if (credits_registered !== null && credits_registered !== undefined) {
      credits_registered = Number.parseInt(credits_registered, 10);
      if (!Number.isFinite(credits_registered) || credits_registered < 0) {
        return res.status(400).json({ error: 'Invalid credits' });
      }
    }

    let tuitionSharePercent = 15.0;
    if (credits_registered !== null && credits_registered !== undefined) {
      if (credits_registered >= 15) tuitionSharePercent = 15.0;
      else if (credits_registered >= 12) tuitionSharePercent = 11.25;
      else if (credits_registered >= 8) tuitionSharePercent = 7.5;
      else tuitionSharePercent = 3.75;
    }

    const updateSql = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET credits_registered = $1,
             tuition_share_percent = $2,
             updated_at = NOW()
         WHERE student_id = $3
         RETURNING student_id, credits_registered, tuition_share_percent, updated_at`
      : `UPDATE public.students
         SET credits_registered = $1,
             tuition_share_percent = $2
         WHERE student_id = $3
         RETURNING student_id, credits_registered, tuition_share_percent, NOW()::timestamp AS updated_at`;

    const result = await pool.query(updateSql, [credits_registered, tuitionSharePercent, studentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json({
      success: true,
      message: 'Credits and tuition share updated',
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Credits update error:', error);
    return res.status(500).json({ error: 'Failed to update credits' });
  }
});

router.put('/students/:id/clearance', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const clearanceStatus = String(req.body?.clearance_status || '').trim().toUpperCase();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    if (!['PENDING', 'CLEARED', 'WAIVED'].includes(clearanceStatus)) {
      return res.status(400).json({ error: 'clearance_status must be one of: pending, cleared, waived' });
    }

    const studentColumns = await getAvailableColumns('students', ['clearance_status', 'updated_at']);
    if (!studentColumns.has('clearance_status')) {
      return res.status(400).json({ error: 'students.clearance_status column is missing' });
    }

    const updateSql = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET clearance_status = $2, updated_at = NOW()
         WHERE student_id = $1
         RETURNING student_id, clearance_status, updated_at`
      : `UPDATE public.students
         SET clearance_status = $2
         WHERE student_id = $1
         RETURNING student_id, clearance_status, NOW()::timestamp AS updated_at`;

    const result = await pool.query(updateSql, [studentId, clearanceStatus]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
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

module.exports = router;
