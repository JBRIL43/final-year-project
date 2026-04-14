const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/students', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.student_id,
        s.user_id,
        s.student_number,
        u.full_name,
        u.email,
        s.department,
        s.batch_year AS enrollment_year,
        s.living_arrangement,
        s.enrollment_status,
        s.created_at,
        NULL::timestamp AS updated_at
      FROM public.students s
      LEFT JOIN public.users u ON s.user_id = u.user_id
      ORDER BY s.student_number
    `);

    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('Admin students error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch students' });
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
