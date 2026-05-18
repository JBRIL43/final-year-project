const express = require('express');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/sync-firebase-users
// One-time endpoint: reads all Firebase Auth users and upserts them into Supabase.
// Protected by SYNC_SECRET env var — call with header: x-sync-secret: <value>
// After running, remove or disable this endpoint.
router.post('/sync-firebase-users', async (req, res) => {
  const secret = process.env.SYNC_SECRET || 'hu-sync-2025';
  if (req.headers['x-sync-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  const results = { inserted: [], updated: [], skipped: [], errors: [] };

  try {
    // List all Firebase users (handles pagination)
    let nextPageToken;
    const firebaseUsers = [];

    do {
      const listResult = await firebaseAdmin.auth().listUsers(1000, nextPageToken);
      firebaseUsers.push(...listResult.users);
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`Found ${firebaseUsers.length} Firebase users`);

    for (const fbUser of firebaseUsers) {
      try {
        const email = fbUser.email?.toLowerCase().trim();
        if (!email) {
          results.skipped.push({ uid: fbUser.uid, reason: 'no email' });
          continue;
        }

        const displayName = fbUser.displayName || email.split('@')[0];

        // Check if user already exists in Supabase by firebase_uid or email
        const existing = await pool.query(
          `SELECT user_id, email, role, firebase_uid FROM public.users
           WHERE firebase_uid = $1 OR LOWER(email) = LOWER($2)
           LIMIT 1`,
          [fbUser.uid, email]
        );

        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          // Update firebase_uid if it was a local fallback
          if (row.firebase_uid !== fbUser.uid) {
            await pool.query(
              `UPDATE public.users SET firebase_uid = $1, updated_at = NOW()
               WHERE user_id = $2`,
              [fbUser.uid, row.user_id]
            );
            results.updated.push({ email, uid: fbUser.uid, reason: 'uid_updated' });
          } else {
            results.skipped.push({ email, uid: fbUser.uid, reason: 'already_exists' });
          }
          continue;
        }

        // Determine role from email pattern (customize as needed)
        let role = 'student';
        if (email.includes('admin')) role = 'admin';
        else if (email.includes('finance')) role = 'finance';
        else if (email.includes('registrar')) role = 'registrar';
        else if (email.includes('dept') || email.includes('head')) role = 'department_head';

        // Insert new user
        await pool.query(
          `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [fbUser.uid, email, displayName, role]
        );

        results.inserted.push({ email, uid: fbUser.uid, role });
      } catch (userErr) {
        results.errors.push({ uid: fbUser.uid, error: userErr.message });
      }
    }

    res.json({
      success: true,
      summary: {
        total_firebase_users: firebaseUsers.length,
        inserted: results.inserted.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    });
  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({ error: 'Sync failed: ' + error.message });
  }
});

// POST /api/auth/change-password — change password for current user
router.post('/change-password', authenticateRequest, async (req, res) => {
  try {
    if (!process.env.FIREBASE_API_KEY) {
      console.error('FIREBASE_API_KEY not configured');
      return res.status(500).json({ error: 'Server misconfiguration' });
    }

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

    if (signInData?.error) {
      const firebaseErrorMessage = String(signInData.error.message || '').toUpperCase();

      if (
        firebaseErrorMessage === 'INVALID_PASSWORD' ||
        firebaseErrorMessage === 'USER_DISABLED' ||
        firebaseErrorMessage === 'INVALID_LOGIN_CREDENTIALS' ||
        firebaseErrorMessage === 'EMAIL_NOT_FOUND'
      ) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      console.error('Firebase auth error:', signInData.error);
      return res.status(401).json({ error: 'Authentication failed' });
    }

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
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
