const pool = require('../config/db');

// UC-03: Record new payment
exports.recordPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, transactionRef, notes } = req.body;
    
    // For MVP: Hardcode debt_id = 1 (Abebe Kebede)
    const debtId = 1;
    const verifiedBy = 1; // Abebe Kebede user_id

    // Validate required fields
    if (!amount || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Amount and payment method are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate payment method
    const validMethods = ['CHAPA', 'RECEIPT', 'BANK_TRANSFER'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ 
        error: 'Invalid payment method',
        code: 'INVALID_METHOD'
      });
    }

    // Insert payment record
    const result = await pool.query(
      `INSERT INTO public.payment_history 
       (debt_id, amount, payment_method, transaction_ref, status, verified_by, notes)
      VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
       RETURNING *`,
      [debtId, amount, paymentMethod, transactionRef || null, verifiedBy, notes || null]
    );

    // Update current balance in debt_records
    await pool.query(
      `UPDATE public.debt_records 
       SET current_balance = current_balance - $1, last_updated = NOW()
       WHERE debt_id = $2`,
      [amount, debtId]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment: result.rows[0]
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
      code: 'SERVER_ERROR'
    });
  }
};