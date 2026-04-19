import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

class StudentStatementService {
  Future<Map<String, String>> _buildHeaders() async {
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

    return headers;
  }

  Future<Map<String, dynamic>> getCostBreakdown() async {
    final headers = await _buildHeaders();
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(
              Uri.parse('$baseUrl/api/student/cost-breakdown'),
              headers: headers,
            )
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          return jsonDecode(response.body) as Map<String, dynamic>;
        }

        errors.add(
          'API Error ${response.statusCode} on $baseUrl/cost-breakdown',
        );
      } catch (e) {
        errors.add('Request failed on $baseUrl/cost-breakdown: $e');
      }
    }

    throw Exception(
      'Unable to load cost breakdown: ${errors.isEmpty ? 'No backend reachable' : errors.join(' | ')}',
    );
  }

  Future<List<dynamic>> getPayments() async {
    final headers = await _buildHeaders();
    final errors = <String>[];

    for (final baseUrl in ApiConfig.candidateBaseUrls()) {
      try {
        final response = await http
            .get(Uri.parse('$baseUrl/api/student/payments'), headers: headers)
            .timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          return body['payments'] as List<dynamic>? ?? [];
        }

        errors.add('API Error ${response.statusCode} on $baseUrl/payments');
      } catch (e) {
        errors.add('Request failed on $baseUrl/payments: $e');
      }
    }

    throw Exception(
      'Unable to load payment history: ${errors.isEmpty ? 'No backend reachable' : errors.join(' | ')}',
    );
  }
}
