import { FormEvent, useEffect, useState } from 'react'
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
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { AdminUser } from '../types/adminUser'

type AdminRole = 'registrar' | 'department_head' | 'finance' | 'admin'

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
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editRole, setEditRole] = useState<AdminRole>('registrar')
  const [editDepartment, setEditDepartment] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ users: AdminUser[] }>('/api/admin/users')
      setUsers(res.data.users)
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load admin users', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

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
      fetchUsers()
      const handleEditClick = (user: AdminUser) => {
        setEditUser(user)
        setEditRole(
          user.role === 'REGISTRAR' ? 'registrar' :
          user.role === 'DEPARTMENT_HEAD' ? 'department_head' :
          user.role === 'FINANCE_OFFICER' ? 'finance' :
          'admin'
        )
        setEditDepartment(user.department || '')
      }

      const handleEditSave = async () => {
        if (!editUser) return
        setEditSubmitting(true)
        try {
          await api.put(`/api/admin/users/${editUser.user_id}`, {
            role: editRole,
            department: editRole === 'department_head' ? editDepartment : null,
          })
          setSnackbar({ open: true, message: 'User updated', severity: 'success' })
          setEditUser(null)
          fetchUsers()
        } catch (err: any) {
          setSnackbar({ open: true, message: err?.response?.data?.error || 'Failed to update user', severity: 'error' })
        } finally {
          setEditSubmitting(false)
        }
      }

      const handleDeleteUser = async (user: AdminUser) => {
        if (!window.confirm(`Delete user ${user.email}?`)) return
        try {
          await api.delete(`/api/admin/users/${user.user_id}`)
          setSnackbar({ open: true, message: 'User deleted', severity: 'success' })
          fetchUsers()
        } catch (err: any) {
          setSnackbar({ open: true, message: err?.response?.data?.error || 'Failed to delete user', severity: 'error' })
        }
      }
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
              <MenuItem value="admin">Admin</MenuItem>
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

      <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Administrative Users
        </Typography>
        <DataGrid
          rows={users}
          columns={[
            { field: 'email', headerName: 'Email', width: 220 },
            { field: 'full_name', headerName: 'Full Name', width: 160 },
            { field: 'role', headerName: 'Role', width: 140, valueGetter: (params) => {
              switch (params.value) {
                case 'REGISTRAR': return 'Registrar'
                case 'DEPARTMENT_HEAD': return 'Department Head'
                case 'FINANCE_OFFICER': return 'Finance Officer'
                case 'ADMIN': return 'Admin'
                default: return params.value
              }
            } },
            { field: 'department', headerName: 'Department', width: 160 },
            { field: 'created_at', headerName: 'Created', width: 160, valueGetter: (params) => new Date(params.value).toLocaleString() },
            { field: 'actions', headerName: 'Actions', width: 140, sortable: false, renderCell: (params) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditClick(params.row)}>
                  Edit
                </Button>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteUser(params.row)}>
                  Delete
                </Button>
              </Box>
            ) },
          ] as GridColDef[]}
          getRowId={(row) => row.user_id}
          autoHeight
          loading={loading}
          pageSizeOptions={[5, 10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        />
      </Paper>

      {editUser && (
        <Paper elevation={2} sx={{ border: '2px solid #1976d2', borderRadius: 3, p: 3, mb: 2, maxWidth: 400 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Edit User
          </Typography>
          <TextField
            label="Email"
            value={editUser.email}
            fullWidth
            disabled
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={editRole}
              label="Role"
              onChange={(e) => setEditRole(e.target.value as AdminRole)}
            >
              <MenuItem value="registrar">Registrar</MenuItem>
              <MenuItem value="department_head">Department Head</MenuItem>
              <MenuItem value="finance">Finance Officer</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          {editRole === 'department_head' && (
            <TextField
              label="Department"
              value={editDepartment}
              onChange={(e) => setEditDepartment(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handleEditSave} disabled={editSubmitting}>
              Save
            </Button>
            <Button onClick={() => setEditUser(null)} disabled={editSubmitting}>
              Cancel
            </Button>
          </Box>
        </Paper>
      )}

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
