import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ExitToAppIcon from '@mui/icons-material/ExitToApp'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import api from '../services/api'

const fmt = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  minimumFractionDigits: 2,
})

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: '2-digit' }) : '—'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingWithdrawal {
  student_id: number
  student_number: string
  full_name: string
  department: string
  campus: string
  withdrawal_requested_at: string | null
  withdrawal_status: string | null
  finance_withdrawal_approved: boolean | null
  current_balance: number | null
}

interface StatementStudent {
  studentId: number
  studentNumber: string
  fullName: string
  department: string
  campus: string
  enrollmentStatus: string
  paymentModel: string
}

interface SemesterStatement {
  type: 'semester'
  academicYear: string | null
  tuitionFullCost: number
  tuitionSharePercent: number
  tuitionStudentShare: number
  boardingCost: number
  foodCostMonthly: number
  foodCostAnnual: number
  totalObligation: number
  totalPaid: number
  currentBalance: number
  isCleared: boolean
}

interface WithdrawalStatement {
  type: 'withdrawal'
  withdrawalRequestedAt: string | null
  enrollmentDate: string | null
  daysEnrolled: number
  monthsEnrolled: number
  proratedTuition: number
  proratedBoarding: number
  proratedFood: number
  settlementAmount: number
  totalPaid: number
  settlementBalance: number
  isSettled: boolean
}

type Statement = SemesterStatement | WithdrawalStatement

interface StatementResponse {
  success: boolean
  student: StatementStudent
  statement: Statement
  payments: PaymentRow[]
  generatedAt: string
}

interface PaymentRow {
  payment_id: number
  amount: number
  payment_method: string
  transaction_ref: string
  status: string
  payment_date: string
}

// ─── Statement Dialog ─────────────────────────────────────────────────────────

