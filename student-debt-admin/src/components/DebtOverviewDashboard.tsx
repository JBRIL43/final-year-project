import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Alert,
  Snackbar,
} from '@mui/material';
import api from '../services/api';

interface DebtMetrics {
  totalCollections: number;
  outstandingDebt: number;
}

export default function DebtOverviewDashboard() {
  const [metrics, setMetrics] = useState<DebtMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadMetrics = async () => {
    try {
      const res = await api.get<{ success: true; data: DebtMetrics }>('/api/admin/analytics/debt-overview');
      setMetrics(res.data.data);
    } catch (err) {
      console.error('Failed to load debt metrics', err);
      setSnackbar({
        open: true,
        message: '❌ Failed to load debt overview',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  // Format currency as ETB
  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Debt Overview Dashboard
      </Typography>

      {loading ? (
        <Grid container spacing={3}>
          {[1, 2].map((i) => (
            <Grid item xs={12} sm={6} key={i}>
              <Paper sx={{ p: 3, height: 120, backgroundColor: '#f5f5f5' }} />
            </Grid>
          ))}
        </Grid>
      ) : metrics ? (
        <Grid container spacing={3}>
          {/* Total Collections */}
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 3, backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
              <Typography variant="body2" color="text.secondary">
                Total Collections
              </Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                {formatETB(metrics.totalCollections)}
              </Typography>
            </Paper>
          </Grid>

          {/* Outstanding Debt */}
          <Grid item xs={12} sm={6}>
            <Paper sx={{ p: 3, backgroundColor: '#ffebee', borderLeft: '4px solid #f44336' }}>
              <Typography variant="body2" color="text.secondary">
                Outstanding Debt
              </Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
                {formatETB(metrics.outstandingDebt)}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Alert severity="error">No data available</Alert>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
