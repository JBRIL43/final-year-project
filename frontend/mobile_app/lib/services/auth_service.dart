import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import 'api_config.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<UserCredential> studentLogin(String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    await _sendFcmTokenToBackend(credential.user);
    return credential;
  }

  Future<UserCredential> financeLogin(String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email,
      password: password,
    );
    await _sendFcmTokenToBackend(credential.user);
    return credential;
  }

  Future<void> _sendFcmTokenToBackend(User? user) async {
    if (user == null) return;

    try {
      final fcmToken = await FirebaseMessaging.instance.getToken();
      if (fcmToken == null || fcmToken.isEmpty) {
        return;
      }

      await http
          .post(
            Uri.parse('${ApiConfig.preferredBaseUrl}/api/user/fcm-token'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'firebaseUid': user.uid,
              'email': user.email,
              'fcmToken': fcmToken,
            }),
          )
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      // Non-blocking best-effort token sync.
    }
  }
}
