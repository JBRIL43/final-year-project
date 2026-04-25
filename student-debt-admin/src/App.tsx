import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PaymentReviewQueue from './components/PaymentReviewQueue'
import StudentManagement from './components/StudentManagement'
import CostManagement from './components/CostManagement'
import GraduateManagement from './components/GraduateManagement'
import DelinquentGraduates from './components/DelinquentGraduates'
import ErcaExportDashboard from './components/ErcaExportDashboard'
import RegistrarDashboard from './components/RegistrarDashboard'
import DepartmentDashboard from './components/DepartmentDashboard'
import ChangePassword from './components/ChangePassword'
import FaydaIntegrationDashboard from './components/FaydaIntegrationDashboard'
import SemesterAmountsDashboard from './components/SemesterAmountsDashboard'

function AppRoutes() {
  const { loading, role } = useAuth()

  const roleHome =
    role === 'registrar'
      ? '/registrar'
      : role === 'department_head'
      ? '/department'
      : role === 'student'
      ? '/login'
      : '/'
  const defaultHome =
    role === 'registrar'
      ? '/registrar'
      : role === 'department_head'
      ? '/department'
      : role === 'student'
      ? '/login'
      : '/reports'

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={defaultHome} replace />} />
        <Route
          path="students"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="manage-users"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="user-list"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="sis-import"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <StudentManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="cost-config"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <CostManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="semester-amounts"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <SemesterAmountsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="graduates"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <GraduateManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="registrar"
          element={
            <ProtectedRoute allowedRoles={['admin', 'registrar']}>
              <RegistrarDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="department"
          element={
            <ProtectedRoute allowedRoles={['admin', 'department_head']}>
              <DepartmentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="graduates/delinquent"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <DelinquentGraduates />
            </ProtectedRoute>
          }
        />
        <Route
          path="erca-export"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <ErcaExportDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment-review"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <PaymentReviewQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="fayda"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <FaydaIntegrationDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="fayda-integration"
          element={
            <ProtectedRoute allowedRoles={['admin', 'finance']}>
              <FaydaIntegrationDashboard />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={roleHome} replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  )
}

export default App
