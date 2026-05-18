import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { API_BASE_URL } from '../services/api'

export type UserRole = 'student' | 'finance' | 'registrar' | 'department_head' | 'admin'

interface UserProfile {
  user_id: number | null
  email: string | null
  role: UserRole
  department: string | null
  full_name: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  role: UserRole
  department: string | null
  profile: UserProfile | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  role: 'student',
  department: null,
  profile: null,
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<UserRole>('student')
  const [department, setDepartment] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const logout = async () => {
    await signOut(auth)
    localStorage.removeItem('firebase_id_token')
    setUser(null)
    setIsAdmin(false)
    setRole('student')
    setDepartment(null)
    setProfile(null)
  }

  const loadProfile = async (token: string, firebaseUser: User): Promise<UserProfile> => {
    // Try to get profile from backend
    const response = await fetch(`${API_BASE_URL}/api/user/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const data = (await response.json()) as { success: boolean; user: UserProfile }
      const p = data.user

      // If backend returned student role but this is an admin dashboard login,
      // the user may not be in Supabase yet — try to upsert via FCM token endpoint
      if (p.role === 'student' && p.user_id === null) {
        await tryUpsertUser(token, firebaseUser)
        // Re-fetch after upsert
        const retry = await fetch(`${API_BASE_URL}/api/user/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (retry.ok) {
          const retryData = (await retry.json()) as { success: boolean; user: UserProfile }
          return retryData.user
        }
      }
      return p
    }

    // Backend unreachable — return minimal profile from Firebase
    return {
      user_id: null,
      email: firebaseUser.email,
      role: 'student',
      department: null,
      full_name: firebaseUser.displayName,
    }
  }

  // Upsert user into Supabase via the FCM token endpoint (works without a role)
  const tryUpsertUser = async (token: string, firebaseUser: User) => {
    try {
      await fetch(`${API_BASE_URL}/api/user/fcm-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          role: 'student', // will be corrected manually in Supabase
          fcmToken: 'web-placeholder',
        }),
      })
    } catch {
      // non-blocking
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken()
          localStorage.setItem('firebase_id_token', idToken)

          const currentProfile = await loadProfile(idToken, currentUser)
          const resolvedRole = currentProfile?.role || 'student'

          setUser(currentUser)
          setProfile(currentProfile)
          setRole(resolvedRole)
          setDepartment(currentProfile?.department || null)
          setIsAdmin(resolvedRole !== 'student')
        } catch (error) {
          console.error('Failed to resolve auth profile:', error)
          setUser(currentUser)
          setProfile(null)
          setRole('student')
          setDepartment(null)
          setIsAdmin(false)
        }
      } else {
        localStorage.removeItem('firebase_id_token')
        setUser(null)
        setIsAdmin(false)
        setRole('student')
        setDepartment(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, []) // eslint-disable-line

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, role, department, profile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
