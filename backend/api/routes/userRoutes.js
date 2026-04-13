const express = require('express');
const pool = require('../config/db');
const { ensureUsersFcmTokenColumn } = require('../utils/notifications');

const router = express.Router();

router.post('/fcm-token', async (req, res) => {
  try {
    await ensureUsersFcmTokenColumn();

    const { userId, firebaseUid, email, fcmToken } = req.body;

    if (!fcmToken || (!userId && !firebaseUid && !email)) {
      return res.status(400).json({
        error: 'fcmToken and one identifier (userId, firebaseUid, or email) are required',
      });
    }

    let result;

    if (userId) {
      result = await pool.query(
        'UPDATE public.users SET fcm_token = $1 WHERE user_id = $2 RETURNING user_id, email',
        [fcmToken, userId]
      );
    } else if (firebaseUid) {
      result = await pool.query(
        'UPDATE public.users SET fcm_token = $1 WHERE firebase_uid = $2 RETURNING user_id, email',
        [fcmToken, firebaseUid]
      );
    } else {
      result = await pool.query(
        'UPDATE public.users SET fcm_token = $1 WHERE email = $2 RETURNING user_id, email',
        [fcmToken, email]
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