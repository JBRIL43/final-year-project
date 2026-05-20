const express = require('express');
const pool = require('../config/db');
const { ensureUsersFcmTokenColumn } = require('../utils/notifications');
const { authenticateRequest } = require('../middleware/auth');
const { auditLog } = require('../utils/auditLog');

const router = express.Router();

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

    await auditLog(
      req,
      'user.fcm_token.update',
      { type: 'user', id: result.rows[0].user_id },
      null,
      { userId: result.rows[0].user_id, role: result.rows[0].role },
      { source: 'mobile' }
    );

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

router.put('/me', authenticateRequest, async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID not resolved' });
    }

    const result = await pool.query(
      `UPDATE public.users
       SET full_name = $1
       WHERE user_id = $2
       RETURNING user_id, email, role, department, full_name`,
      [full_name.trim(), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await auditLog(
      req,
      'user.profile.update',
      { type: 'user', id: userId },
      null,
      { full_name: full_name.trim() }
    );

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;

