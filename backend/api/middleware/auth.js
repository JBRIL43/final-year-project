const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { normalizeRole } = require('../utils/roles');
const { rejectClientIdentityHeaders } = require('../utils/firebaseIdentity');
const { hasColumn } = require('../utils/schemaCache');

const { recordSystemLog } = require('../utils/systemLog');

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

    // Log RBAC failure
    recordSystemLog({
      req,
      action: 'security.rbac_failure',
      severity: 'warning',
      success: false,
      errorMessage: `Forbidden: role ${userRole} tried to access ${req.originalUrl}`,
      metadata: { requiredRoles: allowedRoles, actualRole: userRole }
    });

    return res.status(403).json({ error: 'Forbidden: insufficient role permissions' });
  };
}

/**
 * Ensures that a student can only access their own data.
 * Admin, Finance, and Registrar roles bypass this check.
 */
function validateOwnership(req, res, next) {
  const { user } = req;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Privilege roles bypass ownership checks
  if (['admin', 'finance', 'registrar', 'department_head'].includes(user.role)) {
    return next();
  }

  // Determine student_id from request (param or body)
  const requestedStudentId = req.params.studentId || req.body.studentId;

  if (!requestedStudentId) {
    return next(); // Nothing to check ownership against
  }

  // Logic to resolve studentId from user context
  // This usually requires a DB lookup or session data.
  // For this project, we assume studentId is linked to user_id in students table.
  pool.query('SELECT student_id FROM students WHERE user_id = $1 LIMIT 1', [user.user_id])
    .then(result => {
      const actualStudentId = result.rows[0]?.student_id;
      if (String(actualStudentId) !== String(requestedStudentId)) {
        recordSystemLog({
          req,
          action: 'security.ownership_failure',
          severity: 'critical',
          success: false,
          errorMessage: `Student ${user.user_id} tried to access resource for student ${requestedStudentId}`
        });
        return res.status(403).json({ error: 'Forbidden: you do not own this resource' });
      }
      next();
    })
    .catch(err => {
      console.error('Ownership validation error:', err);
      res.status(500).json({ error: 'Internal server error during validation' });
    });
}

module.exports = {
  authenticateRequest,
  requireRoles,
  validateOwnership,
};
