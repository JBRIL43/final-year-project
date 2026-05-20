import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined'
import api from '../services/api'

type SystemLogRow = {
  id: number
  occurred_at: string
  request_id: string | null
  http_method: string | null
  http_path: string | null
  status_code: number | null
  actor_user_id: number | null
  actor_email: string | null
  actor_role: string | null
  category: string
  action: string
  severity: string
  success: boolean
  error_message: string | null
  entity_type: string | null
  entity_id: string | null
}

type LogSummary = {
  windowHours: number
  totals: { total: number; failures: number; errors: number }
  byCategory: Array<{ category: string; count: number }>
  recentErrors: Array<{
    id: number
    occurred_at: string
    action: string
    actor_email: string | null
    http_path: string | null
    status_code: number | null
    error_message: string | null
  }>
}

type LogDetail = SystemLogRow & {
  ip: string | null
  user_agent: string | null
  old_value: unknown
  new_value: unknown
  metadata: Record<string, unknown>
}

const CATEGORIES = ['', 'auth', 'payment', 'student', 'user', 'admin', 'finance', 'withdrawal', 'fayda', 'system']

export default function SystemLogsDashboard() {
  const [logs, setLogs] = useState<SystemLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null)

  const [category, setCategory] = useState('')
  const [action, setAction] = useState('')
  const [actorEmail, setActorEmail] = useState('')
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState<'' | 'true' | 'false'>('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 })

  const loadSummary = useCallback(async () => {
    const res = await api.get<{ success: boolean } & LogSummary>('/api/admin/system-logs/summary', {
      params: { hours: 24 },
    })
    setSummary(res.data)
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<{
        success: boolean
        total: number
        logs: SystemLogRow[]
      }>('/api/admin/system-logs', {
        params: {
          limit: paginationModel.pageSize,
          offset: paginationModel.page * paginationModel.pageSize,
          category: category || undefined,
          action: action || undefined,
          actorEmail: actorEmail || undefined,
          search: search || undefined,
          success: successFilter || undefined,
        },
      })
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        || (status === 404
          ? 'System logs API is not available on this server. Deploy the latest backend (systemLogRoutes) to Render.'
          : 'Failed to load system logs')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [paginationModel, category, action, actorEmail, search, successFilter])

  useEffect(() => {
    loadSummary().catch(() => {})
  }, [loadSummary])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const openDetail = async (id: number) => {
    try {
      const res = await api.get<{ success: boolean; log: LogDetail }>(`/api/admin/system-logs/${id}`)
      setSelectedLog(res.data.log)
    } catch {
      setError('Failed to load log details')
    }
  }

  const columns: GridColDef<SystemLogRow>[] = [
    {
      field: 'occurred_at',
      headerName: 'Time',
      flex: 1,
      minWidth: 170,
      valueFormatter: (value) => new Date(String(value)).toLocaleString('en-ET'),
    },
    { field: 'action', headerName: 'Action', flex: 1.2, minWidth: 180 },
    { field: 'category', headerName: 'Category', width: 110 },
    { field: 'actor_email', headerName: 'Actor', flex: 1, minWidth: 160 },
    { field: 'http_method', headerName: 'Method', width: 80 },
    { field: 'status_code', headerName: 'Status', width: 80 },
    {
      field: 'success',
      headerName: 'OK',
      width: 80,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'error'}
        />
      ),
    },
    {
      field: 'details',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Button size="small" onClick={() => openDetail(params.row.id)}>
          View
        </Button>
      ),
    },
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: 'center' }}>
        <HistoryOutlinedIcon color="primary" />
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          System Activity Logs
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        All API mutations and security-relevant events are recorded in the database. Admins can
        search, filter, and audit who did what and when.
      </Typography>

      {summary && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <Paper sx={{ p: 2, flex: 1, borderRadius: 3 }}>
            <Typography variant="overline">Last {summary.windowHours}h</Typography>
            <Typography variant="h5" fontWeight={700}>
              {summary.totals.total} events
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {summary.totals.failures} failed · {summary.totals.errors} errors
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 2, borderRadius: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              By category
            </Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {summary.byCategory.map((item) => (
                <Chip key={item.category} label={`${item.category}: ${item.count}`} size="small" />
              ))}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Paper sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            label="Search"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <MenuItem key={c || 'all'} value={c}>
                  {c || 'All'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Action contains"
            size="small"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <TextField
            label="Actor email"
            size="small"
            value={actorEmail}
            onChange={(e) => setActorEmail(e.target.value)}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Success</InputLabel>
            <Select
              label="Success"
              value={successFilter}
              onChange={(e) => setSuccessFilter(e.target.value as '' | 'true' | 'false')}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Success</MenuItem>
              <MenuItem value="false">Failed</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={() => { setPaginationModel((p) => ({ ...p, page: 0 })); loadLogs() }}>
            Apply
          </Button>
          <Button variant="outlined" onClick={loadLogs}>
            Refresh
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 520, borderRadius: 3 }}>
        <DataGrid
          rows={logs}
          columns={columns}
          getRowId={(row) => row.id}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Paper>

      <Dialog open={Boolean(selectedLog)} onClose={() => setSelectedLog(null)} maxWidth="md" fullWidth>
        <DialogTitle>Log #{selectedLog?.id}</DialogTitle>
        <DialogContent dividers>
          {selectedLog && (
            <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, m: 0 }}>
              {JSON.stringify(selectedLog, null, 2)}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
