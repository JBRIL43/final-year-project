import { ReactNode, useState } from 'react'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
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
  History as HistoryIcon,
  ManageAccounts as ManageAccountsIcon,
  ExitToApp as ExitToAppIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const drawerWidth = 270

interface NavLinkItem {
  type: 'link'
  label: string
  to: string
  icon: ReactNode
}

interface NavGroupItem {
  type: 'group'
  label: string
  icon: ReactNode
  id: string
  items: { label: string; to: string; icon: ReactNode }[]
}

type NavItem = NavLinkItem | NavGroupItem

function buildNavItems(role: string): NavItem[] {
  if (role === 'registrar') {
    return [
      { type: 'link', label: 'Student Clearance & Status', to: '/registrar', icon: <AccountBalanceIcon /> },
      { type: 'link', label: 'Graduate Management', to: '/graduates', icon: <SchoolIcon /> },
    ]
  }

  if (role === 'department_head') {
    return [
      { type: 'link', label: 'Department Dashboard', to: '/department', icon: <ApartmentIcon /> },
      { type: 'link', label: 'Cost Configuration', to: '/cost-config', icon: <ReceiptLongIcon /> },
    ]
  }

  if (role === 'finance') {
    return [
      { type: 'link', label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
      {
        type: 'group',
        label: 'Students & Graduates',
        icon: <SchoolIcon />,
        id: 'students_graduates',
        items: [
          { label: 'Student Financial Data', to: '/manage-users', icon: <SchoolIcon /> },
          { label: 'Delinquent Graduates', to: '/graduates/delinquent', icon: <WarningIcon /> },
        ],
      },
      {
        type: 'group',
        label: 'Approvals & Config',
        icon: <AccountBalanceIcon />,
        id: 'approvals_config',
        items: [
          { label: 'Payment Review', to: '/payment-review', icon: <ReceiptLongIcon /> },
          { label: 'Withdrawal Approvals', to: '/withdrawal-approvals', icon: <ExitToAppIcon /> },
          { label: 'Semester Amounts', to: '/semester-amounts', icon: <ReceiptLongIcon /> },
        ],
      },
      {
        type: 'group',
        label: 'Reports & Export',
        icon: <DescriptionIcon />,
        id: 'reports_export',
        items: [
          { label: 'ERCA Export', to: '/erca-export', icon: <DescriptionIcon /> },
          { label: 'Finance Reports', to: '/finance-reports', icon: <DescriptionIcon /> },
        ],
      },
    ]
  }

  return [
    { type: 'link', label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
    {
      type: 'group',
      label: 'User Management',
      icon: <ManageAccountsIcon />,
      id: 'user_management',
      items: [
        { label: 'Student Management', to: '/manage-users', icon: <SchoolIcon /> },
        { label: 'User Administration', to: '/admin-users', icon: <ManageAccountsIcon /> },
      ],
    },
    {
      type: 'group',
      label: 'System Operations',
      icon: <HubIcon />,
      id: 'system_ops',
      items: [
        { label: 'Fayda Integration', to: '/fayda', icon: <HubIcon /> },
        { label: 'Database Health', to: '/database-health', icon: <MonitorHeartIcon /> },
        { label: 'System Logs', to: '/system-logs', icon: <HistoryIcon /> },
      ],
    },
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
  const { user, role, logout } = useAuth()
  const email = user?.email || 'adminstudent@hu.edu.et'
  const displayName = user?.displayName || email.split('@')[0] || 'Admin'
  const navItems = buildNavItems(role)
  const roleLabel = getRoleLabel(role)
  const location = useLocation()
  const navigate = useNavigate()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const isMenuOpen = Boolean(anchorEl)

  const handleAccountClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleEditProfile = () => {
    handleMenuClose()
    navigate('/profile')
  }

  const handleChangePassword = () => {
    handleMenuClose()
    navigate('/change-password')
  }

  const isGroupActive = (group: NavGroupItem) => {
    return group.items.some((item) => {
      if (item.to === '/') {
        return location.pathname === '/' || location.pathname === '/reports'
      }
      return location.pathname.startsWith(item.to)
    })
  }

  const handleGroupClick = (groupId: string) => {
    setOpenGroups((prev) => {
      const currentVal = prev[groupId]
      const defaultVal = (() => {
        const group = navItems.find((item) => item.type === 'group' && item.id === groupId) as NavGroupItem | undefined
        return group ? isGroupActive(group) : false
      })()
      const isCurrentlyOpen = currentVal !== undefined ? currentVal : defaultVal
      return {
        ...prev,
        [groupId]: !isCurrentlyOpen,
      }
    })
  }

  const handleLogout = async () => {
    handleMenuClose()
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

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
          {navItems.map((item) => {
            if (item.type === 'link') {
              return (
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
              )
            } else {
              const isOpen = openGroups[item.id] !== undefined ? openGroups[item.id] : isGroupActive(item)
              return (
                <Box key={item.id} sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() => handleGroupClick(item.id)}
                    sx={{
                      borderRadius: 3,
                      px: 1.5,
                      py: 1.25,
                      color: '#4d586b',
                      bgcolor: isOpen ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
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
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit sx={{ pl: 2.5 }}>
                    <List component="div" disablePadding sx={{ mt: 0.5 }}>
                      {item.items.map((subItem) => (
                        <ListItemButton
                          key={subItem.to}
                          component={NavLink}
                          to={subItem.to}
                          sx={{
                            mb: 0.5,
                            borderRadius: 3,
                            px: 1.5,
                            py: 1,
                            color: '#64748b',
                            '&.active': {
                              bgcolor: '#dce9ff',
                              color: '#2f67dc',
                              '& .MuiListItemIcon-root': { color: '#2f67dc' },
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 32, color: 'inherit', '& .MuiSvgIcon-root': { fontSize: 18 } }}>
                            {subItem.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.label}
                            sx={{
                              '& .MuiListItemText-primary': {
                                fontWeight: 600,
                                fontSize: 13.5,
                              },
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              )
            }
          })}
        </List>

        <Divider sx={{ my: 2, borderColor: '#e7ebf2' }} />

        <Box sx={{ px: 1 }}>
          <Typography variant="overline" sx={{ color: '#8e98aa', letterSpacing: 1.1, fontWeight: 700 }}>
            Account
          </Typography>
          <Paper
            elevation={0}
            onClick={handleAccountClick}
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 3,
              border: '1px solid #e7ebf2',
              bgcolor: '#fff',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              '&:hover': {
                bgcolor: '#f8fafc',
                borderColor: '#cbd5e1',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: '#e5edff', color: '#1d4ed8', fontWeight: 800 }}>
                {getInitials(displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                  {email}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {roleLabel}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Menu
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            slotProps={{
              paper: {
                sx: {
                  width: 238,
                  borderRadius: 3,
                  mt: -1,
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.1)',
                  border: '1px solid #e2e8f0',
                  p: 0.5,
                }
              }
            }}
          >
            <MenuItem onClick={handleEditProfile} sx={{ borderRadius: 2, py: 1.25, px: 2, fontWeight: 600, fontSize: 14 }}>
              Edit Profile
            </MenuItem>
            <MenuItem onClick={handleChangePassword} sx={{ borderRadius: 2, py: 1.25, px: 2, fontWeight: 600, fontSize: 14 }}>
              Change Password
            </MenuItem>
            <Divider sx={{ my: 1, borderColor: '#e2e8f0' }} />
            <MenuItem onClick={handleLogout} sx={{ borderRadius: 2, py: 1.25, px: 2, color: 'error.main', fontWeight: 600, fontSize: 14 }}>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, px: 4, py: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <IconButton
            color="inherit"
            sx={{
              bgcolor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e7ebf2',
              borderRadius: 3,
              p: 1.25,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            <Badge color="error" badgeContent={4}>
              <NotificationsNoneIcon sx={{ color: '#f59e0b' }} />
            </Badge>
          </IconButton>
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