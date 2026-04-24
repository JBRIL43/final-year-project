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
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import api from '../services/api';
import { DEPARTMENTS } from '../constants/departments';

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
    campus: 'Main Campus',
    living_arrangement: 'On-Campus',
    enrollment_status: 'Active',
    payment_model: 'post_graduation',
    pre_payment_amount: '',
    pre_payment_date: '',
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

    if (formData.payment_model !== 'post_graduation') {
      const amount = Number(formData.pre_payment_amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return 'Pre-payment amount is required for pre-payment and hybrid students';
      }
    }

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
        payment_model: formData.payment_model,
        pre_payment_amount:
          formData.payment_model === 'post_graduation' ? 0 : Number(formData.pre_payment_amount),
        pre_payment_date: formData.payment_model === 'post_graduation' ? null : formData.pre_payment_date || null,
        pre_payment_clearance: false,
        campus: formData.campus || 'Main Campus',
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
          select
          margin="dense"
          label="Department"
          fullWidth
          value={formData.department}
          onChange={(e) => handleChange('department', e.target.value)}
          disabled={loading}
        >
          {DEPARTMENTS.map((department) => (
            <MenuItem key={department} value={department}>
              {department}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          margin="dense"
          label="Campus"
          fullWidth
          value={formData.campus}
          onChange={(e) => handleChange('campus', e.target.value)}
          disabled={loading}
        >
          <MenuItem value="Main Campus">Main Campus</MenuItem>
          <MenuItem value="IoT Campus">IoT Campus</MenuItem>
        </TextField>
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
        <FormControl fullWidth margin="dense">
          <InputLabel>Payment Model</InputLabel>
          <Select
            value={formData.payment_model}
            label="Payment Model"
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                payment_model: String(e.target.value),
                pre_payment_amount: String(e.target.value) === 'post_graduation' ? '' : prev.pre_payment_amount,
                pre_payment_date: String(e.target.value) === 'post_graduation' ? '' : prev.pre_payment_date,
              }))
            }
            disabled={loading}
          >
            <MenuItem value="post_graduation">Post-Graduation (Standard)</MenuItem>
            <MenuItem value="pre_payment">Pre-Payment (Full Upfront)</MenuItem>
            <MenuItem value="hybrid">Hybrid (Partial Upfront)</MenuItem>
          </Select>
        </FormControl>
        {formData.payment_model !== 'post_graduation' && (
          <>
            <TextField
              margin="dense"
              label="Pre-Payment Amount (ETB)"
              type="number"
              fullWidth
              value={formData.pre_payment_amount}
              onChange={(e) => handleChange('pre_payment_amount', e.target.value)}
              disabled={loading}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              margin="dense"
              label="Pre-Payment Date"
              type="date"
              fullWidth
              value={formData.pre_payment_date}
              onChange={(e) => handleChange('pre_payment_date', e.target.value)}
              disabled={loading}
              InputLabelProps={{ shrink: true }}
            />
          </>
        )}
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
