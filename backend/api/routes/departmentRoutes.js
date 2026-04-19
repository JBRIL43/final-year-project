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
      'department',
      'campus',
      'enrollment_status',
      'credit_load',
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
    const campusExpr = studentColumns.has('campus') ? 's.campus' : "'Main Campus'::text";
    const enrollmentExpr = studentColumns.has('enrollment_status') ? 's.enrollment_status' : "'ACTIVE'::text";
    const creditLoadExpr = studentColumns.has('credit_load') ? 's.credit_load' : 'NULL::numeric';
    const updatedAtExpr = studentColumns.has('updated_at') ? 's.updated_at' : 'NULL::timestamp';

    const result = await pool.query(
      `SELECT
         s.student_id,
         s.student_number,
         ${fullNameExpr} AS full_name,
         s.department,
         ${campusExpr} AS campus,
         ${creditLoadExpr} AS credit_load,
         ${enrollmentExpr} AS enrollment_status,
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
