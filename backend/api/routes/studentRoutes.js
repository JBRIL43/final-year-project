const express = require('express');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');

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

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    let firebaseUid = null;
    let email = null;

    if (token && firebaseAdmin && firebaseAdmin.apps.length > 0) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        firebaseUid = decoded.uid || null;
        email = decoded.email || null;
      } catch (error) {
        console.warn('Token verification failed for /api/student/*:', error.message);
      }
    }

    if (!firebaseUid && req.headers['x-firebase-uid']) {
      firebaseUid = String(req.headers['x-firebase-uid']).trim();
    }

    if (!email && req.headers['x-user-email']) {
      email = String(req.headers['x-user-email']).trim().toLowerCase();
    }

    if (!firebaseUid && !email) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const userResult = await pool.query(
      `SELECT s.student_id
       FROM public.users u
       JOIN public.students s ON s.user_id = u.user_id
       WHERE ($1::text IS NOT NULL AND u.firebase_uid = $1)
          OR ($2::text IS NOT NULL AND LOWER(TRIM(u.email)) = LOWER(TRIM($2)))
       ORDER BY CASE WHEN $1::text IS NOT NULL AND u.firebase_uid = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [firebaseUid, email]
    );

    let studentId = userResult.rows.length > 0
      ? Number(userResult.rows[0].student_id)
      : null;

    // Fallback for old rows where students.email exists but linkage is missing.
    if (!studentId && email) {
      const hasStudentEmail = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'students'
           AND column_name = 'email'
         LIMIT 1`
      );

      if (hasStudentEmail.rows.length > 0) {
        const byEmail = await pool.query(
          `SELECT student_id
           FROM public.students
           WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
           ORDER BY student_id DESC
           LIMIT 1`,
          [email]
        );

        if (byEmail.rows.length > 0) {
          studentId = Number(byEmail.rows[0].student_id);
        }
      }
    }

    if (!studentId) {
      return res.status(401).json({
        error: 'Unable to resolve logged-in student',
        code: 'UNAUTHORIZED',
      });
    }

    req.user = {
      student_id: studentId,
      firebase_uid: firebaseUid,
      email,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

// GET /api/student/cost-breakdown — get student's detailed cost statement
router.get('/cost-breakdown', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;

    const studentCols = await getAvailableColumns('students', ['full_name', 'campus']);
    const costCols = await getAvailableColumns('cost_shares', ['campus', 'food_cost_per_month']);
    const contractCols = await getAvailableColumns('contracts', ['is_active']);

    const hasStudentFullName = studentCols.has('full_name');
    const hasStudentCampus = studentCols.has('campus');
    const hasFoodCostPerMonth = costCols.has('food_cost_per_month');
    const hasContractIsActive = contractCols.has('is_active');

    const fullNameExpr = hasStudentFullName ? 's.full_name' : 'u.full_name';
    const studentCampusExpr = hasStudentCampus ? 's.campus' : "'Main Campus'::text";
    const needsUsersJoin = !hasStudentFullName;

    const activeContractClause = hasContractIsActive ? 'AND c.is_active = true' : '';

    const result = await pool.query(
      `SELECT
         ${fullNameExpr} AS full_name,
         COALESCE(c.program, s.department) AS department,
         ${studentCampusExpr} AS campus,
         c.academic_year,
         cs.tuition_cost_per_year,
         cs.boarding_cost_per_year,
         ${hasFoodCostPerMonth ? 'cs.food_cost_per_month' : '3000::numeric'} AS food_cost_per_month,
         c.tuition_share_percent
       FROM public.students s
       JOIN public.contracts c
         ON s.student_id = c.student_id
        ${activeContractClause}
       JOIN public.cost_shares cs
         ON LOWER(TRIM(c.program)) = LOWER(TRIM(cs.program))
        AND c.academic_year = cs.academic_year
       ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
       WHERE s.student_id = $1
       LIMIT 1`,
      [studentId]
    );

    // Fallback for older/incomplete data where contracts or cost_shares are missing.
    if (result.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT
           ${fullNameExpr} AS full_name,
           s.department,
           ${studentCampusExpr} AS campus,
           dr.initial_amount,
           dr.current_balance
         FROM public.students s
         LEFT JOIN public.debt_records dr ON dr.student_id = s.student_id
         ${needsUsersJoin ? 'LEFT JOIN public.users u ON s.user_id = u.user_id' : ''}
         WHERE s.student_id = $1
         ORDER BY dr.debt_id DESC NULLS LAST
         LIMIT 1`,
        [studentId]
      );

      if (fallback.rows.length === 0) {
        return res.status(404).json({ error: 'Cost breakdown not found' });
      }

      const row = fallback.rows[0];
      const fallbackTotal = Number(row.initial_amount || row.current_balance || 0);

      return res.json({
        success: true,
        fallback: true,
        costBreakdown: {
          fullName: row.full_name,
          program: row.department,
          campus: row.campus,
          academicYear: 'N/A',
          tuitionFullCost: 0,
          tuitionStudentShare: 0,
          boardingCost: 0,
          foodCostMonthly: 0,
          foodCostAnnual: 0,
          totalDebt: Number(fallbackTotal.toFixed(2)),
        },
      });
    }

    const data = result.rows[0];
    const tuitionCost = Number(data.tuition_cost_per_year || 0);
    const tuitionSharePercent = Number(data.tuition_share_percent || 15);
    const boardingCost = Number(data.boarding_cost_per_year || 0);
    const foodCostMonthly = Number(data.food_cost_per_month || 0);

    const tuitionShare = tuitionCost * (tuitionSharePercent / 100);
    const foodAnnual = foodCostMonthly * 10;
    const totalDebt = tuitionShare + boardingCost + foodAnnual;

    const payments = await pool.query(
      `SELECT
         ph.payment_id,
         ph.amount,
         ph.payment_method,
         ph.transaction_ref,
         ph.status,
         ph.payment_date
       FROM public.payment_history ph
       JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
       WHERE dr.student_id = $1
       ORDER BY ph.payment_date DESC`,
      [studentId]
    );

    res.json({
      success: true,
      costBreakdown: {
        fullName: data.full_name,
        program: data.department,
        campus: data.campus,
        academicYear: data.academic_year,
        tuitionFullCost: tuitionCost,
        tuitionStudentShare: Number(tuitionShare.toFixed(2)),
        boardingCost: boardingCost,
        foodCostMonthly: foodCostMonthly,
        foodCostAnnual: Number(foodAnnual.toFixed(2)),
        totalDebt: Number(totalDebt.toFixed(2)),
      },
      paymentHistory: payments.rows,
    });
  } catch (error) {
    console.error('Cost breakdown error:', error);
    res.status(500).json({ error: 'Failed to load cost breakdown' });
  }
});

// GET /api/student/payments — get student's payment history
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;

    const result = await pool.query(
      `SELECT
         ph.payment_id,
         ph.amount,
         ph.payment_method,
         ph.transaction_ref,
         ph.status,
         ph.payment_date
       FROM public.payment_history ph
       JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
       WHERE dr.student_id = $1
       ORDER BY ph.payment_date DESC`,
      [studentId]
    );

    res.json({
      success: true,
      payments: result.rows,
    });
  } catch (error) {
    console.error('Student payments error:', error);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

// POST /api/student/withdrawal/request — submit student withdrawal request
router.post('/withdrawal/request', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.student_id;

    const studentColumns = await getAvailableColumns('students', [
      'withdrawal_requested_at',
      'department_withdrawal_approved',
      'registrar_withdrawal_processed',
      'updated_at',
    ]);

    if (!studentColumns.has('withdrawal_requested_at')) {
      return res.status(400).json({
        error: 'students.withdrawal_requested_at column is missing. Run withdrawal workflow migration first.',
      });
    }

    const existing = await pool.query(
      `SELECT withdrawal_requested_at
       FROM public.students
       WHERE student_id = $1
       LIMIT 1`,
      [studentId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (existing.rows[0].withdrawal_requested_at) {
      return res.status(409).json({ error: 'Withdrawal already requested' });
    }

    const setParts = ['withdrawal_requested_at = NOW()'];
    if (studentColumns.has('department_withdrawal_approved')) {
      setParts.push('department_withdrawal_approved = NULL');
    }
    if (studentColumns.has('registrar_withdrawal_processed')) {
      setParts.push('registrar_withdrawal_processed = FALSE');
    }
    if (studentColumns.has('updated_at')) {
      setParts.push('updated_at = NOW()');
    }

    await pool.query(
      `UPDATE public.students
       SET ${setParts.join(', ')}
       WHERE student_id = $1`,
      [studentId]
    );

    return res.json({
      success: true,
      message: 'Withdrawal request submitted successfully. Awaiting department approval.',
    });
  } catch (error) {
    console.error('Withdrawal request error:', error);
    return res.status(500).json({ error: 'Failed to submit withdrawal request' });
  }
});

module.exports = router;
