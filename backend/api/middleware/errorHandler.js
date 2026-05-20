const crypto = require('crypto');
const { recordSystemLog } = require('../utils/systemLog');

function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    requestId: req.id,
  });
}

function globalErrorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const status = Number(err.status || err.statusCode) || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error('[ERROR]', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    status,
    message: err.message,
    stack: isProduction ? undefined : err.stack,
  });

  recordSystemLog({
    req,
    action: `error.${status}`,
    category: 'system',
    severity: status >= 500 ? 'error' : 'warning',
    success: false,
    errorMessage: err.message,
    statusCode: status,
    metadata: { handler: 'globalErrorHandler' },
  });

  res.status(status).json({
    error: isProduction && status >= 500 ? 'Internal server error' : err.message || 'Internal server error',
    requestId: req.id,
  });
}

module.exports = {
  requestIdMiddleware,
  notFoundHandler,
  globalErrorHandler,
};
