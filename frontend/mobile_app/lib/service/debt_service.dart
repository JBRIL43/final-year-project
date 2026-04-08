import 'dart:convert';
import 'package:http/http.dart' as http;

class DebtService {
  static const String _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.42.0.1:3000',
  );

  Future<Map<String, dynamic>> getDebtBalance() async {
    try {
      final response = await http
          .get(
            Uri.parse('$_baseUrl/api/debt/balance'),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        throw Exception('API Error: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }
}
