import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class FinanceService {
  static Future<Map<String, String>> _authHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken(true);
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      if (user?.uid != null) 'x-firebase-uid': user!.uid,
      if (user?.email != null) 'x-user-email': user!.email!,
    };
  }

  static Future<List<dynamic>> getPendingPayments() async {
    final errors = <String>[];
    final headers = await _authHeaders();

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(Uri.parse('$baseUrl/api/verification/pending'),
                headers: headers)
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body);
          return data['pendingPayments'] as List<dynamic>;
        }
        errors.add('API Error ${response.statusCode} on $baseUrl');
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }
    throw Exception(
      'Network error: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }

  static Future<void> verifyPayment({
    required int paymentId,
    required int verifiedBy,
    required String action,
  }) async {
    final headers = await _authHeaders();
    Exception? lastError;

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .post(
              Uri.parse('$baseUrl/api/verification/verify'),
              headers: headers,
              body: jsonEncode({
                'paymentId': paymentId,
                'verifiedBy': verifiedBy,
                'action': action,
              }),
            )
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) return;
        lastError = Exception('Failed to verify payment on $baseUrl');
      } catch (e) {
        lastError = Exception('Request failed on $baseUrl: $e');
      }
    }
    throw lastError ?? Exception('Failed to verify payment');
  }

  static Future<List<dynamic>> getPendingWithdrawals() async {
    final headers = await _authHeaders();
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(
              Uri.parse('$baseUrl/api/registrar/withdrawals/pending-finance'),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          return data['withdrawals'] as List<dynamic>? ?? [];
        }
        errors.add('API Error ${response.statusCode} on $baseUrl');
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }
    throw Exception(
      'Network error: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }

  static Future<Map<String, dynamic>> getFinancialStatement(
    int studentId, {
    String type = 'semester',
  }) async {
    final headers = await _authHeaders();
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(
              Uri.parse(
                '$baseUrl/api/registrar/students/$studentId/financial-statement?type=$type',
              ),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          return jsonDecode(response.body) as Map<String, dynamic>;
        }
        errors.add('API Error ${response.statusCode} on $baseUrl');
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }
    throw Exception(
      'Network error: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }

  static Future<void> financeApproveWithdrawal(int studentId) async {
    final headers = await _authHeaders();
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .post(
              Uri.parse(
                '$baseUrl/api/registrar/students/$studentId/withdrawal/finance-approve',
              ),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) return;

        final body = jsonDecode(response.body) as Map<String, dynamic>?;
        final msg = body?['error'] ?? 'Unknown error';
        throw Exception(msg);
      } catch (e) {
        if (e is Exception && !e.toString().contains('Request failed')) rethrow;
        errors.add('Request failed on $baseUrl: $e');
      }
    }
    throw Exception(
      'Network error: ${errors.isEmpty ? 'Unable to reach backend' : errors.join(' | ')}',
    );
  }
}
