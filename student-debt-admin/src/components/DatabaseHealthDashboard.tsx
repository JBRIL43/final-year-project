import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined'
import api from '../services/api'

type DatabaseHealth = {
  status: 'healthy' | 'unhealthy'
  checked_at: string
  latency_ms?: number
  totals?: {
    students: number
    debtors: number
    pending_payments: number
  }
}

export default function DatabaseHealthDashboard() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = async () => {
    try {
      const response = await api.get<{ success: boolean; data: DatabaseHealth; error?: string }>(
        '/api/admin/database/health'
      )
      setHealth(response.data.data)
      setError(null)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load database health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
    const interval = setInterval(loadHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <Alert severity="info">Checking database health...</Alert>
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>
  }

  if (!health) {
    return <Alert severity="warning">No database health data available.</Alert>
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
        Database Health Monitoring
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <MonitorHeartOutlinedIcon color={health.status === 'healthy' ? 'success' : 'error'} />
          <Chip
            label={health.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
            color={health.status === 'healthy' ? 'success' : 'error'}
          />
          <Typography variant="body2" color="text.secondary">
            Last checked: {new Date(health.checked_at).toLocaleString('en-ET')}
          </Typography>
        </Stack>

        <Typography variant="body1" sx={{ mb: 1 }}>
          Query latency: <strong>{health.latency_ms ?? '-'} ms</strong>
        </Typography>

        <Typography variant="h6" sx={{ mt: 2, mb: 1.5, fontWeight: 700 }}>
          Current Totals
        </Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">
              Students
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {health.totals?.students ?? 0}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">
              Debtors
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {health.totals?.debtors ?? 0}
            </Typography>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">
              Pending Payments
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {health.totals?.pending_payments ?? 0}
            </Typography>
          </Paper>
        </Stack>
      </Paper>
    </Box>
  )
}
