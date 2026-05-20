const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { normalizeRole } = require('../utils/roles');
const { rejectClientIdentityHeaders } = require('../utils/firebaseIdentity');
const { hasColumn } = require('../utils/schemaCache');

async function resolveAppUserByIdentity(uid, email) {
  // schemaCache: zero DB round-trip after first request in this process
  const hasDepartment = await hasColumn('users', 'department');

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
    if (rejectClientIdentityHeaders(req, res)) {
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const email = decoded.email ? String(decoded.email).trim().toLowerCase() : null;
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
    console.error('❌ Authentication failed:', {
      message: error.message,
      code: error.code || error.errorInfo?.code || null,
      firebaseAdminConfigured: !!(firebaseAdmin && firebaseAdmin.apps && firebaseAdmin.apps.length > 0),
    });
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
