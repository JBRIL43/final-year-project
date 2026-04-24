import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
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

const toAmount = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const DEFAULT_TUITION_SHARE_PERCENT = 15
const FOOD_MONTHS_PER_YEAR = 10

export default function CostManagement() {
  const [amounts, setAmounts] = useState<SemesterAmount[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const loadAmounts = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const res = await api.get<{ success: true; amounts: SemesterAmount[] }>('/api/admin/semester-amounts')
      const normalized = res.data.amounts.map((amount) => ({
        ...amount,
        tuition_cost_per_year: toAmount(amount.tuition_cost_per_year),
        boarding_cost_per_year: toAmount(amount.boarding_cost_per_year),
        food_cost_per_month: toAmount(amount.food_cost_per_month),
        health_insurance_fee: toAmount(amount.health_insurance_fee),
        other_fees: toAmount(amount.other_fees),
      }))
      setAmounts(normalized)
    } catch (err) {
      console.error('Failed to load semester amounts', err)
      setErrorMessage('Failed to load semester amount configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAmounts()
  }, [])

  const groupedByAcademicYear = useMemo(() => {
    return amounts.reduce<Record<string, SemesterAmount[]>>((groups, amount) => {
      if (!groups[amount.academic_year]) {
        groups[amount.academic_year] = []
      }
      groups[amount.academic_year].push(amount)
      return groups
    }, {})
  }, [amounts])

  const formatETB = (amount: number) =>
    new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount)

  const calculatePreviewTotal = (amount: SemesterAmount) => {
    const tuitionShare = amount.tuition_cost_per_year * (DEFAULT_TUITION_SHARE_PERCENT / 100)
    const foodAnnual = amount.food_cost_per_month * FOOD_MONTHS_PER_YEAR
    return tuitionShare + amount.boarding_cost_per_year + foodAnnual + amount.health_insurance_fee + amount.other_fees
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Cost Configuration Verification
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Read-only verification view for staff to confirm the yearly base amounts and the derived student-share totals.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Calculation Reference
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Student share preview uses the standard formula:
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
          total = (tuition_cost_per_year × {DEFAULT_TUITION_SHARE_PERCENT}%) + boarding_cost_per_year + (food_cost_per_month × {FOOD_MONTHS_PER_YEAR}) + health_insurance_fee + other_fees
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Exact student totals still depend on the contract tuition-share percent used in the student record.
        </Typography>
      </Paper>

      {loading ? (
        <Paper sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Paper>
      ) : errorMessage ? (
        <Alert severity="error">{errorMessage}</Alert>
      ) : amounts.length === 0 ? (
        <Alert severity="info">No semester amount configurations found. Use Semester Amounts to add base values.</Alert>
      ) : (
        Object.entries(groupedByAcademicYear)
          .sort(([yearA], [yearB]) => yearB.localeCompare(yearA))
          .map(([academicYear, yearAmounts]) => (
            <Paper key={academicYear} sx={{ mb: 3 }}>
              <Box sx={{ px: 3, pt: 3, pb: 1 }}>
                <Typography variant="h6">Academic Year {academicYear}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Verify campus and program-specific amounts before they are used in cost calculations.
                </Typography>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Campus</TableCell>
                      <TableCell>Program Type</TableCell>
                      <TableCell>Tuition Share @ 15%</TableCell>
                      <TableCell>Boarding</TableCell>
                      <TableCell>Food / Month</TableCell>
                      <TableCell>Health Insurance</TableCell>
                      <TableCell>Other Fees</TableCell>
                      <TableCell>Preview Total</TableCell>
                      <TableCell>Effective From</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {yearAmounts.map((amount) => {
                      const tuitionShare = amount.tuition_cost_per_year * (DEFAULT_TUITION_SHARE_PERCENT / 100)
                      const previewTotal = calculatePreviewTotal(amount)

                      return (
                        <TableRow key={amount.id} hover>
                          <TableCell>{amount.campus}</TableCell>
                          <TableCell>{amount.program_type}</TableCell>
                          <TableCell>{formatETB(tuitionShare)}</TableCell>
                          <TableCell>{formatETB(amount.boarding_cost_per_year)}</TableCell>
                          <TableCell>{formatETB(amount.food_cost_per_month)}</TableCell>
                          <TableCell>{formatETB(amount.health_insurance_fee)}</TableCell>
                          <TableCell>{formatETB(amount.other_fees)}</TableCell>
                          <TableCell>{formatETB(previewTotal)}</TableCell>
                          <TableCell>{new Date(amount.effective_from).toLocaleDateString('en-ET')}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))
      )}
    </Box>
  )
}
