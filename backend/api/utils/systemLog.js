const pool = require('../config/db');

let tableReady = false;

const SENSITIVE_KEYS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'token',
  'idtoken',
  'fcmtoken',
  'api_key',
  'apikey',
  'secret',
  'chapa_secret_key',
  'sync_secret',
]);

function sanitizePayload(value, depth = 0) {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(key).toLowerCase())) {
      out[key] = '[REDACTED]';
    } else {
      out[key] = sanitizePayload(val, depth + 1);
    }
  }
  return out;
}

async function ensureSystemLogsTable() {
  if (tableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.system_logs (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      request_id TEXT,
      http_method TEXT,
      http_path TEXT,
      status_code INT,
      actor_user_id INT,
      actor_email TEXT,
      actor_role TEXT,
      ip INET,
      user_agent TEXT,
      category TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error_message TEXT,
      entity_type TEXT,
      entity_id TEXT,
      old_value JSONB,
      new_value JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_system_logs_occurred_at
      ON public.system_logs (occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_system_logs_action
      ON public.system_logs (action, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_system_logs_category
      ON public.system_logs (category, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_system_logs_actor_email
      ON public.system_logs (actor_email, occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_system_logs_request_id
      ON public.system_logs (request_id);
  `);

  tableReady = true;
}

function resolveCategory(action, httpPath = '') {
  const path = String(httpPath || '').toLowerCase();
  const act = String(action || '').toLowerCase();

  if (act.startsWith('auth.') || path.startsWith('/api/auth')) return 'auth';
  if (act.includes('payment') || path.includes('/payment')) return 'payment';
  if (act.includes('withdrawal') || path.includes('/withdrawal')) return 'withdrawal';
  if (act.includes('student') || path.includes('/student')) return 'student';
  if (act.includes('user') || path.includes('/users')) return 'user';
  if (act.includes('fayda') || path.includes('/fayda')) return 'fayda';
  if (act.includes('notification') || path.includes('/notification')) return 'notification';
  if (path.startsWith('/api/admin')) return 'admin';
  if (path.startsWith('/api/verification')) return 'finance';
  if (path.startsWith('/api/department')) return 'department';
  if (path.startsWith('/api/registrar')) return 'registrar';
  return 'system';
}

function deriveActionFromRequest(req) {
  const method = String(req.method || 'GET').toLowerCase();
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const normalized = path
    .replace(/^\/api\//, '')
    .replace(/\/(\d+)(?=\/|$)/g, '/:id')
    .replace(/\//g, '.');

  return normalized ? `${method}.${normalized}` : `${method}.unknown`;
}

/**
 * Record an activity in system_logs (database).
 */
async function recordSystemLog({
  req = null,
  action,
  category = null,
  entity = {},
  oldValue = null,
  newValue = null,
  metadata = {},
  severity = 'info',
  success = true,
  errorMessage = null,
  statusCode = null,
  httpMethod = null,
  httpPath = null,
  requestId = null,
}) {
  try {
    await ensureSystemLogsTable();

    const resolvedAction = action || (req ? deriveActionFromRequest(req) : 'system.event');
    const resolvedCategory = category || resolveCategory(resolvedAction, httpPath || req?.originalUrl);
    const actorUserId = req?.user?.user_id ?? null;
    const actorEmail = req?.user?.email || req?.auth?.email || null;
    const actorRole = req?.user?.role || null;
    const ip = req?.ip || null;
    const userAgent = req?.get?.('user-agent') || null;

    const safeMetadata = {
      ...sanitizePayload(metadata),
      ...(req?.body && typeof req.body === 'object'
        ? { requestBody: sanitizePayload(req.body) }
        : {}),
    };

    await pool.query(
      `INSERT INTO public.system_logs (
         request_id,
         http_method,
         http_path,
         status_code,
         actor_user_id,
         actor_email,
         actor_role,
         ip,
         user_agent,
         category,
         action,
         severity,
         success,
         error_message,
         entity_type,
         entity_id,
         old_value,
         new_value,
         metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::inet, $9,
         $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19::jsonb
       )`,
      [
        requestId || req?.id || req?.requestId || null,
        httpMethod || req?.method || null,
        httpPath || req?.originalUrl?.split('?')[0] || null,
        statusCode,
        actorUserId,
        actorEmail,
        actorRole,
        ip,
        userAgent,
        resolvedCategory,
        resolvedAction,
        severity,
        success,
        errorMessage,
        entity.type || null,
        entity.id != null ? String(entity.id) : null,
        oldValue != null ? JSON.stringify(oldValue) : null,
        newValue != null ? JSON.stringify(newValue) : null,
        JSON.stringify(safeMetadata),
      ]
    );
  } catch (error) {
    console.error('[SYSTEM_LOG] Write failed:', error.message);
  }
}

module.exports = {
  ensureSystemLogsTable,
  recordSystemLog,
  deriveActionFromRequest,
  resolveCategory,
  sanitizePayload,
};
