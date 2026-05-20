import axios from 'axios'
import { auth } from '../lib/firebase'
import { signOut } from 'firebase/auth'
import { publishApiError } from './apiErrors'

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const isLocalHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

export const API_BASE_URL =
  envApiBaseUrl ||
  (isLocalHost
    ? 'http://localhost:10000'
    : 'https://final-year-project-r2h8.onrender.com')

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('firebase_id_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Keep axios and localStorage in sync (call after getIdToken). */
export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('firebase_id_token', token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    localStorage.removeItem('firebase_id_token')
    delete api.defaults.headers.common.Authorization
  }
}

let handlingUnauthorized = false

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status
    if (status === 401 && auth.currentUser && !handlingUnauthorized) {
      handlingUnauthorized = true
      try {
        setAuthToken(null)
        await signOut(auth)
      } finally {
        handlingUnauthorized = false
      }
    }
    const apiMessage =
      error?.response?.data?.error
      || error?.message
      || 'Request failed'

    if (status && status >= 500) {
      publishApiError(apiMessage)
    }

    return Promise.reject(error)
  }
)

export default api
