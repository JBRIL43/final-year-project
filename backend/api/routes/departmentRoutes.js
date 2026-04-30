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

async function ensureDepartmentClearanceColumn() {
  const studentColumns = await getAvailableColumns('students', ['department_clearance']);
  if (studentColumns.has('department_clearance')) {
    return;
  }

  await pool.query(`
    ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS department_clearance VARCHAR(20) NOT NULL DEFAULT 'PENDING'
  `);
}

router.use(authenticateRequest, requireRoles(['department_head']));

router.get('/students', async (req, res) => {
  try {
    const studentColumns = await getAvailableColumns('students', [
      'student_id',
      'student_number',
      'full_name',
      'email',
      'department',
      'campus',
      'enrollment_status',
      'withdrawal_requested_at',
      'credits_registered',
      'department_clearance',
      'updated_at',
    ]);

    if (!studentColumns.has('student_id') || !studentColumns.has('student_number')) {
      return res.status(400).json({ error: 'students schema is missing required columns' });
    }

    const department = req.user?.role === 'admin'
      ? String(req.query.department || '').trim()
      : String(req.user?.department || '').trim();

    if (!department) {
      return res.status(400).json({ error: 'No department is configured for this user' });
    }

    const fullNameExpr = studentColumns.has('full_name') ? 's.full_name' : "''::text";
    const emailExpr = studentColumns.has('email') ? 's.email' : "''::text";
    const campusExpr = studentColumns.has('campus') ? 's.campus' : "'Main Campus'::text";
    const enrollmentExpr = studentColumns.has('enrollment_status') ? 's.enrollment_status' : "'ACTIVE'::text";
    const withdrawalRequestedAtExpr = studentColumns.has('withdrawal_requested_at')
      ? 's.withdrawal_requested_at'
      : 'NULL::timestamp';
    const creditsRegisteredExpr = studentColumns.has('credits_registered') ? 's.credits_registered' : 'NULL::integer';
    const departmentClearanceExpr = studentColumns.has('department_clearance')
      ? 's.department_clearance'
      : "'PENDING'::text";
    const updatedAtExpr = studentColumns.has('updated_at') ? 's.updated_at' : 'NULL::timestamp';

    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${fullNameExpr} AS full_name,
         ${emailExpr} AS email,
         s.department,
         ${campusExpr} AS campus,
         ${creditsRegisteredExpr} AS credits_registered,
         ${enrollmentExpr} AS enrollment_status,
         ${withdrawalRequestedAtExpr} AS withdrawal_requested_at,
         ${departmentClearanceExpr} AS department_clearance,
         ${updatedAtExpr} AS updated_at
       FROM public.students s
       WHERE LOWER(COALESCE(s.department, '')) = LOWER($1)
       ORDER BY s.student_id DESC`,
      [department]
    );

    res.json({
      success: true,
      department,
      students: result.rows,
    });
  } catch (error) {
    console.error('Department students list error:', error);
    res.status(500).json({ error: 'Failed to load department students' });
  }
});

router.put('/students/:id/clearance', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const clearanceStatus = String(req.body?.department_clearance || '').trim().toUpperCase();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(clearanceStatus)) {
      return res.status(400).json({
        error: 'department_clearance must be one of: pending, approved, rejected',
      });
    }

    await ensureDepartmentClearanceColumn();

    const studentColumns = await getAvailableColumns('students', [
      'department',
      'department_clearance',
      'updated_at',
    ]);

    const department = req.user?.role === 'admin'
      ? String(req.body?.department || '').trim()
      : String(req.user?.department || '').trim();

    if (!department) {
      return res.status(400).json({ error: 'No department is configured for this user' });
    }

    const query = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET department_clearance = $2,
             updated_at = NOW()
         WHERE student_id = $1
           AND LOWER(COALESCE(department, '')) = LOWER($3)
         RETURNING student_id, department, department_clearance, updated_at`
      : `UPDATE public.students
         SET department_clearance = $2
         WHERE student_id = $1
           AND LOWER(COALESCE(department, '')) = LOWER($3)
         RETURNING student_id, department, department_clearance, NOW()::timestamp AS updated_at`;

    const result = await pool.query(query, [studentId, clearanceStatus, department]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in your department' });
    }

    return res.json({
      success: true,
      message: 'Department clearance updated',
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Department clearance update error:', error);
    return res.status(500).json({ error: 'Failed to update department clearance' });
  }
});

// PUT /api/department/students/:id/credits — update credits and auto-calculate tuition share
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
      'department',
      'updated_at',
    ]);

    if (!studentColumns.has('credits_registered') || !studentColumns.has('tuition_share_percent')) {
      return res.status(400).json({
        error: 'students credit columns are missing. Run the credit load migration first.',
      });
    }

    const department = req.user?.role === 'admin'
      ? String(req.body?.department || '').trim()
      : String(req.user?.department || '').trim();

    if (req.user?.role !== 'admin' && !department) {
      return res.status(400).json({ error: 'No department is configured for this user' });
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
           AND ($4::text IS NULL OR LOWER(COALESCE(department, '')) = LOWER($4))
         RETURNING student_id, credits_registered, tuition_share_percent, updated_at`
      : `UPDATE public.students
         SET credits_registered = $1,
             tuition_share_percent = $2
         WHERE student_id = $3
           AND ($4::text IS NULL OR LOWER(COALESCE(department, '')) = LOWER($4))
         RETURNING student_id, credits_registered, tuition_share_percent, NOW()::timestamp AS updated_at`;

    const result = await pool.query(updateSql, [credits_registered, tuitionSharePercent, studentId, department || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in your department' });
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

// POST /api/department/students/:id/withdrawal/approve — approve or reject withdrawal request
router.post('/students/:id/withdrawal/approve', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const approved = req.body?.approved;

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Missing approval decision' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'department',
      'withdrawal_requested_at',
      'department_withdrawal_approved',
      'updated_at',
    ]);

    if (!studentColumns.has('withdrawal_requested_at') || !studentColumns.has('department_withdrawal_approved')) {
      return res.status(400).json({
        error: 'students withdrawal workflow columns are missing. Run withdrawal workflow migration first.',
      });
    }

    const department = req.user?.role === 'admin'
      ? String(req.body?.department || '').trim()
      : String(req.user?.department || '').trim();

    if (req.user?.role !== 'admin' && !department) {
      return res.status(400).json({ error: 'No department is configured for this user' });
    }

    const query = studentColumns.has('updated_at')
      ? `UPDATE public.students
         SET department_withdrawal_approved = $2,
             updated_at = NOW()
         WHERE student_id = $1
           AND withdrawal_requested_at IS NOT NULL
           AND ($3::text IS NULL OR LOWER(COALESCE(department, '')) = LOWER($3))
         RETURNING student_id, department, department_withdrawal_approved, withdrawal_requested_at, updated_at`
      : `UPDATE public.students
         SET department_withdrawal_approved = $2
         WHERE student_id = $1
           AND withdrawal_requested_at IS NOT NULL
           AND ($3::text IS NULL OR LOWER(COALESCE(department, '')) = LOWER($3))
         RETURNING student_id, department, department_withdrawal_approved, withdrawal_requested_at, NOW()::timestamp AS updated_at`;

    const result = await pool.query(query, [studentId, approved, department || null]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: req.user?.role === 'admin'
          ? 'Student not found or no withdrawal request exists'
          : 'Student not in your department or no withdrawal request exists',
      });
    }

    const action = approved ? 'approved' : 'rejected';
    
    if (approved) {
      try {
        const studentQuery = await pool.query('SELECT full_name FROM public.students WHERE student_id = $1', [studentId]);
        const studentName = studentQuery.rows[0]?.full_name || 'A student';
        const financeOfficers = await pool.query("SELECT user_id FROM users WHERE role = 'finance'");
        
        for (const officer of financeOfficers.rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, type, message, data)
             VALUES ($1, $2, $3, $4)`,
            [
              officer.user_id,
              'finance_review_needed',
              `${studentName} was academically approved for withdrawal. Please calculate final settlement.`,
              JSON.stringify({ student_id: studentId })
            ]
          );
        }
      } catch (err) {
        console.error('Failed to notify finance officers:', err);
      }
    }

    return res.json({
      success: true,
      message: `Withdrawal request ${action} successfully.`,
      student: result.rows[0],
    });
  } catch (error) {
    console.error('Withdrawal approval error:', error);
    return res.status(500).json({ error: 'Failed to process withdrawal approval' });
  }
});

module.exports = router;
