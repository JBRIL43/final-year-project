import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import PaymentsIcon from '@mui/icons-material/Payments'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import TableChartIcon from '@mui/icons-material/TableChart'
import api from '../services/api'
import { API_BASE_URL } from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthlyRow = { month: string; payments_count: number; total_collections: number }
type OutstandingRow = { campus: string; program: string; students_count: number; total_outstanding_debt: number }
type DefaultTotals = { total_graduates: number; delinquent_graduates: number; default_rate: number }
type MethodRow = { payment_method: string; total_transactions: number; approved_count: number; total_approved_amount: number; pending_count: number; rejected_count: number }
type WithdrawalRow = { student_number: string; full_name: string; department: string; campus: string; enrollment_status: string; withdrawal_status: string; withdrawal_requested_at: string; settlement_amount: number; remaining_balance: number; is_final_settlement: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2 })
const today = new Date().toISOString().slice(0, 10)

function downloadCsvUrl(path: string, filename: string) {
  const url = `${API_BASE_URL}${path}`
  const token = localStorage.getItem('firebase_id_token')
  // Build a temporary anchor with auth header via fetch + blob
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    })
    .catch(console.error)
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ReportSection({
  icon,
  title,
  description,
  csvPath,
  csvFilename,
  loading,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  csvPath: string
  csvFilename: string
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        sx={{ px: 2.5, py: 2, bgcolor: '#f7f9fc', borderBottom: '1px solid #e7ebf2' }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {icon}
          <Box>
            <Typography fontWeight={800}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">{description}</Typography>
          </Box>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={() => downloadCsvUrl(csvPath, csvFilename)}
          sx={{ mt: { xs: 1, sm: 0 }, whiteSpace: 'nowrap' }}
        >
          Download CSV
        </Button>
      </Stack>
      <Box sx={{ p: 2 }}>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box> : children}
      </Box>
    </Paper>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceReportsDashboard() {
  const [months, setMonths] = useState(12)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([])
  const [defaultRate, setDefaultRate] = useState<DefaultTotals | null>(null)
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])

  const safeMonths = Math.min(36, Math.max(1, Number(months) || 12))

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, oRes, dRes, pmRes, wRes] = await Promise.all([
        api.get<{ rows: MonthlyRow[] }>(`/api/admin/reports/monthly-collections?months=${safeMonths}`),
        api.get<{ rows: OutstandingRow[] }>('/api/admin/reports/outstanding-debt'),
        api.get<{ totals: DefaultTotals }>('/api/admin/reports/default-rate'),
        api.get<{ rows: MethodRow[] }>('/api/admin/reports/payment-methods'),
        api.get<{ rows: WithdrawalRow[] }>('/api/admin/reports/withdrawal-settlements'),
      ])
      setMonthly(mRes.data.rows || [])
      setOutstanding(oRes.data.rows || [])
      setDefaultRate(dRes.data.totals || null)
      setMethods(pmRes.data.rows || [])
      setWithdrawals(wRes.data.rows || [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const totalCollected = useMemo(() => monthly.reduce((s, r) => s + r.total_collections, 0), [monthly])
  const totalOutstanding = useMemo(() => outstanding.reduce((s, r) => s + r.total_outstanding_debt, 0), [outstanding])

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>Finance Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Live data previews with CSV export for all report types.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: { xs: 1, md: 0 } }}>
          <TextField
            label="Months (Collections)"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            size="small"
            type="number"
            inputProps={{ min: 1, max: 36 }}
            sx={{ width: 180 }}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>
            Refresh All
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI summary cards */}
      {!loading && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Collected', value: fmt.format(totalCollected), color: '#16a34a', bg: '#f0fdf4' },
            { label: 'Total Outstanding', value: fmt.format(totalOutstanding), color: '#dc2626', bg: '#fef2f2' },
            { label: 'Default Rate', value: `${((defaultRate?.default_rate ?? 0) * 100).toFixed(1)}%`, color: '#d97706', bg: '#fffbeb' },
            { label: 'Withdrawals', value: String(withdrawals.length), color: '#7c3aed', bg: '#f5f3ff' },
          ].map((k) => (
            <Paper key={k.label} elevation={0} sx={{ flex: 1, p: 2, borderRadius: 3, bgcolor: k.bg, border: `1px solid ${k.color}22` }}>
              <Typography variant="caption" color="text.secondary">{k.label}</Typography>
              <Typography variant="h5" fontWeight={800} color={k.color}>{k.value}</Typography>
            </Paper>
          ))}
        </Stack>
      )}

      <Stack spacing={2.5}>

        {/* 1. Monthly Collections */}
        <ReportSection
          icon={<TrendingUpIcon color="primary" />}
          title="Monthly Collections"
          description={`Approved payments grouped by month — last ${safeMonths} month(s)`}
          csvPath={`/api/admin/reports/monthly-collections.csv?months=${safeMonths}`}
          csvFilename={`monthly_collections_${today}.csv`}
          loading={loading}
        >
          {monthly.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No collection data found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Payments</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total Collected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthly.map((r) => (
                    <TableRow key={r.month} hover>
                      <TableCell>{r.month}</TableCell>
                      <TableCell align="right">{r.payments_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt.format(r.total_collections)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#f7f9fc' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{monthly.reduce((s, r) => s + r.payments_count, 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt.format(totalCollected)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportSection>

        {/* 2. Outstanding Debt */}
        <ReportSection
          icon={<AccountBalanceWalletIcon color="error" />}
          title="Outstanding Debt by Campus / Program"
          description="Unpaid balances grouped by campus and department"
          csvPath="/api/admin/reports/outstanding-debt.csv"
          csvFilename={`outstanding_debt_${today}.csv`}
          loading={loading}
        >
          {outstanding.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No outstanding debt found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Campus</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Program</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Students</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Outstanding</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outstanding.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{r.campus}</TableCell>
                      <TableCell>{r.program}</TableCell>
                      <TableCell align="right">{r.students_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{fmt.format(r.total_outstanding_debt)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: '#f7f9fc' }}>
                    <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{outstanding.reduce((s, r) => s + r.students_count, 0)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{fmt.format(totalOutstanding)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportSection>

        {/* 3. Default Rate */}
        <ReportSection
          icon={<WarningAmberIcon color="warning" />}
          title="Graduate Default Rate"
          description="Delinquent graduates past repayment start date vs total graduates"
          csvPath="/api/admin/reports/default-rate.csv"
          csvFilename={`default_rate_${today}.csv`}
          loading={loading}
        >
          {defaultRate && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ py: 1 }}>
              {[
                { label: 'Total Graduates', value: defaultRate.total_graduates },
                { label: 'Delinquent', value: defaultRate.delinquent_graduates },
                { label: 'Default Rate', value: `${(defaultRate.default_rate * 100).toFixed(2)}%` },
              ].map((s) => (
                <Box key={s.label}>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </ReportSection>

        {/* 4. Payment Methods */}
        <ReportSection
          icon={<PaymentsIcon color="primary" />}
          title="Payment Method Breakdown"
          description="Transactions by method — Chapa, Bank Transfer, Receipt"
          csvPath="/api/admin/reports/payment-methods.csv"
          csvFilename={`payment_methods_${today}.csv`}
          loading={loading}
        >
          {methods.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No payment data found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Approved</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Amount Approved</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Pending</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Rejected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {methods.map((r) => (
                    <TableRow key={r.payment_method} hover>
                      <TableCell>
                        <Chip label={r.payment_method} size="small"
                          color={r.payment_method === 'CHAPA' ? 'success' : r.payment_method === 'BANK_TRANSFER' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{r.total_transactions}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{r.approved_count}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmt.format(r.total_approved_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: 'warning.main' }}>{r.pending_count}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{r.rejected_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportSection>

        {/* 5. Withdrawal Settlements */}
        <ReportSection
          icon={<ExitToAppIcon sx={{ color: '#7c3aed' }} />}
          title="Withdrawal Settlements"
          description="Students who have requested or completed withdrawal"
          csvPath="/api/admin/reports/withdrawal-settlements.csv"
          csvFilename={`withdrawal_settlements_${today}.csv`}
          loading={loading}
        >
          {withdrawals.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No withdrawal records found.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Settlement</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Settled</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {withdrawals.map((r, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>{r.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.student_number}</Typography>
                      </TableCell>
                      <TableCell>{r.department}</TableCell>
                      <TableCell>
                        <Chip label={r.withdrawal_status || r.enrollment_status} size="small"
                          color={r.withdrawal_status === 'completed' ? 'success' : r.withdrawal_status === 'finance_approved' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{r.settlement_amount != null ? fmt.format(r.settlement_amount) : '—'}</TableCell>
                      <TableCell align="right" sx={{ color: Number(r.remaining_balance) > 0 ? 'error.main' : 'success.main', fontWeight: 700 }}>
                        {r.remaining_balance != null ? fmt.format(r.remaining_balance) : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={r.is_final_settlement ? 'Yes' : 'No'} size="small"
                          color={r.is_final_settlement ? 'success' : 'default'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportSection>

        {/* 6. ERCA Export */}
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableChartIcon color="action" />
              <Box>
                <Typography fontWeight={800}>ERCA Debtor Export</Typography>
                <Typography variant="caption" color="text.secondary">
                  Delinquent graduates list for external ERCA submission
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() => downloadCsvUrl('/api/admin/erca/debtors.csv', `ERCA_Debtors_${today}.csv`)}
              sx={{ mt: { xs: 1, sm: 0 } }}
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>

        {/* 7. Semester Costs */}
        <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TableChartIcon color="action" />
              <Box>
                <Typography fontWeight={800}>Semester Cost Configuration</Typography>
                <Typography variant="caption" color="text.secondary">
                  Cost share configurations used for billing and debt reconciliation
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() => downloadCsvUrl('/api/admin/reports/semester-costs.csv', `semester_costs_${today}.csv`)}
              sx={{ mt: { xs: 1, sm: 0 } }}
            >
              Download CSV
            </Button>
          </Stack>
        </Paper>

      </Stack>
    </Box>
  )
}
