import 'dart:convert';
import 'package:http/http.dart' as http;

class DebtService {
  // ⚠️ CRITICAL: REPLACE WITH YOUR ARCH LINUX LOCAL IP
  // Find it with: ip addr show | grep "inet 192.168"
  static const String _baseUrl = 'http://172.18.37.88:3000'; // ← CHANGE THIS

  Future<Map<String, dynamic>> getDebtBalance() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/api/debt/balance'),
        headers: {'Content-Type': 'application/json'},
      );

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