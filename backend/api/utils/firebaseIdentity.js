const firebaseAdmin = require('../config/firebaseAdmin');

function hasClientIdentityHeaders(req) {
  return !!(req.headers['x-firebase-uid'] || req.headers['x-user-email']);
}

function rejectClientIdentityHeaders(req, res) {
  if (!hasClientIdentityHeaders(req)) {
    return false;
  }

  res.status(400).json({
    error:
      'Client identity headers (x-firebase-uid, x-user-email) are not accepted. Use Authorization: Bearer <Firebase ID token>.',
  });
  return true;
}

async function verifyBearerIdentity(req) {
  if (hasClientIdentityHeaders(req)) {
    const err = new Error('Client identity headers are not accepted');
    err.statusCode = 400;
    throw err;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    const err = new Error('Missing Bearer token');
    err.statusCode = 401;
    throw err;
  }

  if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
    const err = new Error('Firebase Admin is not configured');
    err.statusCode = 500;
    throw err;
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid || null,
      email: decoded.email ? String(decoded.email).trim().toLowerCase() : null,
      name: decoded.name || null,
    };
  } catch (error) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

module.exports = {
  hasClientIdentityHeaders,
  rejectClientIdentityHeaders,
  verifyBearerIdentity,
};
