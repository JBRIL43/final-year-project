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
      'credit_load',
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
    const creditLoadExpr = studentColumns.has('credit_load') ? 's.credit_load' : 'NULL::numeric';
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
         ${creditLoadExpr} AS credit_load,
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

    const studentColumns = await getAvailableColumns('students', [
      'department',
      'department_clearance',
      'updated_at',
    ]);

    if (!studentColumns.has('department_clearance')) {
      return res.status(400).json({
        error: 'students.department_clearance column is missing. Run department clearance migration first.',
      });
    }

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

router.post('/students/:id/actions', async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    const action = String(req.body?.action || '').trim();
    const newDepartment = String(req.body?.newDepartment || '').trim();

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const studentColumns = await getAvailableColumns('students', [
      'department',
      'enrollment_status',
      'updated_at',
    ]);

    if (!studentColumns.has('enrollment_status')) {
      return res.status(400).json({ error: 'students.enrollment_status column is missing' });
    }

    if (action === 'approve_withdrawal') {
      const query = studentColumns.has('updated_at')
        ? `UPDATE public.students
           SET enrollment_status = 'WITHDRAWN', updated_at = NOW()
           WHERE student_id = $1
           RETURNING student_id, enrollment_status, department`
        : `UPDATE public.students
           SET enrollment_status = 'WITHDRAWN'
           WHERE student_id = $1
           RETURNING student_id, enrollment_status, department`;

      const result = await pool.query(query, [studentId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      return res.json({
        success: true,
        message: 'Withdrawal approved',
        student: result.rows[0],
      });
    }

    if (action === 'approve_program_change') {
      if (!newDepartment) {
        return res.status(400).json({ error: 'newDepartment is required for program change approval' });
      }

      if (!studentColumns.has('department')) {
        return res.status(400).json({ error: 'students.department column is missing' });
      }

      const query = studentColumns.has('updated_at')
        ? `UPDATE public.students
           SET department = $2, updated_at = NOW()
           WHERE student_id = $1
           RETURNING student_id, enrollment_status, department`
        : `UPDATE public.students
           SET department = $2
           WHERE student_id = $1
           RETURNING student_id, enrollment_status, department`;

      const result = await pool.query(query, [studentId, newDepartment]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      return res.json({
        success: true,
        message: 'Program change approved',
        student: result.rows[0],
      });
    }

    return res.status(400).json({
      error: "Unknown action. Use 'approve_withdrawal' or 'approve_program_change'.",
    });
  } catch (error) {
    console.error('Department action error:', error);
    res.status(500).json({ error: 'Failed to apply department action' });
  }
});

module.exports = router;
