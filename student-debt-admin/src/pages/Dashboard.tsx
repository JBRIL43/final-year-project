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
          <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 0.5, fontSize: { xs: 32, md: 46 } }}>
            Welcome, {displayName}.
          </Typography>
          <Typography color="#6b7588" variant="h6" sx={{ fontWeight: 500, fontSize: { xs: 18, md: 32 } }}>
            Admin dashboard · Track student payments and total remaining cost
          </Typography>
        </Box>
      </Box>

      <DebtOverviewDashboard />

      <Box sx={{ mt: 3.5 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Quick Actions
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ maxWidth: 1120 }}>
          <Button component={Link} to="/students" variant="contained" size="large" sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.25 }}>
            Generate Reports
          </Button>
          <Button component={Link} to="/students" variant="contained" size="large" sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.25 }}>
            Add User
          </Button>
          <Button component={Link} to="/students" variant="contained" size="large" sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.25 }}>
            User List
          </Button>
          <Button component={Link} to="/payment-review" variant="contained" size="large" sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.25 }}>
            SIS Import
          </Button>
        </Stack>
      </Box>
    </Box>
  )
}
