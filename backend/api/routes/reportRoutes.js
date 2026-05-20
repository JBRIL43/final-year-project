const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateRequest, requireRoles(['admin', 'finance']));

/**
 * Utility: Convert rows to CSV with BOM for Excel compatibility
 */
function toCsv(rows, columns) {
  if (!rows || rows.length === 0) return '\ufeff' + columns.join(',');
  const header = columns.join(',');
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col] === null || row[col] === undefined ? '' : String(row[col]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');
  return '\ufeff' + header + '\n' + body;
}

/**
 * GET /api/admin/reports/monthly-collections[.csv]
 * Approved payment totals grouped by month.
 */
router.get(['/monthly-collections', '/monthly-collections.csv'], async (req, res) => {
  try {
    const { months = 12, startDate, endDate, campus } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ["UPPER(COALESCE(ph.status, '')) IN ('APPROVED', 'SUCCESS')"];
    let values = [];

    if (startDate) {
      values.push(startDate);
      whereClauses.push(`ph.payment_date >= $${values.length}`);
    }
    if (endDate) {
      values.push(endDate);
      whereClauses.push(`ph.payment_date <= $${values.length}`);
    }
    if (campus) {
      values.push(campus);
      whereClauses.push(`LOWER(COALESCE(s.campus, 'main campus')) = LOWER($${values.length})`);
    }

    // Default to last X months if no dates provided
    if (!startDate && !endDate) {
      whereClauses.push(`ph.payment_date >= NOW() - INTERVAL '${Number(months)} months'`);
    }

    const query = `
      SELECT
        TO_CHAR(ph.payment_date, 'YYYY-MM') AS month,
        COUNT(ph.payment_id)::int AS payments_count,
        SUM(ph.amount)::numeric AS total_collections
      FROM public.payment_history ph
      LEFT JOIN public.students s ON ph.student_id = s.student_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY 1
      ORDER BY 1 DESC
    `;

    const result = await pool.query(query, values);

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="monthly_collections_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(result.rows, ['month', 'payments_count', 'total_collections']));
    }

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    console.error('Monthly collections report error:', error);
    res.status(500).json({ error: 'Failed to generate monthly collections report' });
  }
});

/**
 * GET /api/admin/reports/outstanding-debt[.csv]
 * Total outstanding debt grouped by campus and program.
 */
router.get(['/outstanding-debt', '/outstanding-debt.csv'], async (req, res) => {
  try {
    const { campus, program } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ['dr.current_balance > 0'];
    let values = [];

    if (campus) {
      values.push(campus);
      whereClauses.push(`LOWER(COALESCE(s.campus, 'main campus')) = LOWER($${values.length})`);
    }
    if (program) {
      values.push(program);
      whereClauses.push(`LOWER(COALESCE(s.department, '')) = LOWER($${values.length})`);
    }

    const query = `
      SELECT
        COALESCE(s.campus, 'Main Campus') AS campus,
        s.department AS program,
        COUNT(s.student_id)::int AS students_count,
        SUM(dr.current_balance)::numeric AS total_outstanding_debt
      FROM public.students s
      JOIN public.debt_records dr ON s.student_id = dr.student_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY 1, 2
      ORDER BY 4 DESC, 1, 2
    `;

    const result = await pool.query(query, values);

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="outstanding_debt_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(result.rows, ['campus', 'program', 'students_count', 'total_outstanding_debt']));
    }

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    console.error('Outstanding debt report error:', error);
    res.status(500).json({ error: 'Failed to generate outstanding debt report' });
  }
});

/**
 * GET /api/admin/reports/default-rate[.csv]
 * Graduate delinquency rate.
 */
router.get(['/default-rate', '/default-rate.csv'], async (req, res) => {
  try {
    const { campus, program, batchYear } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ["UPPER(COALESCE(s.enrollment_status, '')) = 'GRADUATED'"];
    let values = [];

    if (campus) {
      values.push(campus);
      whereClauses.push(`LOWER(COALESCE(s.campus, 'main campus')) = LOWER($${values.length})`);
    }
    if (program) {
      values.push(program);
      whereClauses.push(`LOWER(COALESCE(s.department, '')) = LOWER($${values.length})`);
    }
    if (batchYear) {
      values.push(Number(batchYear));
      whereClauses.push(`s.enrollment_year = $${values.length}`);
    }

    const query = `
      SELECT
        COUNT(*)::int AS total_graduates,
        COUNT(CASE WHEN dr.current_balance > 0 AND s.repayment_start_date <= NOW() THEN 1 END)::int AS delinquent_graduates,
        COALESCE(
          COUNT(CASE WHEN dr.current_balance > 0 AND s.repayment_start_date <= NOW() THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0), 0
        )::numeric AS default_rate
      FROM public.students s
      LEFT JOIN public.debt_records dr ON s.student_id = dr.student_id
      WHERE ${whereClauses.join(' AND ')}
    `;

    const result = await pool.query(query, values);
    const totals = result.rows[0];

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="default_rate_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv([totals], ['total_graduates', 'delinquent_graduates', 'default_rate']));
    }

    res.json({ success: true, totals });
  } catch (error) {
    console.error('Default rate report error:', error);
    res.status(500).json({ error: 'Failed to generate default rate report' });
  }
});

