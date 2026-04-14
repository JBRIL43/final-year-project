import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingConfigKeys.length > 0) {
  console.warn(
    `Firebase config is missing: ${missingConfigKeys.join(', ')}. Check your Render environment variables.`
  )
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
