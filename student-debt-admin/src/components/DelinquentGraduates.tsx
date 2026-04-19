import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

interface DelinquentGraduate {
  student_id: number;
  full_name: string;
  email: string;
  department: string;
  campus: string;
  graduation_date: string;
  repayment_start_date: string;
  current_balance: number;
}

export default function DelinquentGraduates() {
  const [graduates, setGraduates] = useState<DelinquentGraduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadDelinquents = async () => {
    try {
      const res = await api.get<{ success: true; delinquentGraduates: DelinquentGraduate[] }>(
        '/api/admin/graduates/delinquent'
      );
      setGraduates(res.data.delinquentGraduates);
    } catch (err) {
      console.error('Failed to load delinquent graduates', err);
      setSnackbar({
        open: true,
        message: 'Failed to load delinquent graduates',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDelinquents();
  }, []);

  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ET');
  };

  const runAction = async (studentId: number, action: 'remind' | 'contacted') => {
    setActionLoadingId(studentId);

    try {
      const res = await api.post<{ success: true; message: string }>(
        `/api/admin/graduates/${studentId}/${action}`
      );

      setSnackbar({
        open: true,
        message: res.data.message,
        severity: 'success',
      });

      await loadDelinquents();
    } catch (err) {
      console.error(`Failed to ${action} graduate`, err);
      setSnackbar({
        open: true,
        message: `Failed to ${action} graduate`,
        severity: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Delinquent Graduates (Past Repayment Start Date)
      </Typography>

      {loading ? (
        <Paper>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        </Paper>
      ) : graduates.length === 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          No delinquent graduates found. All past-due accounts are cleared.
        </Alert>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Graduation</TableCell>
                  <TableCell>Repayment Start</TableCell>
                  <TableCell>Outstanding Debt</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {graduates.map((g) => (
                  <TableRow key={g.student_id}>
                    <TableCell>
                      <strong>{g.full_name}</strong>
                      <br />
                      <small>{g.email}</small>
                    </TableCell>
                    <TableCell>{g.department}</TableCell>
                    <TableCell>{g.campus}</TableCell>
                    <TableCell>{formatDate(g.graduation_date)}</TableCell>
                    <TableCell>{formatDate(g.repayment_start_date)}</TableCell>
                    <TableCell>{formatETB(g.current_balance)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={actionLoadingId === g.student_id}
                        onClick={() => runAction(g.student_id, 'remind')}
                        sx={{ mr: 1 }}
                      >
                        Remind
                      </Button>
                      <Button
                        size="small"
                        color="success"
                        disabled={actionLoadingId === g.student_id}
                        onClick={() => runAction(g.student_id, 'contacted')}
                      >
                        Contacted
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
