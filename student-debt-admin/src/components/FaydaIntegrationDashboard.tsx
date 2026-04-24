import { useEffect, useState } from 'react';
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
} from '@mui/material';
import api from '../services/api';

interface FaydaConfig {
  id: number;
  api_endpoint: string;
  institution_code: string;
  last_sync: string | null;
}

export default function FaydaIntegrationDashboard() {
  const [config, setConfig] = useState<FaydaConfig>({
    id: 0,
    api_endpoint: '',
    institution_code: '',
    last_sync: null,
  });
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: true; config: FaydaConfig }>('/api/admin/fayda/config');
      setConfig(res.data.config);
    } catch (err) {
      console.error('Failed to load Fayda config', err);
      setSnackbar({ open: true, message: 'Failed to load configuration', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      await api.put('/api/admin/fayda/config', {
        api_endpoint: config.api_endpoint,
        institution_code: config.institution_code,
      });
      setSnackbar({ open: true, message: 'Configuration saved', severity: 'success' });
      await loadConfig();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Save failed',
        severity: 'error',
      });
    }
  };

  const handleSync = async () => {
    try {
      const res = await api.post<{ message?: string }>('/api/admin/fayda/sync');
      setSnackbar({
        open: true,
        message: `Sync completed: ${res.data?.message || 'Success'}`,
        severity: 'success',
      });
      await loadConfig();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Sync failed',
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Fayda Integration Settings
      </Typography>

      {loading ? <Alert severity="info" sx={{ mb: 2 }}>Loading Fayda configuration...</Alert> : null}

      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField
          fullWidth
          label="Fayda API Endpoint"
          value={config.api_endpoint}
          onChange={(e) => setConfig((prev) => ({ ...prev, api_endpoint: e.target.value }))}
          margin="normal"
        />
        <TextField
          fullWidth
          label="Institution Code"
          value={config.institution_code}
          onChange={(e) => setConfig((prev) => ({ ...prev, institution_code: e.target.value }))}
          margin="normal"
          helperText="Hawassa University code (e.g., HU001)"
        />
        <Button variant="contained" onClick={handleSave} sx={{ mt: 2, mr: 2 }}>
          Save Configuration
        </Button>
        <Button
          variant="outlined"
          onClick={handleSync}
          sx={{ mt: 2 }}
          disabled={!config.api_endpoint || !config.institution_code}
        >
          Sync Now
        </Button>

        {config.last_sync ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Last synchronized: {new Date(config.last_sync).toLocaleString('en-ET')}
          </Typography>
        ) : null}
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell>Records</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Students</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>{config.last_sync ? 'Just now' : 'Never'}</TableCell>
                <TableCell>Auto-sync</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Debt Balances</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>{config.last_sync ? 'Just now' : 'Never'}</TableCell>
                <TableCell>Real-time</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Payments</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>{config.last_sync ? 'Just now' : 'Never'}</TableCell>
                <TableCell>On approval</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
