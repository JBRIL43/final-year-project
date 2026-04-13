const express = require('express');
const pool = require('../config/db');
const {
  ensureNotificationsTable,
} = require('../utils/notifications');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { firebaseUid } = req.query;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'firebaseUid is required' });
    }

    await ensureNotificationsTable();

    const result = await pool.query(
      `SELECT notification_id, firebase_uid, title, body, data, is_read, created_at, updated_at
       FROM public.notifications
       WHERE firebase_uid = $1
       ORDER BY created_at DESC`,
      [firebaseUid]
    );

    const unreadCount = result.rows.filter((row) => !row.is_read).length;

    res.json({
      success: true,
      notifications: result.rows,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
      stack: error.stack,
    });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'firebaseUid is required' });
    }

    await ensureNotificationsTable();

    const result = await pool.query(
      `UPDATE public.notifications
       SET is_read = TRUE, updated_at = NOW()
       WHERE notification_id = $1 AND firebase_uid = $2
       RETURNING notification_id`,
      [notificationId, firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'firebaseUid is required' });
    }

    await ensureNotificationsTable();

    await pool.query(
      `UPDATE public.notifications
       SET is_read = TRUE, updated_at = NOW()
       WHERE firebase_uid = $1 AND is_read = FALSE`,
      [firebaseUid]
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'firebaseUid is required' });
    }

    await ensureNotificationsTable();

    const result = await pool.query(
      `DELETE FROM public.notifications
       WHERE notification_id = $1 AND firebase_uid = $2
       RETURNING notification_id`,
      [notificationId, firebaseUid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({ error: 'firebaseUid is required' });
    }

    await ensureNotificationsTable();

    await pool.query(
      'DELETE FROM public.notifications WHERE firebase_uid = $1',
      [firebaseUid]
    );

    res.json({ success: true, message: 'Notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

module.exports = router;
