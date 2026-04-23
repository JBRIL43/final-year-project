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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  TextField,
} from '@mui/material';
import api from '../services/api';

interface StudentForClearance {
  student_id: number;
  full_name: string;
  email: string;
  department: string;
  campus: string;
  enrollment_status: string;
  clearance_status: string;
  credits_registered: number | null;
  tuition_share_percent: number | null;
  withdrawal_requested_at: string | null;
  department_withdrawal_approved: boolean | null;
  registrar_withdrawal_processed: boolean;
}

export default function RegistrarDashboard() {
  const [students, setStudents] = useState<StudentForClearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: true; students: StudentForClearance[] }>('/api/registrar/students');
      setStudents(res.data.students);
    } catch (err) {
      console.error('Failed to load students', err);
      setSnackbar({ open: true, message: 'Failed to load students', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();

    const interval = setInterval(() => {
      loadStudents();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdateClearance = async (studentId: number, status: string) => {
    try {
      await api.put(`/api/registrar/students/${studentId}/clearance`, { clearance_status: status });
      setSnackbar({ open: true, message: 'Clearance updated', severity: 'success' });
      loadStudents();
    } catch (err: any) {
      console.error('Clearance update error:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Update failed',
        severity: 'error',
      });
    }
  };

  const handleUpdateCredits = async (studentId: number, creditsStr: string) => {
    const credits = creditsStr === '' ? null : Number.parseInt(creditsStr, 10);

    if (credits !== null && (!Number.isFinite(credits) || credits < 0)) {
      setSnackbar({
        open: true,
        message: 'Invalid credits value',
        severity: 'error',
      });
      return;
    }

    try {
      await api.put(`/api/registrar/students/${studentId}/credits`, { credits_registered: credits });
      setSnackbar({ open: true, message: 'Credits updated', severity: 'success' });
      loadStudents();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Update failed',
        severity: 'error',
      });
    }
  };

  const generateCertificate = (studentId: number) => {
    alert(`Generate clearance certificate for student ${studentId}`);
  };

  const processWithdrawal = async (studentId: number) => {
    try {
      await api.post(`/api/registrar/students/${studentId}/withdrawal/process`);
      setSnackbar({ open: true, message: 'Withdrawal processed', severity: 'success' });
      loadStudents();
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Processing failed',
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Registrar: Student Clearance Management
      </Typography>

      {loading ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Loading students...
        </Alert>
      ) : null}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student</TableCell>
                <TableCell>Program</TableCell>
                <TableCell>Campus</TableCell>
                <TableCell>Credits</TableCell>
                <TableCell>Tuition Share</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Clearance</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.student_id}>
                  <TableCell>
                    <strong>{s.full_name}</strong>
                    <br />
                    <small>{s.email}</small>
                  </TableCell>
                  <TableCell>{s.department}</TableCell>
                  <TableCell>{s.campus}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={s.credits_registered ?? ''}
                      onChange={(e) => handleUpdateCredits(s.student_id, e.target.value)}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    {s.tuition_share_percent != null ? `${s.tuition_share_percent}%` : '15%'}
                  </TableCell>
                  <TableCell>{s.enrollment_status}</TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Clearance</InputLabel>
                      <Select
                        value={String(s.clearance_status || '').toLowerCase()}
                        label="Clearance"
                        onChange={(e) => handleUpdateClearance(s.student_id, e.target.value)}
                      >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="cleared">Cleared</MenuItem>
                        <MenuItem value="waived">Waived</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    {String(s.enrollment_status || '').toUpperCase() === 'ACTIVE' &&
                    Boolean(s.withdrawal_requested_at) &&
                    s.department_withdrawal_approved === true &&
                    !s.registrar_withdrawal_processed ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => processWithdrawal(s.student_id)}
                      >
                        Process Withdrawal
                      </Button>
                    ) : (
                      <Button size="small" variant="outlined" onClick={() => generateCertificate(s.student_id)}>
                        Certificate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
