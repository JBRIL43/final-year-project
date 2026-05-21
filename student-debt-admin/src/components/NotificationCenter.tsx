import React, { useState } from 'react'
import {
  Badge,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Tooltip,
  Paper,
} from '@mui/material'
import {
  NotificationsNone as NotificationsIcon,
  Circle as CircleIcon,
  DeleteOutlined as DeleteIcon,
  DoneAll as DoneAllIcon,
  ClearAll as ClearAllIcon,
} from '@mui/icons-material'
import { useNotifications, Notification } from '../contexts/NotificationContext'

/**
 * Native "time ago" formatter using Intl.RelativeTimeFormat
 */
function formatTimeAgo(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + ' years ago'
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + ' months ago'
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + ' days ago'
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + ' hours ago'
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + ' minutes ago'
  return 'just now'
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleMarkAsRead = (id: string) => {
    markAsRead(id)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteNotification(id)
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleClick}
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
          <Badge color="error" badgeContent={unreadCount}>
            <NotificationsIcon sx={{ color: '#f59e0b' }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxHeight: 500,
              mt: 1.5,
              borderRadius: 3,
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.1)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={800}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={() => markAllAsRead()}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No notifications yet.
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notif) => (
              <React.Fragment key={notif.notification_id}>
                <ListItem
                  onClick={() => !notif.is_read && handleMarkAsRead(notif.notification_id)}
                  sx={{
                    cursor: notif.is_read ? 'default' : 'pointer',
                    bgcolor: notif.is_read ? 'transparent' : 'rgba(74, 131, 245, 0.04)',
                    '&:hover': {
                      bgcolor: 'rgba(0, 0, 0, 0.02)',
                    },
                    py: 1.5,
                  }}
                  secondaryAction={
                    <IconButton edge="end" size="small" onClick={(e) => handleDelete(e, notif.notification_id)}>
                      <DeleteIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </IconButton>
                  }
                >
                  {!notif.is_read && (
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <CircleIcon sx={{ fontSize: 10, color: '#3b82f6' }} />
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={notif.is_read ? 600 : 800}>
                        {notif.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block" color="text.primary" sx={{ mb: 0.5 }}>
                          {notif.body}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimeAgo(notif.created_at)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}

        <Box sx={{ p: 1, textAlign: 'center' }}>
          {notifications.length > 0 && (
            <Button
              fullWidth
              size="small"
              color="inherit"
              startIcon={<ClearAllIcon />}
              onClick={() => clearAll()}
              sx={{ textTransform: 'none', color: '#64748b' }}
            >
              Clear all
            </Button>
          )}
        </Box>
      </Menu>
    </>
  )
}
