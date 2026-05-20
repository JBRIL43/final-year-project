const { rateLimit } = require('express-rate-limit');

function rateLimitHandler(req, res) {
  res.status(429).json({
    error: 'Too many requests',
    retryAfter: res.getHeader('Retry-After') || undefined,
  });
}

// ~900 req/min — supports ~15 concurrent users at moderate API churn
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Brute-force / sync abuse on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Expensive admin reports, exports, and reconciliation
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  globalLimiter,
  authLimiter,
  reportLimiter,
};
