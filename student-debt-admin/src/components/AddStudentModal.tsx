import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import api from '../services/api';

interface AddStudentModalProps {
  open: boolean;
  onClose: () => void;
  onStudentAdded: () => void;
}

export default function AddStudentModal({ open, onClose, onStudentAdded }: AddStudentModalProps) {
  const [formData, setFormData] = useState({
    student_number: '',
    full_name: '',
    email: '',
    department: '',
    enrollment_year: '',
    living_arrangement: 'On-Campus',
    enrollment_status: 'Active',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const validate = () => {
    if (!formData.student_number.trim()) return 'Student ID is required';
    if (!formData.full_name.trim()) return 'Full name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) return 'Invalid email format';
    if (!formData.department.trim()) return 'Department is required';
    if (!formData.enrollment_year || isNaN(Number(formData.enrollment_year)))
      return 'Valid enrollment year is required';
    return '';
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/api/admin/students', {
        ...formData,
        enrollment_year: Number(formData.enrollment_year),
      });

      onStudentAdded();
      onClose();
    } catch (err: any) {
      console.error('Add student error:', err);
      setError(err.response?.data?.error || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Student</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TextField
          autoFocus
          margin="dense"
          label="Student ID"
          fullWidth
          value={formData.student_number}
          onChange={(e) => handleChange('student_number', e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Full Name"
          fullWidth
          value={formData.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Email"
          type="email"
          fullWidth
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Department"
          fullWidth
          value={formData.department}
          onChange={(e) => handleChange('department', e.target.value)}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Enrollment Year"
          type="number"
          fullWidth
          value={formData.enrollment_year}
          onChange={(e) => handleChange('enrollment_year', e.target.value)}
          disabled={loading}
        />
        <TextField
          select
          margin="dense"
          label="Living Arrangement"
          fullWidth
          value={formData.living_arrangement}
          onChange={(e) => handleChange('living_arrangement', e.target.value)}
          disabled={loading}
        >
          <MenuItem value="On-Campus">On-Campus</MenuItem>
          <MenuItem value="Off-Campus">Off-Campus</MenuItem>
          <MenuItem value="With Family">With Family</MenuItem>
        </TextField>
        <TextField
          select
          margin="dense"
          label="Enrollment Status"
          fullWidth
          value={formData.enrollment_status}
          onChange={(e) => handleChange('enrollment_status', e.target.value)}
          disabled={loading}
        >
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Graduated">Graduated</MenuItem>
          <MenuItem value="Suspended">Suspended</MenuItem>
          <MenuItem value="Withdrawn">Withdrawn</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Adding...' : 'Add Student'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
