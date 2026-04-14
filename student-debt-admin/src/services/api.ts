import axios from 'axios'

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

export default api
