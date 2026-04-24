import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import api from '../services/api'

interface SemesterAmount {
  id: number
  academic_year: string
  campus: string
  program_type: string
  tuition_cost_per_year: number
  boarding_cost_per_year: number
  food_cost_per_month: number
  health_insurance_fee: number
  other_fees: number
  effective_from: string
}

type NewSemesterAmount = Omit<SemesterAmount, 'id'>

const buildDefaultNewAmount = (): NewSemesterAmount => {
  const now = new Date()
  const year = now.getFullYear()

  return {
    academic_year: `${year}/${year + 1}`,
    campus: 'Main Campus',
    program_type: 'Engineering',
    tuition_cost_per_year: 0,
    boarding_cost_per_year: 0,
    food_cost_per_month: 0,
    health_insurance_fee: 0,
    other_fees: 0,
    effective_from: now.toISOString().split('T')[0],
  }
}

export default function SemesterAmountsDashboard() {
  const [amounts, setAmounts] = useState<SemesterAmount[]>([])
  const [loading, setLoading] = useState(true)
  const [newAmount, setNewAmount] = useState<NewSemesterAmount>(buildDefaultNewAmount())
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const loadAmounts = async () => {
    setLoading(true)
    try {
      const res = await api.get<{ success: true; amounts: SemesterAmount[] }>('/api/admin/semester-amounts')
      setAmounts(res.data.amounts)
    } catch (err) {
      console.error('Failed to load semester amounts', err)
      setSnackbar({ open: true, message: 'Failed to load semester amounts', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAmounts()
  }, [])

  const handleSaveNew = async () => {
    try {
      await api.post('/api/admin/semester-amounts', newAmount)
      setSnackbar({ open: true, message: 'Semester amount configuration saved', severity: 'success' })
      setNewAmount(buildDefaultNewAmount())
      await loadAmounts()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to save semester amount configuration',
        severity: 'error',
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this semester amount configuration?')) {
      return
    }

    try {
      await api.delete(`/api/admin/semester-amounts/${id}`)
      setSnackbar({ open: true, message: 'Semester amount configuration deleted', severity: 'success' })
      await loadAmounts()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to delete semester amount configuration',
        severity: 'error',
      })
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(Number(amount || 0))

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Semester Amount Configuration
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Configuration
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Academic Year"
              value={newAmount.academic_year}
              onChange={(e) => setNewAmount((prev) => ({ ...prev, academic_year: e.target.value }))}
              placeholder="2025/2026"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Campus</InputLabel>
              <Select
                value={newAmount.campus}
                label="Campus"
                onChange={(e) => setNewAmount((prev) => ({ ...prev, campus: String(e.target.value) }))}
              >
                <MenuItem value="Main Campus">Main Campus</MenuItem>
                <MenuItem value="IoT Campus">IoT Campus</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Program Type"
              value={newAmount.program_type}
              onChange={(e) => setNewAmount((prev) => ({ ...prev, program_type: e.target.value }))}
              placeholder="Engineering"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Tuition (Yearly)"
              type="number"
              value={newAmount.tuition_cost_per_year}
              onChange={(e) =>
                setNewAmount((prev) => ({ ...prev, tuition_cost_per_year: Number.parseFloat(e.target.value) || 0 }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Boarding (Yearly)"
              type="number"
              value={newAmount.boarding_cost_per_year}
              onChange={(e) =>
                setNewAmount((prev) => ({ ...prev, boarding_cost_per_year: Number.parseFloat(e.target.value) || 0 }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="Food (Monthly)"
              type="number"
              value={newAmount.food_cost_per_month}
              onChange={(e) =>
                setNewAmount((prev) => ({ ...prev, food_cost_per_month: Number.parseFloat(e.target.value) || 0 }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="Health Insurance"
              type="number"
              value={newAmount.health_insurance_fee}
              onChange={(e) =>
                setNewAmount((prev) => ({ ...prev, health_insurance_fee: Number.parseFloat(e.target.value) || 0 }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="Other Fees"
              type="number"
              value={newAmount.other_fees}
              onChange={(e) =>
                setNewAmount((prev) => ({ ...prev, other_fees: Number.parseFloat(e.target.value) || 0 }))
              }
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Effective From"
              type="date"
              value={newAmount.effective_from}
              onChange={(e) => setNewAmount((prev) => ({ ...prev, effective_from: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleSaveNew}>
              Add Semester Configuration
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {loading ? (
        <Alert severity="info">Loading semester configurations...</Alert>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Academic Year</TableCell>
                  <TableCell>Campus</TableCell>
                  <TableCell>Program Type</TableCell>
                  <TableCell>Tuition</TableCell>
                  <TableCell>Boarding</TableCell>
                  <TableCell>Food / Month</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Other</TableCell>
                  <TableCell>Effective From</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {amounts.map((amount) => (
                  <TableRow key={amount.id}>
                    <TableCell>{amount.academic_year}</TableCell>
                    <TableCell>{amount.campus}</TableCell>
                    <TableCell>{amount.program_type}</TableCell>
                    <TableCell>{formatCurrency(amount.tuition_cost_per_year)}</TableCell>
                    <TableCell>{formatCurrency(amount.boarding_cost_per_year)}</TableCell>
                    <TableCell>{formatCurrency(amount.food_cost_per_month)}</TableCell>
                    <TableCell>{formatCurrency(amount.health_insurance_fee)}</TableCell>
                    <TableCell>{formatCurrency(amount.other_fees)}</TableCell>
                    <TableCell>{new Date(amount.effective_from).toLocaleDateString('en-ET')}</TableCell>
                    <TableCell>
                      <IconButton color="error" size="small" onClick={() => handleDelete(amount.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}