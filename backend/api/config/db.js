const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

// ✅ DEFINE THIS FUNCTION FIRST (before it's used)
function normalizeConnectionString(value) {
  if (!value) return null;
  const trimmed = value.trim();
  
  // Block placeholders and invalid values
  if (
    !trimmed ||
    trimmed === 'base' ||
    trimmed === 'postgres://base' ||
    /<.*>|your[_-]?secure|placeholder|REDACTED|example/i.test(trimmed) ||
    !trimmed.startsWith('postgres')
  ) {
    console.warn('⚠️ Invalid connection string detected');
    return null;
  }
  
  return trimmed;
}

// ✅ NOW safely use the function
const rawConnectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const connectionString = normalizeConnectionString(rawConnectionString);

const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  /render|neon|supabase|railway|cloud|amazonaws|azure|pooler/i.test(connectionString || '');

const connectionLabel = process.env.SUPABASE_DATABASE_URL
  ? 'SUPABASE_DATABASE_URL'
  : connectionString
    ? 'DATABASE_URL'
    : 'DB_HOST/DB_PORT/DB_NAME';

console.log('🔍 DATABASE_URL:', connectionString ? 'SET' : 'NOT SET');
console.log('🔍 Database source:', connectionLabel);
console.log('🔍 Should use SSL:', shouldUseSsl);
console.log('🔍 Connection string preview:', connectionString ? connectionString.substring(0, 50) + '...' : 'N/A');

if (process.env.NODE_ENV === 'production' && !connectionString) {
  throw new Error(
    'DATABASE_URL is missing or invalid. Set a real Supabase connection string in Render → Environment.'
  );
}

// Helper: extract host from connection string
function extractHostPort(cs) {
  try {
    const at = cs.lastIndexOf('@');
    if (at === -1) return null;
    const rest = cs.slice(at + 1);
    const slash = rest.indexOf('/');
    const hostPort = slash === -1 ? rest : rest.slice(0, slash);
    const [host, port] = hostPort.split(':');
    return { host, port: port ? Number(port) : undefined };
  } catch (e) {
    return null;
  }
}

function replaceHostInConnectionString(cs, oldHost, newHost) {
  const lastAt = cs.lastIndexOf('@');
  if (lastAt === -1) return cs;
  const prefix = cs.slice(0, lastAt + 1);
  const rest = cs.slice(lastAt + 1);
  return prefix + rest.replace(oldHost, newHost);
}

// Create initial pool
let pool = new Pool({
  ...(connectionString
    ? {
        connectionString: connectionString,
        ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'student_debt_system',
        user: process.env.DB_USER || 'db_user',
        password: process.env.DB_PASSWORD || 'your_secure_password',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
});

// Delegating export for pool swapping
// Note: Automatic soft-delete filtering is handled at the database level via updatable views.
// Table names (e.g. 'users') now refer to views that filter 'deleted_at IS NULL'.
// To access raw data including deleted records, use '_table_data' (e.g. '_users_data').
const db = {
  query: (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
  end: (...args) => pool.end(...args),
  on: (evt, cb) => pool.on(evt, cb),

  // Soft Delete Constants
  RAW_TABLES: {
    users: '_users_data',
    students: '_students_data',
    debt_records: '_debt_records_data',
    notifications: '_notifications_data',
    semester_amounts: '_semester_amounts_data',
    fayda_config: '_fayda_config_data',
    cost_shares: '_cost_shares_data'
  }
};

// Test connection with IPv6 → IPv4 fallback
function testConnection(currentPool, cs, isFallback = false) {
  currentPool.query('SELECT NOW()', (err, res) => {
    if (err) {
      const msg = err.message || '';
      console.error(`❌ Database connection error${isFallback ? ' (IPv4 fallback)' : ''}:`, msg);

      // Only attempt IPv4 fallback on first attempt with ENETUNREACH
      if (!isFallback && msg.includes('ENETUNREACH') && cs) {
        const hp = extractHostPort(cs);
        if (hp?.host) {
          console.log('ℹ️ Detected ENETUNREACH. Trying IPv4 DNS lookup for:', hp.host);
          dns.lookup(hp.host, { family: 4 }, (dnsErr, address) => {
            if (dnsErr) {
              console.error('❌ IPv4 DNS lookup failed:', dnsErr.message);
              return;
            }
            try {
              const newCs = replaceHostInConnectionString(cs, hp.host, address);
              console.log('ℹ️ Creating IPv4 fallback pool with address:', address);
              const newPool = new Pool({
                connectionString: newCs,
                ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
              });
              pool = newPool;
              testConnection(newPool, newCs, true);
            } catch (e) {
              console.error('❌ Failed to create IPv4 fallback pool:', e.message);
            }
          });
        }
      }
    } else {
      console.log('✅ Database connected successfully' + (isFallback ? ' (IPv4)' : ''));
    }
  });
}

// Initial connection test
testConnection(pool, connectionString);

module.exports = db;