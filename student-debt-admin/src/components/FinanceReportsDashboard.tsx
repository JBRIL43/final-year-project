import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import AssessmentIcon from '@mui/icons-material/Assessment'
import api, { API_BASE_URL } from '../services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthlyRow = { month: string; payments_count: number; total_collections: number }
type OutstandingRow = { campus: string; program: string; students_count: number; total_outstanding_debt: number }
type DefaultTotals = { total_graduates: number; delinquent_graduates: number; default_rate: number }
type MethodRow = { payment_method: string; total_transactions: number; approved_count: number; total_approved_amount: number; pending_count: number; rejected_count: number }
type WithdrawalRow = { student_number: string; full_name: string; department: string; campus: string; enrollment_status: string; withdrawal_status: string; settlement_amount: number; remaining_balance: number; is_final_settlement: boolean }

type ReportType = 'monthly' | 'outstanding' | 'default' | 'methods' | 'withdrawals' | 'erca'

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { value: 'monthly', label: 'Monthly Collections', description: 'Approved payments grouped by month' },
  { value: 'outstanding', label: 'Outstanding Debt', description: 'Unpaid balances by campus and program' },
  { value: 'default', label: 'Graduate Default Rate', description: 'Delinquent graduates vs total graduates' },
  { value: 'methods', label: 'Payment Method Breakdown', description: 'Chapa, Bank Transfer, Receipt analysis' },
  { value: 'withdrawals', label: 'Withdrawal Settlements', description: 'All withdrawal records and settlement amounts' },
  { value: 'erca', label: 'ERCA Debtor Export', description: 'Delinquent graduates for ERCA submission' },
]

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

const fmt = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 0 })
const fmtFull = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', minimumFractionDigits: 2 })
const today = new Date().toISOString().slice(0, 10)

// ─── CSV download helper ──────────────────────────────────────────────────────

function downloadCsvUrl(path: string, filename: string) {
  const token = localStorage.getItem('firebase_id_token')
  fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: 2.5, borderRadius: 3, border: `1.5px solid ${color}33`, bgcolor: `${color}08` }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={800} sx={{ color, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  )
}

// ─── Report views ─────────────────────────────────────────────────────────────

