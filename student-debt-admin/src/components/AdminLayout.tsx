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
  Stack,
  Typography,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  School as SchoolIcon,
  ReceiptLong as ReceiptLongIcon,
  NotificationsNone as NotificationsNoneIcon,
} from '@mui/icons-material'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const drawerWidth = 270

const navItems = [
  { label: 'Dashboard', to: '/', icon: <DashboardIcon /> },
  { label: 'Student Management', to: '/students', icon: <SchoolIcon /> },
  { label: 'Payment Review', to: '/payment-review', icon: <ReceiptLongIcon /> },
]

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'AD'
}

export default function AdminLayout({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  const email = user?.email || 'adminstudent@hu.edu.et'
  const displayName = user?.displayName || email.split('@')[0] || 'Admin'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f3f6fb' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: '1px solid #e6ebf2',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
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
              boxShadow: '0 8px 18px rgba(74, 131, 245, 0.25)',
            }}
          >
            HU
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} lineHeight={1.1}>
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hawassa University
            </Typography>
          </Box>
        </Box>

        <Typography variant="overline" sx={{ px: 1, color: 'text.secondary', letterSpacing: 1.1 }}>
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
                color: '#4b5563',
                '&.active': {
                  bgcolor: '#dce9ff',
                  color: '#1d4ed8',
                  '& .MuiListItemIcon-root': { color: '#1d4ed8' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              />
            </ListItemButton>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ px: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 1.1 }}>
            Account
          </Typography>
          <Paper
            elevation={0}
            sx={{
              mt: 1.5,
              p: 1.5,
              borderRadius: 3,
              border: '1px solid #e6ebf2',
              bgcolor: '#fff',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#e5edff', color: '#1d4ed8', fontWeight: 800 }}>
                {getInitials(displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={800} noWrap>
                  {email}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  System Administrator
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: 3,
              border: '1px solid #e6ebf2',
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
              <Typography variant="body2" fontWeight={800}>
                {email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                System Administrator
              </Typography>
            </Box>
            <NotificationsNoneIcon sx={{ color: '#f59e0b' }} />
          </Paper>
        </Box>

        <Box
          sx={{
            maxWidth: 1440,
            mx: 'auto',
          }}
        >
          {children ?? <Outlet />}
        </Box>
      </Box>
    </Box>
  )
}