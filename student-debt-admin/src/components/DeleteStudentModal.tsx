import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
} from '@mui/material';
import api from '../services/api';

interface DeleteStudentModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number | null;
  studentName: string;
  onStudentDeleted: () => void;
}

export default function DeleteStudentModal({
  open,
  onClose,
  studentId,
  studentName,
  onStudentDeleted
}: DeleteStudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!studentId) return;

    setLoading(true);
    setError('');

    try {
      await api.delete(`/api/admin/students/${studentId}`);
      onStudentDeleted();
      onClose();
    } catch (err: any) {
      console.error('Delete student error:', err);
      setError(err.response?.data?.error || 'Failed to delete student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete Student</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <p>
          Are you sure you want to delete <strong>{studentName}</strong>?<br />
          This action cannot be undone and will remove all associated debt and payment records.
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleDelete}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
