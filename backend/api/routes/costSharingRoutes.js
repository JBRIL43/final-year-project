const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/cost-sharing/accept — accept cost-sharing beneficiary form
router.post('/accept', authenticateRequest, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    // Get student ID from user
    const userResult = await client.query(
      'SELECT student_id FROM students WHERE user_id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = userResult.rows[0].student_id;

    // Update cost-sharing acceptance
    await client.query(
      `UPDATE students 
       SET cost_sharing_statement_accepted = TRUE,
           cost_sharing_accepted_date = NOW()
       WHERE student_id = $1`,
      [studentId],
    );

    // Log the action
    await client.query(
      `INSERT INTO cost_sharing_statement_audit 
       (student_id, download_date, format, downloaded_by_role)
       VALUES ($1, NOW(), 'ACCEPT', 'STUDENT')`,
      [studentId],
    );

    return res.json({
      success: true,
      message: 'Cost-sharing statement accepted',
    });
  } catch (error) {
    console.error('Cost-sharing accept error:', error);
    return res.status(500).json({ error: 'Failed to accept cost-sharing statement' });
  } finally {
    client.release();
  }
});

// ── GET /api/cost-sharing/historical-payments — get historical payment records
router.get('/historical-payments', authenticateRequest, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    // Get student ID from user
    const userResult = await client.query(
      'SELECT student_id FROM students WHERE user_id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = userResult.rows[0].student_id;

    // Get historical payments
    const paymentsResult = await client.query(
      `SELECT id, academic_year, amount_in_birr, receipt_no, payment_date, payment_method
       FROM historical_payments
       WHERE student_id = $1
       ORDER BY academic_year DESC`,
      [studentId],
    );

    return res.json({
      success: true,
      data: {
        historicalPayments: paymentsResult.rows || [],
      },
    });
  } catch (error) {
    console.error('Historical payments fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch historical payments' });
  } finally {
    client.release();
  }
});

// ── GET /api/cost-sharing/statement — get complete cost-sharing statement data
router.get('/statement', authenticateRequest, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const client = await pool.connect();
  try {
    // Get student info
    const studentResult = await client.query(
      `SELECT s.student_id, s.full_name, s.program, s.campus, 
              s.preparatory_school, s.cost_sharing_statement_accepted,
              s.cost_sharing_accepted_date,
              d.academic_year, d.initial_amount, d.current_balance,
              c.tuition_share_percent, cs.tuition_full_cost, cs.tuition_student_share,
              cs.boarding_cost, cs.food_cost_monthly, cs.food_cost_annual
       FROM students s
       LEFT JOIN debt_records d ON s.student_id = d.student_id
       LEFT JOIN contracts c ON s.student_id = c.student_id
       LEFT JOIN cost_shares cs ON s.campus = cs.campus AND c.program_type = cs.program_type
       WHERE s.user_id = $1`,
      [userId],
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult.rows[0];

    // Get historical payments
    const paymentsResult = await client.query(
      `SELECT academic_year, amount_in_birr, receipt_no, payment_date, payment_method
       FROM historical_payments
       WHERE student_id = $1
       ORDER BY academic_year DESC`,
      [student.student_id],
    );

    return res.json({
      success: true,
      data: {
        fullName: student.full_name,
        studentId: student.student_id,
        program: student.program,
        campus: student.campus,
        preparatorySchool: student.preparatory_school || 'N/A',
        academicYear: student.academic_year,
        tuitionFullCost: parseFloat(student.tuition_full_cost || 0),
        tuitionStudentShare: parseFloat(student.tuition_student_share || 0),
        boardingCost: parseFloat(student.boarding_cost || 0),
        foodCostMonthly: parseFloat(student.food_cost_monthly || 0),
        foodCostAnnual: parseFloat(student.food_cost_annual || 0),
        totalDebt: parseFloat(student.initial_amount || 0),
        currentBalance: parseFloat(student.current_balance || 0),
        costSharingAccepted: student.cost_sharing_statement_accepted || false,
        acceptedDate: student.cost_sharing_accepted_date,
        paymentHistory: paymentsResult.rows || [],
      },
    });
  } catch (error) {
    console.error('Cost-sharing statement fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch cost-sharing statement' });
  } finally {
    client.release();
  }
});

// ── POST /api/cost-sharing/log-download — log document download for audit trail
router.post('/log-download', authenticateRequest, async (req, res) => {
  const userId = req.user?.user_id;
  const { format, deviceInfo } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!format) {
    return res.status(400).json({ error: 'Format is required' });
  }

  const client = await pool.connect();
  try {
    // Get student ID from user
    const userResult = await client.query(
      'SELECT student_id FROM students WHERE user_id = $1',
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = userResult.rows[0].student_id;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Log the download
    await client.query(
      `INSERT INTO cost_sharing_statement_audit 
       (student_id, download_date, format, ip_address, device_info, downloaded_by_role)
       VALUES ($1, NOW(), $2, $3, $4, 'STUDENT')`,
      [studentId, format, ipAddress, deviceInfo || null],
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Cost-sharing download log error:', error);
    // Don't fail the main download if logging fails
    return res.status(500).json({ error: 'Failed to log download', code: 'LOG_ERROR' });
  } finally {
    client.release();
  }
});

module.exports = router;
