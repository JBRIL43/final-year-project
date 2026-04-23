const express = require('express');
const firebaseAdmin = require('../config/firebaseAdmin');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/change-password — change password for current user
router.post('/change-password', authenticateRequest, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const email = String(req.user?.email || '').trim();

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    if (!email) {
      return res.status(400).json({ error: 'No user email found for password update' });
    }

    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    if (!process.env.FIREBASE_API_KEY) {
      return res.status(500).json({ error: 'FIREBASE_API_KEY is not configured' });
    }

    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: String(currentPassword),
          returnSecureToken: true,
        }),
      }
    );

    const signInData = await signInResponse.json();

    if (!signInResponse.ok || !signInData?.idToken) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const targetUid = signInData.localId || req.auth?.uid;
    if (!targetUid) {
      return res.status(500).json({ error: 'Unable to resolve account for password update' });
    }

    await firebaseAdmin.auth().updateUser(targetUid, {
      password: String(newPassword),
    });

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error.message);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
