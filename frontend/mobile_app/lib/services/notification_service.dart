import 'dart:convert';

import 'api_client.dart';

class NotificationService {
  static Future<List<dynamic>> getNotifications() async {
    final response = await ApiClient.getWithAuth('/api/notifications');
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['notifications'] as List<dynamic>? ?? [];
  }

  static Future<void> markAsRead(int notificationId) async {
    await ApiClient.patchWithAuth('/api/notifications/$notificationId/read');
  }

  static Future<void> markAllAsRead() async {
    await ApiClient.patchWithAuth('/api/notifications/read-all');
  }

  static Future<void> markAllRead() => markAllAsRead();

  static Future<void> deleteNotification(int notificationId) async {
    await ApiClient.deleteWithAuth('/api/notifications/$notificationId');
  }

  static Future<void> deleteAll() async {
    await ApiClient.deleteWithAuth('/api/notifications');
  }

  static Future<void> clearAll() => deleteAll();
}
