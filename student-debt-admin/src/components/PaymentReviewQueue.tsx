import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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
  new Date(d).toLocaleString('en-ET', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });

function methodIcon(method: string) {
  const m = method?.toUpperCase();
  if (m === 'CHAPA') return <CreditCardIcon fontSize="small" />;
  if (m === 'BANK_TRANSFER') return <AccountBalanceIcon fontSize="small" />;
  return <ReceiptLongIcon fontSize="small" />;
}

function methodColor(method: string): 'success' | 'primary' | 'default' {
  const m = method?.toUpperCase();
  if (m === 'CHAPA') return 'success';
  if (m === 'BANK_TRANSFER') return 'primary';
  return 'default';
}

// ── Proof submit dialog ───────────────────────────────────────────────────────
function ProofDialog({
  paymentId,
  existing,
  onClose,
  onSaved,
}: {
  paymentId: number;
  existing: string | null;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const [url, setUrl] = useState(existing || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!url.trim()) { setError('Please enter a URL'); return; }
    setSaving(true);
    try {
      await api.patch(`/api/payment/${paymentId}/proof`, { proof_url: url.trim() });
      onSaved(url.trim());
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to save proof URL');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Submit Payment Proof</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste a link to the payment proof (bank slip, receipt image, Google Drive, etc.)
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        <TextField
          autoFocus
          fullWidth
          label="Proof URL"
          placeholder="https://drive.google.com/..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Proof'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PaymentReviewQueue() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [acting, setActing] = useState<number | null>(null);
  const [proofDialog, setProofDialog] = useState<Payment | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: true; payments: Payment[] }>('/api/admin/payments/pending');
      setPayments(res.data.payments ?? []);
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Failed to load payments', severity: 'error' });
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
    } finally { setActing(null); }
  };

  const handleReject = async (paymentId: number) => {
    setActing(paymentId);
    try {
      await api.post(`/api/admin/payments/${paymentId}/reject`, { notes: reviewNotes[paymentId] || '' });
      setSnackbar({ open: true, message: 'Payment rejected', severity: 'success' });
      load();
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Rejection failed', severity: 'error' });
    } finally { setActing(null); }
  };

  const handleChapaVerify = async (p: Payment) => {
    if (!p.transaction_ref) {
      setSnackbar({ open: true, message: 'No transaction reference found', severity: 'error' });
      return;
    }
    setActing(p.payment_id);
    try {
      const res = await api.get<{ verified: boolean; status: string; receiptUrl?: string; _debug?: any }>(
        `/api/payment/chapa/verify-admin?txRef=${encodeURIComponent(p.transaction_ref)}&paymentId=${p.payment_id}`
      );
      console.log('Chapa verify full response:', JSON.stringify(res.data, null, 2));
      if (res.data.verified) {
        setSnackbar({ open: true, message: 'Chapa payment verified and approved ✅', severity: 'success' });
        // Update proof_url locally so the receipt link appears immediately
        if (res.data.receiptUrl) {
          setPayments((prev) =>
            prev.map((x) => x.payment_id === p.payment_id ? { ...x, proof_url: res.data.receiptUrl! } : x)
          );
        }
        load();
      } else {
        setSnackbar({ open: true, message: `Chapa status: ${res.data.status} — not yet confirmed`, severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.error || 'Chapa verification failed', severity: 'error' });
    } finally { setActing(null); }
  };

  const isChapa = (p: Payment) => p.payment_method?.toUpperCase() === 'CHAPA';

  // Chapa receipt URL — official format from Chapa docs
  const chapaReceiptUrl = (txRef: string) =>
    `https://chapa.link/payment-receipt/${encodeURIComponent(txRef)}`;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Payment Review Queue</Typography>
          <Typography variant="body2" color="text.secondary">
            Chapa payments are verified automatically. Bank/Receipt payments require manual review.
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
                <TableCell sx={{ fontWeight: 700 }}>Proof</TableCell>
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
                    {/* Student */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{p.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.student_number} · {p.email}
                      </Typography>
                    </TableCell>

                    {/* Amount */}
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>{fmt.format(Number(p.amount))}</Typography>
                    </TableCell>

                    {/* Method chip */}
                    <TableCell>
                      <Chip
                        icon={methodIcon(p.payment_method)}
                        label={p.payment_method || 'MANUAL'}
                        size="small"
                        color={methodColor(p.payment_method)}
                        variant={chapa ? 'filled' : 'outlined'}
                      />
                    </TableCell>

                    {/* Submitted */}
                    <TableCell>
                      <Typography variant="body2">{p.submitted_at ? fmtDate(p.submitted_at) : '—'}</Typography>
                    </TableCell>

                    {/* Proof column */}
                    <TableCell>
                      {chapa ? (
                        // Chapa: show transaction ref + link to Chapa dashboard
                        <Stack spacing={0.5}>
                          {p.transaction_ref && (
                            <Tooltip title={p.transaction_ref}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                {p.transaction_ref.slice(0, 18)}…
                              </Typography>
                            </Tooltip>
                          )}
                          {p.transaction_ref && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<OpenInNewIcon />}
                              href={chapaReceiptUrl(p.transaction_ref)}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ fontSize: 11 }}
                            >
                              View Receipt
                            </Button>
                          )}
                        </Stack>
                      ) : (
                        // Bank / Receipt: show proof link if exists + submit button
                        <Stack spacing={0.5}>
                          {p.proof_url ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<OpenInNewIcon />}
                              href={p.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ fontSize: 11 }}
                            >
                              View Proof
                            </Button>
                          ) : (
                            <Typography variant="caption" color="text.secondary" fontStyle="italic">
                              No proof yet
                            </Typography>
                          )}
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<UploadFileIcon />}
                            onClick={() => setProofDialog(p)}
                            sx={{ fontSize: 11, color: 'text.secondary' }}
                          >
                            {p.proof_url ? 'Update Proof' : 'Submit Proof'}
                          </Button>
                        </Stack>
                      )}
                    </TableCell>

                    {/* Notes */}
                    <TableCell>
                      {chapa ? (
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                          Auto-verified
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

                    {/* Actions */}
                    <TableCell align="right">
                      {chapa ? (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={isActing}
                          startIcon={isActing ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                          onClick={() => handleChapaVerify(p)}
                        >
                          Verify & Approve
                        </Button>
                      ) : (
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

      {/* Proof URL dialog for manual payments */}
      {proofDialog && (
        <ProofDialog
          paymentId={proofDialog.payment_id}
          existing={proofDialog.proof_url}
          onClose={() => setProofDialog(null)}
          onSaved={(url) => {
            setPayments((prev) =>
              prev.map((p) => p.payment_id === proofDialog.payment_id ? { ...p, proof_url: url } : p)
            );
            setSnackbar({ open: true, message: 'Proof URL saved', severity: 'success' });
          }}
        />
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
