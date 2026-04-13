const admin = require('../config/firebaseAdmin');

async function sendPaymentNotification(userId, title, body, data = {}) {
  try {
    const userToken = await getFcmTokenFromDatabase(userId);

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

async function getFcmTokenFromDatabase(userId) {
  // TODO: Query your users table or a separate fcm_tokens table.
  // Return the FCM token for the given userId.
  return null;
}

module.exports = { sendPaymentNotification };
