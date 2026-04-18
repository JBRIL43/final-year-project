import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import api from '../services/api';

interface DebtRecord {
  debt_id: number;
  academic_year: string;
  total_debt: number;
  current_balance: number;
  created_at: string | null;
  updated_at: string | null;
}

interface PaymentRecord {
  payment_id: number | null;
  amount: number;
  status: string;
  proof_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export default function StudentDebtDetail({ studentId }: { studentId: number }) {
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDebt = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get<{
          debtRecords?: DebtRecord[];
          paymentHistory?: PaymentRecord[];
          debts?: DebtRecord[];
          payments?: PaymentRecord[];
        }>(`/api/admin/students/${studentId}/debt`);

        setDebtRecords(res.data.debtRecords || res.data.debts || []);
        setPaymentHistory(res.data.paymentHistory || res.data.payments || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load debt details');
      } finally {
        setLoading(false);
      }
    };

    loadDebt();
  }, [studentId]);

  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const renderStatus = (status: string) => {
    const normalized = String(status || '').toLowerCase();
    const color = normalized === 'approved' || normalized === 'success'
      ? 'green'
      : normalized === 'rejected' || normalized === 'failed'
      ? 'red'
      : 'orange';

    const label = status
      ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
      : 'Unknown';

    return <span style={{ color }}>{label}</span>;
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Debt Records</Typography>
      {debtRecords.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>No debt records found.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Academic Year</TableCell>
                <TableCell>Total Debt</TableCell>
                <TableCell>Current Balance</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {debtRecords.map((record) => (
                <TableRow key={record.debt_id}>
                  <TableCell>{record.academic_year || 'N/A'}</TableCell>
                  <TableCell>{formatETB(record.total_debt)}</TableCell>
                  <TableCell>{formatETB(record.current_balance)}</TableCell>
                  <TableCell>
                    {record.updated_at
                      ? new Date(record.updated_at).toLocaleDateString('en-ET')
                      : record.created_at
                      ? new Date(record.created_at).toLocaleDateString('en-ET')
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="h6" gutterBottom>Payment History</Typography>
      {paymentHistory.length === 0 ? (
        <Alert severity="info">No payments recorded.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paymentHistory.map((payment, index) => (
                <TableRow key={payment.payment_id ?? index}>
                  <TableCell>
                    {payment.submitted_at
                      ? new Date(payment.submitted_at).toLocaleDateString('en-ET')
                      : 'N/A'}
                  </TableCell>
                  <TableCell>{formatETB(payment.amount)}</TableCell>
                  <TableCell>{renderStatus(payment.status)}</TableCell>
                  <TableCell>{payment.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
