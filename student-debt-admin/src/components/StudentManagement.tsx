import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowId, GridRowSelectionModel } from '@mui/x-data-grid';
import { Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';
import { Student } from '../types/student';
import AddStudentModal from './AddStudentModal';
import DeleteStudentModal from './DeleteStudentModal';

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
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Button
          color="error"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={() => handleDeleteClick(params.row.student_id, params.row.full_name)}
        >
          Delete
        </Button>
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
