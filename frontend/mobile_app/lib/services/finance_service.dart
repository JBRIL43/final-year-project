import 'dart:convert';
import 'package:http/http.dart' as http;

class FinanceService {
  static const String _baseUrl = 'http://10.42.0.1:3000'; // Use your hotspot IP

  static Future<List<dynamic>> getPendingPayments() async {
    final response = await http.get(
      Uri.parse('$_baseUrl/api/verification/pending'),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['pendingPayments'] as List<dynamic>;
    } else {
      throw Exception('Failed to load pending payments');
    }
  }

  static Future<void> verifyPayment({
    required int paymentId,
    required int verifiedBy,
    required String action,
  }) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/verification/verify'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'paymentId': paymentId,
        'verifiedBy': verifiedBy,
        'action': action,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to verify payment');
    }
  }
}
