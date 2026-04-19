import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
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
} from '@mui/material'
import api from '../services/api'

interface RegistrarStudent {
  student_id: number
  student_number: string
  full_name: string
  department: string
  campus: string
  enrollment_status: string
  clearance_status: string
}

export default function RegistrarDashboard() {
  const [students, setStudents] = useState<RegistrarStudent[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const loadStudents = async (statusFilter = '') => {
    setLoading(true)

    try {
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
      const response = await api.get<{ success: true; students: RegistrarStudent[] }>(`/api/registrar/students${query}`)
      setStudents(response.data.students)
    } catch (error) {
      console.error('Failed to load registrar students:', error)
      setSnackbar({ open: true, message: 'Failed to load students', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudents(status)
  }, [status])

  const markCleared = async (studentId: number) => {
    try {
      await api.post(`/api/registrar/students/${studentId}/clear`)
      setSnackbar({ open: true, message: 'Student marked as cleared', severity: 'success' })
      loadStudents(status)
    } catch (error) {
      console.error('Failed to clear student:', error)
      setSnackbar({ open: true, message: 'Could not mark student as cleared', severity: 'error' })
    }
  }

  const generateCertificate = (student: RegistrarStudent) => {
    const certificateText = [
      'HAWASSA UNIVERSITY - REGISTRAR CLEARANCE CERTIFICATE',
      `Student: ${student.full_name}`,
      `Student ID: ${student.student_number}`,
      `Program: ${student.department || 'N/A'}`,
      `Campus: ${student.campus || 'N/A'}`,
      `Status: ${student.enrollment_status || 'N/A'}`,
      `Clearance: ${student.clearance_status || 'N/A'}`,
      `Generated: ${new Date().toLocaleString('en-ET')}`,
    ].join('\n')

    const blob = new Blob([certificateText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Clearance_Certificate_${student.student_number}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Registrar Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review student academic status and process graduation or withdrawal clearances.
          </Typography>
        </Box>
        <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} displayEmpty>
          <MenuItem value="">All Statuses</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="WITHDRAWN">Withdrawn</MenuItem>
          <MenuItem value="GRADUATED">Graduated</MenuItem>
        </Select>
      </Box>

      {loading ? (
        <Alert severity="info">Loading registrar students...</Alert>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Student Name</TableCell>
                  <TableCell>Student ID</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Clearance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.student_id} hover>
                    <TableCell>{student.full_name}</TableCell>
                    <TableCell>{student.student_number}</TableCell>
                    <TableCell>{student.department || '-'}</TableCell>
                    <TableCell>{student.campus || '-'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={student.enrollment_status || 'UNKNOWN'} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={student.clearance_status || 'PENDING'}
                        color={String(student.clearance_status || '').toUpperCase() === 'CLEARED' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => markCleared(student.student_id)} sx={{ mr: 1 }}>
                        Mark Cleared
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => generateCertificate(student)}>
                        Generate Certificate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No students found for the selected status.
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
