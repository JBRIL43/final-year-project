import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material'
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import { Link } from 'react-router-dom'
import DebtOverviewDashboard from '../components/DebtOverviewDashboard'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'adminstudent'

  return (
    <Box>
      <Paper
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 4,
          background:
            'linear-gradient(120deg, rgba(27,86,188,0.95) 0%, rgba(34,134,222,0.9) 55%, rgba(38,161,153,0.88) 100%)',
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -40,
            top: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.14)',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 0.5, fontSize: { xs: 28, md: 44 } }}>
            Welcome, {displayName}
          </Typography>
          <Typography sx={{ opacity: 0.92, maxWidth: 840, fontSize: { xs: 15, md: 18 } }}>
            Finance Command Center: monitor collection performance, spot repayment risk early, and trigger debt operations from one place.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
            <Chip icon={<TimelineOutlinedIcon />} label="Live Portfolio Metrics" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 700 }} />
            <Chip icon={<VerifiedOutlinedIcon />} label="Policy-Aligned Tracking" sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 700 }} />
          </Stack>
        </Box>
      </Paper>

      <DebtOverviewDashboard />

      <Box sx={{ mt: 3, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
        {[
          {
            title: 'Delinquency Follow-up',
            text: 'Track overdue graduates and send reminders before escalation deadlines.',
            icon: <CampaignOutlinedIcon sx={{ color: '#2563eb' }} />,
          },
          {
            title: 'Student Ledger Ops',
            text: 'Maintain student records, contract data, and reconciliation readiness.',
            icon: <SchoolOutlinedIcon sx={{ color: '#16a34a' }} />,
          },
          {
            title: 'Verification Queue',
            text: 'Approve or reject submitted payments to keep balances current.',
            icon: <VerifiedOutlinedIcon sx={{ color: '#f59e0b' }} />,
          },
        ].map((item) => (
          <Paper key={item.title} sx={{ p: 2.25, borderRadius: 3, border: '1px solid #e6ebf2' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
              {item.icon}
              <Typography sx={{ fontWeight: 800 }}>{item.title}</Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#667085' }}>
              {item.text}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}
