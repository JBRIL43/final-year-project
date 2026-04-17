const express = require('express');
const pool = require('../config/db');

const router = express.Router();

function normalizeLivingArrangement(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ON-CAMPUS' || normalized === 'ON_CAMPUS') return 'ON_CAMPUS';
  if (normalized === 'OFF-CAMPUS' || normalized === 'OFF_CAMPUS') return 'CASH_STIPEND';
  if (normalized === 'WITH FAMILY' || normalized === 'WITH_FAMILY') return 'CASH_STIPEND';
  if (normalized === 'CASH_STIPEND') return 'CASH_STIPEND';
  return 'ON_CAMPUS';
}

function normalizeEnrollmentStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'GRADUATED') return 'GRADUATED';
  if (normalized === 'WITHDRAWN') return 'WITHDRAWN';
  if (normalized === 'SUSPENDED') return 'WITHDRAWN';
  return 'ACTIVE';
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

function resolveStatusMode(sampleStatus) {
  const value = String(sampleStatus || '').trim();
  if (!value) {
    return {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
    };
  }

  const isUpperCase = value === value.toUpperCase();
  if (isUpperCase) {
    return {
      pending: 'PENDING',
      approved: 'SUCCESS',
      rejected: 'FAILED',
    };
  }

  return {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
  };
}

async function ensureContractsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.contracts (
      contract_id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
      CONSTRAINT contracts_student_id_key UNIQUE (student_id),
      university_name VARCHAR(100) NOT NULL DEFAULT 'Hawassa University',
      program VARCHAR(100) NOT NULL,
      academic_year VARCHAR(9) NOT NULL,
      tuition_share_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
      boarding_full_cost BOOLEAN NOT NULL DEFAULT true,
      signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_contracts_student_id ON public.contracts(student_id)'
  );

  await client.query(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_student_id ON public.contracts(student_id)'
  );

  await client.query(`
    CREATE OR REPLACE FUNCTION public.create_contract_for_new_student()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      current_year integer;
      academic_year_text varchar(9);
    BEGIN
      current_year := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
      academic_year_text := current_year::text || '/' || (current_year + 1)::text;

      INSERT INTO public.contracts (
        student_id,
        university_name,
        program,
        academic_year,
        tuition_share_percent,
        boarding_full_cost,
        signed_at,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        NEW.student_id,
        'Hawassa University',
        COALESCE(NEW.department, 'Unknown Program'),
        academic_year_text,
        15.00,
        true,
        NOW(),
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (student_id) DO NOTHING;

      RETURN NEW;
    END;
    $$;
  `);

  await client.query(
    'DROP TRIGGER IF EXISTS trg_create_contract_for_new_student ON public.students'
  );

  await client.query(`
    CREATE TRIGGER trg_create_contract_for_new_student
    AFTER INSERT ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.create_contract_for_new_student();
  `);
}

