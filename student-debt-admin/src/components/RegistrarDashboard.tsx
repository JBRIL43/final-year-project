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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  FileDownload as FileDownloadIcon,
  FileUpload as FileUploadIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { generateClearanceCertificate, pdfMake } from '../utils/clearanceCertificate';
import { exportToExcel, formatStudentDataForExport } from '../utils/excelExport';
import { importFromExcel, validateStudentImportData, type ImportedRow } from '../utils/excelImport';

interface StudentForClearance {
  student_id: number;
  student_number: string;
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
  phone?: string | null;
  current_balance?: number | null;
  graduation_date?: string | null;
  repayment_start_date?: string | null;
}

export default function RegistrarDashboard() {
  const [students, setStudents] = useState<StudentForClearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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

  const handleUpdateEnrollmentStatus = async (studentId: number, status: string) => {
    try {
      await api.put(`/api/registrar/students/${studentId}/status`, { enrollment_status: status });
      setSnackbar({ open: true, message: 'Enrollment status updated', severity: 'success' });
      loadStudents();
    } catch (err: any) {
      console.error('Enrollment status update error:', err);
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

  const handleGenerateCertificate = async (studentId: number) => {
    try {
      const res = await api.get<{ success: true; student: StudentForClearance & Record<string, unknown> }>(
        `/api/registrar/students/${studentId}/details`
      );
      const studentData = res.data.student;
      const docDefinition = generateClearanceCertificate(studentData);
      pdfMake.createPdf(docDefinition).download(`HU_Clearance_${studentData.student_number}.pdf`);
    } catch (err) {
      console.error('Certificate generation error:', err);
      setSnackbar({
        open: true,
        message: 'Failed to generate certificate',
        severity: 'error',
      });
    }
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

  const handleImportStudents = async (data: ImportedRow[]) => {
    const errors = validateStudentImportData(data);
    if (errors.length > 0) {
      setSnackbar({
        open: true,
        message: `Import validation failed (${errors.length} issues).`,
        severity: 'error',
      });
      alert(`Validation errors:\n${errors.join('\n')}`);
      return;
    }

    try {
      const response = await api.post<{ message?: string; errors?: string[] }>('/api/registrar/students/import', {
        students: data,
      });

      const importErrors = response.data?.errors || [];
      if (importErrors.length > 0) {
        alert(`Imported with some issues:\n${importErrors.join('\n')}`);
      }

      setSnackbar({
        open: true,
        message: response.data?.message || 'Students imported successfully',
        severity: 'success',
      });
      await loadStudents();
      setImportDialogOpen(false);
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Import failed',
        severity: 'error',
      });
    }
  };

  const downloadImportTemplate = () => {
    const template = [
      {
        'Student ID': 'HU123456',
        'Full Name': 'Example Student',
        Email: 'student@example.com',
        Phone: '+251912345678',
        Program: 'Computer Science',
        Campus: 'Main Campus',
        'Enrollment Status': 'ACTIVE',
        'Clearance Status': 'PENDING',
        'Credits Registered': '15',
        'Tuition Share %': '15.00',
        'Payment Model': 'post_graduation',
        'Pre-Payment Amount (ETB)': '',
        'Pre-Payment Date': '',
      },
    ];

    exportToExcel(template, 'HU_Student_Import_Template');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Registrar: Student Clearance Management
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<FileUploadIcon />}
          onClick={() => setImportDialogOpen(true)}
        >
          Import from Excel
        </Button>
        <Button
          variant="outlined"
          startIcon={<DescriptionIcon />}
          onClick={downloadImportTemplate}
        >
          Download Template
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={() => {
            const formattedData = formatStudentDataForExport(students as unknown as Array<Record<string, unknown>>);
            exportToExcel(formattedData, 'HU_Registrar_Students');
          }}
        >
          Export to Excel
        </Button>
      </Box>

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
                <TableCell>Enrollment Status</TableCell>
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
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={String(s.enrollment_status || '').toUpperCase()}
                        label="Status"
                        onChange={(e) => handleUpdateEnrollmentStatus(s.student_id, e.target.value)}
                      >
                        <MenuItem value="ACTIVE">Active</MenuItem>
                        <MenuItem value="WITHDRAWN">Withdrawn</MenuItem>
                        <MenuItem value="GRADUATED">Graduated</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
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
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!['CLEARED', 'WAIVED'].includes(String(s.clearance_status || '').toUpperCase())}
                        onClick={() => handleGenerateCertificate(s.student_id)}
                      >
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

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Students from Excel</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Required columns: Student ID, Full Name, Email, Program, Campus.
          </Alert>

          <TextField
            type="file"
            inputProps={{ accept: '.xlsx,.xls' }}
            fullWidth
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              importFromExcel(file, async (data) => {
                await handleImportStudents(data);
              });
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