function StatementDialog({
  studentId,
  studentName,
  onClose,
  onApprove,
}: {
  studentId: number
  studentName: string
  onClose: () => void
  onApprove: () => void
}) {
  const [tab, setTab] = useState<'semester' | 'withdrawal'>('semester')
  const [data, setData] = useState<StatementResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async (type: 'semester' | 'withdrawal') => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<StatementResponse>(
        `/api/registrar/students/${studentId}/financial-statement?type=${type}`
      )
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load statement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const statement = data?.statement
  const student = data?.student
  const payments = data?.payments ?? []

  const canApprove =
    statement != null &&
    (statement.type === 'semester'
      ? (statement as SemesterStatement).currentBalance <= 0
      : (statement as WithdrawalStatement).settlementBalance <= 0)

  const balanceValue =
    statement == null
      ? null
      : statement.type === 'semester'
      ? (statement as SemesterStatement).currentBalance
      : (statement as WithdrawalStatement).settlementBalance

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#1b56bc', color: '#fff' }}>
        <DescriptionOutlinedIcon />
        Financial Statement — {studentName}
      </DialogTitle>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Semester Statement" value="semester" />
          <Tab label="Withdrawal Settlement" value="withdrawal" />
        </Tabs>
      </Box>

      <DialogContent sx={{ minHeight: 360 }}>
        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress /></Box>}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && statement && student && (
          <Stack spacing={2}>
            {/* Student info */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Student</Typography>
              <Typography fontWeight={700}>{student.fullName}</Typography>
              <Typography variant="body2" color="text.secondary">
                {student.studentNumber} · {student.department} · {student.campus}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {student.enrollmentStatus} · Model: {student.paymentModel}
              </Typography>
            </Paper>

            {/* Statement rows */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              {statement.type === 'semester' ? (
                <SemesterRows s={statement as SemesterStatement} />
              ) : (
                <WithdrawalRows s={statement as WithdrawalStatement} />
              )}
            </Paper>

            {/* Balance summary */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: canApprove ? '#f0fdf4' : '#fff7ed',
                borderColor: canApprove ? '#86efac' : '#fdba74',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={700}>
                  {statement.type === 'semester' ? 'Current Balance' : 'Settlement Balance Due'}
                </Typography>
                <Typography
                  fontWeight={800}
                  fontSize={18}
                  color={canApprove ? 'success.main' : 'error.main'}
                >
                  {fmt.format(balanceValue ?? 0)}
                </Typography>
              </Stack>
              {canApprove ? (
                <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
                  ✓ Balance cleared — eligible for finance approval
                </Typography>
              ) : (
                <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                  Student must pay {fmt.format(balanceValue ?? 0)} before approval
                </Typography>
              )}
            </Paper>

            {/* Payment history */}
            {payments.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Payment History
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Ref</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments.map((p) => {
                        const s = p.status?.toUpperCase()
                        return (
                          <TableRow key={p.payment_id}>
                            <TableCell>{fmtDate(p.payment_date)}</TableCell>
                            <TableCell>{fmt.format(Number(p.amount))}</TableCell>
                            <TableCell>{p.payment_method}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.transaction_ref}</TableCell>
                            <TableCell>
                              <Chip
                                label={s}
                                size="small"
                                color={
                                  s === 'SUCCESS' || s === 'APPROVED'
                                    ? 'success'
                                    : s === 'PENDING'
                                    ? 'warning'
                                    : 'error'
                                }
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button
          onClick={onApprove}
          variant="contained"
          color="success"
          disabled={!canApprove}
          startIcon={<CheckCircleIcon />}
        >
          Approve Withdrawal
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400}>{value}</Typography>
    </Stack>
  )
}

function SemesterRows({ s }: { s: SemesterStatement }) {
  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Semester Breakdown</Typography>
      <Row label="Academic Year" value={s.academicYear ?? 'N/A'} />
      <Row label="Full Tuition Cost" value={fmt.format(s.tuitionFullCost)} />
      <Row label={`Student Share (${s.tuitionSharePercent}%)`} value={fmt.format(s.tuitionStudentShare)} />
      <Row label="Boarding" value={fmt.format(s.boardingCost)} />
      <Row label="Food (Annual)" value={fmt.format(s.foodCostAnnual)} />
      <Divider sx={{ my: 1 }} />
      <Row label="Total Obligation" value={fmt.format(s.totalObligation)} bold />
      <Row label="Total Paid" value={fmt.format(s.totalPaid)} />
    </>
  )
}

function WithdrawalRows({ s }: { s: WithdrawalStatement }) {
  return (
    <>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>Withdrawal Settlement</Typography>
      <Row label="Withdrawal Requested" value={fmtDate(s.withdrawalRequestedAt)} />
      <Row label="Enrollment Date" value={fmtDate(s.enrollmentDate)} />
      <Row label="Days Enrolled" value={`${s.daysEnrolled} days`} />
      <Divider sx={{ my: 1 }} />
      <Row label="Prorated Tuition" value={fmt.format(s.proratedTuition)} />
      <Row label="Prorated Boarding" value={fmt.format(s.proratedBoarding)} />
      <Row label="Prorated Food" value={fmt.format(s.proratedFood)} />
      <Divider sx={{ my: 1 }} />
      <Row label="Settlement Amount" value={fmt.format(s.settlementAmount)} bold />
      <Row label="Total Paid" value={fmt.format(s.totalPaid)} />
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WithdrawalApprovalDashboard() {
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statementFor, setStatementFor] = useState<PendingWithdrawal | null>(null)
  const [approving, setApproving] = useState<number | null>(null)
  const [notifying, setNotifying] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{ success: boolean; withdrawals: PendingWithdrawal[] }>(
        '/api/registrar/withdrawals/pending-finance'
      )
      setWithdrawals(res.data.withdrawals ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to load pending withdrawals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (studentId: number, name: string) => {
    setApproving(studentId)
    setStatementFor(null)
    try {
      await api.post(`/api/registrar/students/${studentId}/withdrawal/finance-approve`)
      setSnackbar({ open: true, message: `Withdrawal approved for ${name}`, severity: 'success' })
      load()
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.response?.data?.error || 'Approval failed',
        severity: 'error',
      })
    } finally {
      setApproving(null)
    }
  }

  const handleNotify = async (studentId: number, name: string) => {
    setNotifying(studentId)
    try {
      await api.post(`/api/registrar/students/${studentId}/withdrawal/notify-payment`)
      setSnackbar({
        open: true,
        message: `Payment reminder sent to ${name}`,
        severity: 'success',
      })
    } catch (e: any) {
      setSnackbar({
        open: true,
        message: e?.response?.data?.error || 'Failed to send notification',
        severity: 'error',
      })
    } finally {
      setNotifying(null)
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 0.5 }}>
            Withdrawal Approvals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review financial statements and approve withdrawals after confirming full payment.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={load} sx={{ mt: { xs: 1, md: 0 } }}>
          Refresh
        </Button>
      </Stack>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && !error && withdrawals.length === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid #e7ebf2', borderRadius: 3, p: 5, textAlign: 'center' }}
        >
          <ExitToAppIcon sx={{ fontSize: 56, color: '#c5cdd8', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">No pending withdrawals</Typography>
          <Typography variant="body2" color="text.secondary">
            All department-approved withdrawals have been processed by finance.
          </Typography>
        </Paper>
      )}

      {!loading && withdrawals.length > 0 && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f7f9fc' }}>
                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Payment Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {withdrawals.map((w) => {
                const balance = Number(w.current_balance ?? 0)
                const isPaid = balance <= 0
                const isApproving = approving === w.student_id

                return (
                  <TableRow key={w.student_id} hover>
                    <TableCell>
                      <Typography fontWeight={700} variant="body2">{w.full_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{w.student_number}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{w.department}</Typography>
                      <Typography variant="caption" color="text.secondary">{w.campus}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{fmtDate(w.withdrawal_requested_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color={isPaid ? 'success.main' : 'error.main'}
                      >
                        {fmt.format(balance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={isPaid ? 'PAID' : 'BALANCE DUE'}
                        size="small"
                        color={isPaid ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DescriptionOutlinedIcon />}
                          onClick={() => setStatementFor(w)}
                        >
                          Statement
                        </Button>
                        {!isPaid && (
                          <Tooltip title="Send payment reminder notification to student">
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                disabled={notifying === w.student_id}
                                startIcon={
                                  notifying === w.student_id
                                    ? <CircularProgress size={14} color="inherit" />
                                    : <NotificationsActiveIcon />
                                }
                                onClick={() => handleNotify(w.student_id, w.full_name)}
                              >
                                Notify
                              </Button>
                            </span>
                          </Tooltip>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={!isPaid || isApproving}
                          startIcon={isApproving ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                          onClick={() => handleApprove(w.student_id, w.full_name)}
                        >
                          Approve
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {statementFor && (
        <StatementDialog
          studentId={statementFor.student_id}
          studentName={statementFor.full_name}
          onClose={() => setStatementFor(null)}
          onApprove={() => handleApprove(statementFor.student_id, statementFor.full_name)}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  )
}
