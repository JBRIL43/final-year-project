const express = require('express');
const pool = require('../config/db');

const router = express.Router();

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

module.exports = router;
