const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function normalizePrivateKey(rawKey) {
  if (!rawKey) return null;

  let key = rawKey.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key
    .replace(/\r/g, '')
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n');

  return key;
}

function getEnvPrivateKey() {
  const base64Key = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (base64Key) {
    try {
      const decoded = Buffer.from(base64Key, 'base64').toString('utf8');
      return normalizePrivateKey(decoded);
    } catch (error) {
      console.warn('FIREBASE_PRIVATE_KEY_BASE64 could not be decoded.');
    }
  }

  return normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
}

function initializeFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getEnvPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL || `https://${projectId}.firebaseio.com`,
  });

  return true;
}

function initializeFromLocalFile() {
  const localKeyPath = path.resolve(__dirname, '../firebase-adminsdk.json');

  if (!fs.existsSync(localKeyPath)) {
    return false;
  }

  const serviceAccount = require(localKeyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      `https://${serviceAccount.project_id}.firebaseio.com`,
  });

  return true;
}

if (admin.apps.length === 0) {
  try {
    if (initializeFromEnv()) {
      console.log('Firebase Admin initialized from environment variables.');
    } else if (initializeFromLocalFile()) {
      console.log('Firebase Admin initialized from local service account file.');
    } else {
      console.warn(
        'Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.'
      );
    }
  } catch (error) {
    console.error(
      'Firebase Admin initialization failed. Notifications will be disabled until credentials are fixed.',
      error.message
    );
  }
}

module.exports = admin;
