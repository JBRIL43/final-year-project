const express = require('express');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { authenticateRequest, requireRoles } = require('../middleware/auth');
const { sendPaymentNotification } = require('../utils/notifications');

const router = express.Router();

// GET /api/admin/users — list all admin users (not students)
router.get('/users', authenticateRequest, requireRoles(['admin']), async (req, res) => {
  try {
    const userCols = await getAvailableColumns('users', [
      'user_id', 'email', 'full_name', 'role', 'department', 'created_at', 'updated_at',
    ]);

    const selectFields = ['user_id', 'email'];
    if (userCols.has('full_name')) selectFields.push('full_name');
    else selectFields.push("''::text AS full_name");
    selectFields.push('role');
    if (userCols.has('department')) selectFields.push('department');
    else selectFields.push("NULL::text AS department");
    if (userCols.has('created_at')) selectFields.push('created_at');
    else selectFields.push('NULL::timestamp AS created_at');
    if (userCols.has('updated_at')) selectFields.push('updated_at');
    else selectFields.push('NULL::timestamp AS updated_at');

    const orderBy = userCols.has('created_at') ? 'ORDER BY created_at DESC' : 'ORDER BY user_id DESC';

    const result = await pool.query(
      `SELECT ${selectFields.join(', ')}
       FROM public.users
       WHERE UPPER(role) IN ('ADMIN', 'REGISTRAR', 'DEPARTMENT_HEAD', 'FINANCE_OFFICER')
       ${orderBy}`
    );
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Failed to fetch admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// PUT /api/admin/users/:id — update admin user (role, department)
router.put('/users/:id', authenticateRequest, requireRoles(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    const normalizedRole = normalizeAdminRole(role);
    if (!normalizedRole) return res.status(400).json({ error: 'Invalid role' });
    const updateFields = ['role = $1'];
    const values = [normalizedRole, id];
    if (normalizedRole === 'DEPARTMENT_HEAD') {
      if (!department) return res.status(400).json({ error: 'department is required for department_head' });
      updateFields.push('department = $2');
      values[1] = department;
      values[2] = id;
    } else {
      updateFields.push('department = NULL');
    }
    const query = `UPDATE public.users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE user_id = $${values.length} RETURNING user_id, email, role, department, updated_at`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Failed to update admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

// DELETE /api/admin/users/:id — delete admin user
router.delete('/users/:id', authenticateRequest, requireRoles(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    // Get firebase_uid for cleanup
    const userRes = await pool.query('SELECT firebase_uid FROM public.users WHERE user_id = $1', [id]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const firebaseUid = userRes.rows[0].firebase_uid;
    await pool.query('DELETE FROM public.users WHERE user_id = $1', [id]);
    if (firebaseUid && firebaseAdmin && firebaseAdmin.apps.length > 0) {
      try {
        await firebaseAdmin.auth().deleteUser(firebaseUid);
      } catch (err) {
        console.warn('Failed to delete Firebase user:', err.message);
      }
    }
    res.json({ success: true, message: 'Admin user deleted' });
  } catch (error) {
    console.error('Failed to delete admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

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

function normalizePaymentModel(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  if (normalized === 'pre_payment') return 'pre_payment';
  if (normalized === 'hybrid') return 'hybrid';
  return 'post_graduation';
}

function normalizeCampus(value) {
  const raw = String(value || '').trim();
  return raw || 'Main Campus';
}

function inferProgramType(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.includes('engineering')) return 'Engineering';
  if (normalized.includes('computer') || normalized.includes('software')) return 'Computer Science';
  if (normalized.includes('health') || normalized.includes('medicine')) return 'Health Sciences';

  return 'Social Sciences';
}

function normalizeAdminRole(role) {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'registrar') return 'REGISTRAR';
  if (normalized === 'department_head') return 'DEPARTMENT_HEAD';
  if (normalized === 'finance') return 'FINANCE_OFFICER';
  if (normalized === 'admin') return 'ADMIN';

  return null;
}

function buildFallbackUid(studentNumber) {
  const safeStudentNumber = String(studentNumber || 'student')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return `local-${safeStudentNumber}-${Date.now()}`;
}

async function createOrResolveFirebaseUid({ studentNumber, email, fullName }) {
  const fallbackUid = buildFallbackUid(studentNumber);

  if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
    return {
      uid: fallbackUid,
      source: 'fallback',
      reason: 'firebase-admin-not-configured',
    };
  }

  try {
    const userRecord = await firebaseAdmin.auth().createUser({
      email: String(email).trim(),
      emailVerified: false,
      password: '12345678',
      displayName: String(fullName).trim(),
      disabled: false,
    });

    return {
      uid: userRecord.uid,
      source: 'created',
      reason: null,
    };
  } catch (error) {
    if (error && error.code === 'auth/email-already-exists') {
      try {
        const existingFirebaseUser = await firebaseAdmin.auth().getUserByEmail(String(email).trim());
        return {
          uid: existingFirebaseUser.uid,
          source: 'existing',
          reason: null,
        };
      } catch (lookupError) {
        console.error('Firebase lookup by email failed:', lookupError.message);
      }
    } else {
      console.error('Firebase account creation failed:', error.message);
    }

    return {
      uid: fallbackUid,
      source: 'fallback',
      reason: error && error.code ? error.code : 'firebase-create-failed',
    };
  }
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

function requireAdminOnly(req, res) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin only operation' });
    return false;
  }

  return true;
}

router.use(authenticateRequest, requireRoles(['admin', 'finance']));

router.use((req, res, next) => {
  const actor = req.user?.email || req.user?.user_id || 'unknown';
  console.info(`[AUDIT] ${new Date().toISOString()} role=${req.user?.role || 'unknown'} actor=${actor} ${req.method} ${req.originalUrl}`);
  next();
});

router.post('/users', authenticateRequest, requireRoles(['admin']), async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const requestedRole = String(req.body?.role || '').trim();
    const department = req.body?.department ? String(req.body.department).trim() : null;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const role = normalizeAdminRole(requestedRole);
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (role === 'DEPARTMENT_HEAD' && !department) {
      return res.status(400).json({ error: 'department is required for department_head' });
    }

    const existingUser = await pool.query(
      'SELECT user_id FROM public.users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    const userRecord = await firebaseAdmin.auth().createUser({
      email,
      emailVerified: false,
      password: '12345678',
      displayName: email.split('@')[0],
      disabled: false,
    });

    let insertResult;

    try {
      insertResult = await pool.query(
        `INSERT INTO public.users (firebase_uid, email, full_name, role, department, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING user_id, email, role, department`,
        [userRecord.uid, email, email.split('@')[0], role, department]
      );
    } catch (dbError) {
      try {
        await firebaseAdmin.auth().deleteUser(userRecord.uid);
      } catch (cleanupError) {
        console.error('Failed to clean up Firebase user after DB insert error:', cleanupError.message);
      }

      throw dbError;
    }

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: insertResult.rows[0],
      defaultPassword: '12345678',
    });
  } catch (error) {
    console.error('Create admin user error:', error);

    if (error && error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Firebase account already exists' });
    }

    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

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

// GET /api/admin/graduates — fetch students for graduate management
router.get('/graduates', async (req, res) => {
  try {
    const studentCols = await getAvailableColumns('students', [
      'full_name',
      'email',
      'department',
      'campus',
      'graduation_date',
      'repayment_start_date',
      'clearance_status',
    ]);

    const hasStudentFullName = studentCols.has('full_name');
    const hasStudentEmail = studentCols.has('email');
    const hasDepartment = studentCols.has('department');
    const hasCampus = studentCols.has('campus');
    const hasGraduationDate = studentCols.has('graduation_date');
    const hasRepaymentStartDate = studentCols.has('repayment_start_date');
    const hasClearanceStatus = studentCols.has('clearance_status');

    if (!hasGraduationDate || !hasRepaymentStartDate || !hasClearanceStatus) {
      return res.status(400).json({
        error:
          'students schema is missing graduate tracking columns. Run the graduate migration first.',
      });
    }

    const fullNameExpr = hasStudentFullName ? 's.full_name' : 'u.full_name';
    const emailExpr = hasStudentEmail ? 's.email' : 'u.email';
    const departmentExpr = hasDepartment ? 's.department' : "''::text";
    const campusExpr = hasCampus ? 's.campus' : "'Main Campus'::text";
    const needsUsersJoin = !hasStudentFullName || !hasStudentEmail;

    const result = await pool.query(
      `SELECT
         s.student_id,
         ${fullNameExpr} AS full_name,
         ${emailExpr} AS email,
         ${departmentExpr} AS department,
         ${campusExpr} AS campus,
         s.graduation_date,
         s.repayment_start_date,
         s.clearance_status
       FROM public.students s
       ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
       ORDER BY s.graduation_date DESC NULLS LAST, full_name`)
    ;

    res.json({ success: true, graduates: result.rows });
  } catch (error) {
    console.error('Fetch graduates error:', error);
    res.status(500).json({ error: 'Failed to load graduates' });
  }
});

// GET /api/admin/graduates/delinquent — get graduates past repayment start with unpaid debt
router.get('/graduates/delinquent', async (req, res) => {
  try {
    const studentCols = await getAvailableColumns('students', [
      'full_name',
      'email',
      'department',
      'campus',
      'graduation_date',
      'repayment_start_date',
      'clearance_status',
    ]);
    const debtCols = await getAvailableColumns('debt_records', ['student_id', 'current_balance']);

    const hasStudentFullName = studentCols.has('full_name');
    const hasStudentEmail = studentCols.has('email');
    const hasDepartment = studentCols.has('department');
    const hasCampus = studentCols.has('campus');
    const hasGraduationDate = studentCols.has('graduation_date');
    const hasRepaymentStartDate = studentCols.has('repayment_start_date');
    const hasClearanceStatus = studentCols.has('clearance_status');
    const hasCurrentBalance = debtCols.has('current_balance');

    if (!hasGraduationDate || !hasRepaymentStartDate || !hasClearanceStatus || !hasCurrentBalance) {
      return res.status(400).json({
        error:
          'students/debt_records schema is missing graduate delinquency columns. Run the graduate migration first.',
      });
    }

    const fullNameExpr = hasStudentFullName ? 's.full_name' : 'u.full_name';
    const emailExpr = hasStudentEmail ? 's.email' : 'u.email';
    const departmentExpr = hasDepartment ? 's.department' : "''::text";
    const campusExpr = hasCampus ? 's.campus' : "'Main Campus'::text";
    const needsUsersJoin = !hasStudentFullName || !hasStudentEmail;

    const result = await pool.query(
      `SELECT
         s.student_id,
         ${fullNameExpr} AS full_name,
         ${emailExpr} AS email,
         ${departmentExpr} AS department,
         ${campusExpr} AS campus,
         s.graduation_date,
         s.repayment_start_date,
         dr.current_balance
       FROM public.students s
       JOIN public.debt_records dr ON dr.student_id = s.student_id
       ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
       WHERE s.graduation_date IS NOT NULL
         AND s.repayment_start_date IS NOT NULL
         AND s.repayment_start_date <= NOW()
         AND UPPER(COALESCE(s.clearance_status, '')) = 'PENDING'
         AND dr.current_balance > 0
       ORDER BY s.repayment_start_date ASC, s.student_id ASC`
    );

    res.json({ success: true, delinquentGraduates: result.rows });
  } catch (error) {
    console.error('Fetch delinquent graduates error:', error);
    res.status(500).json({ error: 'Failed to load delinquent graduates' });
  }
});

// GET /api/admin/erca/debtors — export debtor list for ERCA
router.get('/erca/debtors', async (req, res) => {
  try {
    const studentCols = await getAvailableColumns('students', [
      'full_name',
      'student_number',
      'email',
      'phone',
      'tin',
      'department',
      'campus',
      'graduation_date',
      'repayment_start_date',
      'clearance_status',
      'payment_model',
    ]);

    const debtCols = await getAvailableColumns('debt_records', ['student_id', 'current_balance']);

    const hasStudentFullName = studentCols.has('full_name');
    const hasStudentEmail = studentCols.has('email');
    const hasStudentPhone = studentCols.has('phone');
    const hasStudentTin = studentCols.has('tin');
    const hasStudentNumber = studentCols.has('student_number');
    const hasDepartment = studentCols.has('department');
    const hasCampus = studentCols.has('campus');
    const hasGraduationDate = studentCols.has('graduation_date');
    const hasRepaymentStartDate = studentCols.has('repayment_start_date');
    const hasClearanceStatus = studentCols.has('clearance_status');
    const hasPaymentModel = studentCols.has('payment_model');
    const hasCurrentBalance = debtCols.has('current_balance');

    if (!hasStudentNumber || !hasGraduationDate || !hasRepaymentStartDate || !hasClearanceStatus || !hasCurrentBalance) {
      return res.status(400).json({
        error: 'students/debt_records schema is missing ERCA export columns. Run graduate and debt migrations first.',
      });
    }

    const fullNameExpr = hasStudentFullName ? 's.full_name' : 'u.full_name';
    const emailExpr = hasStudentEmail ? 's.email' : 'u.email';
    const phoneExpr = hasStudentPhone ? 's.phone' : "''::text";
    const tinExpr = hasStudentTin ? "COALESCE(s.tin, '')" : "''::text";
    const departmentExpr = hasDepartment ? 's.department' : "''::text";
    const campusExpr = hasCampus ? 's.campus' : "'Main Campus'::text";
    const needsUsersJoin = !hasStudentFullName || !hasStudentEmail;

    const result = await pool.query(
      `SELECT
         ${fullNameExpr} AS full_name,
         s.student_number,
         ${emailExpr} AS email,
         ${phoneExpr} AS phone,
         ${tinExpr} AS tin,
         SUM(dr.current_balance) AS total_debt,
         ${departmentExpr} AS program,
         ${campusExpr} AS campus,
         s.graduation_date,
         s.repayment_start_date
       FROM public.students s
       JOIN public.debt_records dr ON s.student_id = dr.student_id
       ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
       WHERE UPPER(COALESCE(s.clearance_status, '')) = 'PENDING'
         AND dr.current_balance > 0
         AND s.graduation_date IS NOT NULL
         AND s.repayment_start_date IS NOT NULL
         AND s.repayment_start_date <= NOW()
        ${hasPaymentModel ? "AND LOWER(COALESCE(s.payment_model, 'post_graduation')) = 'post_graduation'" : ''}
       GROUP BY
         s.student_id,
         s.student_number,
         ${fullNameExpr},
         ${emailExpr},
         ${phoneExpr},
         ${tinExpr},
         ${departmentExpr},
         ${campusExpr},
         s.graduation_date,
         s.repayment_start_date
       ORDER BY s.repayment_start_date ASC, s.student_id ASC`
    );

    res.json({
      success: true,
      ercaDebtors: result.rows,
      generatedAt: new Date().toISOString(),
      totalCount: result.rows.length,
    });
  } catch (error) {
    console.error('ERCA debtor list error:', error);
    res.status(500).json({ error: 'Failed to generate ERCA debtor list' });
  }
});

async function getGraduateNotificationTarget(studentId) {
  const result = await pool.query(
    `SELECT s.student_id, s.user_id, s.full_name, s.email, u.firebase_uid
     FROM public.students s
     LEFT JOIN public.users u ON u.user_id = s.user_id
     WHERE s.student_id = $1
     LIMIT 1`,
    [studentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

router.post('/graduates/:id/remind', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const { method = 'email' } = req.body;

    if (!Number.isFinite(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const student = await getGraduateNotificationTarget(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const delinquentCheck = await pool.query(
      `SELECT s.student_id
       FROM public.students s
       JOIN public.debt_records dr ON dr.student_id = s.student_id
       WHERE s.student_id = $1
         AND s.repayment_start_date IS NOT NULL
         AND s.repayment_start_date <= NOW()
         AND UPPER(COALESCE(s.clearance_status, '')) = 'PENDING'
         AND dr.current_balance > 0
       LIMIT 1`,
      [studentId]
    );

    if (delinquentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found or already cleared' });
    }

    console.log(`📤 REMINDER SENT via ${String(method).toUpperCase()}:`, {
      student: student.full_name,
      email: student.email,
      method,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Reminder logged for ${student.full_name || 'the student'} via ${method}`,
      studentName: student.full_name,
      method,
    });
  } catch (error) {
    console.error('Send graduate reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

router.post('/graduates/:id/contacted', async (req, res) => {
  try {
    const studentId = Number(req.params.id);

    if (!Number.isFinite(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const student = await getGraduateNotificationTarget(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.user_id) {
      return res.status(400).json({ error: 'Student is not linked to a user account' });
    }

    await sendPaymentNotification(
      student.user_id,
      'Payment follow-up recorded',
      'Your account has been marked as contacted by the finance office regarding your repayment balance.',
      {
        type: 'graduate_contacted',
        student_id: String(student.student_id),
        email: student.email || '',
      }
    );

    res.json({
      success: true,
      message: `Contact log sent for ${student.full_name || 'the student'}`,
    });
  } catch (error) {
    console.error('Record graduate contact error:', error);
    res.status(500).json({ error: 'Failed to record contact' });
  }
});

// PUT /api/admin/graduates/:id — update graduate fields
router.put('/graduates/:id', async (req, res) => {
  try {
    if (!requireAdminOnly(req, res)) return;

    const { id } = req.params;
    const { graduation_date, repayment_start_date, clearance_status } = req.body;

    const studentCols = await getAvailableColumns('students', [
      'graduation_date',
      'repayment_start_date',
      'clearance_status',
      'updated_at',
    ]);

    const hasGraduationDate = studentCols.has('graduation_date');
    const hasRepaymentStartDate = studentCols.has('repayment_start_date');
    const hasClearanceStatus = studentCols.has('clearance_status');
    const hasUpdatedAt = studentCols.has('updated_at');

    if (!hasGraduationDate || !hasRepaymentStartDate || !hasClearanceStatus) {
      return res.status(400).json({
        error:
          'students schema is missing graduate tracking columns. Run the graduate migration first.',
      });
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (graduation_date !== undefined) {
      fields.push(`graduation_date = $${paramIndex}`);
      values.push(graduation_date || null);
      paramIndex += 1;
    }

    if (repayment_start_date !== undefined) {
      fields.push(`repayment_start_date = $${paramIndex}`);
      values.push(repayment_start_date || null);
      paramIndex += 1;
    }

    if (clearance_status !== undefined) {
      fields.push(`clearance_status = $${paramIndex}`);
      values.push(clearance_status);
      paramIndex += 1;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (hasUpdatedAt) {
      fields.push('updated_at = NOW()');
    }

    values.push(Number(id));

    const query = `
      UPDATE public.students
      SET ${fields.join(', ')}
      WHERE student_id = $${paramIndex}
      RETURNING student_id
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ success: true, message: 'Graduate record updated' });
  } catch (error) {
    console.error('Update graduate error:', error);
    res.status(500).json({ error: 'Failed to update graduate record' });
  }
});

// POST /api/admin/students — create new student + auto-create contract
router.post('/students', async (req, res) => {
  let client;
  try {
    if (!requireAdminOnly(req, res)) return;

    const {
      student_number,
      full_name,
      email,
      department,
      enrollment_year,
      campus = 'Main Campus',
      living_arrangement = 'On-Campus',
      enrollment_status = 'Active',
      payment_model = 'post_graduation',
      pre_payment_amount = 0,
      pre_payment_date,
      pre_payment_clearance,
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
      'SELECT user_id, firebase_uid FROM public.users WHERE email = $1 LIMIT 1',
      [email]
    );

    let userId;
    let firebaseSync = { source: 'none', reason: null };
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].user_id;
      const currentUid = existingUser.rows[0].firebase_uid;

      if (!currentUid || String(currentUid).startsWith('local-')) {
        const firebaseResult = await createOrResolveFirebaseUid({
          studentNumber: student_number,
          email,
          fullName: full_name,
        });

        await client.query(
          'UPDATE public.users SET firebase_uid = $1 WHERE user_id = $2',
          [firebaseResult.uid, userId]
        );
        firebaseSync = {
          source: firebaseResult.source,
          reason: firebaseResult.reason,
        };
      }
    } else {
      const firebaseResult = await createOrResolveFirebaseUid({
        studentNumber: student_number,
        email,
        fullName: full_name,
      });

      const userResult = await client.query(
        `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at)
         VALUES ($1, $2, $3, 'STUDENT', NOW())
         RETURNING user_id`,
        [firebaseResult.uid, email, full_name]
      );
      userId = userResult.rows[0].user_id;
      firebaseSync = {
        source: firebaseResult.source,
        reason: firebaseResult.reason,
      };
    }

    const availableStudentColumns = await getAvailableColumns('students', [
      'user_id',
      'student_number',
      'full_name',
      'email',
      'department',
      'enrollment_year',
      'campus',
      'living_arrangement',
      'enrollment_status',
      'payment_model',
      'pre_payment_amount',
      'pre_payment_date',
      'pre_payment_clearance',
      'created_at',
      'updated_at',
    ]);

    const insertColumns = [];
    const insertValues = [];

    const addStudentColumn = (columnName, value) => {
      if (availableStudentColumns.has(columnName)) {
        insertColumns.push(columnName);
        insertValues.push(value);
      }
    };

    const normalizedCampus = normalizeCampus(campus);
    const normalizedPaymentModel = normalizePaymentModel(payment_model);
    const normalizedPrePaymentAmount = Number(pre_payment_amount) || 0;

    addStudentColumn('user_id', userId);
    addStudentColumn('student_number', student_number);
    addStudentColumn('full_name', full_name);
    addStudentColumn('email', email);
    addStudentColumn('department', department);
    addStudentColumn('enrollment_year', Number(enrollment_year));
    addStudentColumn('campus', normalizedCampus);
    addStudentColumn('living_arrangement', normalizeLivingArrangement(living_arrangement));
    addStudentColumn('enrollment_status', normalizeEnrollmentStatus(enrollment_status));
    addStudentColumn('payment_model', normalizedPaymentModel);

    if (normalizedPaymentModel !== 'post_graduation') {
      addStudentColumn('pre_payment_amount', normalizedPrePaymentAmount);
      addStudentColumn('pre_payment_date', pre_payment_date || null);
      addStudentColumn('pre_payment_clearance', Boolean(pre_payment_clearance));
    }

    if (availableStudentColumns.has('created_at')) {
      addStudentColumn('created_at', new Date());
    }
    if (availableStudentColumns.has('updated_at')) {
      addStudentColumn('updated_at', new Date());
    }

    const insertPlaceholders = insertValues.map((_, index) => `$${index + 1}`).join(', ');
    const studentResult = await client.query(
      `INSERT INTO public.students (${insertColumns.join(', ')})
       VALUES (${insertPlaceholders})
       RETURNING *`,
      insertValues
    );

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      student: studentResult.rows[0],
      firebase: {
        status: firebaseSync.source,
        reason: firebaseSync.reason,
      },
    });
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
    if (!requireAdminOnly(req, res)) return;

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
    if (!requireAdminOnly(req, res)) return;

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
    if (!requireAdminOnly(req, res)) return;

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
    if (!requireAdminOnly(req, res)) return;

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
    if (!requireAdminOnly(req, res)) return;

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

// GET /api/admin/cost-shares — list all cost configurations
router.get('/cost-shares', async (req, res) => {
  try {
    const costShareCols = await getAvailableColumns('cost_shares', ['food_cost_per_month']);
    const hasFoodCostPerMonth = costShareCols.has('food_cost_per_month');

    if (!hasFoodCostPerMonth) {
      return res.status(400).json({
        error: 'cost_shares schema is outdated. Run backend/database/add_campus_support.sql first.',
      });
    }

    const result = await pool.query(
      `SELECT
         cost_share_id,
         program,
         campus,
         academic_year,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month,
         created_at
       FROM public.cost_shares
       ORDER BY academic_year DESC, program ASC`
    );

    res.json({ success: true, costs: result.rows });
  } catch (error) {
    console.error('Fetch cost shares error:', error);
    res.status(500).json({ error: 'Failed to load cost configurations' });
  }
});

// POST /api/admin/cost-shares — create a new cost configuration
router.post('/cost-shares', async (req, res) => {
  try {
    if (!requireAdminOnly(req, res)) return;

    const FIXED_FOOD_COST_PER_MONTH = 3000;

    const {
      program,
      academic_year,
      tuition_cost_per_year,
      boarding_cost_per_year,
    } = req.body;

    if (!program || !academic_year) {
      return res.status(400).json({
        error: 'program and academic_year are required',
      });
    }

    const tuitionCost = Number(tuition_cost_per_year);
    const boardingCost = Number(boarding_cost_per_year);
    const foodCost = FIXED_FOOD_COST_PER_MONTH;

    if (Number.isNaN(tuitionCost) || Number.isNaN(boardingCost)) {
      return res.status(400).json({
        error: 'tuition_cost_per_year and boarding_cost_per_year must be valid numbers',
      });
    }

    const result = await pool.query(
      `INSERT INTO public.cost_shares (
         program,
         campus,
         academic_year,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         cost_share_id,
         program,
         campus,
         academic_year,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month,
         created_at`,
      [
        String(program).trim(),
        'Main Campus',
        String(academic_year).trim(),
        tuitionCost,
        boardingCost,
        foodCost,
      ]
    );

    res.status(201).json({ success: true, cost: result.rows[0] });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        error: 'Cost configuration already exists for this program and academic year',
      });
    }
    console.error('Create cost share error:', error);
    res.status(500).json({ error: 'Failed to create cost configuration' });
  }
});

// PUT /api/admin/cost-shares/:id — update a cost configuration
router.put('/cost-shares/:id', async (req, res) => {
  try {
    if (!requireAdminOnly(req, res)) return;

    const FIXED_FOOD_COST_PER_MONTH = 3000;

    const { id } = req.params;
    const {
      program,
      academic_year,
      tuition_cost_per_year,
      boarding_cost_per_year,
    } = req.body;

    if (!program || !academic_year) {
      return res.status(400).json({
        error: 'program and academic_year are required',
      });
    }

    const tuitionCost = Number(tuition_cost_per_year);
    const boardingCost = Number(boarding_cost_per_year);
    const foodCost = FIXED_FOOD_COST_PER_MONTH;

    if (Number.isNaN(tuitionCost) || Number.isNaN(boardingCost)) {
      return res.status(400).json({
        error: 'tuition_cost_per_year and boarding_cost_per_year must be valid numbers',
      });
    }

    const result = await pool.query(
      `UPDATE public.cost_shares
       SET
         program = $1,
         campus = $2,
         academic_year = $3,
         tuition_cost_per_year = $4,
         boarding_cost_per_year = $5,
         food_cost_per_month = $6
       WHERE cost_share_id = $7
       RETURNING
         cost_share_id,
         program,
         campus,
         academic_year,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month,
         created_at`,
      [
        String(program).trim(),
        'Main Campus',
        String(academic_year).trim(),
        tuitionCost,
        boardingCost,
        foodCost,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cost configuration not found' });
    }

    res.json({ success: true, cost: result.rows[0] });
  } catch (error) {
    if (error && error.code === '23505') {
      return res.status(409).json({
        error: 'Cost configuration already exists for this program and academic year',
      });
    }
    console.error('Update cost share error:', error);
    res.status(500).json({ error: 'Failed to update cost configuration' });
  }
});

// DELETE /api/admin/cost-shares/:id — delete a cost configuration
router.delete('/cost-shares/:id', async (req, res) => {
  try {
    if (!requireAdminOnly(req, res)) return;

    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM public.cost_shares WHERE cost_share_id = $1 RETURNING cost_share_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cost configuration not found' });
    }

    res.json({ success: true, message: 'Cost configuration deleted' });
  } catch (error) {
    console.error('Delete cost share error:', error);
    res.status(500).json({ error: 'Failed to delete cost configuration' });
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
    const FOOD_MONTHS_PER_YEAR = 10;

    client = await pool.connect();
    await client.query('BEGIN');

    const hasSemesterAmounts = (
      await client.query(
        `SELECT to_regclass('public.semester_amounts') AS table_name`
      )
    ).rows[0].table_name;

    const hasCostShares = (
      await client.query(
        `SELECT to_regclass('public.cost_shares') AS table_name`
      )
    ).rows[0].table_name;

    if (!hasSemesterAmounts && !hasCostShares) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Neither semester_amounts nor cost_shares tables are available for reconciliation.',
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

    const costShareCols = hasCostShares
      ? await getAvailableColumns('cost_shares', ['food_cost_per_month', 'campus'])
      : new Set();
    const hasFoodCostPerMonth = costShareCols.has('food_cost_per_month');
    const hasCostShareCampus = costShareCols.has('campus');

    const studentCols = await getAvailableColumns('students', ['campus', 'department', 'enrollment_status']);
    const contractCols = await getAvailableColumns('contracts', ['program', 'academic_year', 'tuition_share_percent', 'is_active']);

    const hasStudentCampus = studentCols.has('campus');
    const hasStudentDepartment = studentCols.has('department');
    const hasStudentEnrollmentStatus = studentCols.has('enrollment_status');
    const hasContractProgram = contractCols.has('program');
    const hasContractAcademicYear = contractCols.has('academic_year');
    const hasContractTuitionSharePercent = contractCols.has('tuition_share_percent');
    const hasContractIsActive = contractCols.has('is_active');

    if (!hasContractAcademicYear || !hasContractTuitionSharePercent) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'contracts schema is missing academic_year or tuition_share_percent columns.',
      });
    }

    const studentCampusExpr = hasStudentCampus ? 's.campus' : "'Main Campus'::text";
    const studentDepartmentExpr = hasStudentDepartment ? 's.department' : "''::text";
    const contractProgramExpr = hasContractProgram ? 'c.program' : 'NULL::text';
    const activeContractCondition = hasContractIsActive ? 'AND c.is_active = true' : '';
    const enrollmentFilter = hasStudentEnrollmentStatus
      ? "WHERE UPPER(COALESCE(s.enrollment_status, '')) IN ('ACTIVE', 'GRADUATED')"
      : '';

    const semesterAmountRows = hasSemesterAmounts
      ? (
          await client.query(
            `SELECT
               academic_year,
               campus,
               program_type,
               tuition_cost_per_year,
               boarding_cost_per_year,
               food_cost_per_month,
               health_insurance_fee,
               other_fees,
               effective_from
             FROM public.semester_amounts
             ORDER BY effective_from DESC, id DESC`
          )
        ).rows
      : [];

    const costShareRows = hasCostShares
      ? (
          await client.query(
            `SELECT
               program,
               academic_year,
               ${hasCostShareCampus ? 'campus' : "'Main Campus'::text AS campus"},
               tuition_cost_per_year,
               boarding_cost_per_year,
               ${hasFoodCostPerMonth ? 'food_cost_per_month' : '0::numeric AS food_cost_per_month'}
             FROM public.cost_shares`
          )
        ).rows
      : [];

    const candidates = await client.query(
      `SELECT
         s.student_id,
         COALESCE(${contractProgramExpr}, ${studentDepartmentExpr}) AS program,
         ${studentDepartmentExpr} AS department,
         ${studentCampusExpr} AS campus,
         c.academic_year,
         c.tuition_share_percent
       FROM public.students s
       JOIN public.contracts c
         ON c.student_id = s.student_id
        ${activeContractCondition}
       ${enrollmentFilter}`
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
      const academicYear = String(row.academic_year || '').trim();
      const campus = normalizeCampus(row.campus);
      const tuitionSharePercent = Number(row.tuition_share_percent);

      const programType = inferProgramType(row.program || row.department);

      const semesterConfig = semesterAmountRows.find((config) =>
        String(config.academic_year || '').trim().toLowerCase() === academicYear.toLowerCase()
        && String(config.campus || '').trim().toLowerCase() === campus.toLowerCase()
        && String(config.program_type || '').trim().toLowerCase() === programType.toLowerCase()
      )
      || semesterAmountRows.find((config) =>
        String(config.academic_year || '').trim().toLowerCase() === academicYear.toLowerCase()
        && String(config.program_type || '').trim().toLowerCase() === programType.toLowerCase()
      )
      || semesterAmountRows.find((config) =>
        String(config.academic_year || '').trim().toLowerCase() === academicYear.toLowerCase()
      );

      let tuitionCost;
      let boardingCost;
      let foodCostPerMonth;
      let healthInsuranceFee = 0;
      let otherFees = 0;

      if (semesterConfig) {
        tuitionCost = Number(semesterConfig.tuition_cost_per_year);
        boardingCost = Number(semesterConfig.boarding_cost_per_year);
        foodCostPerMonth = Number(semesterConfig.food_cost_per_month);
        healthInsuranceFee = Number(semesterConfig.health_insurance_fee || 0);
        otherFees = Number(semesterConfig.other_fees || 0);
      } else {
        const costShareConfig = costShareRows.find((config) =>
          String(config.academic_year || '').trim().toLowerCase() === academicYear.toLowerCase()
          && String(config.program || '').trim().toLowerCase() === String(row.program || '').trim().toLowerCase()
        )
        || costShareRows.find((config) =>
          String(config.academic_year || '').trim().toLowerCase() === academicYear.toLowerCase()
        );

        tuitionCost = Number(costShareConfig?.tuition_cost_per_year);
        boardingCost = Number(costShareConfig?.boarding_cost_per_year);
        foodCostPerMonth = Number(costShareConfig?.food_cost_per_month);
      }

      if (
        Number.isNaN(tuitionCost)
        || Number.isNaN(boardingCost)
        || Number.isNaN(foodCostPerMonth)
        || Number.isNaN(tuitionSharePercent)
      ) {
        skippedCount += 1;
        continue;
      }

      const tuitionDebt = (tuitionCost * tuitionSharePercent) / 100;
      const foodDebt = foodCostPerMonth * FOOD_MONTHS_PER_YEAR;
      const targetDebt = Number((tuitionDebt + boardingCost + foodDebt + healthInsuranceFee + otherFees).toFixed(2));
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

// GET /api/admin/database/health — lightweight DB health monitoring
router.get('/database/health', async (req, res) => {
  try {
    const startedAt = Date.now();
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - startedAt;

    const [studentsCountResult, debtCountResult, pendingPaymentsResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM public.students'),
      pool.query('SELECT COUNT(*)::int AS count FROM public.debt_records WHERE current_balance > 0'),
      pool.query("SELECT COUNT(*)::int AS count FROM public.payment_history WHERE UPPER(COALESCE(status, '')) = 'PENDING'"),
    ]);

    res.json({
      success: true,
      data: {
        status: 'healthy',
        checked_at: new Date().toISOString(),
        latency_ms: latencyMs,
        totals: {
          students: Number(studentsCountResult.rows[0]?.count || 0),
          debtors: Number(debtCountResult.rows[0]?.count || 0),
          pending_payments: Number(pendingPaymentsResult.rows[0]?.count || 0),
        },
      },
    });
  } catch (error) {
    console.error('Database health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Database health check failed',
      data: {
        status: 'unhealthy',
        checked_at: new Date().toISOString(),
      },
    });
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
    if (!requireAdminOnly(req, res)) return;

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
