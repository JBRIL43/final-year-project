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
import { DataGrid, GridColDef, GridRowId, GridActionsCellItem } from '@mui/x-data-grid';
import { Edit as EditIcon, Download as DownloadIcon, Add as AddIcon } from '@mui/icons-material';
import api from '../services/api';
import { Student } from '../types/student';
import AddStudentModal from './AddStudentModal';

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
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

  const columns: GridColDef[] = [
    { field: 'student_number', headerName: 'ID', width: 120, sortable: true },
    { field: 'full_name', headerName: 'Full Name', width: 200, sortable: true },
    { field: 'email', headerName: 'Email', width: 250, sortable: true },
    { field: 'department', headerName: 'Dept', width: 140 },
    { field: 'enrollment_year', headerName: 'Year', width: 80 },
    {
      field: 'living_arrangement',
      headerName: 'Living',
      width: 160,
      editable: true,
      type: 'singleSelect',
      valueOptions: ['CASH_STIPEND', 'ON_CAMPUS'],
      renderCell: (params) => (
        <TextField
          size="small"
          select
          value={params.value}
          onChange={(e) =>
            handleEdit(params.row.student_id, 'living_arrangement', e.target.value)
          }
          sx={{ width: '100%' }}
        >
          <MenuItem value="CASH_STIPEND">CASH_STIPEND</MenuItem>
          <MenuItem value="ON_CAMPUS">ON_CAMPUS</MenuItem>
        </TextField>
      ),
    },
    {
      field: 'enrollment_status',
      headerName: 'Status',
      width: 140,
      editable: true,
      type: 'singleSelect',
      valueOptions: ['ACTIVE', 'GRADUATED', 'WITHDRAWN'],
      renderCell: (params) => (
        <TextField
          size="small"
          select
          value={params.value}
          onChange={(e) => handleEdit(params.row.student_id, 'enrollment_status', e.target.value)}
          sx={{ width: '100%' }}
        >
          <MenuItem value="ACTIVE">ACTIVE</MenuItem>
          <MenuItem value="GRADUATED">GRADUATED</MenuItem>
          <MenuItem value="WITHDRAWN">WITHDRAWN</MenuItem>
        </TextField>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 80,
      getActions: () => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => {}} color="inherit" />,
      ],
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" gutterBottom>
        Student Management
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 250 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAddStudentOpen(true)}>
          Add Student
        </Button>
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
          slotProps={{
            toolbar: { showQuickFilter: false },
          }}
        />
      </Paper>

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
