import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import api from '../services/api';

type SnackbarState = {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
};

export default function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleChange = (field: 'current' | 'next' | 'confirm', value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.next !== form.confirm) {
      setSnackbar({
        open: true,
        message: 'New passwords do not match',
        severity: 'error',
      });
      return;
    }

    if (form.next.length < 8) {
      setSnackbar({
        open: true,
        message: 'New password must be at least 8 characters',
        severity: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: form.current,
        newPassword: form.next,
      });

      setSnackbar({
        open: true,
        message: 'Password updated successfully',
        severity: 'success',
      });
      setForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to update password',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 500 }}>
      <Typography variant="h5" gutterBottom>
        Change Password
      </Typography>

      <form onSubmit={handleSubmit}>
        <TextField
          fullWidth
          label="Current Password"
          type="password"
          value={form.current}
          onChange={(e) => handleChange('current', e.target.value)}
          margin="normal"
          required
        />

        <TextField
          fullWidth
          label="New Password"
          type="password"
          value={form.next}
          onChange={(e) => handleChange('next', e.target.value)}
          margin="normal"
          helperText="Must be at least 8 characters"
          required
        />

        <TextField
          fullWidth
          label="Confirm New Password"
          type="password"
          value={form.confirm}
          onChange={(e) => handleChange('confirm', e.target.value)}
          margin="normal"
          required
        />

        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? 'Updating...' : 'Update Password'}
        </Button>
      </form>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