/**
 * GET /api/admin/reports/payment-methods[.csv]
 * Transaction counts and amounts broken down by method.
 */
router.get(['/payment-methods', '/payment-methods.csv'], async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ['1=1'];
    let values = [];

    if (startDate) {
      values.push(startDate);
      whereClauses.push(`ph.payment_date >= $${values.length}`);
    }
    if (endDate) {
      values.push(endDate);
      whereClauses.push(`ph.payment_date <= $${values.length}`);
    }

    const query = `
      SELECT
        ph.payment_method,
        COUNT(*)::int AS total_transactions,
        COUNT(CASE WHEN UPPER(COALESCE(ph.status, '')) IN ('APPROVED', 'SUCCESS') THEN 1 END)::int AS approved_count,
        SUM(CASE WHEN UPPER(COALESCE(ph.status, '')) IN ('APPROVED', 'SUCCESS') THEN ph.amount ELSE 0 END)::numeric AS total_approved_amount,
        COUNT(CASE WHEN UPPER(COALESCE(ph.status, '')) = 'PENDING' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN UPPER(COALESCE(ph.status, '')) IN ('FAILED', 'REJECTED') THEN 1 END)::int AS rejected_count
      FROM public.payment_history ph
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY 1
      ORDER BY 4 DESC
    `;

    const result = await pool.query(query, values);

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payment_methods_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(result.rows, ['payment_method', 'total_transactions', 'approved_count', 'total_approved_amount', 'pending_count', 'rejected_count']));
    }

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    console.error('Payment methods report error:', error);
    res.status(500).json({ error: 'Failed to generate payment methods report' });
  }
});

/**
 * GET /api/admin/reports/withdrawal-settlements[.csv]
 * Withdrawal status and settlement amounts.
 */
router.get(['/withdrawal-settlements', '/withdrawal-settlements.csv'], async (req, res) => {
  try {
    const { startDate, endDate, campus, status } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ["(s.withdrawal_status IS NOT NULL OR UPPER(COALESCE(s.enrollment_status, '')) = 'WITHDRAWN')"];
    let values = [];

    if (startDate) {
      values.push(startDate);
      whereClauses.push(`s.withdrawal_requested_at >= $${values.length}`);
    }
    if (endDate) {
      values.push(endDate);
      whereClauses.push(`s.withdrawal_requested_at <= $${values.length}`);
    }
    if (campus) {
      values.push(campus);
      whereClauses.push(`LOWER(COALESCE(s.campus, 'main campus')) = LOWER($${values.length})`);
    }
    if (status) {
      values.push(status);
      whereClauses.push(`LOWER(COALESCE(s.withdrawal_status, s.enrollment_status)) = LOWER($${values.length})`);
    }

    const query = `
      SELECT
        s.student_number,
        s.full_name,
        s.department,
        COALESCE(s.campus, 'Main Campus') AS campus,
        s.enrollment_status,
        s.withdrawal_status,
        dr.initial_amount AS settlement_amount,
        dr.current_balance AS remaining_balance,
        COALESCE(dr.is_final_settlement, false) AS is_final_settlement
      FROM public.students s
      LEFT JOIN public.debt_records dr ON s.student_id = dr.student_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY s.withdrawal_requested_at DESC NULLS LAST
    `;

    const result = await pool.query(query, values);

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="withdrawal_settlements_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(result.rows, ['student_number', 'full_name', 'department', 'campus', 'enrollment_status', 'withdrawal_status', 'settlement_amount', 'remaining_balance', 'is_final_settlement']));
    }

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    console.error('Withdrawal settlements report error:', error);
    res.status(500).json({ error: 'Failed to generate withdrawal settlements report' });
  }
});

/**
 * GET /api/admin/reports/semester-costs[.csv]
 * Configured tuition, boarding, food, and fee amounts.
 */
router.get(['/semester-costs', '/semester-costs.csv'], async (req, res) => {
  try {
    const { academicYear, campus } = req.query;
    const isCsv = req.path.endsWith('.csv') || req.query.format === 'csv';

    let whereClauses = ['1=1'];
    let values = [];

    if (academicYear) {
      values.push(academicYear);
      whereClauses.push(`academic_year = $${values.length}`);
    }
    if (campus) {
      values.push(campus);
      whereClauses.push(`LOWER(COALESCE(campus, 'main campus')) = LOWER($${values.length})`);
    }

    const query = `
      SELECT
        academic_year,
        campus,
        program_type,
        tuition_cost_per_year,
        boarding_cost_per_year,
        food_cost_per_month,
        health_insurance_fee,
        other_fees,
        effective_from
      FROM public.semester_amounts
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY academic_year DESC, campus, program_type
    `;

    const result = await pool.query(query, values);

    if (isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="semester_costs_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(toCsv(result.rows, ['academic_year', 'campus', 'program_type', 'tuition_cost_per_year', 'boarding_cost_per_year', 'food_cost_per_month', 'health_insurance_fee', 'other_fees', 'effective_from']));
    }

    res.json({ success: true, rows: result.rows });
  } catch (error) {
    console.error('Semester costs report error:', error);
    res.status(500).json({ error: 'Failed to generate semester costs report' });
  }
});

module.exports = router;
