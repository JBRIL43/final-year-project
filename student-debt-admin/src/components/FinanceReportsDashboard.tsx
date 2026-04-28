import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import api from '../services/api'

type MonthlyCollectionsRow = {
  month: string
  payments_count: number
  total_collections: number
}

type OutstandingDebtRow = {
  campus: string
  program: string
  students_count: number
  total_outstanding_debt: number
}

type DefaultRateTotals = {
  total_graduates: number
  delinquent_graduates: number
  default_rate: number
}

async function downloadCsv(url: string, filename: string) {
  const response = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export default function FinanceReportsDashboard() {
  const [months, setMonths] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [monthlyCollections, setMonthlyCollections] = useState<MonthlyCollectionsRow[]>([])
  const [outstandingDebt, setOutstandingDebt] = useState<OutstandingDebtRow[]>([])
  const [defaultRate, setDefaultRate] = useState<DefaultRateTotals | null>(null)

  const formatETB = useMemo(
    () =>
      (amount: number) =>
        new Intl.NumberFormat('en-ET', {
          style: 'currency',
          currency: 'ETB',
          minimumFractionDigits: 2,
        }).format(amount),
    []
  )

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const [monthlyRes, outstandingRes, defaultRateRes] = await Promise.all([
        api.get<{ success: boolean; rows: MonthlyCollectionsRow[] }>(
          `/api/admin/reports/monthly-collections?months=${months}`
        ),
        api.get<{ success: boolean; rows: OutstandingDebtRow[] }>(
          '/api/admin/reports/outstanding-debt'
        ),
        api.get<{ success: boolean; totals: DefaultRateTotals }>(
          '/api/admin/reports/default-rate'
        ),
      ])

      setMonthlyCollections(monthlyRes.data.rows || [])
      setOutstandingDebt(outstandingRes.data.rows || [])
      setDefaultRate(defaultRateRes.data.totals || null)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load finance reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = async () => {
    await loadReports()
  }

  const safeMonths = Math.min(36, Math.max(1, Number(months) || 12))

  if (loading) {
    return <Alert severity="info">Loading finance reports...</Alert>
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={handleRefresh}>
          Retry
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            Finance Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Generate exports for compliance, collections, and debt monitoring.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <TextField
            label="Months (Collections)"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            size="small"
            type="number"
            inputProps={{ min: 1, max: 36 }}
            sx={{ width: 200 }}
          />
          <Button variant="outlined" onClick={handleRefresh}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                ERCA Debtor Export (CSV)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delinquent graduates list for external ERCA submission.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  '/api/admin/erca/debtors.csv',
                  `ERCA_Debtors_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              Download
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Monthly Collections Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Approved/success payments grouped by month (last {safeMonths} month(s)).
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Latest month: <strong>{monthlyCollections[0]?.month || '-'}</strong> — Total:{' '}
                <strong>{formatETB(Number(monthlyCollections[0]?.total_collections || 0))}</strong>
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  `/api/admin/reports/monthly-collections.csv?months=${safeMonths}`,
                  `monthly_collections_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Outstanding Debt by Campus/Program
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Aggregated unpaid balances (current_balance &gt; 0).
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Groups: <strong>{outstandingDebt.length}</strong>
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  '/api/admin/reports/outstanding-debt.csv',
                  `outstanding_debt_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Default Rate (Delinquent vs Total Graduates)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Delinquent graduates past repayment start with unpaid debt vs all graduates.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Total graduates: <strong>{defaultRate?.total_graduates ?? 0}</strong> — Delinquent:{' '}
                <strong>{defaultRate?.delinquent_graduates ?? 0}</strong> — Default rate:{' '}
                <strong>{((defaultRate?.default_rate ?? 0) * 100).toFixed(2)}%</strong>
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  '/api/admin/reports/default-rate.csv',
                  `default_rate_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Semester Cost Configuration Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Export cost share configurations used for billing and debt reconciliation.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() =>
                downloadCsv(
                  '/api/admin/reports/semester-costs.csv',
                  `semester_costs_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}

