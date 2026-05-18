const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

const rawConnectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;



const connectionString = normalizeConnectionString(rawConnectionString);
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
console.log('🔍 Connection string preview:', connectionString ? connectionString.substring(0, 50) + '...' : 'N/A');

if (process.env.NODE_ENV === 'production' && !connectionString) {
  throw new Error(
    'SUPABASE_DATABASE_URL is missing or still set to a placeholder. Set the real Supabase connection string in Render → Environment.'
  );
}

let pool = new Pool({
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

// Delegating export so we can swap the underlying pool if we recreate it (e.g., IPv6 -> IPv4 fallback)
const db = {
  query: (...args) => pool.query(...args),
  connect: (...args) => pool.connect(...args),
  end: (...args) => pool.end(...args),
  on: (evt, cb) => pool.on(evt, cb),
};

// Helper: extract host/port portion from a postgres connection string
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
  // replace only the first occurrence of oldHost in the rest
  return prefix + rest.replace(oldHost, newHost);
}

// Test database connection; if we see ENETUNREACH attempt an IPv4 lookup and recreate the pool
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err && err.stack ? err.stack : err);

    const msg = (err && err.message) || '';
    if (msg.includes('ENETUNREACH') && connectionString) {
      const hp = extractHostPort(connectionString);
      if (hp && hp.host) {
        console.log('ℹ️  Detected ENETUNREACH. Trying IPv4 lookup for host:', hp.host);
        dns.lookup(hp.host, { family: 4 }, (dnsErr, address) => {
          if (dnsErr) {
            console.error('❌ IPv4 DNS lookup failed:', dnsErr && dnsErr.message ? dnsErr.message : dnsErr);
            return;
          }

          try {
            const newCs = replaceHostInConnectionString(connectionString, hp.host, address);
            console.log('ℹ️  Recreating DB pool using IPv4 address', address, 'for host', hp.host);
            const newPool = new Pool({
              connectionString: newCs,
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

            // swap underlying pool used by delegating exports
            pool = newPool;
            console.log('ℹ️  IPv4 fallback pool created; testing connection...');
            pool.query('SELECT NOW()', (err2) => {
              if (err2) {
                console.error('❌ IPv4 fallback connection failed:', err2 && err2.stack ? err2.stack : err2);
              } else {
                console.log('✅ Database connected successfully (IPv4 fallback)');
              }
            });
          } catch (createErr) {
            console.error('❌ Failed creating IPv4 fallback pool:', createErr && createErr.stack ? createErr.stack : createErr);
          }
        });
      }
    }
  } else {
    console.log('✅ Database connected successfully');
  }
});

module.exports = db;