function MonthlyView({ rows }: { rows: MonthlyRow[] }) {
  const total = rows.reduce((s, r) => s + r.total_collections, 0)
  const chartData = [...rows].reverse().map((r) => ({ month: r.month, amount: r.total_collections, count: r.payments_count }))

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <KpiCard label="Total Collected" value={fmt.format(total)} sub={`Last ${rows.length} months`} color="#16a34a" />
        <KpiCard label="Avg per Month" value={fmt.format(rows.length ? total / rows.length : 0)} color="#2563eb" />
        <KpiCard label="Total Payments" value={String(rows.reduce((s, r) => s + r.payments_count, 0))} color="#7c3aed" />
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Collections by Month (ETB)</Typography>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => fmt.format(v)} tick={{ fontSize: 11 }} width={90} />
            <RechartTooltip formatter={(v: number) => fmtFull.format(v)} />
            <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} name="Collected" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f7f9fc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Payments</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Collected</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.month} hover>
                <TableCell>{r.month}</TableCell>
                <TableCell align="right">{r.payments_count}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmtFull.format(r.total_collections)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function OutstandingView({ rows }: { rows: OutstandingRow[] }) {
  const total = rows.reduce((s, r) => s + r.total_outstanding_debt, 0)
  const chartData = rows.slice(0, 8).map((r) => ({ name: r.program?.slice(0, 20) || r.campus, debt: r.total_outstanding_debt }))

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <KpiCard label="Total Outstanding" value={fmt.format(total)} color="#dc2626" />
        <KpiCard label="Programs Affected" value={String(rows.length)} color="#d97706" />
        <KpiCard label="Students with Debt" value={String(rows.reduce((s, r) => s + r.students_count, 0))} color="#7c3aed" />
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Top Programs by Outstanding Debt</Typography>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tickFormatter={(v) => fmt.format(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
            <RechartTooltip formatter={(v: number) => fmtFull.format(v)} />
            <Bar dataKey="debt" fill="#dc2626" radius={[0, 4, 4, 0]} name="Outstanding" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f7f9fc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Campus</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Program</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Students</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Outstanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>{r.campus}</TableCell>
                <TableCell>{r.program}</TableCell>
                <TableCell align="right">{r.students_count}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{fmtFull.format(r.total_outstanding_debt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function DefaultView({ totals }: { totals: DefaultTotals | null }) {
  if (!totals) return <Typography color="text.secondary">No data available.</Typography>
  const pieData = [
    { name: 'Delinquent', value: totals.delinquent_graduates },
    { name: 'On Track', value: Math.max(0, totals.total_graduates - totals.delinquent_graduates) },
  ]
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <KpiCard label="Total Graduates" value={String(totals.total_graduates)} color="#2563eb" />
        <KpiCard label="Delinquent" value={String(totals.delinquent_graduates)} color="#dc2626" />
        <KpiCard label="Default Rate" value={`${(totals.default_rate * 100).toFixed(2)}%`} color="#d97706" />
      </Stack>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Graduate Repayment Status</Typography>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
              {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#dc2626' : '#16a34a'} />)}
            </Pie>
            <Legend />
            <RechartTooltip />
          </PieChart>
        </ResponsiveContainer>
      </Paper>
    </Stack>
  )
}

function MethodsView({ rows }: { rows: MethodRow[] }) {
  const pieData = rows.map((r) => ({ name: r.payment_method, value: r.total_approved_amount }))
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <KpiCard label="Total Methods" value={String(rows.length)} color="#2563eb" />
        <KpiCard label="Total Approved" value={fmt.format(rows.reduce((s, r) => s + r.total_approved_amount, 0))} color="#16a34a" />
        <KpiCard label="Pending" value={String(rows.reduce((s, r) => s + r.pending_count, 0))} color="#d97706" />
      </Stack>

      <Paper elevation={0} sx={{ p: 2, border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Approved Amount by Method</Typography>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name }) => name}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Legend />
            <RechartTooltip formatter={(v: number) => fmtFull.format(v)} />
          </PieChart>
        </ResponsiveContainer>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f7f9fc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Approved</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Pending</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Rejected</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.payment_method} hover>
                <TableCell><Chip label={r.payment_method} size="small" color={r.payment_method === 'CHAPA' ? 'success' : r.payment_method === 'BANK_TRANSFER' ? 'primary' : 'default'} variant="outlined" /></TableCell>
                <TableCell align="right">{r.total_transactions}</TableCell>
                <TableCell align="right" sx={{ color: 'success.main' }}>{r.approved_count}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmtFull.format(r.total_approved_amount)}</TableCell>
                <TableCell align="right" sx={{ color: 'warning.main' }}>{r.pending_count}</TableCell>
                <TableCell align="right" sx={{ color: 'error.main' }}>{r.rejected_count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

function WithdrawalsView({ rows }: { rows: WithdrawalRow[] }) {
  const settled = rows.filter((r) => r.is_final_settlement).length
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <KpiCard label="Total Withdrawals" value={String(rows.length)} color="#7c3aed" />
        <KpiCard label="Settled" value={String(settled)} color="#16a34a" />
        <KpiCard label="Pending Settlement" value={String(rows.length - settled)} color="#d97706" />
      </Stack>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f7f9fc' }}>
              <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Settlement</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Remaining</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Settled</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>{r.full_name}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.student_number}</Typography>
                </TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>
                  <Chip label={r.withdrawal_status || r.enrollment_status || '—'} size="small"
                    color={r.withdrawal_status === 'completed' ? 'success' : r.withdrawal_status === 'finance_approved' ? 'primary' : 'default'}
                    variant="outlined" />
                </TableCell>
                <TableCell align="right">{r.settlement_amount != null ? fmtFull.format(r.settlement_amount) : '—'}</TableCell>
                <TableCell align="right" sx={{ color: Number(r.remaining_balance) > 0 ? 'error.main' : 'success.main', fontWeight: 700 }}>
                  {r.remaining_balance != null ? fmtFull.format(r.remaining_balance) : '—'}
                </TableCell>
                <TableCell><Chip label={r.is_final_settlement ? 'Yes' : 'No'} size="small" color={r.is_final_settlement ? 'success' : 'default'} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}

// ─── CSV path map ─────────────────────────────────────────────────────────────

function csvPath(type: ReportType, months: number): string {
  switch (type) {
    case 'monthly': return `/api/admin/reports/monthly-collections.csv?months=${months}`
    case 'outstanding': return '/api/admin/reports/outstanding-debt.csv'
    case 'default': return '/api/admin/reports/default-rate.csv'
    case 'methods': return '/api/admin/reports/payment-methods.csv'
    case 'withdrawals': return '/api/admin/reports/withdrawal-settlements.csv'
    case 'erca': return '/api/admin/erca/debtors.csv'
  }
}

function csvFilename(type: ReportType): string {
  const labels: Record<ReportType, string> = {
    monthly: 'monthly_collections',
    outstanding: 'outstanding_debt',
    default: 'default_rate',
    methods: 'payment_methods',
    withdrawals: 'withdrawal_settlements',
    erca: 'ERCA_Debtors',
  }
  return `${labels[type]}_${today}.csv`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FinanceReportsDashboard() {
  const [reportType, setReportType] = useState<ReportType>('monthly')
  const [months, setMonths] = useState(12)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [monthly, setMonthly] = useState<MonthlyRow[]>([])
  const [outstanding, setOutstanding] = useState<OutstandingRow[]>([])
  const [defaultRate, setDefaultRate] = useState<DefaultTotals | null>(null)
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])

  const safeMonths = Math.min(36, Math.max(1, Number(months) || 12))

  const generate = async () => {
    setLoading(true)
    setError(null)
    setGenerated(false)
    try {
      if (reportType === 'monthly') {
        const r = await api.get<{ rows: MonthlyRow[] }>(`/api/admin/reports/monthly-collections?months=${safeMonths}`)
        setMonthly(r.data.rows || [])
      } else if (reportType === 'outstanding') {
        const r = await api.get<{ rows: OutstandingRow[] }>('/api/admin/reports/outstanding-debt')
        setOutstanding(r.data.rows || [])
      } else if (reportType === 'default') {
        const r = await api.get<{ totals: DefaultTotals }>('/api/admin/reports/default-rate')
        setDefaultRate(r.data.totals || null)
      } else if (reportType === 'methods') {
        const r = await api.get<{ rows: MethodRow[] }>('/api/admin/reports/payment-methods')
        setMethods(r.data.rows || [])
      } else if (reportType === 'withdrawals') {
        const r = await api.get<{ rows: WithdrawalRow[] }>('/api/admin/reports/withdrawal-settlements')
        setWithdrawals(r.data.rows || [])
      } else if (reportType === 'erca') {
        // ERCA is CSV-only — trigger download directly
        downloadCsvUrl(csvPath('erca', safeMonths), csvFilename('erca'))
        setLoading(false)
        return
      }
      setGenerated(true)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const selectedOption = REPORT_OPTIONS.find((o) => o.value === reportType)!

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <AssessmentIcon sx={{ color: '#2563eb', fontSize: 32 }} />
        <Box>
          <Typography variant="h4" fontWeight={800}>Finance Reports</Typography>
          <Typography variant="body2" color="text.secondary">
            Select a report type, generate a preview, then export as CSV.
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ my: 2.5 }} />

      {/* Controls */}
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #e7ebf2', borderRadius: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={reportType}
              label="Report Type"
              onChange={(e) => { setReportType(e.target.value as ReportType); setGenerated(false); setError(null) }}
            >
              {REPORT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{o.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{o.description}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {reportType === 'monthly' && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Period</InputLabel>
              <Select value={months} label="Period" onChange={(e) => setMonths(Number(e.target.value))}>
                {[3, 6, 12, 24, 36].map((m) => (
                  <MenuItem key={m} value={m}>{m} months</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              onClick={generate}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AssessmentIcon />}
              sx={{ px: 3 }}
            >
              {loading ? 'Generating…' : 'Generate Report'}
            </Button>

            {generated && reportType !== 'erca' && (
              <Button
                variant="outlined"
                startIcon={<DownloadOutlinedIcon />}
                onClick={() => downloadCsvUrl(csvPath(reportType, safeMonths), csvFilename(reportType))}
              >
                Export CSV
              </Button>
            )}
          </Stack>
        </Stack>

        {selectedOption && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            <strong>{selectedOption.label}</strong> — {selectedOption.description}
          </Typography>
        )}
      </Paper>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Report preview */}
      {generated && !loading && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" fontWeight={800}>{selectedOption.label}</Typography>
            <Chip label={`Generated ${new Date().toLocaleTimeString()}`} size="small" color="success" variant="outlined" />
          </Stack>

          {reportType === 'monthly' && <MonthlyView rows={monthly} />}
          {reportType === 'outstanding' && <OutstandingView rows={outstanding} />}
          {reportType === 'default' && <DefaultView totals={defaultRate} />}
          {reportType === 'methods' && <MethodsView rows={methods} />}
          {reportType === 'withdrawals' && <WithdrawalsView rows={withdrawals} />}
        </Box>
      )}

      {!generated && !loading && !error && (
        <Paper elevation={0} sx={{ p: 6, border: '1px dashed #d0d7e2', borderRadius: 3, textAlign: 'center' }}>
          <AssessmentIcon sx={{ fontSize: 56, color: '#c5cdd8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">Select a report type and click Generate Report</Typography>
          <Typography variant="body2" color="text.secondary">Charts and data tables will appear here</Typography>
        </Paper>
      )}
    </Box>
  )
}
