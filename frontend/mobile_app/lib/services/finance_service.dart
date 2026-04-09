import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class FinanceService {
  static Future<List<dynamic>> getPendingPayments() async {
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(Uri.parse('$baseUrl/api/verification/pending'))
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
    Exception? lastError;

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .post(
              Uri.parse('$baseUrl/api/verification/verify'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'paymentId': paymentId,
                'verifiedBy': verifiedBy,
                'action': action,
              }),
            )
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          return;
        }

        lastError = Exception('Failed to verify payment on $baseUrl');
      } catch (e) {
        lastError = Exception('Request failed on $baseUrl: $e');
      }
    }

    throw lastError ?? Exception('Failed to verify payment');
  }
}
