import { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Alert,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  CircularProgress,
  Stack,
  Chip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import api from '../services/api';
import { generateCostSharingStatement, pdfMake } from '../utils/costSharingStatement';

// Ethiopian calendar academic years (2011-2018 EC)
const EC_YEARS = ['2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018'];

interface HistoricalPayment {
  academic_year: string;
  amount_in_birr: number;
  receipt_no?: string | null;
}

interface CostSharingDialogProps {
  open: boolean;
  studentId: number;
  studentName: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function CostSharingDialog({ open, studentId, studentName, onClose, onSaved }: CostSharingDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [studentData, setStudentData] = useState<Record<string, any> | null>(null);

  // Profile fields
  const [preparatorySchool, setPreparatorySchool] = useState('');
  const [tin, setTin] = useState('');

  // Historical payments — keyed by year
  const [payments, setPayments] = useState<Record<string, { amount: string; receipt: string }>>(() => {
    const init: Record<string, { amount: string; receipt: string }> = {};
    EC_YEARS.forEach(y => { init[y] = { amount: '', receipt: '' }; });
    return init;
  });

  useEffect(() => {
    if (open && studentId > 0) {
      loadData();
    }
  }, [open, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Load student details (includes historical_payments)
      const res = await api.get<{ success: boolean; student: Record<string, any> }>(
        `/api/registrar/students/${studentId}/details`
      );
      const student = res.data.student;
      setStudentData(student);
      setPreparatorySchool(student.preparatory_school || '');
      setTin(student.tin || '');

      // Populate historical payment grid
      const newPayments: Record<string, { amount: string; receipt: string }> = {};
      EC_YEARS.forEach(y => { newPayments[y] = { amount: '', receipt: '' }; });

      const hps = (student.historical_payments || []) as HistoricalPayment[];
      hps.forEach(hp => {
        const year = String(hp.academic_year).trim();
        if (newPayments[year] !== undefined) {
          newPayments[year] = {
            amount: hp.amount_in_birr > 0 ? String(hp.amount_in_birr) : '',
            receipt: hp.receipt_no || '',
          };
        }
      });
      setPayments(newPayments);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentChange = (year: string, field: 'amount' | 'receipt', value: string) => {
    setPayments(prev => ({
      ...prev,
      [year]: { ...prev[year], [field]: value },
    }));
  };

  const totalPaid = EC_YEARS.reduce((sum, y) => {
    const val = Number(payments[y]?.amount || 0);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Save profile fields
      await api.put(`/api/registrar/students/${studentId}/profile`, {
        preparatory_school: preparatorySchool,
        tin,
      });

      // Save historical payments
      const paymentData = EC_YEARS
        .filter(y => payments[y].amount.trim() !== '')
        .map(y => ({
          academic_year: y,
          amount_in_birr: Number(payments[y].amount) || 0,
          receipt_no: payments[y].receipt || null,
        }));

      if (paymentData.length > 0) {
        await api.put(`/api/registrar/students/${studentId}/historical-payments`, {
          payments: paymentData,
        });
      }

      setSuccess('Data saved successfully');
      onSaved?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save data');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      // Re-fetch latest data
      const res = await api.get<{ success: boolean; student: Record<string, any> }>(
        `/api/registrar/students/${studentId}/details`
      );
      const student = res.data.student;

      const docDefinition = generateCostSharingStatement({
        full_name: student.full_name,
        student_number: student.student_number,
        tin: student.tin,
        department: student.department,
        enrollment_year: student.enrollment_year,
        preparatory_school: student.preparatory_school,
        campus: student.campus,
        tuition_share_percent: student.tuition_share_percent,
        estimated_cost: student.debt_summary?.current_balance || 0,
        phone: student.phone,
        email: student.email,
        historical_payments: student.historical_payments || [],
        total_paid: totalPaid,
        advanced_payment: Number(student.pre_payment_amount || 0),
        receipt_no: student.historical_payments?.[0]?.receipt_no || '',
      });

      pdfMake.createPdf(docDefinition).download(
        `HU_CostSharing_${student.student_number || studentId}.pdf`
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate PDF');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Cost-Sharing Statement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {studentName}
          </Typography>
        </Box>
        <Chip
          label={`Total: ${totalPaid.toLocaleString('en-ET', { minimumFractionDigits: 2 })} ETB`}
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {/* Profile Fields */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Student Profile Fields
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Preparatory School (Field 7)"
                  fullWidth
                  size="small"
                  value={preparatorySchool}
                  onChange={(e) => setPreparatorySchool(e.target.value)}
                  placeholder="School where preparatory program was completed"
                />
                <TextField
                  label="TIN Number (Field 3)"
                  fullWidth
                  size="small"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="Tax Identification Number"
                />
              </Stack>
            </Box>

            <Divider />

            {/* Historical Payments Table */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Historical Payments by Academic Year (EC)
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                      <TableCell sx={{ fontWeight: 700, width: 100 }}>Year (EC)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Amount in Birr</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Receipt No.</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {EC_YEARS.map((year) => (
                      <TableRow key={year} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{year}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            fullWidth
                            value={payments[year]?.amount || ''}
                            onChange={(e) => handlePaymentChange(year, 'amount', e.target.value)}
                            inputProps={{ min: 0, step: '0.01' }}
                            placeholder="0.00"
                            sx={{ '& .MuiInputBase-input': { py: 0.75 } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={payments[year]?.receipt || ''}
                            onChange={(e) => handlePaymentChange(year, 'receipt', e.target.value)}
                            placeholder="Receipt #"
                            sx={{ '& .MuiInputBase-input': { py: 0.75 } }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total row */}
                    <TableRow sx={{ bgcolor: '#e8f5e9' }}>
                      <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'success.main' }}>
                        {totalPaid.toLocaleString('en-ET', { minimumFractionDigits: 2 })} ETB
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button
          variant="outlined"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? 'Saving...' : 'Save Data'}
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleGeneratePDF}
          disabled={loading}
          color="primary"
        >
          Download PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}
