import 'dart:convert';

import '../services/api_client.dart';

class DebtService {
  Future<Map<String, dynamic>> getDebtBalance() async {
    final response = await ApiClient.getWithAuth(
      '/api/debt/balance',
      forceRefresh: true,
      timeout: const Duration(seconds: 8),
    );
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<String> requestWithdrawal() async {
    try {
      final response = await ApiClient.postWithAuth(
        '/api/student/withdrawal/request',
        timeout: const Duration(seconds: 8),
        acceptStatusCodes: {409},
      );

      if (response.statusCode == 409) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception((body['error'] ?? 'Withdrawal already requested').toString());
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      return (body['message'] ?? 'Withdrawal request submitted successfully.').toString();
    } on Exception {
      rethrow;
    }
  }

  Future<void> cancelWithdrawal() async {
    await ApiClient.deleteWithAuth(
      '/api/student/withdrawal/request',
      timeout: const Duration(seconds: 8),
    );
  }
}
