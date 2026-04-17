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

router.post('/students', async (req, res) => {
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

    const existing = await pool.query(
      'SELECT student_id FROM public.students WHERE student_number = $1 OR email = $2 LIMIT 1',
      [student_number, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Student ID or email already exists' });
    }

    const existingUser = await pool.query(
      'SELECT user_id FROM public.users WHERE email = $1 LIMIT 1',
      [email]
    );

    let userId;
    if (existingUser.rows.length > 0) {
      userId = existingUser.rows[0].user_id;
    } else {
      const firebaseUid = `local-${student_number}-${Date.now()}`;
      const userResult = await pool.query(
        `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at)
         VALUES ($1, $2, $3, 'STUDENT', NOW())
         RETURNING user_id`,
        [firebaseUid, email, full_name]
      );
      userId = userResult.rows[0].user_id;
    }

    const columnsResult = await pool.query(
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

    const studentResult = await pool.query(insertSql, [
      userId,
      student_number,
      full_name,
      email,
      department,
      Number(enrollment_year),
      normalizeLivingArrangement(living_arrangement),
      normalizeEnrollmentStatus(enrollment_status),
    ]);

    res.status(201).json({ success: true, student: studentResult.rows[0] });
  } catch (error) {
    console.error('Create student error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to create student' });
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
