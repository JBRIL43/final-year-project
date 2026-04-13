import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class NotificationService {
  static Future<List<dynamic>> getNotifications() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return [];

    final response = await http
        .get(
          Uri.parse(
            '${ApiConfig.preferredBaseUrl}/api/notifications?firebaseUid=${Uri.encodeComponent(user.uid)}',
          ),
          headers: {'Content-Type': 'application/json'},
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception(
        'Failed to load notifications (${response.statusCode}): ${response.body}',
      );
    }

    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return (data['notifications'] as List<dynamic>? ?? []);
  }

  static Future<void> markAsRead(int notificationId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final response = await http
        .patch(
          Uri.parse(
            '${ApiConfig.preferredBaseUrl}/api/notifications/$notificationId/read',
          ),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'firebaseUid': user.uid}),
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception(
        'Failed to mark notification as read (${response.statusCode}): ${response.body}',
      );
    }
  }

  static Future<void> markAllRead() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final response = await http
        .patch(
          Uri.parse('${ApiConfig.preferredBaseUrl}/api/notifications/read-all'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'firebaseUid': user.uid}),
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception(
        'Failed to mark notifications as read (${response.statusCode}): ${response.body}',
      );
    }
  }

  static Future<void> deleteNotification(int notificationId) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final response = await http
        .delete(
          Uri.parse(
            '${ApiConfig.preferredBaseUrl}/api/notifications/$notificationId',
          ),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'firebaseUid': user.uid}),
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception(
        'Failed to delete notification (${response.statusCode}): ${response.body}',
      );
    }
  }

  static Future<void> clearAll() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final response = await http
        .delete(
          Uri.parse('${ApiConfig.preferredBaseUrl}/api/notifications'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'firebaseUid': user.uid}),
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception(
        'Failed to clear notifications (${response.statusCode}): ${response.body}',
      );
    }
  }
}
