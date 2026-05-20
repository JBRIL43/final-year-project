import 'dart:convert';

import 'api_client.dart';

class StudentStatementService {
  Future<Map<String, dynamic>> getCostBreakdown() async {
    final response = await ApiClient.getWithAuth('/api/student/cost-breakdown');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> getPayments() async {
    final response = await ApiClient.getWithAuth('/api/student/payments');
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return body['payments'] as List<dynamic>? ?? [];
  }
}