router.get('/students', async (req, res) => {
  console.log('✅ Admin students route hit');
  try {
    const columnsResult = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = ANY($1::text[])`,
      [[
        'full_name',
        'email',
        'enrollment_year',
        'batch_year',
        'updated_at',
      ]]
    );

    const availableColumns = new Set(
      columnsResult.rows.map((row) => row.column_name)
    );

    const hasStudentFullName = availableColumns.has('full_name');
    const hasStudentEmail = availableColumns.has('email');
    const hasEnrollmentYear = availableColumns.has('enrollment_year');
    const hasBatchYear = availableColumns.has('batch_year');
    const hasUpdatedAt = availableColumns.has('updated_at');

    const fullNameExpr = hasStudentFullName
      ? 's.full_name'
      : 'u.full_name';
    const emailExpr = hasStudentEmail ? 's.email' : 'u.email';
    const yearExpr = hasEnrollmentYear
      ? 's.enrollment_year'
      : hasBatchYear
      ? 's.batch_year'
      : 'NULL::integer';
    const updatedAtExpr = hasUpdatedAt
      ? 's.updated_at'
      : 'NULL::timestamp';
    const needsUsersJoin = !hasStudentFullName || !hasStudentEmail;

    const result = await pool.query(`
      SELECT
        s.student_id,
        s.user_id,
        s.student_number,
        ${fullNameExpr} AS full_name,
        ${emailExpr} AS email,
        s.department,
        ${yearExpr} AS enrollment_year,
        s.living_arrangement,
        s.enrollment_status,
        s.created_at,
        ${updatedAtExpr} AS updated_at
      FROM public.students s
      ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
      ORDER BY s.student_number
    `);

    console.log('✅ Fetched', result.rows.length, 'students');
    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('❌ Admin students route ERROR:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({ error: 'Failed to fetch students', details: error.message });
  }
});

// POST /api/admin/students — create new student + auto-create contract
router.post('/students', async (req, res) => {
  let client;
  try {
    const {
      student_number,
      full_name,
      email,
      department,
      enrollment_year,
      living_arrangement = 'On-Campus',
      enrollment_status = 'Active',
    } = req.body;

    if (!student_number || !full_name || !email || !department || !enrollment_year) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    await ensureContractsTable(client);

    const existing = await client.query(
      'SELECT student_id FROM public.students WHERE student_number = $1 OR email = $2 LIMIT 1',
      [student_number, email]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Student ID or email already exists' });
    }

    const existingUser = await client.query(
      'SELECT user_id FROM public.users WHERE email = $1 LIMIT 1',
      [email]
    );

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].user_id;
    } else {
      const firebaseUid = `local-${student_number}-${Date.now()}`;
      const userResult = await client.query(
        `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at)
         VALUES ($1, $2, $3, 'STUDENT', NOW())
         RETURNING user_id`,
        [firebaseUid, email, full_name]
      );
      userId = userResult.rows[0].user_id;
    }

    const columnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = ANY($1::text[])`,
      [['updated_at']]
    );

    const hasUpdatedAt = columnsResult.rows.some((row) => row.column_name === 'updated_at');

    const insertSql = hasUpdatedAt
      ? `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, living_arrangement, enrollment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`
      : `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, living_arrangement, enrollment_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`;

    const studentResult = await client.query(insertSql, [
      userId,
      student_number,
      full_name,
      email,
      department,
      Number(enrollment_year),
      normalizeLivingArrangement(living_arrangement),
      normalizeEnrollmentStatus(enrollment_status),
    ]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, student: studentResult.rows[0] });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Create student + contract error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to create student and contract' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { living_arrangement, enrollment_status, department } = req.body;

    if (!living_arrangement || !enrollment_status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `UPDATE public.students
       SET
         living_arrangement = $1,
         enrollment_status = $2,
         department = $3
       WHERE student_id = $4
       RETURNING *`,
      [living_arrangement, enrollment_status, department, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, student: result.rows[0] });
  } catch (error) {
    console.error('Update student error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// POST /api/admin/students/batch-update — bulk update selected students
router.post('/students/batch-update', async (req, res) => {
  try {
    const { studentIds, updates } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'studentIds must be a non-empty array' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'At least one field to update is required' });
    }

    const normalizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'living_arrangement')) {
      normalizedUpdates.living_arrangement = normalizeLivingArrangement(
        normalizedUpdates.living_arrangement
      );
    }
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'enrollment_status')) {
      normalizedUpdates.enrollment_status = normalizeEnrollmentStatus(
        normalizedUpdates.enrollment_status
      );
    }

    // Build dynamic SET clause
    const allowedFields = ['living_arrangement', 'enrollment_status', 'department'];
    const setFields = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (field in normalizedUpdates) {
        setFields.push(`${field} = $${paramIndex}`);
        values.push(normalizedUpdates[field]);
        paramIndex++;
      }
    }

    if (setFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const hasUpdatedAt = (await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = 'updated_at'
       LIMIT 1`
    )).rows.length > 0;

    // Add student IDs to values
    const idPlaceholders = studentIds.map((_, i) => `$${paramIndex + i}`).join(',');
    const finalValues = [...values, ...studentIds];

    const query = `
      UPDATE students
      SET ${setFields.join(', ')}${hasUpdatedAt ? ', updated_at = NOW()' : ''}
      WHERE student_id IN (${idPlaceholders})
      RETURNING student_id
    `;

    const result = await pool.query(query, finalValues);

    res.json({
      success: true,
      updatedCount: result.rowCount,
      message: `Updated ${result.rowCount} student(s)`
    });
  } catch (error) {
    console.error('Batch update error:', error);
    res.status(500).json({ error: 'Failed to batch update students' });
  }
});

// GET /api/admin/analytics/debt-overview — debt & collection summary
router.get('/analytics/debt-overview', async (req, res) => {
  try {
    // Total collections (approved/success payments across schema variants)
    const collectionsResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_collections
      FROM payment_history
      WHERE UPPER(COALESCE(status, '')) IN ('APPROVED', 'SUCCESS')
    `);

    // Total outstanding debt (unpaid balances)
    const debtResult = await pool.query(`
      SELECT COALESCE(SUM(current_balance), 0) AS outstanding_debt
      FROM debt_records
      WHERE current_balance > 0
    `);

    res.json({
      success: true,
      data: {
        totalCollections: parseFloat(collectionsResult.rows[0].total_collections),
        outstandingDebt: parseFloat(debtResult.rows[0].outstanding_debt),
      },
    });
  } catch (error) {
    console.error('Debt analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch debt analytics' });
  }
});

