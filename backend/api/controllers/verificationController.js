const pool = require('../config/db');

// UC-04: Get pending payments for verification
exports.getPendingPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         ph.payment_id,
         s.student_number,
         u.full_name,
         ph.amount,
         ph.payment_method,
         ph.transaction_ref,
         ph.notes,
         ph.payment_date,
         ph.status
       FROM payment_history ph
       JOIN debt_records dr ON ph.debt_id = dr.debt_id
       JOIN students s ON dr.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE ph.status = 'PENDING'
       ORDER BY ph.payment_date DESC`
    );

    res.json({
      success: true,
      pendingPayments: result.rows
    });
  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
};

// UC-04: Verify a payment
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, verifiedBy, action } = req.body;
    
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    // Get current payment details
    const paymentResult = await pool.query(
      'SELECT debt_id, amount, status FROM payment_history WHERE payment_id = $1',
      [paymentId]
    );
    
    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentResult.rows[0];
    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Payment is not pending verification' });
    }

    const newStatus = action === 'APPROVE' ? 'SUCCESS' : 'REJECTED';
    
    // Update payment status
    await pool.query(
      'UPDATE payment_history SET status = $1, verified_by = $2 WHERE payment_id = $3',
      [newStatus, verifiedBy, paymentId]
    );

    // Only update debt balance if approved
    if (action === 'APPROVE') {
      await pool.query(
        'UPDATE debt_records SET current_balance = current_balance - $1 WHERE debt_id = $2',
        [payment.amount, payment.debt_id]
      );
    }

    res.json({
      success: true,
      message: `Payment ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
      paymentId: paymentId,
      newStatus: newStatus
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};
