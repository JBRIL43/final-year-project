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
  TextField,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

interface Payment {
  payment_id: number;
  student_id: number;
  full_name: string;
  student_number: string;
  email: string;
  amount: number;
  proof_url: string;
  submitted_at: string;
  status: string;
  notes: string;
}

export default function PaymentReviewQueue() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  const loadPayments = async () => {
    try {
      const res = await api.get<{ success: true; payments: Payment[] }>('/api/admin/payments/pending');
      setPayments(res.data.payments);
    } catch (err) {
      console.error('Failed to load pending payments', err);
      setSnackbar({
        open: true,
        message: '❌ Failed to load pending payments',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleApprove = async (paymentId: number) => {
    try {
      await api.post(`/api/admin/payments/${paymentId}/approve`, {
        notes: reviewNotes[paymentId] || '',
      });
      setSnackbar({
        open: true,
        message: '✅ Payment approved and debt updated',
        severity: 'success',
      });
      loadPayments(); // Refresh list
    } catch (err: any) {
      console.error('Approve failed', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Approval failed',
        severity: 'error',
      });
    }
  };

  const handleReject = async (paymentId: number) => {
    try {
      await api.post(`/api/admin/payments/${paymentId}/reject`, {
        notes: reviewNotes[paymentId] || '',
      });
      setSnackbar({
        open: true,
        message: '✅ Payment rejected',
        severity: 'success',
      });
      loadPayments(); // Refresh list
    } catch (err: any) {
      console.error('Reject failed', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Rejection failed',
        severity: 'error',
      });
    }
  };

  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-ET', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Payment Review Queue
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : payments.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No pending payments. All submissions have been reviewed.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Proof</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.payment_id}>
                  <TableCell>
                    <strong>{payment.full_name}</strong><br />
                    <small>{payment.student_number} • {payment.email}</small>
                  </TableCell>
                  <TableCell>{formatETB(payment.amount)}</TableCell>
                  <TableCell>{formatDate(payment.submitted_at)}</TableCell>
                  <TableCell>
                    {payment.proof_url ? (
                      <Button
                        size="small"
                        variant="outlined"
                        href={payment.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Proof
                      </Button>
                    ) : (
                      <em>No proof</em>
                    )}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="Optional review note"
                      value={reviewNotes[payment.payment_id] || ''}
                      onChange={(e) =>
                        setReviewNotes((prev) => ({
                          ...prev,
                          [payment.payment_id]: e.target.value,
                        }))
                      }
                      sx={{ width: '160px' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      color="success"
                      size="small"
                      variant="contained"
                      onClick={() => handleApprove(payment.payment_id)}
                      sx={{ mr: 1 }}
                    >
                      Approve
                    </Button>
                    <Button
                      color="error"
                      size="small"
                      variant="outlined"
                      onClick={() => handleReject(payment.payment_id)}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
