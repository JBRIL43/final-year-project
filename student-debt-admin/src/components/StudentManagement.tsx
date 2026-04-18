import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowId, GridRowSelectionModel } from '@mui/x-data-grid';
import { Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';
import { Student } from '../types/student';
import AddStudentModal from './AddStudentModal';
import DeleteStudentModal from './DeleteStudentModal';

type ContractRecord = {
  contract_id?: number;
  student_id?: number;
  program: string;
  academic_year: string;
  tuition_share_percent: number;
  boarding_full_cost: boolean;
  signed_at: string;
  is_active?: boolean;
};

type ContractForm = {
  program: string;
  academic_year: string;
  tuition_share_percent: string;
  boarding_full_cost: boolean;
  signed_at: string;
};

type DebtRecord = {
  debt_id: number;
  student_id: number;
  total_debt: number;
  current_balance: number;
  academic_year: string;
  updated_at: string | null;
};

type DebtPayment = {
  payment_id: number | null;
  debt_id: number;
  amount: number;
  status: string;
  payment_date: string | null;
  payment_method: string;
  transaction_ref: string | null;
  notes: string | null;
};

const currentYear = new Date().getFullYear();
const defaultAcademicYear = `${currentYear}/${currentYear + 1}`;

const emptyContractForm: ContractForm = {
  program: '',
  academic_year: defaultAcademicYear,
  tuition_share_percent: '15',
  boarding_full_cost: true,
  signed_at: new Date().toISOString().slice(0, 16),
};

function toInputDateTime(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 16);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 16);
  const tzOffsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  return new Date(parsed.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [bulkAction, setBulkAction] = useState<'status' | 'living' | ''>('');
  const [bulkValue, setBulkValue] = useState('');
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    studentId: number | null;
    studentName: string;
  }>({
    open: false,
    studentId: null,
    studentName: '',
  });
  const [contractModal, setContractModal] = useState<{
    open: boolean;
    contract: ContractRecord | null;
    studentId: number | null;
    studentName: string;
    loading: boolean;
    isNew: boolean;
  }>({
    open: false,
    contract: null,
    studentId: null,
    studentName: '',
    loading: false,
    isNew: false,
  });
  const [contractForm, setContractForm] = useState<ContractForm>(emptyContractForm);
  const [contractSaving, setContractSaving] = useState(false);
  const [debtModal, setDebtModal] = useState<{
    open: boolean;
    studentId: number | null;
    studentName: string;
    loading: boolean;
    debts: DebtRecord[];
    payments: DebtPayment[];
  }>({
    open: false,
    studentId: null,
    studentName: '',
    loading: false,
    debts: [],
    payments: [],
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadStudents = async () => {
    try {
      const res = await api.get<{ students: Student[] }>('/api/admin/students');
      setStudents(res.data.students);
    } catch (err) {
      console.error('Failed to load students', err);
      setSnackbar({
        open: true,
        message: '❌ Failed to load students',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(term) ||
        s.student_number.includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.department.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const handleEdit = async (id: GridRowId, field: keyof Student, value: string | number) => {
    try {
      const student = students.find((s) => s.student_id === id);
      if (!student) return;

      const payload: Partial<Student> = {
        living_arrangement:
          field === 'living_arrangement' ? String(value) : student.living_arrangement,
        enrollment_status:
          field === 'enrollment_status' ? String(value) : student.enrollment_status,
        department: field === 'department' ? String(value) : student.department,
      };

      const res = await api.put<{ student: Student }>(`/api/admin/students/${id}`, payload);

      setStudents((prev) =>
        prev.map((s) => (s.student_id === id ? { ...s, ...res.data.student } : s))
      );
      setSnackbar({
        open: true,
        message: '✅ Student updated successfully',
        severity: 'success',
      });
    } catch (err) {
      console.error('Update failed', err);
      setSnackbar({
        open: true,
        message: '❌ Update failed',
        severity: 'error',
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Student ID',
      'Full Name',
      'Email',
      'Department',
      'Year',
      'Living',
      'Status',
    ].join(',');

    const rows = students
      .map((s) =>
        [
          s.student_number,
          s.full_name,
          s.email,
          s.department,
          s.enrollment_year,
          s.living_arrangement,
          s.enrollment_status,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const csvContent = `data:text/csv;charset=utf-8,${encodeURIComponent(headers + '\n' + rows)}`;
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'students_export.csv');
    link.click();
    setSnackbar({
      open: true,
      message: '📥 Exported to CSV',
      severity: 'success',
    });
  };

  const handleDeleteClick = (studentId: number, studentName: string) => {
    setDeleteModal({ open: true, studentId, studentName });
  };

  const handleViewContract = async (student: Student) => {
    try {
      setContractModal({
        open: true,
        contract: null,
        studentId: student.student_id,
        studentName: student.full_name,
        loading: true,
        isNew: false,
      });
      const res = await api.get<{ contract: ContractRecord }>(
        `/api/admin/students/${student.student_id}/contract`
      );
      const { contract } = res.data;
      setContractForm({
        program: contract.program || student.department,
        academic_year: contract.academic_year || defaultAcademicYear,
        tuition_share_percent: String(contract.tuition_share_percent ?? 15),
        boarding_full_cost: Boolean(contract.boarding_full_cost),
        signed_at: toInputDateTime(contract.signed_at),
      });
      setContractModal((prev) => ({
        ...prev,
        contract,
        loading: false,
        isNew: false,
      }));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setContractForm({
          ...emptyContractForm,
          program: student.department || '',
        });
        setContractModal((prev) => ({
          ...prev,
          loading: false,
          isNew: true,
          contract: null,
        }));
        return;
      }

      console.error('Failed to load contract', err);
      setContractModal({
        open: false,
        contract: null,
        studentId: null,
        studentName: '',
        loading: false,
        isNew: false,
      });
      setSnackbar({
        open: true,
        message: '❌ Failed to load contract',
        severity: 'error',
      });
    }
  };

  const handleCloseContractModal = () => {
    setContractModal({
      open: false,
      contract: null,
      studentId: null,
      studentName: '',
      loading: false,
      isNew: false,
    });
    setContractForm(emptyContractForm);
    setContractSaving(false);
  };

  const handleContractFormChange = (field: keyof ContractForm, value: string | boolean) => {
    setContractForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateContractForm = () => {
    if (!contractForm.program.trim()) return 'Program is required';
    if (!contractForm.academic_year.trim()) return 'Academic year is required';
    if (!contractForm.tuition_share_percent.trim()) return 'Tuition share percent is required';
    if (!contractForm.signed_at.trim()) return 'Signed date/time is required';

    const tuitionShare = Number(contractForm.tuition_share_percent);
    if (Number.isNaN(tuitionShare)) return 'Tuition share percent must be a valid number';
    if (tuitionShare < 0 || tuitionShare > 100) return 'Tuition share percent must be between 0 and 100';

    return null;
  };

  const handleSaveContract = async () => {
    if (!contractModal.studentId) return;

    const validationError = validateContractForm();
    if (validationError) {
      setSnackbar({ open: true, message: `❌ ${validationError}`, severity: 'error' });
      return;
    }

    setContractSaving(true);
    try {
      const payload = {
        program: contractForm.program.trim(),
        academic_year: contractForm.academic_year.trim(),
        tuition_share_percent: Number(contractForm.tuition_share_percent),
        boarding_full_cost: contractForm.boarding_full_cost,
        signed_at: new Date(contractForm.signed_at).toISOString(),
      };

      const method = contractModal.isNew ? 'post' : 'put';
      const res = await api[method]<{ contract: ContractRecord }>(
        `/api/admin/students/${contractModal.studentId}/contract`,
        payload
      );

      const { contract } = res.data;
      setContractModal((prev) => ({ ...prev, contract, isNew: false }));
      setContractForm({
        program: contract.program,
        academic_year: contract.academic_year,
        tuition_share_percent: String(contract.tuition_share_percent),
        boarding_full_cost: Boolean(contract.boarding_full_cost),
        signed_at: toInputDateTime(contract.signed_at),
      });
      setSnackbar({
        open: true,
        message: contractModal.isNew ? '✅ Contract created' : '✅ Contract updated',
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to save contract', err);
      setSnackbar({
        open: true,
        message: '❌ Failed to save contract',
        severity: 'error',
      });
    } finally {
      setContractSaving(false);
    }
  };

  const handleDeleteContract = async () => {
    if (!contractModal.studentId) return;

    const confirmed = window.confirm('Deactivate this active contract?');
    if (!confirmed) return;

    setContractSaving(true);
    try {
      await api.delete(`/api/admin/students/${contractModal.studentId}/contract`);
      setContractModal((prev) => ({ ...prev, contract: null, isNew: true }));
      setContractForm((prev) => ({ ...prev }));
      setSnackbar({
        open: true,
        message: '✅ Contract deactivated',
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to delete contract', err);
      setSnackbar({
        open: true,
        message: '❌ Failed to delete contract',
        severity: 'error',
      });
    } finally {
      setContractSaving(false);
    }
  };

  const handlePrintContract = () => {
    const { contract, studentName } = contractModal;
    if (!contract) return;

    const signedAt = contract.signed_at
      ? new Date(contract.signed_at).toLocaleString('en-ET')
      : 'N/A';

    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      setSnackbar({
        open: true,
        message: '❌ Could not open print window',
        severity: 'error',
      });
      return;
    }

    const content = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Student Contract</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; line-height: 1.5; color: #111; }
            h1 { margin: 0 0 8px; }
            h2 { margin: 0 0 24px; color: #444; font-size: 18px; }
            .row { margin-bottom: 10px; }
            .label { font-weight: 700; }
            .note { margin-top: 24px; color: #444; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>Student Cost-Sharing Contract</h1>
          <h2>${studentName || 'Student'}</h2>
          <div class="row"><span class="label">Program:</span> ${contract.program ?? 'N/A'}</div>
          <div class="row"><span class="label">Academic Year:</span> ${contract.academic_year ?? 'N/A'}</div>
          <div class="row"><span class="label">Tuition Share:</span> ${contract.tuition_share_percent ?? 'N/A'}%</div>
          <div class="row"><span class="label">Boarding Cost:</span> ${contract.boarding_full_cost ? 'Full (100%)' : 'Partial'}</div>
          <div class="row"><span class="label">Signed At:</span> ${signedAt}</div>
          <div class="note">Legally binding agreement per Council of Ministers Regulation No. 91/2003.</div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleViewDebt = async (student: Student) => {
    try {
      setDebtModal({
        open: true,
        studentId: student.student_id,
        studentName: student.full_name,
        loading: true,
        debts: [],
        payments: [],
      });

      const res = await api.get<{ debts: DebtRecord[]; payments: DebtPayment[] }>(
        `/api/admin/students/${student.student_id}/debt-details`
      );

      setDebtModal((prev) => ({
        ...prev,
        loading: false,
        debts: res.data.debts || [],
        payments: res.data.payments || [],
      }));
    } catch (err) {
      console.error('Failed to load debt details', err);
      setDebtModal({
        open: false,
        studentId: null,
        studentName: '',
        loading: false,
        debts: [],
        payments: [],
      });
      setSnackbar({
        open: true,
        message: '❌ Failed to load debt details',
        severity: 'error',
      });
    }
  };

  const handleCloseDebtModal = () => {
    setDebtModal({
      open: false,
      studentId: null,
      studentName: '',
      loading: false,
      debts: [],
      payments: [],
    });
  };

  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  const normalizeSelectionModel = (selection: unknown): GridRowSelectionModel => {
    if (Array.isArray(selection)) {
      return { type: 'include', ids: new Set(selection) };
    }

    if (
      selection &&
      typeof selection === 'object' &&
      'type' in selection &&
      'ids' in selection
    ) {
      const model = selection as { type?: unknown; ids?: unknown };
      if (
        (model.type === 'include' || model.type === 'exclude') &&
        model.ids instanceof Set
      ) {
        return { type: model.type, ids: model.ids };
      }

      if (Array.isArray(model.ids)) {
        return {
          type: model.type === 'exclude' ? 'exclude' : 'include',
          ids: new Set(model.ids),
        };
      }
    }

    return { type: 'include', ids: new Set() };
  };

  const handleBulkUpdate = async () => {
    if (!bulkAction || !bulkValue || selectedStudents.length === 0) return;

    const updates: Partial<Student> = {};
    if (bulkAction === 'status') updates.enrollment_status = bulkValue;
    if (bulkAction === 'living') updates.living_arrangement = bulkValue;

    try {
      await api.post('/api/admin/students/batch-update', {
        studentIds: selectedStudents,
        updates,
      });
      setSnackbar({
        open: true,
        message: `✅ Updated ${selectedStudents.length} student(s)`,
        severity: 'success',
      });
      loadStudents();
      setSelectedStudents([]);
      setRowSelectionModel({ type: 'include', ids: new Set() });
      setBulkAction('');
      setBulkValue('');
    } catch (err: any) {
      console.error('Bulk update error:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Bulk update failed',
        severity: 'error',
      });
    }
  };

  const columns: GridColDef[] = [
    { field: 'student_number', headerName: 'ID', width: 120 },
    { field: 'full_name', headerName: 'Full Name', width: 200 },
    { field: 'email', headerName: 'Email', width: 250 },
    { field: 'department', headerName: 'Dept', width: 140 },
    { field: 'enrollment_year', headerName: 'Year', width: 80 },
    {
      field: 'living_arrangement',
      headerName: 'Living',
      width: 120,
      renderCell: (params) => (
        <TextField
          size="small"
          select
          value={params.value || ''}
          onChange={(e) => handleEdit(params.row.student_id, 'living_arrangement', e.target.value)}
          sx={{ width: '100%' }}
        >
          <MenuItem value="On-Campus">On-Campus</MenuItem>
          <MenuItem value="Off-Campus">Off-Campus</MenuItem>
          <MenuItem value="With Family">With Family</MenuItem>
        </TextField>
      ),
    },
    {
      field: 'enrollment_status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <TextField
          size="small"
          select
          value={params.value || ''}
          onChange={(e) => handleEdit(params.row.student_id, 'enrollment_status', e.target.value)}
          sx={{ width: '100%' }}
        >
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Graduated">Graduated</MenuItem>
          <MenuItem value="Suspended">Suspended</MenuItem>
          <MenuItem value="Withdrawn">Withdrawn</MenuItem>
        </TextField>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 300,
      sortable: false,
      renderCell: (params) => (
        <>
          <Button
            size="small"
            startIcon={<DescriptionIcon />}
            onClick={() => handleViewContract(params.row as Student)}
            sx={{ mr: 1 }}
          >
            View Contract
          </Button>
          <Button
            size="small"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => handleViewDebt(params.row as Student)}
            sx={{ mr: 1 }}
          >
            View Debt
          </Button>
          <Button
            color="error"
            size="small"
            startIcon={<DeleteIcon />}
            onClick={() => handleDeleteClick(params.row.student_id, params.row.full_name)}
          >
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Student Management
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAddStudentOpen(true)}>
          Add Student
        </Button>

        {selectedStudents.length > 0 && (
          <>
            <TextField
              select
              size="small"
              label="Bulk Action"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as 'status' | 'living' | '')}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="status">Update Status</MenuItem>
              <MenuItem value="living">Update Living</MenuItem>
            </TextField>

            {bulkAction === 'status' && (
              <TextField
                select
                size="small"
                label="Status"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Graduated">Graduated</MenuItem>
                <MenuItem value="Suspended">Suspended</MenuItem>
                <MenuItem value="Withdrawn">Withdrawn</MenuItem>
              </TextField>
            )}

            {bulkAction === 'living' && (
              <TextField
                select
                size="small"
                label="Living"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="On-Campus">On-Campus</MenuItem>
                <MenuItem value="Off-Campus">Off-Campus</MenuItem>
                <MenuItem value="With Family">With Family</MenuItem>
              </TextField>
            )}

            <Button
              variant="contained"
              color="primary"
              disabled={!bulkAction || !bulkValue}
              onClick={handleBulkUpdate}
            >
              Apply to {selectedStudents.length} Students
            </Button>
          </>
        )}

        <TextField
          size="small"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 250, ml: 'auto' }}
        />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportToCSV}>
          Export CSV
        </Button>
      </Box>

      <Paper sx={{ height: 'calc(100vh - 260px)', width: '100%' }}>
        <DataGrid
          rows={filteredStudents}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.student_id}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
          checkboxSelection
          onRowSelectionModelChange={(newSelection) => {
            const normalizedSelection = normalizeSelectionModel(newSelection);
            setRowSelectionModel(normalizedSelection);
            setSelectedStudents(Array.from(normalizedSelection.ids).map((id) => Number(id)));
          }}
          rowSelectionModel={rowSelectionModel}
        />
      </Paper>

      {/* Delete Student Modal */}
      <DeleteStudentModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, studentId: null, studentName: '' })}
        studentId={deleteModal.studentId}
        studentName={deleteModal.studentName}
        onStudentDeleted={loadStudents}
      />

      <Dialog
        open={contractModal.open}
        onClose={handleCloseContractModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Student Contract{contractModal.studentName ? ` - ${contractModal.studentName}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {contractModal.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ minWidth: 300 }}>
              <TextField
                label="Program"
                value={contractForm.program}
                onChange={(e) => handleContractFormChange('program', e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Academic Year"
                value={contractForm.academic_year}
                onChange={(e) => handleContractFormChange('academic_year', e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Tuition Share (%)"
                type="number"
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                value={contractForm.tuition_share_percent}
                onChange={(e) => handleContractFormChange('tuition_share_percent', e.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Signed At"
                type="datetime-local"
                value={contractForm.signed_at}
                onChange={(e) => handleContractFormChange('signed_at', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={(
                  <Switch
                    checked={contractForm.boarding_full_cost}
                    onChange={(e) => handleContractFormChange('boarding_full_cost', e.target.checked)}
                  />
                )}
                label="Boarding Cost Obligation: Full (100%)"
              />
              {contractModal.contract && (
                <Typography sx={{ mt: 1 }}>
                  <strong>Signed At (ET):</strong>{' '}
                  {new Date(contractModal.contract.signed_at).toLocaleString('en-ET')}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Legally binding agreement per Council of Ministers Regulation No. 91/2003.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handlePrintContract}
            disabled={!contractModal.contract}
          >
            Print / Download
          </Button>
          <Button
            onClick={handleDeleteContract}
            color="error"
            disabled={!contractModal.contract || contractSaving || contractModal.loading}
          >
            Deactivate
          </Button>
          <Button
            onClick={handleSaveContract}
            variant="contained"
            disabled={contractSaving || contractModal.loading}
          >
            {contractModal.isNew ? 'Create Contract' : 'Update Contract'}
          </Button>
          <Button onClick={handleCloseContractModal}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={debtModal.open}
        onClose={handleCloseDebtModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Debt Details{debtModal.studentName ? ` - ${debtModal.studentName}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {debtModal.loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {debtModal.debts.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  No debt records found for this student.
                </Alert>
              ) : (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Debt Records
                  </Typography>
                  {debtModal.debts.map((debt) => (
                    <Paper
                      key={debt.debt_id}
                      variant="outlined"
                      sx={{ p: 2, mb: 1.5 }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Academic Year: {debt.academic_year || 'N/A'}
                      </Typography>
                      <Typography>
                        <strong>Total Debt:</strong> {formatETB(debt.total_debt)}
                      </Typography>
                      <Typography>
                        <strong>Current Balance:</strong> {formatETB(debt.current_balance)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Updated:{' '}
                        {debt.updated_at ? new Date(debt.updated_at).toLocaleString('en-ET') : 'N/A'}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}

              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Payment History
                </Typography>
                {debtModal.payments.length === 0 ? (
                  <Alert severity="info">No payment history found for this student.</Alert>
                ) : (
                  debtModal.payments.map((payment, index) => (
                    <Paper
                      key={`${payment.debt_id}-${payment.payment_id ?? `idx-${index}`}`}
                      variant="outlined"
                      sx={{ p: 2, mb: 1.5 }}
                    >
                      <Typography>
                        <strong>Amount:</strong> {formatETB(payment.amount)}
                      </Typography>
                      <Typography>
                        <strong>Status:</strong> {payment.status || 'N/A'}
                      </Typography>
                      <Typography>
                        <strong>Method:</strong> {payment.payment_method || 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Date:{' '}
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleString('en-ET')
                          : 'N/A'}
                      </Typography>
                      {payment.transaction_ref && (
                        <Typography variant="body2" color="text.secondary">
                          Ref: {payment.transaction_ref}
                        </Typography>
                      )}
                      {payment.notes && (
                        <Typography variant="body2" color="text.secondary">
                          Notes: {payment.notes}
                        </Typography>
                      )}
                    </Paper>
                  ))
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDebtModal}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <AddStudentModal
        open={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        onStudentAdded={loadStudents}
      />
    </Box>
  );
}
