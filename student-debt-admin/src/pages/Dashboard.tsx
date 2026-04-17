import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import DebtOverviewDashboard from '../components/DebtOverviewDashboard'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'adminstudent'

  return (
    <Box>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 0.5 }}>
            Welcome, {displayName}.
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Admin dashboard · Track student payments and total remaining cost
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            px: 2,
            py: 1.5,
            borderRadius: 3,
            border: '1px solid #e6ebf2',
            bgcolor: '#fff',
            minWidth: 240,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Logged in as
          </Typography>
          <Typography variant="body2" fontWeight={800} noWrap>
            {user?.email || 'adminstudent@hu.edu.et'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            System Administrator
          </Typography>
        </Paper>
      </Box>

      <DebtOverviewDashboard />

      <Box sx={{ mt: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Quick Actions
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Button component={Link} to="/students" variant="contained" size="large">
            Student Management
          </Button>
          <Button component={Link} to="/payment-review" variant="contained" size="large">
            Payment Review
          </Button>
          <Button variant="outlined" size="large" disabled>
            Reports
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
