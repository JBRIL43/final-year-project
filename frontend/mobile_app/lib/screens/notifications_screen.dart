import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/notification_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  Timer? _pollTimer;

  int? _parseNotificationId(dynamic value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value);
    return int.tryParse(value?.toString() ?? '');
  }

  @override
  void initState() {
    super.initState();
    _loadNotifications();
    // Poll every 15s so new notifications appear quickly
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) _loadNotifications(silent: true);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadNotifications({bool silent = false}) async {
    if (!silent) setState(() => _isLoading = true);
    try {
      final items = await NotificationService.getNotifications();
      if (mounted) setState(() => _notifications = items);
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading notifications: $e')),
        );
      }
    } finally {
      if (mounted && !silent) setState(() => _isLoading = false);
    }
  }

  Future<void> _markRead(int id) async {
    try {
      await NotificationService.markAsRead(id);
      await _loadNotifications();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _delete(int id) async {
    try {
      await NotificationService.deleteNotification(id);
      await _loadNotifications();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, h:mm a');
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Mark all read',
            icon: const Icon(Icons.done_all),
            onPressed: () async {
              await NotificationService.markAllRead();
              await _loadNotifications();
            },
          ),
          IconButton(
            tooltip: 'Clear all',
            icon: const Icon(Icons.delete_sweep_outlined),
            onPressed: () async {
              await NotificationService.clearAll();
              await _loadNotifications();
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadNotifications,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notifications.isEmpty
          ? const Center(child: Text('No notifications yet'))
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: _notifications.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final item = _notifications[index] as Map<String, dynamic>;
                  final notificationId = _parseNotificationId(
                    item['notification_id'],
                  );
                  final isRead = item['is_read'] == true;
                  final createdAt = DateTime.tryParse(
                    item['created_at'].toString(),
                  );
                  final title = item['title']?.toString() ?? 'Notification';
                  final body = item['body']?.toString() ?? '';

                  return Dismissible(
                    key: ValueKey(item['notification_id']),
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20),
                      color: Colors.red[400],
                      child: const Icon(Icons.delete, color: Colors.white),
                    ),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) async {
                      if (notificationId != null) {
                        await _delete(notificationId);
                      }
                      return false;
                    },
                    child: Card(
                      child: ListTile(
                        onTap: isRead
                            ? null
                            : notificationId == null
                            ? null
                            : () => _markRead(notificationId),
                        leading: CircleAvatar(
                          backgroundColor: isRead
                              ? Colors.grey[300]
                              : Colors.green[100],
                          child: Icon(
                            isRead
                                ? Icons.notifications_none
                                : Icons.notifications_active,
                            color: isRead
                                ? Colors.grey[700]
                                : Colors.green[800],
                          ),
                        ),
                        title: Text(
                          title,
                          style: TextStyle(
                            fontWeight: isRead
                                ? FontWeight.normal
                                : FontWeight.bold,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text(body),
                            const SizedBox(height: 6),
                            Text(
                              createdAt != null
                                  ? dateFormat.format(createdAt)
                                  : '',
                              style: TextStyle(
                                color: Colors.grey[600],
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                        trailing: isRead
                            ? const Icon(Icons.done, color: Colors.green)
                            : const Icon(
                                Icons.brightness_1,
                                size: 10,
                                color: Colors.green,
                              ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
