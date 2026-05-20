const pool = require('../config/db');
const { ensureSystemLogsTable } = require('../utils/systemLog');

function parsePositiveInt(value, fallback, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

exports.listLogs = async (req, res) => {
  try {
    await ensureSystemLogsTable();

    const limit = parsePositiveInt(req.query.limit, 50, 200);
    const offset = parsePositiveInt(req.query.offset, 0, 100000);
    const action = String(req.query.action || '').trim();
    const category = String(req.query.category || '').trim();
    const actorEmail = String(req.query.actorEmail || '').trim();
    const success = req.query.success;
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const search = String(req.query.search || '').trim();

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (action) {
      conditions.push(`action ILIKE $${paramIndex}`);
      values.push(`%${action}%`);
      paramIndex += 1;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(category);
      paramIndex += 1;
    }

    if (actorEmail) {
      conditions.push(`actor_email ILIKE $${paramIndex}`);
      values.push(`%${actorEmail}%`);
      paramIndex += 1;
    }

    if (success === 'true' || success === 'false') {
      conditions.push(`success = $${paramIndex}`);
      values.push(success === 'true');
      paramIndex += 1;
    }

    if (from) {
      conditions.push(`occurred_at >= $${paramIndex}::timestamptz`);
      values.push(from);
      paramIndex += 1;
    }

    if (to) {
      conditions.push(`occurred_at <= $${paramIndex}::timestamptz`);
      values.push(to);
      paramIndex += 1;
    }

    if (search) {
      conditions.push(
        `(action ILIKE $${paramIndex}
          OR actor_email ILIKE $${paramIndex}
          OR http_path ILIKE $${paramIndex}
          OR entity_id ILIKE $${paramIndex}
          OR error_message ILIKE $${paramIndex})`
      );
      values.push(`%${search}%`);
      paramIndex += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.system_logs ${whereClause}`,
      values
    );

    values.push(limit, offset);

    const rowsResult = await pool.query(
      `SELECT
         id,
         occurred_at,
         request_id,
         http_method,
         http_path,
         status_code,
         actor_user_id,
         actor_email,
         actor_role,
         category,
         action,
         severity,
         success,
         error_message,
         entity_type,
         entity_id
       FROM public.system_logs
       ${whereClause}
       ORDER BY occurred_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );

    return res.json({
      success: true,
      total: countResult.rows[0].total,
      limit,
      offset,
      logs: rowsResult.rows,
    });
  } catch (error) {
    console.error('List system logs error:', error);
    return res.status(500).json({ error: 'Failed to load system logs' });
  }
};

exports.getLogById = async (req, res) => {
  try {
    await ensureSystemLogsTable();

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid log id' });
    }

    const result = await pool.query(
      `SELECT *
       FROM public.system_logs
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    return res.json({ success: true, log: result.rows[0] });
  } catch (error) {
    console.error('Get system log error:', error);
    return res.status(500).json({ error: 'Failed to load log entry' });
  }
};

exports.getSummary = async (req, res) => {
  try {
    await ensureSystemLogsTable();

    const hours = parsePositiveInt(req.query.hours, 24, 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const [totals, byCategory, byAction, recentErrors] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE success = FALSE)::int AS failures,
           COUNT(*) FILTER (WHERE severity = 'error')::int AS errors
         FROM public.system_logs
         WHERE occurred_at >= $1::timestamptz`,
        [since]
      ),
      pool.query(
        `SELECT category, COUNT(*)::int AS count
         FROM public.system_logs
         WHERE occurred_at >= $1::timestamptz
         GROUP BY category
         ORDER BY count DESC
         LIMIT 12`,
        [since]
      ),
      pool.query(
        `SELECT action, COUNT(*)::int AS count
         FROM public.system_logs
         WHERE occurred_at >= $1::timestamptz
         GROUP BY action
         ORDER BY count DESC
         LIMIT 15`,
        [since]
      ),
      pool.query(
        `SELECT id, occurred_at, action, actor_email, http_path, status_code, error_message
         FROM public.system_logs
         WHERE occurred_at >= $1::timestamptz AND success = FALSE
         ORDER BY occurred_at DESC
         LIMIT 20`,
        [since]
      ),
    ]);

    return res.json({
      success: true,
      windowHours: hours,
      since,
      totals: totals.rows[0],
      byCategory: byCategory.rows,
      topActions: byAction.rows,
      recentErrors: recentErrors.rows,
    });
  } catch (error) {
    console.error('System log summary error:', error);
    return res.status(500).json({ error: 'Failed to load system log summary' });
  }
};
