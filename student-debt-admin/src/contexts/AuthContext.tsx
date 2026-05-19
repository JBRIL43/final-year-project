import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import api, { setAuthToken } from '../services/api'

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
  /** Firebase auth state not yet known */
  loading: boolean
  /** `/api/user/me` in flight for signed-in user */
  profileLoading: boolean
  /** `/api/user/me` finished (success or failure) */
  profileReady: boolean
  isAdmin: boolean
  role: UserRole
  department: string | null
  profile: UserProfile | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profileLoading: false,
  profileReady: false,
  isAdmin: false,
  role: 'student',
  department: null,
  profile: null,
  logout: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function getRoleHome(role: UserRole): string {
  if (role === 'registrar') return '/registrar'
  if (role === 'department_head') return '/department'
  if (role === 'student') return '/login'
  return '/reports'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<UserRole>('student')
  const [department, setDepartment] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const resetProfileState = () => {
    setProfile(null)
    setRole('student')
    setDepartment(null)
    setIsAdmin(false)
    setProfileReady(false)
    setProfileLoading(false)
  }

  const logout = async () => {
    await signOut(auth)
    setAuthToken(null)
    setUser(null)
    resetProfileState()
  }

  const loadProfile = async (token: string): Promise<UserProfile> => {
    const response = await api.get<{ success: boolean; user: UserProfile }>('/api/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    return response.data.user
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setProfileLoading(true)
        setProfileReady(false)

        try {
          const idToken = await currentUser.getIdToken(true)
          setAuthToken(idToken)

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
          resetProfileState()
          setProfile({
            user_id: null,
            email: currentUser.email,
            role: 'student',
            department: null,
            full_name: currentUser.displayName,
          })
        } finally {
          setProfileLoading(false)
          setProfileReady(true)
          setLoading(false)
        }
      } else {
        setAuthToken(null)
        setUser(null)
        resetProfileState()
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileLoading,
        profileReady,
        isAdmin,
        role,
        department,
        profile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
