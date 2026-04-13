const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  const serviceAccount = require('../firebase-adminsdk.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      'https://final-year-project-default-rtdb.firebaseio.com',
  });
}

module.exports = admin;
