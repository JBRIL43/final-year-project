import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  role: 'student',
  department: null,
  profile: null,
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

  const loadProfile = async (token: string) => {
    const response = await fetch(`${API_BASE_URL}/api/user/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to load user profile (${response.status})`)
    }

    const data = (await response.json()) as { success: boolean; user: UserProfile }
    return data.user
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken()
          localStorage.setItem('firebase_id_token', idToken)

          const currentProfile = await loadProfile(idToken)
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
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, role, department, profile }}>
      {children}
    </AuthContext.Provider>
  )
}
