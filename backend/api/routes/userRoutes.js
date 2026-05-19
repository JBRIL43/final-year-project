const express = require('express');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { ensureUsersFcmTokenColumn } = require('../utils/notifications');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

async function resolveAppUserByIdentity(uid, email) {
  const result = await pool.query(
    `SELECT
       user_id,
       email,
       full_name,
       role,
       department
     FROM public.users
     WHERE ($1::text IS NOT NULL AND firebase_uid = $1)
        OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
     ORDER BY user_id ASC
     LIMIT 1`,
    [uid || null, email || null]
  );

  return result.rows[0] || null;
}

router.post('/debug/firebase', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.body?.idToken;

    if (!token) {
      return res.status(400).json({ error: 'Bearer token or idToken is required' });
    }

    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    const appUser = await resolveAppUserByIdentity(decoded.uid, decoded.email || null);

    return res.json({
      success: true,
      firebase: {
        uid: decoded.uid,
        email: decoded.email || null,
        name: decoded.name || null,
        issuer: decoded.iss || null,
        audience: decoded.aud || null,
        authTime: decoded.auth_time || null,
      },
      appUser,
    });
  } catch (error) {
    console.error('Firebase debug verification failed:', {
      message: error.message,
      code: error.code || error.errorInfo?.code || null,
      stack: error.stack,
    });

    return res.status(401).json({
      success: false,
      error: 'Token verification failed',
      message: error.message,
      code: error.code || error.errorInfo?.code || null,
    });
  }
});

router.get('/me', authenticateRequest, async (req, res) => {
  res.json({
    success: true,
    user: {
      user_id: req.user?.user_id || null,
      email: req.user?.email || null,
      role: req.user?.role || 'student',
      department: req.user?.department || null,
      full_name: req.user?.full_name || null,
    },
  });
});

router.post('/fcm-token', authenticateRequest, async (req, res) => {
  try {
    await ensureUsersFcmTokenColumn();

    const forbiddenFields = ['role', 'firebaseUid', 'email', 'userId', 'displayName'];
    const sentForbidden = forbiddenFields.filter((key) => req.body?.[key] != null);
    if (sentForbidden.length > 0) {
      return res.status(400).json({
        error: 'Only fcmToken is accepted; identity and role come from the Bearer token',
        rejectedFields: sentForbidden,
      });
    }

    const { fcmToken } = req.body;
    const firebaseUid = req.auth?.uid;
    const email = String(req.user?.email || req.auth?.email || '')
      .trim()
      .toLowerCase();

    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' });
    }

    if (!firebaseUid || !email) {
      return res.status(400).json({ error: 'Authenticated user must have uid and email' });
    }

    let result = await pool.query(
      `UPDATE public.users
       SET fcm_token = $1,
           firebase_uid = COALESCE(firebase_uid, $2)
       WHERE firebase_uid = $2
          OR LOWER(email) = LOWER($3)
       RETURNING user_id, email, role`,
      [fcmToken, firebaseUid, email]
    );

    if (result.rows.length === 0) {
      const callerRole = req.user?.role || 'student';

      if (callerRole !== 'student') {
        return res.status(404).json({
          error:
            'User not found in database. Admin and staff accounts must be provisioned before login.',
        });
      }

      const fullName = req.auth?.name || req.user?.full_name || email.split('@')[0] || email;

      result = await pool.query(
        `INSERT INTO public.users (firebase_uid, email, full_name, role, fcm_token)
         VALUES ($1, $2, $3, 'student', $4)
         ON CONFLICT (email) DO UPDATE
         SET firebase_uid = COALESCE(public.users.firebase_uid, EXCLUDED.firebase_uid),
             fcm_token = EXCLUDED.fcm_token
         RETURNING user_id, email, role`,
        [firebaseUid, email, fullName, fcmToken]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'FCM token updated',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('FCM token update error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to update FCM token' });
  }
});

module.exports = router;
