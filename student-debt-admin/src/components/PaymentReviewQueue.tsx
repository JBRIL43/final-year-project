import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import api from '../services/api';

interface Payment {
  payment_id: number;
  student_id: number;
  full_name: string;
  student_number: string;
  email: string;
  amount: number;
  proof_url: string | null;
  transaction_ref: string | null;
  payment_method: string;
  submitted_at: string;
  status: string;
  notes: string | null;
}

const fmt = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2 });
const fmtDate = (d: string) =>
  new Date(d).toLocaleString('en-ET', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function PaymentReviewQueue() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [acting, setActing] = useState<number | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: true; payments: Payment[] }>('/api/admin/payments/pending');
      setPayments(res.data.payments ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to load pending payments';
      setSnackbar({ open: true, message: msg, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (paymentId: number) => {
    setActing(paymentId);
    try {
      await api.post(`/api/admin/payments/${paymentId}/approve`, { notes: reviewNotes[paymentId] || '' });
      setSnackbar({ open: true, message: 'Payment approved and debt updated', severity: 'success' });
      load();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Approval failed', severity: 'error' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (paymentId: number) => {
    setActing(paymentId);
    try {
      await api.post(`/api/admin/payments/${paymentId}/reject`, { notes: reviewNotes[paymentId] || '' });
      setSnackbar({ open: true, message: 'Payment rejected', severity: 'success' });
      load();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Rejection failed', severity: 'error' });
    } finally {
      setActing(null);
    }
  };

  // For Chapa: verify directly with Chapa and auto-approve
  const handleChapaVerify = async (payment: Payment) => {
    if (!payment.transaction_ref) {
      setSnackbar({ open: true, message: 'No transaction reference found', severity: 'error' });
      return;
    }
    setActing(payment.payment_id);
    try {
      const res = await api.get<{ success: boolean; status: string; verified: boolean }>(
        `/api/payment/chapa/verify-admin?txRef=${encodeURIComponent(payment.transaction_ref)}&paymentId=${payment.payment_id}`
      );
      if (res.data.verified) {
        setSnackbar({ open: true, message: 'Chapa payment verified and approved automatically', severity: 'success' });
        load();
      } else {
        setSnackbar({ open: true, message: `Chapa status: ${res.data.status} — not yet confirmed`, severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Chapa verification failed', severity: 'error' });
    } finally {
      setActing(null);
    }
  };

  const isChapa = (p: Payment) => String(p.payment_method || '').toUpperCase() === 'CHAPA';

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Payment Review Queue</Typography>
          <Typography variant="body2" color="text.secondary">
            Chapa payments are auto-verified. Manual payments require approve/reject.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={load}>Refresh</Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
      ) : payments.length === 0 ? (
        <Alert severity="info">No pending payments. All submissions have been reviewed.</Alert>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f7f9fc' }}>
                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Submitted</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reference / Proof</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => {
                const chapa = isChapa(p);
                const isActing = acting === p.payment_id;

                return (
                  <TableRow key={p.payment_id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{p.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.student_number} · {p.email}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{fmt.format(Number(p.amount))}</Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        icon={chapa ? <CreditCardIcon /> : <ReceiptLongIcon />}
                        label={p.payment_method || 'MANUAL'}
                        size="small"
                        color={chapa ? 'success' : 'default'}
                        variant={chapa ? 'filled' : 'outlined'}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">{p.submitted_at ? fmtDate(p.submitted_at) : '—'}</Typography>
                    </TableCell>

                    <TableCell>
                      {chapa && p.transaction_ref ? (
                        <Tooltip title={p.transaction_ref}>
                          <Typography
                            variant="caption"
                            sx={{ fontFamily: 'monospace', color: 'text.secondary', cursor: 'default' }}
                          >
                            {p.transaction_ref.slice(0, 20)}…
                          </Typography>
                        </Tooltip>
                      ) : p.proof_url ? (
                        <Button
                          size="small"
                          variant="outlined"
                          href={p.proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Proof
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">No proof</Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      {chapa ? (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                          Auto-verified by Chapa
                        </Typography>
                      ) : (
                        <TextField
                          size="small"
                          placeholder="Review note"
                          value={reviewNotes[p.payment_id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [p.payment_id]: e.target.value }))
                          }
                          sx={{ width: 150 }}
                        />
                      )}
                    </TableCell>

                    <TableCell align="right">
                      {chapa ? (
                        // Chapa: just a verify button — auto-approves if Chapa confirms
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={isActing}
                          startIcon={isActing ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                          onClick={() => handleChapaVerify(p)}
                        >
                          Verify with Chapa
                        </Button>
                      ) : (
                        // Manual: approve / reject
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={isActing}
                            startIcon={isActing ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                            onClick={() => handleApprove(p.payment_id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={isActing}
                            startIcon={<CancelIcon />}
                            onClick={() => handleReject(p.payment_id)}
                          >
                            Reject
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
