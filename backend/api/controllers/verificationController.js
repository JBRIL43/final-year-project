const pool = require('../config/db');
const { sendPaymentNotification } = require('../utils/notifications');

function resolveStatusMode(sampleStatus) {
  const value = String(sampleStatus || '').trim();
  if (!value) {
    return {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
    };
  }

  const isUpperCase = value === value.toUpperCase();
  if (isUpperCase) {
    return {
      pending: 'PENDING',
      approved: 'SUCCESS',
      rejected: 'FAILED',
    };
  }

  return {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
  };
}

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
       FROM public.payment_history ph
       JOIN public.debt_records dr ON ph.debt_id = dr.debt_id
       JOIN public.students s ON dr.student_id = s.student_id
       JOIN public.users u ON s.user_id = u.user_id
       WHERE UPPER(COALESCE(ph.status, '')) = 'PENDING'
       ORDER BY ph.payment_date DESC`
    );

    res.json({
      success: true,
      pendingPayments: result.rows
    });
  } catch (error) {
    console.error('Get pending payments error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
};

// UC-04: Verify a payment
exports.verifyPayment = async (req, res) => {
  let client;
  try {
    const { paymentId, verifiedBy, action } = req.body;
    
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const paymentColumnsResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'payment_history'
         AND column_name = ANY($1::text[])`,
      [['status', 'verified_by', 'reviewed_at', 'notes']]
    );
    const paymentColumns = new Set(paymentColumnsResult.rows.map((row) => row.column_name));

    if (!paymentColumns.has('status')) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'payment_history.status column is missing' });
    }

    const paymentResult = await client.query(
      `SELECT
         ph.payment_id,
         ph.debt_id,
         ph.amount,
         ph.status,
         s.full_name,
         s.email
       FROM public.payment_history ph
       LEFT JOIN public.debt_records dr ON dr.debt_id = ph.debt_id
       LEFT JOIN public.students s ON s.student_id = dr.student_id
       WHERE ph.payment_id = $1
       FOR UPDATE`,
      [paymentId]
    );
    
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = paymentResult.rows[0];
    const statusMode = resolveStatusMode(payment.status);
    if (String(payment.status || '').toUpperCase() !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment is not pending verification' });
    }

    const newStatus = action === 'APPROVE' ? statusMode.approved : statusMode.rejected;

    const setClauses = ['status = $1'];
    const updateValues = [newStatus];

    if (paymentColumns.has('verified_by')) {
      updateValues.push(verifiedBy ?? null);
      setClauses.push(`verified_by = $${updateValues.length}`);
    }

    if (paymentColumns.has('reviewed_at')) {
      setClauses.push('reviewed_at = NOW()');
    }

    if (paymentColumns.has('notes')) {
      updateValues.push(action === 'APPROVE' ? 'Approved by finance' : 'Rejected by finance');
      setClauses.push(`notes = COALESCE(NULLIF(notes, ''), $${updateValues.length})`);
    }

    updateValues.push(paymentId);
    await client.query(
      `UPDATE public.payment_history
       SET ${setClauses.join(', ')}
       WHERE payment_id = $${updateValues.length}`,
      updateValues
    );

    const studentUserResult = await client.query(
      `SELECT u.user_id
       FROM public.debt_records dr
       JOIN public.students s ON dr.student_id = s.student_id
       JOIN public.users u ON s.user_id = u.user_id
       WHERE dr.debt_id = $1
       LIMIT 1`,
      [payment.debt_id]
    );

    const studentUserId = studentUserResult.rows[0]?.user_id;

    // Only update debt balance if approved
    if (action === 'APPROVE') {
      const debtColumnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'debt_records'
           AND column_name = ANY($1::text[])`,
        [['current_balance', 'updated_at', 'last_updated']]
      );
      const debtColumns = new Set(debtColumnsResult.rows.map((row) => row.column_name));

      if (!debtColumns.has('current_balance')) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'debt_records.current_balance column is missing' });
      }

      const debtResult = await client.query(
        `SELECT debt_id, current_balance
         FROM public.debt_records
         WHERE debt_id = $1
         FOR UPDATE`,
        [payment.debt_id]
      );

      if (debtResult.rows.length > 0) {
        const debt = debtResult.rows[0];
        const currentBalance = Number(debt.current_balance || 0);
        const paymentAmount = Number(payment.amount || 0);
        const newBalance = Math.max(0, currentBalance - paymentAmount);

        const debtSetClauses = ['current_balance = $1'];
        if (debtColumns.has('updated_at')) {
          debtSetClauses.push('updated_at = NOW()');
        } else if (debtColumns.has('last_updated')) {
          debtSetClauses.push('last_updated = NOW()');
        }

        await client.query(
          `UPDATE public.debt_records
           SET ${debtSetClauses.join(', ')}
           WHERE debt_id = $2`,
          [newBalance, debt.debt_id]
        );
      }
    }

    await client.query('COMMIT');

    if (action === 'APPROVE' && studentUserId) {
      await sendPaymentNotification(
        studentUserId,
        'Payment Approved! 💰',
        'Your payment has been verified and your balance has been updated.',
        {
          type: 'PAYMENT_APPROVED',
          paymentId: String(paymentId),
          debtId: String(payment.debt_id),
        }
      );
      console.log(
        `📧 Notification: Payment approved for ${payment.full_name || 'student'} (${payment.email || 'no-email'}). New balance calculated.`
      );
    } else if (action === 'REJECT' && studentUserId) {
      await sendPaymentNotification(
        studentUserId,
        'Payment Rejected',
        'Your payment was rejected by finance. Please review details and resubmit.',
        {
          type: 'PAYMENT_REJECTED',
          paymentId: String(paymentId),
          debtId: String(payment.debt_id),
          status: 'FAILED',
        }
      );
    }

    res.json({
      success: true,
      message: `Payment ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`,
      paymentId: paymentId,
      newStatus: newStatus
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Verify payment error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to verify payment' });
  } finally {
    if (client) {
      client.release();
    }
  }
};
