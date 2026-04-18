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

function normalizeCampus(value) {
  const raw = String(value || '').trim();
  return raw || 'Main Campus';
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
        'campus',
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
    const hasCampus = availableColumns.has('campus');
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
    const campusExpr = hasCampus ? 's.campus' : "'Main Campus'::text";
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
        ${campusExpr} AS campus,
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
      campus = 'Main Campus',
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
      [['updated_at', 'campus']]
    );

    const hasUpdatedAt = columnsResult.rows.some((row) => row.column_name === 'updated_at');
    const hasCampus = columnsResult.rows.some((row) => row.column_name === 'campus');

    const normalizedCampus = normalizeCampus(campus);

    const insertSql = hasUpdatedAt && hasCampus
      ? `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, campus, living_arrangement, enrollment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`
      : hasUpdatedAt
      ? `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, living_arrangement, enrollment_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`
      : hasCampus
      ? `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, campus, living_arrangement, enrollment_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`
      : `INSERT INTO public.students (
          user_id, student_number, full_name, email, department,
          enrollment_year, living_arrangement, enrollment_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`;

    const values = hasCampus
      ? [
          userId,
          student_number,
          full_name,
          email,
          department,
          Number(enrollment_year),
          normalizedCampus,
          normalizeLivingArrangement(living_arrangement),
          normalizeEnrollmentStatus(enrollment_status),
        ]
      : [
          userId,
          student_number,
          full_name,
          email,
          department,
          Number(enrollment_year),
          normalizeLivingArrangement(living_arrangement),
          normalizeEnrollmentStatus(enrollment_status),
        ];

    const studentResult = await client.query(insertSql, values);

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

// GET /api/admin/students/:id/contract — fetch student's active contract
router.get('/students/:id/contract', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        program,
        academic_year,
        tuition_share_percent,
        boarding_full_cost,
        signed_at
       FROM public.contracts
       WHERE student_id = $1 AND is_active = true
       ORDER BY signed_at DESC
       LIMIT 1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active contract found' });
    }

    res.json({ success: true, contract: result.rows[0] });
  } catch (error) {
    console.error('Fetch contract error:', error);
    res.status(500).json({ error: 'Failed to load contract' });
  }
});

