import { FormEvent, useState } from 'react'
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
  TextField,
  Typography,
} from '@mui/material'
import api from '../services/api'

type AdminRole = 'registrar' | 'department_head' | 'finance'

type CreateUserResponse = {
  success: boolean
  message: string
  defaultPassword: string
  user: {
    user_id: number
    email: string
    role: string
    department: string | null
  }
}

export default function AdminUserManagement() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('registrar')
  const [department, setDepartment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault()

    if (!email.trim()) {
      setSnackbar({ open: true, message: 'Email is required', severity: 'error' })
      return
    }

    if (role === 'department_head' && !department.trim()) {
      setSnackbar({ open: true, message: 'Department is required for Department Head', severity: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post<CreateUserResponse>('/api/admin/users', {
        email: email.trim().toLowerCase(),
        role,
        department: role === 'department_head' ? department.trim() : null,
      })

      setCreatedUser(response.data)
      setSnackbar({ open: true, message: 'User created successfully', severity: 'success' })
      setEmail('')
      setRole('registrar')
      setDepartment('')
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.error || 'Failed to create user',
        severity: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
        User Administration
      </Typography>

      <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Create Administrative User
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create users for Registrar, Department Head, and Finance roles.
        </Typography>

        <Box component="form" onSubmit={handleCreateUser} sx={{ display: 'grid', gap: 2, maxWidth: 560 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(event) => setRole(event.target.value as AdminRole)}
            >
              <MenuItem value="registrar">Registrar</MenuItem>
              <MenuItem value="department_head">Department Head</MenuItem>
              <MenuItem value="finance">Finance Officer</MenuItem>
            </Select>
          </FormControl>

          {role === 'department_head' && (
            <TextField
              label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              required
              fullWidth
            />
          )}

          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </Button>
        </Box>
      </Paper>

      <Alert severity="info" sx={{ mb: 2 }}>
        Student passwords are never viewable. New admin users receive a default password and should change it on first login.
      </Alert>

      {createdUser && (
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Last Created User
          </Typography>
          <Typography variant="body2"><strong>Email:</strong> {createdUser.user.email}</Typography>
          <Typography variant="body2"><strong>Role:</strong> {createdUser.user.role}</Typography>
          <Typography variant="body2"><strong>Department:</strong> {createdUser.user.department || '-'}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Default Password:</strong> {createdUser.defaultPassword}
          </Typography>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
