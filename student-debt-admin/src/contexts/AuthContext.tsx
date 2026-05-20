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
  /** `/api/user/me` finished successfully */
  profileReady: boolean
  /** Set when profile load failed after retries (before sign-out completes) */
  profileError: string | null
  isAdmin: boolean
  role: UserRole
  department: string | null
  profile: UserProfile | null
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  profileLoading: false,
  profileReady: false,
  profileError: null,
  isAdmin: false,
  role: 'student',
  department: null,
  profile: null,
  logout: async () => {},
  refreshProfile: async () => {},
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

const PROFILE_RETRY_ATTEMPTS = 2
const PROFILE_RETRY_DELAY_MS = 500

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function fetchUserProfile(idToken: string): Promise<UserProfile> {
  const response = await api.get<{ success: boolean; user: UserProfile }>('/api/user/me', {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  return response.data.user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
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
    setProfileError(null)
  }

  const logout = async () => {
    await signOut(auth)
    setAuthToken(null)
    setUser(null)
    resetProfileState()
  }

  const loadProfileWithRetry = async (firebaseUser: User): Promise<UserProfile> => {
    let lastError: unknown = null

    for (let attempt = 0; attempt < PROFILE_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const idToken = await firebaseUser.getIdToken(attempt > 0)
        setAuthToken(idToken)
        return await fetchUserProfile(idToken)
      } catch (error) {
        lastError = error
        if (attempt < PROFILE_RETRY_ATTEMPTS - 1) {
          await delay(PROFILE_RETRY_DELAY_MS * (attempt + 1))
        }
      }
    }

    throw lastError
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setProfileLoading(true)
        setProfileReady(false)
        setProfileError(null)

        try {
          const currentProfile = await loadProfileWithRetry(currentUser)
          const resolvedRole = currentProfile?.role || 'student'

          setUser(currentUser)
          setProfile(currentProfile)
          setRole(resolvedRole)
          setDepartment(currentProfile?.department || null)
          setIsAdmin(resolvedRole !== 'student')
          setProfileReady(true)
        } catch (error) {
          const message =
            (error as { response?: { data?: { error?: string } } })?.response?.data?.error
            || (error as Error)?.message
            || 'Failed to load account profile'

          console.error('Failed to resolve auth profile after retries:', error)
          setProfileError(message)

          // Do not keep a half-authenticated session with a guessed student role
          await signOut(auth)
          setAuthToken(null)
          setUser(null)
          resetProfileState()
        } finally {
          setProfileLoading(false)
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

  const refreshProfile = async () => {
    if (!user) return
    setProfileLoading(true)
    try {
      const idToken = await user.getIdToken()
      const currentProfile = await fetchUserProfile(idToken)
      setProfile(currentProfile)
      setRole(currentProfile?.role || 'student')
      setDepartment(currentProfile?.department || null)
      setIsAdmin((currentProfile?.role || 'student') !== 'student')
    } catch (err) {
      console.error('Failed to refresh profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileLoading,
        profileReady,
        profileError,
        isAdmin,
        role,
        department,
        profile,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
