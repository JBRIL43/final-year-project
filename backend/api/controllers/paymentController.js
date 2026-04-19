const pool = require('../config/db');
const { sendPaymentNotification } = require('../utils/notifications');
const firebaseAdmin = require('../config/firebaseAdmin');

function resolveStatusMode(sampleStatus) {
  const value = String(sampleStatus || '').trim();
  if (!value) {
    return {
      pending: 'PENDING',
    };
  }

  return value === value.toLowerCase()
    ? { pending: 'pending' }
    : { pending: 'PENDING' };
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

  if (email) {
    const existingUserByEmail = await pool.query(
      `SELECT user_id, firebase_uid, full_name
       FROM public.users
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       LIMIT 1`,
      [email]
    );

    if (existingUserByEmail.rows.length > 0) {
      const userRow = existingUserByEmail.rows[0];
      const repairedFirebaseUid = firebaseUid || userRow.firebase_uid || `local-${Date.now()}`;

      const repairedStudent = await pool.query(
        `SELECT student_id, user_id
         FROM public.students
         WHERE user_id = $1
         LIMIT 1`,
        [userRow.user_id]
      );

      if (repairedStudent.rows.length > 0) {
        return {
          studentId: Number(repairedStudent.rows[0].student_id),
          userId: Number(userRow.user_id),
        };
      }

      if (studentEmailColumn.rows.length > 0) {
        const studentByEmail = await pool.query(
          `SELECT student_id, user_id
           FROM public.students
           WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
           ORDER BY student_id DESC
           LIMIT 1`,
          [email]
        );

        if (studentByEmail.rows.length > 0) {
          const studentRow = studentByEmail.rows[0];
          await pool.query(
            `UPDATE public.users
             SET firebase_uid = COALESCE($1, firebase_uid)
             WHERE user_id = $2`,
            [repairedFirebaseUid, userRow.user_id]
          );

          if (!studentRow.user_id) {
            await pool.query(
              `UPDATE public.students
               SET user_id = $1
               WHERE student_id = $2`,
              [userRow.user_id, studentRow.student_id]
            );
          }

          return {
            studentId: Number(studentRow.student_id),
            userId: Number(userRow.user_id),
          };
        }
      }
    }
  }
      return {
        studentId: Number(fallbackStudent.rows[0].student_id),
        userId: Number(fallbackStudent.rows[0].user_id),
      };
    }
  }

  // Last-resort self-healing: if the student row exists by email but the user link is stale or missing,
  // reconcile public.users and public.students so valid Firebase logins can submit payments.
  if (email && studentEmailColumn.rows.length > 0) {
    const candidateStudent = await pool.query(
      `SELECT student_id, user_id
       FROM public.students
       WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
       ORDER BY student_id DESC
       LIMIT 1`,
      [email]
    );

    if (candidateStudent.rows.length > 0) {
      const studentRow = candidateStudent.rows[0];
      let userId = Number(studentRow.user_id || 0);

      if (!userId) {
        const fullName = email.split('@')[0].replace(/[._-]+/g, ' ').trim() || email;
        const upsertUser = await pool.query(
          `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at)
           VALUES ($1, $2, $3, 'STUDENT', NOW())
           ON CONFLICT (email) DO UPDATE
           SET firebase_uid = COALESCE(EXCLUDED.firebase_uid, public.users.firebase_uid),
               full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.users.full_name)
           RETURNING user_id`,
          [firebaseUid || `local-${Date.now()}`, email, fullName]
        );

        userId = Number(upsertUser.rows[0].user_id);

        await pool.query(
          `UPDATE public.students
           SET user_id = $1
           WHERE student_id = $2`,
          [userId, studentRow.student_id]
        );
      } else if (firebaseUid) {
        await pool.query(
          `UPDATE public.users
           SET firebase_uid = COALESCE($1, firebase_uid)
           WHERE user_id = $2`,
          [firebaseUid, userId]
        );
      }

      return {
        studentId: Number(studentRow.student_id),
        userId,
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

    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({
        error: 'Amount must be a valid positive number',
        code: 'INVALID_AMOUNT',
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

    const latestStatusResult = await client.query(
      `SELECT status
       FROM public.payment_history
       WHERE debt_id = $1
         AND status IS NOT NULL
       ORDER BY payment_id DESC
       LIMIT 1`,
      [debtId]
    );
    const statusMode = resolveStatusMode(latestStatusResult.rows[0]?.status);

    const hasStudentId = await paymentHistoryHasStudentId();

    const pendingCheck = hasStudentId
      ? await client.query(
          `SELECT payment_id
           FROM public.payment_history
           WHERE student_id = $1
             AND UPPER(COALESCE(status, '')) = 'PENDING'
           LIMIT 1`,
          [resolvedStudent.studentId]
        )
      : await client.query(
          `SELECT ph.payment_id
           FROM public.payment_history ph
           JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
           WHERE dr.student_id = $1
             AND UPPER(COALESCE(ph.status, '')) = 'PENDING'
           LIMIT 1`,
          [resolvedStudent.studentId]
        );

    if (pendingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'You already have a pending payment under review',
        code: 'PENDING_PAYMENT_EXISTS',
      });
    }

    const insertQuery = hasStudentId
      ? `INSERT INTO public.payment_history
         (debt_id, student_id, amount, payment_method, transaction_ref, status, verified_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`
      : `INSERT INTO public.payment_history
         (debt_id, amount, payment_method, transaction_ref, status, verified_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`;

    const values = hasStudentId
      ? [
          debtId,
          resolvedStudent.studentId,
          normalizedAmount,
          paymentMethod,
          transactionRef || null,
          statusMode.pending,
          verifiedBy,
          notes || null,
        ]
      : [
          debtId,
          normalizedAmount,
          paymentMethod,
          transactionRef || null,
          statusMode.pending,
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
        `Your payment of ETB ${normalizedAmount} is pending finance verification.`,
        {
          type: 'PAYMENT_SUBMITTED',
          paymentId: String(createdPayment.payment_id),
          debtId: String(debtId),
          status: statusMode.pending,
        }
      );
    }

    for (const financeUser of financeUsersResult.rows) {
      await sendPaymentNotification(
        financeUser.user_id,
        'New Payment Needs Review',
        `A ${paymentMethod} payment of ETB ${normalizedAmount} was submitted and is pending verification.`,
        {
          type: 'PAYMENT_PENDING_VERIFICATION',
          paymentId: String(createdPayment.payment_id),
          debtId: String(debtId),
          status: statusMode.pending,
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

exports.getStudentPayments = async (req, res) => {
  try {
    const resolvedStudent = await resolveStudentFromRequest(req);
    if (!resolvedStudent) {
      return res.status(401).json({
        error: 'Unable to resolve logged-in student',
        code: 'UNAUTHORIZED',
      });
    }

    const hasStudentId = await paymentHistoryHasStudentId();
    const result = hasStudentId
      ? await pool.query(
          `SELECT
             payment_id,
             amount,
             status,
             payment_method,
             transaction_ref,
             notes,
             submitted_at,
             payment_date,
             reviewed_at
           FROM public.payment_history
           WHERE student_id = $1
           ORDER BY COALESCE(submitted_at, payment_date) DESC NULLS LAST, payment_id DESC`,
          [resolvedStudent.studentId]
        )
      : await pool.query(
          `SELECT
             ph.payment_id,
             ph.amount,
             ph.status,
             ph.payment_method,
             ph.transaction_ref,
             ph.notes,
             ph.submitted_at,
             ph.payment_date,
             ph.reviewed_at
           FROM public.payment_history ph
           JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
           WHERE dr.student_id = $1
           ORDER BY COALESCE(ph.submitted_at, ph.payment_date) DESC NULLS LAST, ph.payment_id DESC`,
          [resolvedStudent.studentId]
        );

    const hasPending = result.rows.some((row) => String(row.status || '').toUpperCase() === 'PENDING');
    res.json({
      success: true,
      payments: result.rows,
      hasPending,
    });
  } catch (error) {
    console.error('Fetch student payments error:', error);
    res.status(500).json({
      error: 'Failed to load payment history',
      code: 'SERVER_ERROR',
    });
  }
};