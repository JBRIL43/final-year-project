const { Pool } = require('pg');
require('dotenv').config();

const rawConnectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
let connectionString = rawConnectionString;
const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  /render|neon|supabase|railway|cloud|amazonaws|azure/i.test(connectionString || '');

const connectionLabel = process.env.SUPABASE_DATABASE_URL
  ? 'SUPABASE_DATABASE_URL'
  : connectionString
    ? 'DATABASE_URL'
    : 'DB_HOST/DB_PORT/DB_NAME';

console.log('🔍 DATABASE_URL:', connectionString ? 'SET' : 'NOT SET');
console.log('🔍 Database source:', connectionLabel);
console.log('🔍 Should use SSL:', shouldUseSsl);
function sanitizePreview(conn) {
  if (!conn) return 'N/A';
  try {
    // try to hide password in userinfo if present
    const url = new URL(conn);
    if (url.username || url.password) {
      return `${url.protocol}//${url.username}:*****@${url.host}${url.pathname}${url.search}`;
    }
    return conn.substring(0, 50) + '...';
  } catch (e) {
    // fallback: show first 50 chars
    return conn.substring(0, 50) + '...';
  }
}

console.log('🔍 Connection string preview:', sanitizePreview(connectionString));

let pool;
try {
  pool = new Pool({
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
} catch (err) {
  // If parsing the provided connection string fails (commonly due to unencoded
  // special characters in the password), attempt to percent-encode the
  // credentials and retry.
  console.warn('⚠️ Failed to create DB pool with raw connection string:', err.message);
  if (rawConnectionString) {
    try {
      const schemeSplit = rawConnectionString.split('://');
      if (schemeSplit.length >= 2) {
        const scheme = schemeSplit[0];
        const rest = schemeSplit.slice(1).join('://');
        const lastAt = rest.lastIndexOf('@');
        if (lastAt > -1) {
          const userinfo = rest.substring(0, lastAt);
          const hostAndRest = rest.substring(lastAt + 1);
          const colonIndex = userinfo.indexOf(':');
          if (colonIndex > -1) {
            const user = userinfo.substring(0, colonIndex);
            const pass = userinfo.substring(colonIndex + 1);
            const encUser = encodeURIComponent(user);
            const encPass = encodeURIComponent(pass);
            connectionString = `${scheme}://${encUser}:${encPass}@${hostAndRest}`;
            console.log('🔍 Retrying with percent-encoded credentials. Preview:', sanitizePreview(connectionString));
            pool = new Pool({
              connectionString: connectionString,
              ...(shouldUseSsl
                ? {
                    ssl: {
                      rejectUnauthorized: false,
                    },
                  }
                : {}),
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
            });
          }
        }
      }
    } catch (retryErr) {
      console.error('❌ Retry with encoded credentials failed:', retryErr.message);
      throw retryErr;
    }
  }
  if (!pool) throw err;
}

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = pool;