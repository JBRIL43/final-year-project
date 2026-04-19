import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import api from '../services/api'

interface ErcaDebtor {
  full_name: string
  student_number: string
  email: string
  phone: string
  tin: string
  total_debt: number
  program: string
  campus: string
  graduation_date: string
  repayment_start_date: string
}

export default function ErcaExportDashboard() {
  const [debtors, setDebtors] = useState<ErcaDebtor[]>([])
  const [loading, setLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })

  useEffect(() => {
    loadDebtors()
  }, [])

  const loadDebtors = async () => {
    setLoading(true)

    try {
      const res = await api.get<{ success: true; ercaDebtors: ErcaDebtor[]; generatedAt: string }>(
        '/api/admin/erca/debtors'
      )
      setDebtors(res.data.ercaDebtors)
      setGeneratedAt(res.data.generatedAt)
    } catch (error) {
      console.error('Failed to load ERCA debtors', error)
      setSnackbar({ open: true, message: 'Failed to load debtor list', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const formatETB = (amount: number) =>
    new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-ET')
  }

  const exportToCSV = () => {
    if (debtors.length === 0) return

    const headers = [
      'Full Name',
      'Student ID',
      'Email',
      'Phone',
      'TIN',
      'Total Debt (ETB)',
      'Program',
      'Campus',
      'Graduation Date',
      'Repayment Start Date',
    ]

    const csvContent = [
      headers.join(','),
      ...debtors.map((debtor) =>
        [
          `"${debtor.full_name}"`,
          `"${debtor.student_number}"`,
          `"${debtor.email}"`,
          `"${debtor.phone || ''}"`,
          `"${debtor.tin || ''}"`,
          debtor.total_debt,
          `"${debtor.program}"`,
          `"${debtor.campus}"`,
          `"${formatDate(debtor.graduation_date)}"`,
          `"${formatDate(debtor.repayment_start_date)}"`,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ERCA_Debtors_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
            ERCA Debtor List Export
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review overdue graduates and download a CSV for ERCA submission.
          </Typography>
        </Box>
        <Button variant="contained" onClick={exportToCSV} disabled={loading || debtors.length === 0}>
          Download CSV
        </Button>
      </Box>

      {loading ? (
        <Alert severity="info">Loading debtor list...</Alert>
      ) : debtors.length === 0 ? (
        <Alert severity="info">No delinquent graduates found for ERCA submission.</Alert>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Generated at: {new Date(generatedAt).toLocaleString('en-ET')}
          </Typography>
          <Paper elevation={0} sx={{ border: '1px solid #e7ebf2', borderRadius: 3, overflow: 'hidden' }}>
            <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>TIN</TableCell>
                    <TableCell>Debt</TableCell>
                    <TableCell>Program</TableCell>
                    <TableCell>Campus</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {debtors.map((debtor, index) => (
                    <TableRow key={`${debtor.student_number}-${index}`} hover>
                      <TableCell>{debtor.full_name}</TableCell>
                      <TableCell>{debtor.student_number}</TableCell>
                      <TableCell>{debtor.email}</TableCell>
                      <TableCell>{debtor.phone || '-'}</TableCell>
                      <TableCell>{debtor.tin || '-'}</TableCell>
                      <TableCell>{formatETB(Number(debtor.total_debt || 0))}</TableCell>
                      <TableCell>{debtor.program}</TableCell>
                      <TableCell>{debtor.campus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
