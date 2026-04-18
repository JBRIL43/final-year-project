import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import api from '../services/api';

interface DebtMetrics {
  totalCollections: number;
  outstandingDebt: number;
}

export default function DebtOverviewDashboard() {
  const [metrics, setMetrics] = useState<DebtMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
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

  const handleReconcileDebt = async () => {
    if (!window.confirm('Recalculate debt for all active students based on current cost shares? This cannot be undone.')) {
      return;
    }

    setReconciling(true);
    try {
      const res = await api.post<{ message?: string }>('/api/admin/debt/reconcile');
      setSnackbar({
        open: true,
        message: res.data.message || '✅ Debt reconciliation completed',
        severity: 'success',
      });
      loadMetrics();
    } catch (err: any) {
      console.error('Debt reconciliation failed', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Failed to reconcile debt',
        severity: 'error',
      });
    } finally {
      setReconciling(false);
    }
  };

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
    <Box sx={{ p: 0 }}>

      {loading ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          {[1, 2].map((i) => (
            <Paper key={i} sx={{ p: 3, height: 140, backgroundColor: '#f5f7fb', borderRadius: 3 }} />
          ))}
        </Box>
      ) : metrics ? (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
          {/* Total Collections */}
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e6ebf2', bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box>
                <Typography variant="body1" color="#4f5b70" sx={{ fontWeight: 700 }}>
                  Total Collections
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800, color: '#1c2333' }}>
                  {formatETB(metrics.totalCollections)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#8390a5' }}>
                  All successful student payments
                </Typography>
              </Box>
              <Box sx={{ width: 56, height: 56, borderRadius: 2.5, bgcolor: '#edf2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SavingsOutlinedIcon sx={{ color: '#2f67dc' }} />
              </Box>
            </Box>
          </Paper>

          {/* Outstanding Debt */}
          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e6ebf2', bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Box>
                <Typography variant="body1" color="#4f5b70" sx={{ fontWeight: 700 }}>
                  Outstanding Debt
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, fontWeight: 800, color: '#1c2333' }}>
                  {formatETB(metrics.outstandingDebt)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, color: '#8390a5' }}>
                  Total remaining debt across all students
                </Typography>
              </Box>
              <Box sx={{ width: 56, height: 56, borderRadius: 2.5, bgcolor: '#edf2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShowChartOutlinedIcon sx={{ color: '#2f67dc' }} />
              </Box>
            </Box>
          </Paper>
        </Box>
      ) : (
        <Alert severity="error">No data available</Alert>
      )}

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleReconcileDebt}
          disabled={reconciling}
          sx={{ minWidth: 220 }}
        >
          {reconciling ? 'Recalculating...' : 'Recalculate Annual Debt'}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Run at start of each academic year to apply official tuition & boarding costs.
        </Typography>
      </Box>

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