// POST /api/admin/students/:id/contract — create or reactivate student's contract
router.post('/students/:id/contract', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      program,
      academic_year,
      tuition_share_percent = 15,
      boarding_full_cost = true,
      signed_at,
    } = req.body;

    if (!program || !academic_year) {
      return res.status(400).json({ error: 'program and academic_year are required' });
    }

    const tuitionShare = Number(tuition_share_percent);
    if (Number.isNaN(tuitionShare)) {
      return res.status(400).json({ error: 'tuition_share_percent must be a valid number' });
    }

    const result = await pool.query(
      `INSERT INTO public.contracts (
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
        $1,
        'Hawassa University',
        $2,
        $3,
        $4,
        $5,
        COALESCE($6::timestamp, NOW()),
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (student_id)
      DO UPDATE SET
        program = EXCLUDED.program,
        academic_year = EXCLUDED.academic_year,
        tuition_share_percent = EXCLUDED.tuition_share_percent,
        boarding_full_cost = EXCLUDED.boarding_full_cost,
        signed_at = EXCLUDED.signed_at,
        is_active = true,
        updated_at = NOW()
      RETURNING
        contract_id,
        student_id,
        program,
        academic_year,
        tuition_share_percent,
        boarding_full_cost,
        signed_at,
        is_active`,
      [id, program, academic_year, tuitionShare, Boolean(boarding_full_cost), signed_at || null]
    );

    res.status(201).json({ success: true, contract: result.rows[0] });
  } catch (error) {
    console.error('Create contract error:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// PUT /api/admin/students/:id/contract — update student's active contract
router.put('/students/:id/contract', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      program,
      academic_year,
      tuition_share_percent,
      boarding_full_cost,
      signed_at,
    } = req.body;

    if (!program || !academic_year || tuition_share_percent == null || signed_at == null) {
      return res.status(400).json({
        error: 'program, academic_year, tuition_share_percent, and signed_at are required',
      });
    }

    const tuitionShare = Number(tuition_share_percent);
    if (Number.isNaN(tuitionShare)) {
      return res.status(400).json({ error: 'tuition_share_percent must be a valid number' });
    }

    const result = await pool.query(
      `UPDATE public.contracts
       SET
         program = $1,
         academic_year = $2,
         tuition_share_percent = $3,
         boarding_full_cost = $4,
         signed_at = $5,
         is_active = true,
         updated_at = NOW()
       WHERE student_id = $6 AND is_active = true
       RETURNING
         contract_id,
         student_id,
         program,
         academic_year,
         tuition_share_percent,
         boarding_full_cost,
         signed_at,
         is_active`,
      [
        program,
        academic_year,
        tuitionShare,
        Boolean(boarding_full_cost),
        signed_at,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active contract found' });
    }

    res.json({ success: true, contract: result.rows[0] });
  } catch (error) {
    console.error('Update contract error:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// DELETE /api/admin/students/:id/contract — deactivate student's active contract
router.delete('/students/:id/contract', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE public.contracts
       SET is_active = false,
           updated_at = NOW()
       WHERE student_id = $1 AND is_active = true
       RETURNING contract_id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active contract found' });
    }

    res.json({ success: true, message: 'Contract deactivated' });
  } catch (error) {
    console.error('Delete contract error:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

// GET /api/admin/students/:id/debt-details — fetch student debt records + payments
router.get('/students/:id/debt-details', async (req, res) => {
  try {
    const { id } = req.params;

    const debtCols = await getAvailableColumns('debt_records', [
      'debt_id',
      'student_id',
      'initial_amount',
      'current_balance',
      'academic_year',
      'updated_at',
      'last_updated',
    ]);
    const contractCols = await getAvailableColumns('contracts', ['academic_year', 'is_active']);
    const paymentCols = await getAvailableColumns('payment_history', [
      'payment_id',
      'debt_id',
      'amount',
      'status',
      'payment_date',
      'submitted_at',
      'payment_method',
      'transaction_ref',
      'notes',
    ]);

    const hasDebtId = debtCols.has('debt_id');
    const hasDebtStudentId = debtCols.has('student_id');
    const hasInitialAmount = debtCols.has('initial_amount');
    const hasCurrentBalance = debtCols.has('current_balance');
    const hasDebtAcademicYear = debtCols.has('academic_year');
    const hasDebtUpdatedAt = debtCols.has('updated_at');
    const hasDebtLastUpdated = debtCols.has('last_updated');

    const hasContractAcademicYear = contractCols.has('academic_year');
    const hasContractIsActive = contractCols.has('is_active');

    const hasPaymentId = paymentCols.has('payment_id');
    const hasPaymentDebtId = paymentCols.has('debt_id');
    const hasPaymentAmount = paymentCols.has('amount');
    const hasPaymentStatus = paymentCols.has('status');
    const hasPaymentDate = paymentCols.has('payment_date');
    const hasSubmittedAt = paymentCols.has('submitted_at');
    const hasPaymentMethod = paymentCols.has('payment_method');
    const hasTransactionRef = paymentCols.has('transaction_ref');
    const hasPaymentNotes = paymentCols.has('notes');

    if (!hasDebtId || !hasDebtStudentId || !hasInitialAmount || !hasCurrentBalance) {
      return res.status(500).json({ error: 'Debt records schema is missing required columns' });
    }

    const debtAcademicYearExpr = hasDebtAcademicYear
      ? 'dr.academic_year::text'
      : hasContractAcademicYear
      ? 'c.academic_year::text'
      : "'N/A'::text";

    const debtUpdatedExpr = hasDebtUpdatedAt
      ? 'dr.updated_at'
      : hasDebtLastUpdated
      ? 'dr.last_updated'
      : 'NULL::timestamp';

    const joinContracts = hasContractAcademicYear;
    const contractActiveCondition = hasContractIsActive ? ' AND c.is_active = true' : '';

    const debtsResult = await pool.query(
      `SELECT
         dr.debt_id,
         dr.student_id,
         dr.initial_amount AS total_debt,
         dr.current_balance,
         ${debtAcademicYearExpr} AS academic_year,
         ${debtUpdatedExpr} AS updated_at
       FROM public.debt_records dr
       ${joinContracts ? `LEFT JOIN public.contracts c ON c.student_id = dr.student_id${contractActiveCondition}` : ''}
       WHERE dr.student_id = $1
       ORDER BY dr.debt_id DESC`,
      [id]
    );

    if (debtsResult.rows.length === 0) {
      return res.json({
        success: true,
        debts: [],
        payments: [],
      });
    }

    if (!hasPaymentDebtId) {
      return res.json({
        success: true,
        debts: debtsResult.rows,
        payments: [],
      });
    }

    const paymentDateExpr = hasSubmittedAt
      ? 'ph.submitted_at'
      : hasPaymentDate
      ? 'ph.payment_date'
      : 'NULL::timestamp';

    const paymentsResult = await pool.query(
      `SELECT
         ${hasPaymentId ? 'ph.payment_id' : 'NULL::integer'} AS payment_id,
         ph.debt_id,
         ${hasPaymentAmount ? 'ph.amount' : '0::numeric'} AS amount,
         ${hasPaymentStatus ? 'ph.status' : "''::text"} AS status,
         ${paymentDateExpr} AS payment_date,
         ${hasPaymentMethod ? 'ph.payment_method' : "''::text"} AS payment_method,
         ${hasTransactionRef ? 'ph.transaction_ref' : 'NULL::text'} AS transaction_ref,
         ${hasPaymentNotes ? 'ph.notes' : 'NULL::text'} AS notes
       FROM public.payment_history ph
       JOIN public.debt_records dr
         ON dr.debt_id = ph.debt_id
       WHERE dr.student_id = $1
       ORDER BY payment_date DESC NULLS LAST, payment_id DESC NULLS LAST`,
      [id]
    );

    res.json({
      success: true,
      debts: debtsResult.rows,
      payments: paymentsResult.rows,
    });
  } catch (error) {
    console.error('Fetch student debt details error:', error);
    res.status(500).json({ error: 'Failed to load student debt details' });
  }
});

// GET /api/admin/students/:id/debt — fetch student's debt records and payment history
router.get('/students/:id/debt', async (req, res) => {
  try {
    const { id } = req.params;

    const debtCols = await getAvailableColumns('debt_records', [
      'debt_id',
      'student_id',
      'initial_amount',
      'current_balance',
      'academic_year',
      'created_at',
      'updated_at',
      'last_updated',
    ]);
    const contractCols = await getAvailableColumns('contracts', ['academic_year', 'is_active']);
    const paymentCols = await getAvailableColumns('payment_history', [
      'payment_id',
      'debt_id',
      'amount',
      'status',
      'proof_url',
      'submitted_at',
      'payment_date',
      'reviewed_at',
      'notes',
    ]);

    const hasDebtId = debtCols.has('debt_id');
    const hasDebtStudentId = debtCols.has('student_id');
    const hasInitialAmount = debtCols.has('initial_amount');
    const hasCurrentBalance = debtCols.has('current_balance');
    const hasDebtAcademicYear = debtCols.has('academic_year');
    const hasDebtCreatedAt = debtCols.has('created_at');
    const hasDebtUpdatedAt = debtCols.has('updated_at');
    const hasDebtLastUpdated = debtCols.has('last_updated');

    const hasContractAcademicYear = contractCols.has('academic_year');
    const hasContractIsActive = contractCols.has('is_active');

    const hasPaymentId = paymentCols.has('payment_id');
    const hasPaymentDebtId = paymentCols.has('debt_id');
    const hasPaymentAmount = paymentCols.has('amount');
    const hasPaymentStatus = paymentCols.has('status');
    const hasProofUrl = paymentCols.has('proof_url');
    const hasSubmittedAt = paymentCols.has('submitted_at');
    const hasPaymentDate = paymentCols.has('payment_date');
    const hasReviewedAt = paymentCols.has('reviewed_at');
    const hasPaymentNotes = paymentCols.has('notes');

    if (!hasDebtId || !hasDebtStudentId || !hasInitialAmount || !hasCurrentBalance) {
      return res.status(500).json({ error: 'Debt records schema is missing required columns' });
    }

    const debtAcademicYearExpr = hasDebtAcademicYear
      ? 'dr.academic_year::text'
      : hasContractAcademicYear
      ? 'c.academic_year::text'
      : "'N/A'::text";

    const debtCreatedExpr = hasDebtCreatedAt
      ? 'dr.created_at'
      : hasDebtLastUpdated
      ? 'dr.last_updated'
      : 'NULL::timestamp';

    const debtUpdatedExpr = hasDebtUpdatedAt
      ? 'dr.updated_at'
      : hasDebtLastUpdated
      ? 'dr.last_updated'
      : 'NULL::timestamp';

    const joinContracts = hasContractAcademicYear;
    const contractActiveCondition = hasContractIsActive ? ' AND c.is_active = true' : '';

    const debtResult = await pool.query(
      `SELECT
         dr.debt_id,
         ${debtAcademicYearExpr} AS academic_year,
         dr.initial_amount AS total_debt,
         dr.current_balance,
         ${debtCreatedExpr} AS created_at,
         ${debtUpdatedExpr} AS updated_at
       FROM public.debt_records dr
       ${joinContracts ? `LEFT JOIN public.contracts c ON c.student_id = dr.student_id${contractActiveCondition}` : ''}
       WHERE dr.student_id = $1
       ORDER BY dr.debt_id DESC`,
      [id]
    );

    let paymentHistory = [];

    if (hasPaymentDebtId) {
      const paymentDateExpr = hasSubmittedAt
        ? 'ph.submitted_at'
        : hasPaymentDate
        ? 'ph.payment_date'
        : 'NULL::timestamp';

      const paymentResult = await pool.query(
        `SELECT
           ${hasPaymentId ? 'ph.payment_id' : 'NULL::integer'} AS payment_id,
           ${hasPaymentAmount ? 'ph.amount' : '0::numeric'} AS amount,
           ${hasPaymentStatus ? 'ph.status' : "''::text"} AS status,
           ${hasProofUrl ? 'ph.proof_url' : 'NULL::text'} AS proof_url,
           ${paymentDateExpr} AS submitted_at,
           ${hasReviewedAt ? 'ph.reviewed_at' : 'NULL::timestamp'} AS reviewed_at,
           ${hasPaymentNotes ? 'ph.notes' : 'NULL::text'} AS notes
         FROM public.payment_history ph
         JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
         WHERE dr.student_id = $1
         ORDER BY submitted_at DESC NULLS LAST, payment_id DESC NULLS LAST`,
        [id]
      );
      paymentHistory = paymentResult.rows;
    }

    res.json({
      success: true,
      debtRecords: debtResult.rows,
      paymentHistory,
    });
  } catch (error) {
    console.error('Fetch student debt error:', error);
    res.status(500).json({ error: 'Failed to load student debt details' });
  }
});

router.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { living_arrangement, enrollment_status, department, campus } = req.body;

    if (!living_arrangement || !enrollment_status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const hasCampus = (await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = 'campus'
       LIMIT 1`
    )).rows.length > 0;

    const setClauses = [
      'living_arrangement = $1',
      'enrollment_status = $2',
      'department = $3',
    ];
    const values = [living_arrangement, enrollment_status, department];

    if (hasCampus && campus != null) {
      setClauses.push(`campus = $${values.length + 1}`);
      values.push(normalizeCampus(campus));
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE public.students
       SET ${setClauses.join(', ')}
       WHERE student_id = $${values.length}
       RETURNING *`,
      values
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
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'campus')) {
      normalizedUpdates.campus = normalizeCampus(normalizedUpdates.campus);
    }

    // Build dynamic SET clause
    const hasCampus = (await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = 'campus'
       LIMIT 1`
    )).rows.length > 0;

    const allowedFields = hasCampus
      ? ['living_arrangement', 'enrollment_status', 'department', 'campus']
      : ['living_arrangement', 'enrollment_status', 'department'];
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

// POST /api/admin/debt/reconcile — recalculate debt for active students
router.post('/debt/reconcile', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const hasCostShares = (
      await client.query(
        `SELECT to_regclass('public.cost_shares') AS table_name`
      )
    ).rows[0].table_name;

    if (!hasCostShares) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'cost_shares table is missing. Run backend/database/add_cost_shares_table.sql first.',
      });
    }

    const debtColumns = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'debt_records'
         AND column_name = ANY($1::text[])`,
      [['updated_at', 'last_updated']]
    );
    const hasUpdatedAt = debtColumns.rows.some((row) => row.column_name === 'updated_at');
    const hasLastUpdated = debtColumns.rows.some((row) => row.column_name === 'last_updated');

    const candidates = await client.query(
      `SELECT
         s.student_id,
         ${
           (await getAvailableColumns('students', ['campus'])).has('campus')
             ? 's.campus'
             : "'Main Campus'::text"
         } AS campus,
         c.program,
         c.academic_year,
         c.tuition_share_percent,
         cs.tuition_cost_per_year,
         cs.boarding_cost_per_year
       FROM public.students s
       JOIN public.contracts c
         ON c.student_id = s.student_id
        AND c.is_active = true
       LEFT JOIN public.cost_shares cs
         ON LOWER(TRIM(cs.program)) = LOWER(TRIM(c.program))
        AND cs.academic_year = c.academic_year
        ${
          (await getAvailableColumns('cost_shares', ['campus'])).has('campus')
            ? "AND LOWER(TRIM(COALESCE(cs.campus, 'Main Campus'))) = LOWER(TRIM(COALESCE(s.campus, 'Main Campus')))"
            : ''
        }
       WHERE UPPER(COALESCE(s.enrollment_status, '')) = 'ACTIVE'`
    );

    if (candidates.rows.length === 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'No active students with active contracts found to reconcile.',
        reconciledCount: 0,
        skippedCount: 0,
      });
    }

    const paidRows = await client.query(
      `SELECT
         dr.student_id,
         COALESCE(SUM(ph.amount), 0) AS paid_total
       FROM public.debt_records dr
       JOIN public.payment_history ph
         ON ph.debt_id = dr.debt_id
       WHERE UPPER(COALESCE(ph.status, '')) IN ('APPROVED', 'SUCCESS')
       GROUP BY dr.student_id`
    );
    const paidByStudentId = new Map(
      paidRows.rows.map((row) => [Number(row.student_id), Number(row.paid_total)])
    );

    let reconciledCount = 0;
    let skippedCount = 0;

    for (const row of candidates.rows) {
      const studentId = Number(row.student_id);
      const tuitionCost = Number(row.tuition_cost_per_year);
      const boardingCost = Number(row.boarding_cost_per_year);
      const tuitionSharePercent = Number(row.tuition_share_percent);

      if (
        Number.isNaN(tuitionCost)
        || Number.isNaN(boardingCost)
        || Number.isNaN(tuitionSharePercent)
      ) {
        skippedCount += 1;
        continue;
      }

      const targetDebt = Number(((tuitionCost * tuitionSharePercent) / 100 + boardingCost).toFixed(2));
      const paidTotal = paidByStudentId.get(studentId) || 0;
      const currentBalance = Number(Math.max(0, targetDebt - paidTotal).toFixed(2));

      const latestDebt = await client.query(
        `SELECT debt_id
         FROM public.debt_records
         WHERE student_id = $1
         ORDER BY debt_id DESC
         LIMIT 1`,
        [studentId]
      );

      if (latestDebt.rows.length > 0) {
        const setClauses = [
          'initial_amount = $1',
          'current_balance = $2',
        ];

        if (hasUpdatedAt) {
          setClauses.push('updated_at = NOW()');
        } else if (hasLastUpdated) {
          setClauses.push('last_updated = NOW()');
        }

        await client.query(
          `UPDATE public.debt_records
           SET ${setClauses.join(', ')}
           WHERE debt_id = $3`,
          [targetDebt, currentBalance, latestDebt.rows[0].debt_id]
        );
      } else {
        await client.query(
          `INSERT INTO public.debt_records (
             student_id,
             initial_amount,
             current_balance,
             last_updated
           ) VALUES ($1, $2, $3, NOW())`,
          [studentId, targetDebt, currentBalance]
        );
      }

      reconciledCount += 1;
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Debt reconciliation completed. Reconciled ${reconciledCount} student(s), skipped ${skippedCount}.`,
      reconciledCount,
      skippedCount,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Debt reconcile error:', error);
    res.status(500).json({ error: 'Failed to reconcile debt' });
  } finally {
    if (client) {
      client.release();
    }
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
  let client;
  try {
    const { id } = req.params;

    client = await pool.connect();
    await client.query('BEGIN');

    const studentResult = await client.query(
      'SELECT user_id FROM public.students WHERE student_id = $1',
      [id]
    );

    if (studentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }

    const userId = studentResult.rows[0].user_id;

    const paymentCols = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'payment_history'
         AND column_name = ANY($1::text[])`,
      [['student_id', 'debt_id']]
    );
    const debtCols = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'debt_records'
         AND column_name = ANY($1::text[])`,
      [['debt_id', 'student_id']]
    );

    const hasPhStudentId = paymentCols.rows.some((row) => row.column_name === 'student_id');
    const hasPhDebtId = paymentCols.rows.some((row) => row.column_name === 'debt_id');
    const hasDebtId = debtCols.rows.some((row) => row.column_name === 'debt_id');
    const hasDebtStudentId = debtCols.rows.some((row) => row.column_name === 'student_id');

    // Explicit cleanup for schema variants where FK cascades may be missing.
    if (hasPhStudentId) {
      await client.query('DELETE FROM public.payment_history WHERE student_id = $1', [id]);
    }

    if (hasPhDebtId && hasDebtId && hasDebtStudentId) {
      await client.query(
        `DELETE FROM public.payment_history
         WHERE debt_id IN (
           SELECT debt_id
           FROM public.debt_records
           WHERE student_id = $1
         )`,
        [id]
      );
    }

    await client.query('DELETE FROM public.contracts WHERE student_id = $1', [id]);

    if (hasDebtStudentId) {
      await client.query('DELETE FROM public.debt_records WHERE student_id = $1', [id]);
    }

    await client.query('DELETE FROM public.students WHERE student_id = $1', [id]);

    let userDeleted = false;

    if (userId) {
      const remainingStudents = await client.query(
        'SELECT 1 FROM public.students WHERE user_id = $1 LIMIT 1',
        [userId]
      );

      if (remainingStudents.rows.length === 0) {
        // User cleanup is best-effort. Keep student deletion successful even if other
        // tables still reference the user (e.g. audit/verification foreign keys).
        await client.query('SAVEPOINT sp_delete_user');
        try {
          const userDeleteResult = await client.query(
            'DELETE FROM public.users WHERE user_id = $1',
            [userId]
          );
          userDeleted = userDeleteResult.rowCount > 0;
        } catch (userDeleteError) {
          await client.query('ROLLBACK TO SAVEPOINT sp_delete_user');
          console.warn('Student deleted but user cleanup skipped:', {
            message: userDeleteError.message,
            code: userDeleteError.code,
            detail: userDeleteError.detail,
            hint: userDeleteError.hint,
            table: userDeleteError.table,
            column: userDeleteError.column,
            constraint: userDeleteError.constraint,
          });
        } finally {
          await client.query('RELEASE SAVEPOINT sp_delete_user');
        }
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: userDeleted
        ? 'Student and user deleted successfully'
        : 'Student deleted successfully',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
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
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
