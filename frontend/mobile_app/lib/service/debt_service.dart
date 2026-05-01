import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import '../services/api_config.dart';

class DebtService {
  List<String> _candidateBaseUrls() {
    return ApiConfig.candidateBaseUrls();
  }

  Future<Map<String, dynamic>> getDebtBalance() async {
    final errors = <String>[];
    final user = FirebaseAuth.instance.currentUser;
    final idToken = await user?.getIdToken(true);

    final headers = <String, String>{'Content-Type': 'application/json'};

    if (idToken != null && idToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $idToken';
    }

    if (user?.uid != null && user!.uid.isNotEmpty) {
      headers['x-firebase-uid'] = user.uid;
    }

    if (user?.email != null && user!.email!.isNotEmpty) {
      headers['x-user-email'] = user.email!;
    }

    for (final baseUrl in _candidateBaseUrls()) {
      try {
        final response = await http
            .get(Uri.parse('$baseUrl/api/debt/balance'), headers: headers)
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          return jsonDecode(response.body);
        }

        String errorBody = response.body;
        try {
          final decoded = jsonDecode(response.body);
          if (decoded['error'] != null) errorBody = decoded['error'];
        } catch (_) {}
        
        errors.add('API Error ${response.statusCode} on $baseUrl: $errorBody');
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(
      'Network error: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }

  Future<String> requestWithdrawal() async {
    final errors = <String>[];
    final user = FirebaseAuth.instance.currentUser;
    final idToken = await user?.getIdToken(true);

    final headers = <String, String>{'Content-Type': 'application/json'};

    if (idToken != null && idToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $idToken';
    }

    if (user?.uid != null && user!.uid.isNotEmpty) {
      headers['x-firebase-uid'] = user.uid;
    }

    if (user?.email != null && user!.email!.isNotEmpty) {
      headers['x-user-email'] = user.email!;
    }

    for (final baseUrl in _candidateBaseUrls()) {
      try {
        final response = await http
            .post(
              Uri.parse('$baseUrl/api/student/withdrawal/request'),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        Map<String, dynamic>? body;
        try {
          body = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (_) {
          body = null;
        }

        if (response.statusCode == 200) {
          return (body?['message'] ??
                  'Withdrawal request submitted successfully.')
              .toString();
        }

        if (response.statusCode == 409) {
          throw Exception(
            (body?['error'] ?? 'Withdrawal already requested').toString(),
          );
        }

        errors.add(
          'API Error ${response.statusCode} on $baseUrl: ${(body?['error'] ?? response.body).toString()}',
        );
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(
      'Withdrawal request failed: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }

  Future<void> cancelWithdrawal() async {
    final errors = <String>[];
    final user = FirebaseAuth.instance.currentUser;
    final idToken = await user?.getIdToken(true);

    final headers = <String, String>{'Content-Type': 'application/json'};

    if (idToken != null && idToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $idToken';
    }
    if (user?.uid != null && user!.uid.isNotEmpty) {
      headers['x-firebase-uid'] = user.uid;
    }
    if (user?.email != null && user!.email!.isNotEmpty) {
      headers['x-user-email'] = user.email!;
    }

    for (final baseUrl in _candidateBaseUrls()) {
      try {
        final response = await http
            .delete(
              Uri.parse('$baseUrl/api/student/withdrawal/request'),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) return;

        Map<String, dynamic>? body;
        try {
          body = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (_) {}

        errors.add(
          'API Error ${response.statusCode} on $baseUrl: ${(body?['error'] ?? response.body).toString()}',
        );
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(
      'Cancel failed: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }
}
