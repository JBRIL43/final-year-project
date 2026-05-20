const crypto = require('crypto');

function generateSecurePassword(length = 32) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

async function createFirebaseUserWithReset({ firebaseAdmin, email, displayName }) {
  const password = generateSecurePassword(32);

  const userRecord = await firebaseAdmin.auth().createUser({
    email: String(email).trim(),
    emailVerified: false,
    password,
    displayName: String(displayName || email).trim(),
    disabled: false,
  });

  let passwordResetLink = null;
  try {
    passwordResetLink = await firebaseAdmin.auth().generatePasswordResetLink(String(email).trim());
  } catch (linkError) {
    console.warn('Failed to generate password reset link:', linkError.message);
  }

  return {
    uid: userRecord.uid,
    passwordResetLink,
  };
}

module.exports = {
  generateSecurePassword,
  createFirebaseUserWithReset,
};
