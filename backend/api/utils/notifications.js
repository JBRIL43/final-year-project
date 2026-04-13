const admin = require('../config/firebaseAdmin');
const pool = require('../config/db');

let notificationsTableReady = false;

async function ensureNotificationsTable() {
  if (notificationsTableReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.notifications (
      notification_id BIGSERIAL PRIMARY KEY,
      firebase_uid VARCHAR(255) NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_firebase_uid
      ON public.notifications (firebase_uid, is_read, created_at DESC);
  `);

  notificationsTableReady = true;
}

async function sendPaymentNotification(userId, title, body, data = {}) {
  try {
    await ensureNotificationsTable();

    const recipient = await getRecipientFromDatabase(userId);

    if (!recipient) {
      console.log('No recipient found for user:', userId);
      return;
    }

    await storeNotification(recipient.firebase_uid, title, body, data);

    const userToken = recipient.fcm_token;

    if (!userToken) {
      console.log('No FCM token found for user:', userId);
      return;
    }

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      token: userToken,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

async function storeNotification(firebaseUid, title, body, data = {}) {
  await pool.query(
    `INSERT INTO public.notifications (firebase_uid, title, body, data)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [firebaseUid, title, body, JSON.stringify(data)]
  );
}

async function getRecipientFromDatabase(userId) {
  const result = await pool.query(
    'SELECT firebase_uid, fcm_token FROM public.users WHERE user_id = $1 LIMIT 1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

module.exports = {
  ensureNotificationsTable,
  sendPaymentNotification,
  storeNotification,
};
