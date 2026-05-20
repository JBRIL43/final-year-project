require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const debtRoutes = require('./routes/debtRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const studentRoutes = require('./routes/studentRoutes');
const registrarRoutes = require('./routes/registrarRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const faydaRoutes = require('./routes/faydaRoutes');
const semesterAmountsRoutes = require('./routes/semesterAmountsRoutes');
const {
  globalLimiter,
  authLimiter,
  reportLimiter,
} = require('./middleware/rateLimit');
const {
  requestIdMiddleware,
  notFoundHandler,
  globalErrorHandler,
} = require('./middleware/errorHandler');
const { systemLogMiddleware } = require('./middleware/systemLogMiddleware');
const systemLogRoutes = require('./routes/systemLogRoutes');
const { warnProductionConfig } = require('./config/startupChecks');

warnProductionConfig();

const app = express();
const PORT = process.env.PORT || 3000;

// Render / reverse proxy — required for per-IP rate limiting
app.set('trust proxy', 1);
app.use(requestIdMiddleware);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.MOBILE_APP_URL,
  'https://student-debt-admin.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
    : []),
].filter(Boolean);
const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin: (origin, callback) => {
    // Native/mobile and curl often omit Origin; CORS applies to browsers only.
    if (!origin) {
      return callback(null, true);
    }
    if (uniqueAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
};

// Security headers (HSTS, X-Content-Type-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Health checks before strict CORS (load balancers/probes often omit Origin)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/health/full', async (req, res) => {
  const pool = require('./config/db');
  const firebaseAdmin = require('./config/firebaseAdmin');
  const results = { status: 'OK', timestamp: new Date().toISOString(), checks: {} };

  try {
    const dbRes = await pool.query('SELECT NOW() AS now, COUNT(*) AS user_count FROM public.users');
    results.checks.database = {
      status: 'connected',
      server_time: dbRes.rows[0].now,
      user_count: Number(dbRes.rows[0].user_count),
    };
  } catch (e) {
    results.checks.database = { status: 'error', message: e.message };
    results.status = 'DEGRADED';
  }

  try {
    if (firebaseAdmin && firebaseAdmin.apps.length > 0) {
      const firebaseApp = firebaseAdmin.apps[0];
      results.checks.firebase = {
        status: 'initialized',
        project_id: firebaseApp.options?.credential?.projectId || 'unknown',
      };
    } else {
      results.checks.firebase = { status: 'not_initialized' };
      results.status = 'DEGRADED';
    }
  } catch (e) {
    results.checks.firebase = { status: 'error', message: e.message };
    results.status = 'DEGRADED';
  }

  try {
    const seedCheck = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM public.users WHERE role != 'student') AS admin_users,
         (SELECT COUNT(*) FROM public.students) AS students,
         (SELECT COUNT(*) FROM public.debt_records) AS debt_records,
         (SELECT COUNT(*) FROM public.semester_amounts) AS semester_amounts`
    );
    results.checks.seed_data = {
      admin_users: Number(seedCheck.rows[0].admin_users),
      students: Number(seedCheck.rows[0].students),
      debt_records: Number(seedCheck.rows[0].debt_records),
      semester_amounts: Number(seedCheck.rows[0].semester_amounts),
    };
  } catch (e) {
    results.checks.seed_data = { status: 'error', message: e.message };
  }

  res.status(results.status === 'OK' ? 200 : 503).json(results);
});

app.use(cors(corsOptions));
app.use((err, req, res, next) => {
  if (err && String(err.message).includes('CORS')) {
    console.warn('[CORS] Rejected origin', {
      origin: req.headers.origin || null,
      method: req.method,
      path: req.originalUrl,
      requestId: req.requestId || null,
    });
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  return next(err);
});
app.use(express.json());
app.use('/api', systemLogMiddleware);

// Rate limits (health routes above are excluded)
app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/verification/pending', reportLimiter);
app.use('/api/admin/erca/debtors', reportLimiter);
app.use('/api/admin/analytics/debt-overview', reportLimiter);
app.use('/api/admin/debt/reconcile', reportLimiter);
app.use('/api/admin/payments/pending', reportLimiter);

// Routes
app.use('/api/debt', debtRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/system-logs', systemLogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/registrar', registrarRoutes);
app.use('/api/admin/fayda', faydaRoutes);
app.use('/api/admin/semester-amounts', semesterAmountsRoutes);
app.use('/api/department', departmentRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
  console.log(`🌐 CORS allowlist (${uniqueAllowedOrigins.length}):`, uniqueAllowedOrigins.join(', ') || '(none)');
  console.log('ℹ️  Requests without Origin are allowed (mobile/native clients); browser cross-origin requires allowlist match.');
});

/*
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const debtRoutes = require('./routes/debtRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const registrarRoutes = require('./routes/registrarRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration (allow Flutter app & React dashboard)
const corsOptions = {
  origin: [
    process.env.CLIENT_URL,
    process.env.MOBILE_APP_URL,
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Support large receipt uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add this before routes:
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Auth routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/debt', debtRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/registrar', registrarRoutes);

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Max connections (adjust for Ethiopian server constraints)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
    return;
  }
  console.log('✅ Connected to PostgreSQL database');
  release();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
});
*/