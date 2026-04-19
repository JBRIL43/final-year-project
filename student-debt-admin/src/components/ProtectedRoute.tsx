import type { ReactNode } from 'react'
import { CircularProgress, Box } from '@mui/material'
import { Navigate } from 'react-router-dom'
import { type UserRole, useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

const DEFAULT_ALLOWED_ROLES: UserRole[] = ['admin', 'finance', 'registrar', 'department_head']

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, role } = useAuth()

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  const effectiveRoles = allowedRoles || DEFAULT_ALLOWED_ROLES
  const roleAllowed = effectiveRoles.includes(role)

  if (!user || !roleAllowed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