// GET /api/admin/payments/pending — fetch all pending payments
router.get('/payments/pending', async (req, res) => {
  try {
    const paymentCols = await getAvailableColumns('payment_history', [
      'student_id',
      'debt_id',
      'proof_url',
      'transaction_ref',
      'submitted_at',
      'payment_date',
      'notes',
    ]);
    const studentCols = await getAvailableColumns('students', ['full_name', 'email', 'user_id']);
    const userCols = await getAvailableColumns('users', ['full_name', 'email']);
    const debtCols = await getAvailableColumns('debt_records', ['student_id']);

    const hasPhStudentId = paymentCols.has('student_id');
    const hasPhDebtId = paymentCols.has('debt_id');
    const hasProofUrl = paymentCols.has('proof_url');
    const hasTransactionRef = paymentCols.has('transaction_ref');
    const hasSubmittedAt = paymentCols.has('submitted_at');
    const hasPaymentDate = paymentCols.has('payment_date');
    const hasNotes = paymentCols.has('notes');

    const hasStudentFullName = studentCols.has('full_name');
    const hasStudentEmail = studentCols.has('email');
    const hasStudentUserId = studentCols.has('user_id');
    const hasUserFullName = userCols.has('full_name');
    const hasUserEmail = userCols.has('email');
    const hasDebtStudentId = debtCols.has('student_id');

    const joinDebt = !hasPhStudentId && hasPhDebtId;
    const joinStudents = hasPhStudentId || (joinDebt && hasDebtStudentId);
    const joinUsers = joinStudents && hasStudentUserId && (!hasStudentFullName || !hasStudentEmail);

    const studentIdExpr = hasPhStudentId
      ? 'ph.student_id'
      : joinDebt && hasDebtStudentId
      ? 'dr.student_id'
      : 'NULL::integer';

    const fullNameExpr = joinStudents
      ? hasStudentFullName
        ? 's.full_name'
        : joinUsers && hasUserFullName
        ? 'u.full_name'
        : "''::text"
      : "''::text";

    const emailExpr = joinStudents
      ? hasStudentEmail
        ? 's.email'
        : joinUsers && hasUserEmail
        ? 'u.email'
        : "''::text"
      : "''::text";

    const proofExpr = hasProofUrl
      ? 'ph.proof_url'
      : hasTransactionRef
      ? 'ph.transaction_ref'
      : 'NULL::text';

    const submittedExpr = hasSubmittedAt
      ? 'ph.submitted_at'
      : hasPaymentDate
      ? 'ph.payment_date'
      : 'NOW()';

    const result = await pool.query(`
      SELECT
        ph.payment_id,
        ${studentIdExpr} AS student_id,
        ${fullNameExpr} AS full_name,
        ${joinStudents ? 's.student_number' : 'NULL::text'} AS student_number,
        ${emailExpr} AS email,
        ph.amount,
        ${proofExpr} AS proof_url,
        ${submittedExpr} AS submitted_at,
        ph.status,
        ${hasNotes ? 'ph.notes' : 'NULL::text'} AS notes
      FROM public.payment_history ph
      ${joinDebt ? 'LEFT JOIN public.debt_records dr ON ph.debt_id = dr.debt_id' : ''}
      ${joinStudents ? `LEFT JOIN public.students s ON ${hasPhStudentId ? 'ph.student_id' : 'dr.student_id'} = s.student_id` : ''}
      ${joinUsers ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
      WHERE UPPER(COALESCE(ph.status, '')) = 'PENDING'
      ORDER BY submitted_at DESC
    `);
    res.json({ success: true, payments: result.rows });
  } catch (error) {
    console.error('Fetch pending payments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// POST /api/admin/payments/:id/approve — approve a payment
router.post('/payments/:id/approve', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;
    const { notes = '' } = req.body;

    const paymentCols = await getAvailableColumns('payment_history', [
      'student_id',
      'debt_id',
      'reviewed_at',
      'notes',
    ]);
    const debtCols = await getAvailableColumns('debt_records', [
      'student_id',
      'updated_at',
      'last_updated',
    ]);

    const hasPhStudentId = paymentCols.has('student_id');
    const hasPhDebtId = paymentCols.has('debt_id');
    const hasReviewedAt = paymentCols.has('reviewed_at');
    const hasNotes = paymentCols.has('notes');
    const hasDebtStudentId = debtCols.has('student_id');
    const hasDebtUpdatedAt = debtCols.has('updated_at');
    const hasDebtLastUpdated = debtCols.has('last_updated');

    // Start transaction on a single client connection
    await client.query('BEGIN');

    // Get payment and student info
    const paymentRes = await client.query(
      `SELECT
         amount,
         status,
         ${hasPhStudentId ? 'student_id' : 'NULL::integer AS student_id'},
         ${hasPhDebtId ? 'debt_id' : 'NULL::integer AS debt_id'}
       FROM payment_history
       WHERE payment_id = $1
         AND UPPER(COALESCE(status, '')) = 'PENDING'`,
      [id]
    );
    if (paymentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending payment not found' });
    }

    const { student_id, debt_id, amount, status } = paymentRes.rows[0];
    const statusMode = resolveStatusMode(status);

    // Update payment status
    const paymentSetClauses = [`status = $1`];
    const paymentValues = [statusMode.approved];
    let paymentParamIndex = 2;

    if (hasReviewedAt) {
      paymentSetClauses.push('reviewed_at = NOW()');
    }
    if (hasNotes) {
      paymentSetClauses.push(`notes = $${paymentParamIndex}`);
      paymentValues.push(notes);
      paymentParamIndex += 1;
    }
    paymentValues.push(id);

    await client.query(
      `UPDATE payment_history
       SET ${paymentSetClauses.join(', ')}
       WHERE payment_id = $${paymentParamIndex}`,
      paymentValues
    );

    // Reduce student's current debt balance
    const debtSetClauses = ['current_balance = GREATEST(0, current_balance - $1)'];
    if (hasDebtUpdatedAt) {
      debtSetClauses.push('updated_at = NOW()');
    } else if (hasDebtLastUpdated) {
      debtSetClauses.push('last_updated = NOW()');
    }

    let debtWhereClause = '';
    let debtWhereValue;
    if (hasPhDebtId && debt_id != null) {
      debtWhereClause = 'debt_id = $2';
      debtWhereValue = debt_id;
    } else if (hasDebtStudentId && student_id != null) {
      debtWhereClause = 'student_id = $2';
      debtWhereValue = student_id;
    } else {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Unable to resolve debt record for this payment' });
    }

    await client.query(
      `UPDATE debt_records
       SET ${debtSetClauses.join(', ')}
       WHERE ${debtWhereClause}`,
      [amount, debtWhereValue]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Payment approved and debt updated' });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Approve payment error:', error);
    res.status(500).json({ error: 'Failed to approve payment' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/admin/payments/:id/reject — reject a payment
router.post('/payments/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = '' } = req.body;

    const paymentCols = await getAvailableColumns('payment_history', ['reviewed_at', 'notes']);
    const hasReviewedAt = paymentCols.has('reviewed_at');
    const hasNotes = paymentCols.has('notes');

    const paymentRes = await pool.query(
      `SELECT status
       FROM payment_history
       WHERE payment_id = $1
         AND UPPER(COALESCE(status, '')) = 'PENDING'`,
      [id]
    );

    if (paymentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pending payment not found' });
    }

    const statusMode = resolveStatusMode(paymentRes.rows[0].status);
    const setClauses = ['status = $1'];
    const values = [statusMode.rejected];
    let paramIndex = 2;

    if (hasReviewedAt) {
      setClauses.push('reviewed_at = NOW()');
    }
    if (hasNotes) {
      setClauses.push(`notes = $${paramIndex}`);
      values.push(notes);
      paramIndex += 1;
    }
    values.push(id);

    const result = await pool.query(
      `UPDATE payment_history
       SET ${setClauses.join(', ')}
       WHERE payment_id = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pending payment not found' });
    }

    res.json({ success: true, message: 'Payment rejected' });
  } catch (error) {
    console.error('Reject payment error:', error);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// DELETE /api/admin/students/:id — delete student and associated user
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const studentResult = await pool.query(
      'SELECT user_id FROM public.students WHERE student_id = $1',
      [id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const userId = studentResult.rows[0].user_id;

    await pool.query('DELETE FROM public.students WHERE student_id = $1', [id]);

    if (userId) {
      await pool.query('DELETE FROM public.users WHERE user_id = $1', [userId]);
    }

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

module.exports = router;
