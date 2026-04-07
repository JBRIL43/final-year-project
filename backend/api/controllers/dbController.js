const pool = require('../config/db');

// UC-02: Get student debt balance with Ethiopian policy calculation
exports.getDebtBalance = async (req, res) => {
  try {
    // For MVP: Use hardcoded student_id = 1 (Abebe Kebede)
    const studentId = 1;

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
          FROM payment_history ph
          WHERE ph.debt_id = dr.debt_id
        ) as payment_history
       FROM debt_records dr
       JOIN students s ON dr.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
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
    console.error('Debt balance error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch debt balance',
      code: 'SERVER_ERROR'
    });
  }
};