import type { ReactNode } from 'react'
import { CircularProgress, Box } from '@mui/material'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: Array<'admin' | 'finance'>
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth()

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

  const roleAllowed = !allowedRoles || allowedRoles.includes('admin')

  if (!user || !isAdmin || !roleAllowed) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
