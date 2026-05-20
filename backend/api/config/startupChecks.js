function warnProductionConfig() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  if (!process.env.CHAPA_WEBHOOK_SECRET && !process.env.CHAPA_SECRET_KEY) {
    console.warn(
      '[startup] CHAPA_WEBHOOK_SECRET (or CHAPA_SECRET_KEY) is not set — Chapa webhooks will be rejected until configured.'
    );
  }

  if (!process.env.SYNC_SECRET?.trim()) {
    console.error('[startup] SYNC_SECRET is required in production.');
  }

  if (!process.env.REDIS_URL) {
    console.warn('[startup] REDIS_URL is not set — using in-memory cache (not shared across instances).');
  }
}

module.exports = { warnProductionConfig };
