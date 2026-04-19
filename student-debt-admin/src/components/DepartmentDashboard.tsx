import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import api from '../services/api'

interface DepartmentStudent {
  student_id: number
  student_number: string
  full_name: string
  department: string
  campus: string
  credit_load: number | null
  enrollment_status: string
}

export default function DepartmentDashboard() {
  const [students, setStudents] = useState<DepartmentStudent[]>([])
  const [department, setDepartment] = useState('')
  const [programChanges, setProgramChanges] = useState<Record<number, string>>({})
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
  }, [])

  const approveWithdrawal = async (studentId: number) => {
    try {
      await api.post(`/api/department/students/${studentId}/actions`, {
        action: 'approve_withdrawal',
      })
      setSnackbar({ open: true, message: 'Withdrawal approved', severity: 'success' })
      loadStudents()
    } catch (error) {
      console.error('Failed to approve withdrawal:', error)
      setSnackbar({ open: true, message: 'Could not approve withdrawal', severity: 'error' })
    }
  }

  const approveProgramChange = async (studentId: number) => {
    const newDepartment = (programChanges[studentId] || '').trim()
    if (!newDepartment) {
      setSnackbar({ open: true, message: 'Enter the new program first', severity: 'error' })
      return
    }

    try {
      await api.post(`/api/department/students/${studentId}/actions`, {
        action: 'approve_program_change',
        newDepartment,
      })
      setSnackbar({ open: true, message: 'Program change approved', severity: 'success' })
      setProgramChanges((prev) => ({ ...prev, [studentId]: '' }))
      loadStudents()
    } catch (error) {
      console.error('Failed to approve program change:', error)
      setSnackbar({ open: true, message: 'Could not approve program change', severity: 'error' })
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
                  <TableCell>Name</TableCell>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Credits</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>New Program</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.student_id} hover>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.student_number}</TableCell>
                    <TableCell>{student.credit_load ?? '-'}</TableCell>
                    <TableCell>{student.enrollment_status || '-'}</TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="e.g. Information Systems"
                        value={programChanges[student.student_id] || ''}
                        onChange={(event) =>
                          setProgramChanges((prev) => ({
                            ...prev,
                            [student.student_id]: event.target.value,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => approveWithdrawal(student.student_id)} sx={{ mr: 1 }}>
                        Approve Withdrawal
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => approveProgramChange(student.student_id)}>
                        Approve Program Change
                      </Button>
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
