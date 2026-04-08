import 'dart:convert';
import 'package:http/http.dart' as http;

class DebtService {
  static const String _primaryBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.42.0.1:3000',
  );

  static const List<String> _fallbackBaseUrls = [
    'http://10.42.0.1:3000',
  ];

  List<String> _candidateBaseUrls() {
    final urls = <String>[_primaryBaseUrl, ..._fallbackBaseUrls];
    return urls.toSet().toList();
  }

  Future<Map<String, dynamic>> getDebtBalance() async {
    final errors = <String>[];

    for (final baseUrl in _candidateBaseUrls()) {
      try {
        final response = await http
            .get(
              Uri.parse('$baseUrl/api/debt/balance'),
              headers: {'Content-Type': 'application/json'},
            )
            .timeout(const Duration(seconds: 5));

        if (response.statusCode == 200) {
          return jsonDecode(response.body);
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
}
