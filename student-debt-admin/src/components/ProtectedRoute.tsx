import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { Navigate } from 'react-router-dom'
import { type UserRole, useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

const DEFAULT_ALLOWED_ROLES: UserRole[] = ['admin', 'finance', 'registrar', 'department_head']

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profileReady, role } = useAuth()

  // AppRoutes already blocks the entire tree until loading + profileReady are settled,
  // so by the time ProtectedRoute renders, auth state is fully known.

  const effectiveRoles = allowedRoles || DEFAULT_ALLOWED_ROLES
  const roleAllowed = effectiveRoles.includes(role)

  const roleHome =
    role === 'registrar'
      ? '/registrar'
      : role === 'department_head'
      ? '/department'
      : role === 'student'
      ? '/login'
      : '/'

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user && profileReady && role === 'student') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Box>
          <strong>Account not configured</strong>
          <br />
          You are logged in as <strong>{user.email}</strong> but your account has not been set up
          for the admin dashboard yet.
          <br />
          <br />
          Ask your administrator to run the Firebase sync and assign your role in the database.
        </Box>
      </Box>
    )
  }

  if (!roleAllowed) {
    return <Navigate to={roleHome} replace />
  }

  return <>{children}</>
}
