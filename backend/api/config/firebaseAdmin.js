const admin = require('firebase-admin');

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

function parseServiceAccountJson() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;
  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;

  let jsonText = null;

  if (base64Json) {
    try {
      jsonText = Buffer.from(base64Json, 'base64').toString('utf8');
    } catch (error) {
      console.warn('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 could not be decoded.');
    }
  } else if (rawJson) {
    jsonText = rawJson;
  }

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);

    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }

    return parsed;
  } catch (error) {
    console.warn('FIREBASE service account JSON is not valid JSON.');
    return null;
  }
}

function initializeFromEnv() {
  const serviceAccount = parseServiceAccountJson();

  if (
    serviceAccount?.project_id &&
    serviceAccount?.client_email &&
    serviceAccount?.private_key
  ) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        `https://${serviceAccount.project_id}.firebaseio.com`,
    });

    return true;
  }

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

if (admin.apps.length === 0) {
  try {
    if (initializeFromEnv()) {
      console.log('Firebase Admin initialized from environment variables.');
    } else {
      console.warn(
        'Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON/FIREBASE_SERVICE_ACCOUNT(_BASE64) or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY(_BASE64).'
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
