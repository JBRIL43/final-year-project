const express = require('express');
const pool = require('../config/db');

const router = express.Router();

router.get('/students', async (req, res) => {
  console.log('✅ Admin students route hit');
  try {
    const result = await pool.query(`
      SELECT
        s.student_id,
        s.user_id,
        s.student_number,
        s.full_name,
        s.email,
        s.department,
        s.enrollment_year,
        s.living_arrangement,
        s.enrollment_status,
        s.created_at,
        s.updated_at
      FROM students s
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
