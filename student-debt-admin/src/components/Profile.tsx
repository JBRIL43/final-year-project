import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  TextField,
  Typography,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export default function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setSnackbar({
        open: true,
        message: 'Full name cannot be empty',
        severity: 'error',
      })
      return
    }

    setSaving(true)
    try {
      await api.put('/api/user/me', { full_name: fullName.trim() })
      await refreshProfile()
      setSnackbar({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success',
      })
    } catch (err: any) {
      console.error('Failed to update profile:', err)
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update profile',
        severity: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: 'System Administrator',
    finance: 'Finance Officer',
    registrar: 'Registrar',
    department_head: 'Department Head',
    student: 'Student',
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 800 }}>
        User Profile
      </Typography>
      <Card sx={{ mt: 2, borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <CardHeader
          title="Profile Information"
          subheader="Manage your account profile details"
          titleTypographyProps={{ fontWeight: 800 }}
        />
        <Divider />
        <CardContent>
          <Box component="form" onSubmit={handleSave} noValidate>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={profile?.email || ''}
                  disabled
                  helperText="Your email address cannot be changed."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Role"
                  value={roleLabels[profile?.role || ''] || profile?.role || ''}
                  disabled
                  helperText="Your role is assigned by the system administrator."
                />
              </Grid>
              {profile?.department && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Department"
                    value={profile.department}
                    disabled
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !fullName.trim() || fullName.trim() === profile?.full_name}
                  sx={{
                    py: 1.25,
                    px: 3,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                  }}
                >
                  {saving ? <CircularProgress size={24} /> : 'Save Changes'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
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
