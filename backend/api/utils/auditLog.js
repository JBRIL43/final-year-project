const pool = require('../config/db');

let auditTableReady = false;

async function ensureAuditLogsTable() {
  if (auditTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actor_user_id INT,
      actor_email TEXT,
      ip INET,
      user_agent TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      old_value JSONB,
      new_value JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at
      ON public.audit_logs (occurred_at DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action
      ON public.audit_logs (action, occurred_at DESC);
  `);

  auditTableReady = true;
}

async function auditLog(req, action, entity = {}, oldValue = null, newValue = null, metadata = {}) {
  try {
    await ensureAuditLogsTable();

    const actorUserId = req.user?.user_id ?? null;
    const actorEmail = req.user?.email || req.auth?.email || null;
    const ip = req.ip || null;
    const userAgent = req.get('user-agent') || null;

    await pool.query(
      `INSERT INTO public.audit_logs (
         actor_user_id,
         actor_email,
         ip,
         user_agent,
         action,
         entity_type,
         entity_id,
         old_value,
         new_value,
         metadata
       ) VALUES ($1, $2, $3::inet, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)`,
      [
        actorUserId,
        actorEmail,
        ip,
        userAgent,
        action,
        entity.type || null,
        entity.id != null ? String(entity.id) : null,
        oldValue != null ? JSON.stringify(oldValue) : null,
        newValue != null ? JSON.stringify(newValue) : null,
        JSON.stringify(metadata),
      ]
    );
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

module.exports = {
  ensureAuditLogsTable,
  auditLog,
};
