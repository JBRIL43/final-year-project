import { Box } from '@mui/material'
import DebtOverviewDashboard from '../components/DebtOverviewDashboard'
import StudentManagement from '../components/StudentManagement'

export default function Dashboard() {
  return (
    <Box sx={{ p: 0, m: 0 }}>
      <DebtOverviewDashboard />
      <StudentManagement />
    </Box>
  )
}
