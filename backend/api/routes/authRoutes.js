const crypto = require('crypto');
const express = require('express');
const pool = require('../config/db');
const firebaseAdmin = require('../config/firebaseAdmin');
const { authenticateRequest } = require('../middleware/auth');

const router = express.Router();

function getSyncSecret() {
  const secret = process.env.SYNC_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SYNC_SECRET environment variable is required in production. Set it in Render/host env and redeploy.'
    );
  }

  return null;
}

function syncSecretMatches(provided, expected) {
  const providedBuf = Buffer.from(String(provided || ''));
  const expectedBuf = Buffer.from(String(expected || ''));

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

// Fail fast in production when the module loads (server startup).
getSyncSecret();

// ── Firebase → database user sync (admin operation) ───────────────────────────
// POST /api/auth/sync-firebase-users  with header: x-sync-secret: <SYNC_SECRET>
// No GET route — secrets must not appear in URLs, logs, or browser history.

async function runSync(res) {
  if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
    return res.status(500).json({ error: 'Firebase Admin not configured' });
  }

  const results = { inserted: [], updated: [], skipped: [], errors: [] };

  try {
    let nextPageToken;
    const firebaseUsers = [];
    do {
      const listResult = await firebaseAdmin.auth().listUsers(1000, nextPageToken);
      firebaseUsers.push(...listResult.users);
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`Syncing ${firebaseUsers.length} Firebase users to database`);

    for (const fbUser of firebaseUsers) {
      try {
        const email = fbUser.email?.toLowerCase().trim();
        if (!email) {
          results.skipped.push({ uid: fbUser.uid, reason: 'no_email' });
          continue;
        }

        const displayName = fbUser.displayName || email.split('@')[0];

        const existing = await pool.query(
          `SELECT user_id, firebase_uid FROM public.users
           WHERE firebase_uid = $1 OR LOWER(email) = LOWER($2) LIMIT 1`,
          [fbUser.uid, email]
        );

        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          if (row.firebase_uid !== fbUser.uid) {
            await pool.query(
              `UPDATE public.users SET firebase_uid = $1, updated_at = NOW() WHERE user_id = $2`,
              [fbUser.uid, row.user_id]
            );
            results.updated.push({ email, uid: fbUser.uid });
          } else {
            results.skipped.push({ email, uid: fbUser.uid, reason: 'already_exists' });
          }
          continue;
        }

        // Default new users to student; assign staff roles manually in the database.
        await pool.query(
          `INSERT INTO public.users (firebase_uid, email, full_name, role, created_at, updated_at)
           VALUES ($1, $2, $3, 'student', NOW(), NOW())`,
          [fbUser.uid, email, displayName]
        );
        results.inserted.push({ email, uid: fbUser.uid, role: 'student' });
      } catch (err) {
        results.errors.push({ uid: fbUser.uid, error: err.message });
      }
    }

    return res.json({
      success: true,
      summary: {
        total: firebaseUsers.length,
        inserted: results.inserted.length,
        updated: results.updated.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      details: results,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: 'Sync failed: ' + err.message });
  }
}

router.post('/sync-firebase-users', async (req, res) => {
  const secret = getSyncSecret();

  if (!secret) {
    return res.status(503).json({
      error: 'Firebase sync is disabled. Set SYNC_SECRET in the server environment.',
    });
  }

  const provided = String(req.headers['x-sync-secret'] || '').trim();
  if (!syncSecretMatches(provided, secret)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return runSync(res);
});

// ── Change password ───────────────────────────────────────────────────────────
router.post('/change-password', authenticateRequest, async (req, res) => {
  try {
    if (!process.env.FIREBASE_API_KEY) {
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
      return res.status(400).json({ error: 'No user email found' });
    }
    if (!firebaseAdmin || firebaseAdmin.apps.length === 0) {
      return res.status(500).json({ error: 'Firebase Admin is not configured' });
    }

    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: String(currentPassword), returnSecureToken: true }),
      }
    );

    const signInData = await signInResponse.json();

    if (signInData?.error) {
      const msg = String(signInData.error.message || '').toUpperCase();
      if (['INVALID_PASSWORD', 'USER_DISABLED', 'INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND'].includes(msg)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (!signInResponse.ok || !signInData?.idToken) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const targetUid = signInData.localId || req.auth?.uid;
    if (!targetUid) {
      return res.status(500).json({ error: 'Unable to resolve account' });
    }

    await firebaseAdmin.auth().updateUser(targetUid, { password: String(newPassword) });
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
