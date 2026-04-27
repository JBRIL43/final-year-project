import { ReactNode } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  School as SchoolIcon,
  ReceiptLong as ReceiptLongIcon,
  NotificationsNone as NotificationsNoneIcon,
  Warning as WarningIcon,
  Description as DescriptionIcon,
  AccountBalance as AccountBalanceIcon,
  Apartment as ApartmentIcon,
  LockReset as LockResetIcon,
  Hub as HubIcon,
  MonitorHeart as MonitorHeartIcon,
  ManageAccounts as ManageAccountsIcon,
} from '@mui/icons-material'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const drawerWidth = 270

function buildNavItems(role: string) {
  if (role === 'registrar') {
    return [
      { label: 'Student Clearance & Status', to: '/registrar', icon: <AccountBalanceIcon /> },
      { label: 'Change Password', to: '/change-password', icon: <LockResetIcon /> },
    ]
  }

  if (role === 'department_head') {
    return [
      { label: 'Department Dashboard', to: '/department', icon: <ApartmentIcon /> },
      { label: 'Change Password', to: '/change-password', icon: <LockResetIcon /> },
    ]
  }

  if (role === 'finance') {
    return [
      { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
      { label: 'Student Financial Data', to: '/manage-users', icon: <SchoolIcon /> },
      { label: 'Delinquent Graduates', to: '/graduates/delinquent', icon: <WarningIcon /> },
      { label: 'Payment Review', to: '/payment-review', icon: <ReceiptLongIcon /> },
      { label: 'Semester Amounts', to: '/semester-amounts', icon: <ReceiptLongIcon /> },
      { label: 'ERCA Export', to: '/erca-export', icon: <DescriptionIcon /> },
      { label: 'Fayda Integration', to: '/fayda', icon: <HubIcon /> },
      { label: 'Database Health', to: '/database-health', icon: <MonitorHeartIcon /> },
      { label: 'Change Password', to: '/change-password', icon: <LockResetIcon /> },
    ]
  }

  return [
    { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
    { label: 'Graduate Management', to: '/graduates', icon: <SchoolIcon /> },
    { label: 'Student Management', to: '/manage-users', icon: <SchoolIcon /> },
    { label: 'User Administration', to: '/admin-users', icon: <ManageAccountsIcon /> },
    { label: 'Delinquent Graduates', to: '/graduates/delinquent', icon: <WarningIcon /> },
    { label: 'Registrar Clearance', to: '/registrar', icon: <AccountBalanceIcon /> },
    // { label: 'Department Dashboard', to: '/department', icon: <ApartmentIcon /> },
    { label: 'Cost Configuration', to: '/cost-config', icon: <ReceiptLongIcon /> },
    { label: 'Semester Amounts', to: '/semester-amounts', icon: <ReceiptLongIcon /> },
    { label: 'Payment Review', to: '/payment-review', icon: <ReceiptLongIcon /> },
    { label: 'ERCA Export', to: '/erca-export', icon: <DescriptionIcon /> },
    { label: 'Fayda Integration', to: '/fayda', icon: <HubIcon /> },
    { label: 'Database Health', to: '/database-health', icon: <MonitorHeartIcon /> },
    { label: 'Change Password', to: '/change-password', icon: <LockResetIcon /> },
  ]
}

function getRoleLabel(role: string) {
  if (role === 'finance') return 'Finance Officer'
  if (role === 'registrar') return 'Registrar'
  if (role === 'department_head') return 'Department Head'
  if (role === 'admin') return 'System Administrator'
  return 'User'
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'AD'
}

export default function AdminLayout({ children }: { children?: ReactNode }) {
  const { user, role } = useAuth()
  const email = user?.email || 'adminstudent@hu.edu.et'
  const displayName = user?.displayName || email.split('@')[0] || 'Admin'
  const navItems = buildNavItems(role)
  const roleLabel = getRoleLabel(role)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f1f4f9' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e7ebf2',
            background: '#f7f9fc',
            px: 2,
            py: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              bgcolor: '#4a83f5',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              boxShadow: '0 8px 18px rgba(74, 131, 245, 0.18)',
            }}
          >
            HU
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hawassa University
            </Typography>
          </Box>
        </Box>

        <Typography variant="overline" sx={{ px: 1, color: '#8e98aa', letterSpacing: 1.1, fontWeight: 700 }}>
          Navigation
        </Typography>

        <List sx={{ mt: 1 }}>
          {navItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.to === '/'}
              sx={{
                mb: 1,
                borderRadius: 3,
                px: 1.5,
                py: 1.25,
                color: '#4d586b',
                '&.active': {
                  bgcolor: '#dce9ff',
                  color: '#2f67dc',
                  '& .MuiListItemIcon-root': { color: '#2f67dc' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontWeight: 700,
                    fontSize: 15,
                  },
                }}
              />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 2, borderColor: '#e7ebf2' }} />

        <Box sx={{ px: 1 }}>
          <Typography variant="overline" sx={{ color: '#8e98aa', letterSpacing: 1.1, fontWeight: 700 }}>
            Account
          </Typography>
          <Paper
            elevation={0}
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 3,
              border: '1px solid #e7ebf2',
              bgcolor: '#fff',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: '#e5edff', color: '#1d4ed8', fontWeight: 800 }}>
                {getInitials(displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                  {email}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {roleLabel}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, px: 4, py: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 3,
              border: '1px solid #e7ebf2',
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              bgcolor: 'rgba(255,255,255,0.95)',
            }}
          >
            <Badge color="error" badgeContent={4} overlap="circular">
              <Avatar sx={{ bgcolor: '#f4f7ff', color: '#4a83f5', fontWeight: 800 }}>
                {getInitials(displayName)}
              </Avatar>
            </Badge>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                {email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {roleLabel}
              </Typography>
            </Box>
            <NotificationsNoneIcon sx={{ color: '#f59e0b' }} />
          </Paper>
        </Box>

        <Box
          sx={{
            maxWidth: 1180,
            mr: 'auto',
          }}
        >
          {children ?? <Outlet />}
        </Box>
      </Box>
    </Box>
  )
}