require('dotenv').config();
const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://student-debt-admin.onrender.com',
  'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/debt', debtRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/registrar', registrarRoutes);
app.use('/api/admin/fayda', faydaRoutes);
app.use('/api/admin/semester-amounts', semesterAmountsRoutes);
app.use('/api/department', departmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Full health check — verifies DB connection and Firebase auth
app.get('/api/health/full', async (req, res) => {
  const pool = require('./config/db');
  const firebaseAdmin = require('./config/firebaseAdmin');
  const results = { status: 'OK', timestamp: new Date().toISOString(), checks: {} };

  // DB check
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

  // Firebase check
  try {
    if (firebaseAdmin && firebaseAdmin.apps.length > 0) {
      const app = firebaseAdmin.apps[0];
      results.checks.firebase = {
        status: 'initialized',
        project_id: app.options?.credential?.projectId || 'unknown',
      };
    } else {
      results.checks.firebase = { status: 'not_initialized' };
      results.status = 'DEGRADED';
    }
  } catch (e) {
    results.checks.firebase = { status: 'error', message: e.message };
    results.status = 'DEGRADED';
  }

  // Seed data check
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on http://0.0.0.0:${PORT}`);
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