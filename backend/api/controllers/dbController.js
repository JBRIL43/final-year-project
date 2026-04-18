const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');

async function resolveStudentFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  let firebaseUid = null;
  let email = null;

  if (token && firebaseAdmin && firebaseAdmin.apps.length > 0) {
    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      firebaseUid = decoded.uid || null;
      email = decoded.email || null;
    } catch (error) {
      console.warn('Token verification failed for /api/debt/balance:', error.message);
    }
  }

  // Development fallback when Firebase verification is unavailable.
  if (!firebaseUid) {
    const headerUid = req.headers['x-firebase-uid'];
    if (headerUid) {
      firebaseUid = String(headerUid).trim();
    }
  }

  if (!email) {
    const headerEmail = req.headers['x-user-email'];
    if (headerEmail) {
      email = String(headerEmail).trim().toLowerCase();
    }
  }

  if (!firebaseUid && !email) {
    return null;
  }

  const userResult = await pool.query(
    `SELECT s.student_id
     FROM public.users u
     JOIN public.students s ON s.user_id = u.user_id
     WHERE ($1::text IS NOT NULL AND u.firebase_uid = $1)
        OR ($2::text IS NOT NULL AND LOWER(u.email) = LOWER($2))
     ORDER BY CASE WHEN $1::text IS NOT NULL AND u.firebase_uid = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [firebaseUid, email]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  return Number(userResult.rows[0].student_id);
}

// UC-02: Get student debt balance with Ethiopian policy calculation
exports.getDebtBalance = async (req, res) => {
  try {
    const studentId = await resolveStudentFromRequest(req);

    if (!studentId) {
      return res.status(401).json({
        error: 'Unable to resolve logged-in student',
        code: 'UNAUTHORIZED',
      });
    }

    const result = await pool.query(
      `SELECT 
        dr.debt_id,
        dr.initial_amount,
        dr.current_balance,
        dr.last_updated,
        s.student_number,
        u.full_name,
        s.living_arrangement,
        s.enrollment_status,
        (
          SELECT json_agg(
            json_build_object(
              'payment_id', ph.payment_id,
              'amount', ph.amount,
              'payment_method', ph.payment_method,
              'transaction_ref', ph.transaction_ref,
              'status', ph.status,
              'payment_date', ph.payment_date
            ) ORDER BY ph.payment_date DESC
          )
          FROM public.payment_history ph
          WHERE ph.debt_id = dr.debt_id
        ) as payment_history
       FROM public.debt_records dr
       JOIN public.students s ON dr.student_id = s.student_id
       JOIN public.users u ON s.user_id = u.user_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student debt record not found',
        code: 'DEBT_NOT_FOUND'
      });
    }

    const debt = result.rows[0];
    const totalPaid = debt.initial_amount - debt.current_balance;

    res.json({
      success: true,
       data: {
        studentId: debt.student_number,
        studentName: debt.full_name,
        livingArrangement: debt.living_arrangement,
        enrollmentStatus: debt.enrollment_status,
        debtId: debt.debt_id,
        initialAmount: parseFloat(debt.initial_amount),
        currentBalance: parseFloat(debt.current_balance),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        lastUpdated: debt.last_updated,
        paymentHistory: debt.payment_history || [],
        policyNotes: [
          "Per Ethiopian Council of Ministers Regulation No. 447/2024:",
          "- Living stipend debt applies ONLY to students with 'CASH_STIPEND' arrangement",
          "- Tuition share = 15% of full tuition amount",
          "- Living stipend = 3,000 ETB × 5 months = 15,000 ETB per semester",
          "- Graduation requires zero balance on ALL debts"
        ]
      }
    });

  } catch (error) {
    console.error('Debt balance error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: 'Failed to fetch debt balance',
      code: 'SERVER_ERROR'
    });
  }
};