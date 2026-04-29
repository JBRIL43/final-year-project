import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  Snackbar,
  LinearProgress,
} from '@mui/material';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import DonutLargeOutlinedIcon from '@mui/icons-material/DonutLargeOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
    if (!window.confirm('Recalculate debt for all active students based on semester amount configuration? This cannot be undone.')) {
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

          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e6ebf2', bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
              <Typography variant="body1" color="#4f5b70" sx={{ fontWeight: 700 }}>
                Portfolio Health
              </Typography>
              <DonutLargeOutlinedIcon sx={{ color: '#2f67dc' }} />
            </Box>
            {(() => {
              const totalPortfolio = metrics.totalCollections + metrics.outstandingDebt;
              const recoveredRate = totalPortfolio > 0 ? (metrics.totalCollections / totalPortfolio) * 100 : 0;
              return (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#1c2333', mb: 1 }}>
                    {recoveredRate.toFixed(1)}% recovered
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(100, recoveredRate))}
                    sx={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: '#edf2ff',
                      '& .MuiLinearProgress-bar': { backgroundColor: '#2f67dc' },
                    }}
                  />
                  <Typography variant="body2" sx={{ mt: 1, color: '#8390a5' }}>
                    Recovered {formatETB(metrics.totalCollections)} out of {formatETB(totalPortfolio)} total portfolio.
                  </Typography>
                </>
              );
            })()}
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e6ebf2', bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
              <Typography variant="body1" color="#4f5b70" sx={{ fontWeight: 700 }}>
                Debt vs Collection
              </Typography>
              <InsightsOutlinedIcon sx={{ color: '#2f67dc' }} />
            </Box>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Collections', value: metrics.totalCollections, color: '#2f67dc' },
                    { name: 'Outstanding', value: metrics.outstandingDebt, color: '#f59e0b' },
                  ]}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatETB(Number(value))} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {[
                      { color: '#2f67dc' },
                      { color: '#f59e0b' },
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e6ebf2', bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
              <Typography variant="body1" color="#4f5b70" sx={{ fontWeight: 700 }}>
                Allocation Split
              </Typography>
              <DonutLargeOutlinedIcon sx={{ color: '#2f67dc' }} />
            </Box>
            <Box sx={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Collected', value: Math.max(metrics.totalCollections, 0), color: '#16a34a' },
                      { name: 'Outstanding', value: Math.max(metrics.outstandingDebt, 0), color: '#f97316' },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={84}
                    paddingAngle={3}
                  >
                    {[
                      { color: '#16a34a' },
                      { color: '#f97316' },
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatETB(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
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
          sx={{ minWidth: 260 }}
        >
          {reconciling ? 'Recalculating...' : 'Recalculate Semester Debt'}
        </Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Run at start of each semester to apply official semester amount configurations.
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
