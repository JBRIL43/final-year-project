import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  TextField,
} from '@mui/material'
import api from '../services/api'

interface DepartmentStudent {
  student_id: number
  student_number: string
  full_name: string
  email: string
  department: string
  campus: string
  credits_registered: number | null
  enrollment_status: string
  withdrawal_requested_at: string | null
  department_clearance: string
}

export default function DepartmentDashboard() {
  const [students, setStudents] = useState<DepartmentStudent[]>([])
  const [department, setDepartment] = useState('')
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const loadStudents = async () => {
    setLoading(true)
    try {
      const response = await api.get<{ success: true; department: string; students: DepartmentStudent[] }>(
        '/api/department/students'
      )
      setStudents(response.data.students)
      setDepartment(response.data.department)
    } catch (error) {
      console.error('Failed to load department students:', error)
      setSnackbar({ open: true, message: 'Failed to load department students', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents()

    const interval = setInterval(() => {
      loadStudents()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleWithdrawalDecision = async (studentId: number, approved: boolean) => {
    try {
      await api.post(`/api/department/students/${studentId}/withdrawal/approve`, {
        approved,
      })
      setSnackbar({
        open: true,
        message: approved ? 'Withdrawal approved' : 'Withdrawal rejected',
        severity: 'success',
      })
      loadStudents()
    } catch (error: any) {
      console.error('Failed to process withdrawal decision:', error)
      setSnackbar({
        open: true,
        message: error?.response?.data?.error || 'Could not process withdrawal decision',
        severity: 'error',
      })
    }
  }

  const updateDepartmentClearance = async (studentId: number, status: string) => {
    try {
      await api.put(`/api/department/students/${studentId}/clearance`, {
        department_clearance: status,
      })
      setSnackbar({ open: true, message: 'Department clearance updated', severity: 'success' })
      loadStudents()
    } catch (error: any) {
      console.error('Failed to update department clearance:', error)
      setSnackbar({
        open: true,
        message: error?.response?.data?.error || 'Could not update department clearance',
        severity: 'error',
      })
    }
  }

  const handleUpdateCredits = async (studentId: number, creditsStr: string) => {
    const credits = creditsStr === '' ? null : Number.parseInt(creditsStr, 10)

    if (credits !== null && (!Number.isFinite(credits) || credits < 0)) {
      setSnackbar({
        open: true,
        message: 'Invalid credits value',
        severity: 'error',
      })
      return
    }

    try {
      await api.put(`/api/department/students/${studentId}/credits`, { credits_registered: credits })
      setSnackbar({ open: true, message: 'Credits updated', severity: 'success' })
      loadStudents()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update credits',
        severity: 'error',
      })
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        Department Head Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Department: {department || 'Not assigned'}
      </Typography>

      {loading ? (
        <Alert severity="info">Loading department students...</Alert>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Credits</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Dept. Clearance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.student_id} hover>
                    <TableCell>
                      <strong>{student.full_name}</strong>
                      <br />
                      <small>{student.email || student.student_number}</small>
                    </TableCell>
                    <TableCell>{student.campus || '-'}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={student.credits_registered ?? ''}
                        onChange={(e) => handleUpdateCredits(student.student_id, e.target.value)}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      {student.withdrawal_requested_at ? 'Withdrawal Requested' : student.enrollment_status || '-'}
                    </TableCell>
                    <TableCell>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel>Clearance</InputLabel>
                        <Select
                          value={String(student.department_clearance || 'PENDING').toLowerCase()}
                          label="Clearance"
                          onChange={(event) => updateDepartmentClearance(student.student_id, event.target.value)}
                        >
                          <MenuItem value="pending">Pending</MenuItem>
                          <MenuItem value="approved">Approved</MenuItem>
                          <MenuItem value="rejected">Rejected</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell align="right">
                      {student.withdrawal_requested_at ? (
                        <>
                          <Button
                            size="small"
                            onClick={() => handleWithdrawalDecision(student.student_id, true)}
                            sx={{ mr: 1 }}
                          >
                            Approve Withdrawal
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleWithdrawalDecision(student.student_id, false)}
                          >
                            Reject Withdrawal
                          </Button>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No withdrawal request
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No students found in this department.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
