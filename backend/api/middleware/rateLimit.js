const { rateLimit } = require('express-rate-limit');

function rateLimitHandler(req, res) {
  res.status(429).json({
    error: 'Too many requests',
    retryAfter: res.getHeader('Retry-After') || undefined,
  });
}

// ~900 req/min — supports 15 req/sec as per specification
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 900,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Brute-force / sync abuse on auth endpoints: 20 req / 15 min
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
