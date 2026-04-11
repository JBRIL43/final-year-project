const pool = require('../config/db');

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
  try {
    const { amount, paymentMethod, transactionRef, notes } = req.body;

    // MVP defaults (replace with authenticated user context in production)
    const debtId = 1;
    const studentId = 1;
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

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment: result.rows[0],
    });
  } catch (error) {
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
  }
};