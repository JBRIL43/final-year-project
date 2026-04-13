const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL || `https://${projectId}.firebaseio.com`,
    });
  } else {
    const localKeyPath = path.resolve(__dirname, '../firebase-adminsdk.json');

    if (fs.existsSync(localKeyPath)) {
      const serviceAccount = require(localKeyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          process.env.FIREBASE_DATABASE_URL ||
          `https://${serviceAccount.project_id}.firebaseio.com`,
      });
    } else {
      console.warn(
        'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
      );
    }
  }
}

module.exports = admin;
