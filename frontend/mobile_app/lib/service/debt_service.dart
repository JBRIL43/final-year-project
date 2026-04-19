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
