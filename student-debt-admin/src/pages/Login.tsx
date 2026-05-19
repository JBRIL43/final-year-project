import { useEffect, useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/firebase'
import { getRoleHome, useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { user, profileLoading, profileReady, role } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && profileReady && role !== 'student') {
      navigate(getRoleHome(role), { replace: true })
    }
  }, [user, profileReady, role, navigate])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code

      if (code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key') {
        setError(
          'Firebase API key is invalid or the Render domain is not authorized in Firebase. Check VITE_FIREBASE_API_KEY and Authorized domains.'
        )
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          'This domain is not authorized in Firebase. Add your Render domain to Authorized domains in Firebase Console.'
        )
      } else {
        setError((err as Error)?.message || 'Login failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (user && profileLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography color="text.secondary">Loading your account…</Typography>
      </Box>
    )
  }

  if (user && profileReady && role === 'student') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Paper sx={{ p: 4, maxWidth: 480, textAlign: 'center' }} elevation={3}>
          <Typography variant="h6" gutterBottom>
            Account not configured
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You are signed in as <strong>{user.email}</strong>, but this account is not set up for
            the admin dashboard yet. Ask an administrator to sync Firebase users and assign your
            role in the database, then sign in again.
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }} elevation={3}>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Admin Login
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign in with your Firebase account.
        </Typography>

        <Box component="form" onSubmit={handleLogin}>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  )
}
