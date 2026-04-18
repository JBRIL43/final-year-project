import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';
import { DEPARTMENTS } from '../constants/departments';

const FIXED_FOOD_COST_PER_MONTH = 3000;

interface CostShare {
  cost_share_id: number;
  program: string;
  academic_year: string;
  tuition_cost_per_year: number;
  boarding_cost_per_year: number;
  food_cost_per_month: number;
}

const toAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function CostManagement() {
  const [costs, setCosts] = useState<CostShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<CostShare | null>(null);
  const [formData, setFormData] = useState({
    program: '',
    academic_year: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    tuition_cost_per_year: '',
    boarding_cost_per_year: '',
  });

  const loadCosts = async () => {
    try {
      const res = await api.get<{ success: true; costs: CostShare[] }>('/api/admin/cost-shares');
      const normalizedCosts = res.data.costs.map((cost) => ({
        ...cost,
        tuition_cost_per_year: toAmount(cost.tuition_cost_per_year),
        boarding_cost_per_year: toAmount(cost.boarding_cost_per_year),
        food_cost_per_month: toAmount(cost.food_cost_per_month),
      }));
      setCosts(normalizedCosts);
    } catch (err) {
      console.error('Failed to load costs', err);
      setSnackbar({ open: true, message: '❌ Failed to load cost configurations', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCosts();
  }, []);

  const handleOpenModal = (cost?: CostShare) => {
    if (cost) {
      setEditingCost(cost);
      setFormData({
        program: cost.program,
        academic_year: cost.academic_year,
        tuition_cost_per_year: String(cost.tuition_cost_per_year),
        boarding_cost_per_year: String(cost.boarding_cost_per_year),
      });
    } else {
      setEditingCost(null);
      setFormData({
        program: '',
        academic_year: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
        tuition_cost_per_year: '',
        boarding_cost_per_year: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...formData,
        tuition_cost_per_year: Number(formData.tuition_cost_per_year),
        boarding_cost_per_year: Number(formData.boarding_cost_per_year),
        food_cost_per_month: FIXED_FOOD_COST_PER_MONTH,
      };

      if (editingCost) {
        await api.put(`/api/admin/cost-shares/${editingCost.cost_share_id}`, payload);
      } else {
        await api.post('/api/admin/cost-shares', payload);
      }

      setSnackbar({ open: true, message: '✅ Cost configuration saved', severity: 'success' });
      setModalOpen(false);
      loadCosts();
    } catch (err: any) {
      console.error('Save cost error:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Failed to save cost',
        severity: 'error',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this cost configuration? This may affect debt calculations.')) return;
    try {
      await api.delete(`/api/admin/cost-shares/${id}`);
      setSnackbar({ open: true, message: '✅ Cost deleted', severity: 'success' });
      loadCosts();
    } catch (err: any) {
      console.error('Delete cost error:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.error || '❌ Failed to delete cost',
        severity: 'error',
      });
    }
  };

  const formatETB = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Cost Configuration</Typography>
        <Button variant="contained" onClick={() => handleOpenModal()}>
          + Add Cost Configuration
        </Button>
      </Box>

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
                  <TableCell>Program</TableCell>
                  <TableCell>Academic Year</TableCell>
                  <TableCell>Tuition (15%)</TableCell>
                  <TableCell>Boarding</TableCell>
                  <TableCell>Food/Month</TableCell>
                  <TableCell>Total Student Share</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {costs.map((cost) => {
                  const tuitionCostPerYear = toAmount(cost.tuition_cost_per_year);
                  const boardingCostPerYear = toAmount(cost.boarding_cost_per_year);
                  const foodCostPerMonth = toAmount(cost.food_cost_per_month);
                  const tuitionShare = tuitionCostPerYear * 0.15;
                  const totalShare =
                    tuitionShare +
                    boardingCostPerYear +
                    foodCostPerMonth * 10;
                  return (
                    <TableRow key={cost.cost_share_id}>
                      <TableCell>{cost.program}</TableCell>
                      <TableCell>{cost.academic_year}</TableCell>
                      <TableCell>{formatETB(tuitionShare)}</TableCell>
                      <TableCell>{formatETB(boardingCostPerYear)}</TableCell>
                      <TableCell>{formatETB(foodCostPerMonth)}</TableCell>
                      <TableCell>{formatETB(totalShare)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => handleOpenModal(cost)} sx={{ mr: 1 }}>
                          Edit
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDelete(cost.cost_share_id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {costs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Alert severity="info">No cost configurations found.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCost ? 'Edit Cost' : 'Add Cost Configuration'}</DialogTitle>
        <DialogContent>
          <TextField
            select
            margin="dense"
            label="Program/Department"
            fullWidth
            value={formData.program}
            onChange={(e) => setFormData((prev) => ({ ...prev, program: e.target.value }))}
          >
            {DEPARTMENTS.map((department) => (
              <MenuItem key={department} value={department}>
                {department}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            margin="dense"
            label="Academic Year (e.g., 2026/2027)"
            fullWidth
            value={formData.academic_year}
            onChange={(e) => setFormData((prev) => ({ ...prev, academic_year: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Full Tuition Cost (per year)"
            type="number"
            fullWidth
            value={formData.tuition_cost_per_year}
            onChange={(e) => setFormData((prev) => ({ ...prev, tuition_cost_per_year: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Boarding Cost (per year)"
            type="number"
            fullWidth
            value={formData.boarding_cost_per_year}
            onChange={(e) => setFormData((prev) => ({ ...prev, boarding_cost_per_year: e.target.value }))}
          />
          <TextField
            margin="dense"
            label="Food Cost (per month)"
            type="number"
            fullWidth
            value={FIXED_FOOD_COST_PER_MONTH}
            disabled
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </DialogActions>
      </Dialog>

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
