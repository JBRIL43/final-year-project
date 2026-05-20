const { recordSystemLog, deriveActionFromRequest, resolveCategory } = require('../utils/systemLog');

const SKIP_PATH_PREFIXES = [
  '/api/health',
  '/api/admin/system-logs',
];

const SKIP_PATH_EXACT = new Set([
  '/api/notifications/unread-count',
]);

function shouldAutoLog(req, statusCode) {
  const path = req.originalUrl?.split('?')[0] || '';

  if (SKIP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return false;
  }
  if (SKIP_PATH_EXACT.has(path)) {
    return false;
  }

  const method = req.method?.toUpperCase() || 'GET';

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  if (method === 'GET' && path.startsWith('/api/admin/system-logs')) {
    return false;
  }

  if (statusCode >= 400) {
    return true;
  }

  return false;
}

function systemLogMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (!shouldAutoLog(req, res.statusCode)) {
      return;
    }

    const action = deriveActionFromRequest(req);
    const category = resolveCategory(action, req.originalUrl);
    const success = res.statusCode < 400;
    const severity = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';

    recordSystemLog({
      req,
      action,
      category,
      metadata: { durationMs: Date.now() - startedAt, autoCaptured: true },
      severity,
      success,
      errorMessage: success ? null : `HTTP ${res.statusCode}`,
      statusCode: res.statusCode,
      httpMethod: req.method,
      httpPath: req.originalUrl?.split('?')[0],
      requestId: req.id,
    });
  });

  next();
}

module.exports = { systemLogMiddleware };
