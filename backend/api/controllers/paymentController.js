const pool = require('../config/db');
const { sendPaymentNotification } = require('../utils/notifications');
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
      console.warn('Token verification failed for /api/payment/record:', error.message);
    }
  }

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
    `SELECT
       s.student_id,
       s.user_id
     FROM public.users u
     JOIN public.students s ON s.user_id = u.user_id
     WHERE ($1::text IS NOT NULL AND u.firebase_uid = $1)
        OR ($2::text IS NOT NULL AND LOWER(TRIM(u.email)) = LOWER(TRIM($2)))
     ORDER BY CASE WHEN $1::text IS NOT NULL AND u.firebase_uid = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    [firebaseUid, email]
  );

  if (userResult.rows.length > 0) {
    return {
      studentId: Number(userResult.rows[0].student_id),
      userId: Number(userResult.rows[0].user_id),
    };
  }

  const studentEmailColumn = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'students'
       AND column_name = 'email'
     LIMIT 1`
  );

  if (email && studentEmailColumn.rows.length > 0) {
    const fallbackStudent = await pool.query(
      `SELECT student_id, user_id
       FROM public.students
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       ORDER BY student_id DESC
       LIMIT 1`,
      [email]
    );

    if (fallbackStudent.rows.length > 0) {
      return {
        studentId: Number(fallbackStudent.rows[0].student_id),
        userId: Number(fallbackStudent.rows[0].user_id),
      };
    }
  }

  return null;
}

const paymentHistoryHasStudentId = async () => {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'payment_history'
       AND column_name = 'student_id'
     LIMIT 1`
  );

  return result.rows.length > 0;
};

// UC-03: Record new payment
exports.recordPayment = async (req, res) => {
  let client;
  try {
    const { amount, paymentMethod, transactionRef, notes } = req.body;
    const verifiedBy = null;

    if (!amount || !paymentMethod) {
      return res.status(400).json({
        error: 'Amount and payment method are required',
        code: 'MISSING_FIELDS',
      });
    }

    const validMethods = ['CHAPA', 'RECEIPT', 'BANK_TRANSFER'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Invalid payment method',
        code: 'INVALID_METHOD',
      });
    }

    const resolvedStudent = await resolveStudentFromRequest(req);
    if (!resolvedStudent) {
      return res.status(401).json({
        error: 'Unable to resolve logged-in student',
        code: 'UNAUTHORIZED',
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const debtColumnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'debt_records'
         AND column_name = ANY($1::text[])`,
      [['debt_id', 'student_id', 'academic_year']]
    );
    const debtColumns = new Set(debtColumnsResult.rows.map((row) => row.column_name));

    const hasAcademicYear = debtColumns.has('academic_year');
    const debtResult = await client.query(
      `SELECT debt_id
       FROM public.debt_records
       WHERE student_id = $1
       ORDER BY ${hasAcademicYear ? 'academic_year DESC NULLS LAST,' : ''} debt_id DESC
       LIMIT 1`,
      [resolvedStudent.studentId]
    );

    if (debtResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'No debt record found for this student',
        code: 'DEBT_NOT_FOUND',
      });
    }

    const debtId = Number(debtResult.rows[0].debt_id);

    const hasStudentId = await paymentHistoryHasStudentId();

    const insertQuery = hasStudentId
      ? `INSERT INTO public.payment_history
         (debt_id, student_id, amount, payment_method, transaction_ref, status, verified_by, notes)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
         RETURNING *`
      : `INSERT INTO public.payment_history
         (debt_id, amount, payment_method, transaction_ref, status, verified_by, notes)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
         RETURNING *`;

    const values = hasStudentId
      ? [
          debtId,
          studentId,
          amount,
          paymentMethod,
          transactionRef || null,
          verifiedBy,
          notes || null,
        ]
      : [
          debtId,
          amount,
          paymentMethod,
          transactionRef || null,
          verifiedBy,
          notes || null,
        ];

    const result = await client.query(insertQuery, values);
    const createdPayment = result.rows[0];

    const studentUserResult = await client.query(
      `SELECT u.user_id
       FROM public.debt_records dr
       JOIN public.students s ON dr.student_id = s.student_id
       JOIN public.users u ON s.user_id = u.user_id
       WHERE dr.debt_id = $1
       LIMIT 1`,
      [debtId]
    );

    const financeUsersResult = await client.query(
      `SELECT user_id
       FROM public.users
       WHERE role = 'FINANCE_OFFICER'`
    );

    await client.query('COMMIT');

    const studentUserId = studentUserResult.rows[0]?.user_id;

    if (studentUserId) {
      await sendPaymentNotification(
        studentUserId,
        'Payment Submitted',
        `Your payment of ETB ${amount} is pending finance verification.`,
        {
          type: 'PAYMENT_SUBMITTED',
          paymentId: String(createdPayment.payment_id),
          debtId: String(debtId),
          status: 'PENDING',
        }
      );
    }

    for (const financeUser of financeUsersResult.rows) {
      await sendPaymentNotification(
        financeUser.user_id,
        'New Payment Needs Review',
        `A ${paymentMethod} payment of ETB ${amount} was submitted and is pending verification.`,
        {
          type: 'PAYMENT_PENDING_VERIFICATION',
          paymentId: String(createdPayment.payment_id),
          debtId: String(debtId),
          status: 'PENDING',
        }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment: createdPayment,
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Payment recording error:', {
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
      error: 'Failed to record payment',
      code: 'SERVER_ERROR',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};