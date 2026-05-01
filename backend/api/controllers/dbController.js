const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');

function normalizePaymentModel(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

  if (normalized === 'pre_payment') return 'pre_payment';
  if (normalized === 'hybrid') return 'hybrid';
  return 'post_graduation';
}

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
        OR ($2::text IS NOT NULL AND LOWER(TRIM(u.email)) = LOWER(TRIM($2)))
     ORDER BY CASE WHEN $1::text IS NOT NULL AND u.firebase_uid = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [firebaseUid, email]
  );

  if (userResult.rows.length > 0) {
    return Number(userResult.rows[0].student_id);
  }

  // Backward-compatible fallback for records where students.email exists but user linkage is missing.
  if (email) {
    const columnCheck = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'students'
         AND column_name = 'email'
       LIMIT 1`
    );

    if (columnCheck.rows.length > 0) {
      const studentByEmail = await pool.query(
        `SELECT student_id
         FROM public.students
         WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         ORDER BY student_id DESC
         LIMIT 1`,
        [email]
      );

      if (studentByEmail.rows.length > 0) {
        return Number(studentByEmail.rows[0].student_id);
      }
    }
  }

  return null;
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
        s.payment_model,
        s.pre_payment_amount,
        s.pre_payment_date,
        s.pre_payment_clearance,
        s.living_arrangement,
        s.enrollment_status,
        s.withdrawal_status,
        s.withdrawal_requested_at,
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
       FROM public.students s
       JOIN public.users u ON s.user_id = u.user_id
       LEFT JOIN public.debt_records dr ON dr.student_id = s.student_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Student record not found',
        code: 'STUDENT_NOT_FOUND'
      });
    }

    const debt = result.rows[0];
    const paymentModel = normalizePaymentModel(debt.payment_model);
    const initialAmount = Number(debt.initial_amount || 0);
    const currentBalance = Number(debt.current_balance || 0);
    const prePaymentAmount = Number(debt.pre_payment_amount || 0);
    const prePaymentCleared = Boolean(debt.pre_payment_clearance);

    let totalPaid = initialAmount - currentBalance;
    let displayedBalance = currentBalance;
    let isCleared = displayedBalance <= 0;

    if (paymentModel === 'pre_payment') {
      displayedBalance = prePaymentCleared ? 0 : prePaymentAmount;
      totalPaid = prePaymentAmount - displayedBalance;
      isCleared = prePaymentCleared;
    } else if (paymentModel === 'hybrid') {
      totalPaid += prePaymentAmount;
    }

    res.json({
      success: true,
       data: {
        studentId: debt.student_number,
        studentName: debt.full_name,
        paymentModel,
        prePaymentAmount: parseFloat(prePaymentAmount.toFixed(2)),
        prePaymentDate: debt.pre_payment_date,
        prePaymentClearance: prePaymentCleared,
        livingArrangement: debt.living_arrangement,
        enrollmentStatus: debt.enrollment_status,
        withdrawalStatus: debt.withdrawal_status || null,
        withdrawalRequestedAt: debt.withdrawal_requested_at || null,
        debtId: debt.debt_id,
        initialAmount: parseFloat(initialAmount.toFixed(2)),
        currentBalance: parseFloat(displayedBalance.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        lastUpdated: debt.last_updated,
        paymentHistory: debt.payment_history || [],
        isCleared,
        policyNotes: [
          "Per Ethiopian Council of Ministers Regulation No. 447/2024:",
          "- Living stipend debt applies ONLY to students with 'CASH_STIPEND' arrangement",
          "- Tuition share = 15% of full tuition amount",
          "- Living stipend = 3,000 ETB × 5 months = 15,000 ETB per semester",
          "- Pre-payment students are cleared against their upfront payment record",
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