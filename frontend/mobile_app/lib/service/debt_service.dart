import 'dart:convert';
import 'package:http/http.dart' as http;
import '../services/api_config.dart';

class DebtService {
  List<String> _candidateBaseUrls() {
    return ApiConfig.candidateBaseUrls();
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
