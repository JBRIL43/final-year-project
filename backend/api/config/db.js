const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  /render|neon|supabase|railway|cloud|amazonaws|azure/i.test(connectionString || '');

console.log('🔍 DATABASE_URL:', connectionString ? 'SET' : 'NOT SET');
console.log('🔍 Should use SSL:', shouldUseSsl);
console.log('🔍 Connection string preview:', connectionString ? connectionString.substring(0, 50) + '...' : 'N/A');

const pool = new Pool({
  ...(connectionString
    ? {
        connectionString: connectionString,
        ...(shouldUseSsl
          ? {
              ssl: {
                rejectUnauthorized: false,
              },
            }
          : {}),
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'student_debt_system',
        user: process.env.DB_USER || 'db_user',
        password: process.env.DB_PASSWORD || 'your_secure_password',
        ssl:
          process.env.DB_SSL === 'true'
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = pool;