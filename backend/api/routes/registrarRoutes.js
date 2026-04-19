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

router.use(authenticateRequest, requireRoles(['registrar']));

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
