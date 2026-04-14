import { useEffect, useState } from 'react'
import { Alert, Box, Button, Container, Paper, Stack, Typography } from '@mui/material'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export default function Dashboard() {
  const { user } = useAuth()
  const [health, setHealth] = useState<string>('Checking API...')
  const [error, setError] = useState<string | null>(null)

  const loadHealth = async () => {
    try {
      setError(null)
      const response = await api.get('/api/health')
      setHealth(response.data?.status || 'OK')
    } catch (err: any) {
      setHealth('Unavailable')
      setError(err?.message || 'Failed to reach backend')
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Admin Dashboard
          </Typography>
          <Typography variant="body1">Signed in as: {user?.email}</Typography>
          <Typography variant="body1">Backend health: {health}</Typography>
          {error && <Alert severity="warning">{error}</Alert>}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={loadHealth}>
              Refresh API Status
            </Button>
            <Button variant="contained" color="error" onClick={() => signOut(auth)}>
              Sign out
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  )
}
