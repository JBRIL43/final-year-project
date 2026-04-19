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
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';

interface Graduate {
  student_id: number;
  full_name: string;
  email: string;
  department: string;
  campus: string;
  graduation_date: string | null;
  repayment_start_date: string | null;
  clearance_status: string;
}

export default function GraduateManagement() {
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadGraduates = async () => {
    try {
      const res = await api.get<{ success: true; graduates: Graduate[] }>('/api/admin/graduates');
      setGraduates(res.data.graduates);
    } catch (err) {
      console.error('Failed to load graduates', err);
      setSnackbar({ open: true, message: 'Failed to load graduates', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraduates();
  }, []);

  const handleUpdateGraduate = async (studentId: number, field: string, value: string) => {
    try {
      await api.put(`/api/admin/graduates/${studentId}`, { [field]: value });
      setSnackbar({ open: true, message: 'Updated successfully', severity: 'success' });
      loadGraduates();
    } catch (err: any) {
      console.error('Update error:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Update failed',
        severity: 'error',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Graduate Repayment Management
      </Typography>

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Program</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Graduation Date</TableCell>
                  <TableCell>Repayment Start</TableCell>
                  <TableCell>Clearance Status</TableCell>
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
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={formatDate(g.graduation_date)}
                        onChange={(e) =>
                          handleUpdateGraduate(g.student_id, 'graduation_date', e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="date"
                        size="small"
                        value={formatDate(g.repayment_start_date)}
                        onChange={(e) =>
                          handleUpdateGraduate(g.student_id, 'repayment_start_date', e.target.value)
                        }
                        InputLabelProps={{ shrink: true }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={g.clearance_status}
                        onChange={(e) =>
                          handleUpdateGraduate(g.student_id, 'clearance_status', e.target.value)
                        }
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="cleared">Cleared</MenuItem>
                        <MenuItem value="waived">Waived</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell>
                      {g.graduation_date && !g.repayment_start_date && (
                        <Button
                          size="small"
                          onClick={() => {
                            const gradDate = new Date(g.graduation_date as string);
                            const repaymentStart = new Date(gradDate);
                            repaymentStart.setMonth(repaymentStart.getMonth() + 6);
                            handleUpdateGraduate(
                              g.student_id,
                              'repayment_start_date',
                              repaymentStart.toISOString().split('T')[0]
                            );
                          }}
                        >
                          Set +6 Months
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

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
