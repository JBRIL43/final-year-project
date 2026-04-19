const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { normalizeRole } = require('../utils/roles');

async function getAvailableUserColumns() {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = ANY($1::text[])`,
    [['user_id', 'firebase_uid', 'email', 'full_name', 'role', 'department']]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function resolveAppUserByIdentity(uid, email) {
  const userColumns = await getAvailableUserColumns();
  const hasDepartment = userColumns.has('department');

  const departmentExpr = hasDepartment ? 'department' : "NULL::text AS department";

  const result = await pool.query(
    `SELECT
       user_id,
       email,
       full_name,
       role,
       ${departmentExpr}
     FROM public.users
     WHERE ($1::text IS NOT NULL AND firebase_uid = $1)
        OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
     ORDER BY user_id ASC
     LIMIT 1`,
    [uid || null, email || null]
  );

  return result.rows[0] || null;
}

async function authenticateRequest(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const email = decoded.email || req.headers['x-user-email'] || null;
    const appUser = await resolveAppUserByIdentity(decoded.uid, email);

    req.auth = {
      uid: decoded.uid,
      email,
      name: decoded.name || null,
    };

    req.user = {
      user_id: appUser ? appUser.user_id : null,
      email: appUser?.email || email,
      role: normalizeRole(appUser?.role),
      department: appUser?.department || null,
      full_name: appUser?.full_name || decoded.name || null,
    };

    next();
  } catch (error) {
    console.error('Authentication failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireRoles(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'student';

    if (userRole === 'admin' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
  };
}

module.exports = {
  authenticateRequest,
  requireRoles,
};
