import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';

/// Shared HTTP helpers — Bearer token only (no x-firebase-uid / x-user-email).
class ApiClient {
  static Future<String> requireIdToken({bool forceRefresh = false}) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      throw Exception('Not signed in. Please log in again.');
    }

    final token = await user.getIdToken(forceRefresh);
    if (token == null || token.isEmpty) {
      throw Exception('Could not get auth token. Please log in again.');
    }

    return token;
  }

  static Future<Map<String, String>> authHeaders({bool forceRefresh = false}) async {
    final token = await requireIdToken(forceRefresh: forceRefresh);
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static List<String> candidateBaseUrls() => ApiConfig.candidateBaseUrls();

  static String get preferredBaseUrl => ApiConfig.preferredBaseUrl;

  static Future<http.Response> getWithAuth(
    String path, {
    bool forceRefresh = false,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final headers = await authHeaders(forceRefresh: forceRefresh);
    final errors = <String>[];

    for (final baseUrl in candidateBaseUrls()) {
      try {
        final response = await http
            .get(Uri.parse('$baseUrl$path'), headers: headers)
            .timeout(timeout);

        if (response.statusCode == 200) {
          return response;
        }

        errors.add(_formatApiError(baseUrl, response));
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(errors.isEmpty ? 'Unable to reach backend' : errors.join(' | '));
  }

  static Future<http.Response> postWithAuth(
    String path, {
    Object? body,
    bool forceRefresh = false,
    Duration timeout = const Duration(seconds: 8),
    Set<int>? acceptStatusCodes,
  }) async {
    final headers = await authHeaders(forceRefresh: forceRefresh);
    final errors = <String>[];
    final allowed = acceptStatusCodes ?? {};

    for (final baseUrl in candidateBaseUrls()) {
      try {
        final response = await http
            .post(
              Uri.parse('$baseUrl$path'),
              headers: headers,
              body: body,
            )
            .timeout(timeout);

        if ((response.statusCode >= 200 && response.statusCode < 300)
            || allowed.contains(response.statusCode)) {
          return response;
        }

        errors.add(_formatApiError(baseUrl, response));
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(errors.isEmpty ? 'Unable to reach backend' : errors.join(' | '));
  }

  static Future<http.Response> patchWithAuth(
    String path, {
    Object? body,
    bool forceRefresh = false,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final headers = await authHeaders(forceRefresh: forceRefresh);
    final errors = <String>[];

    for (final baseUrl in candidateBaseUrls()) {
      try {
        final response = await http
            .patch(
              Uri.parse('$baseUrl$path'),
              headers: headers,
              body: body,
            )
            .timeout(timeout);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          return response;
        }

        errors.add(_formatApiError(baseUrl, response));
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(errors.isEmpty ? 'Unable to reach backend' : errors.join(' | '));
  }

  static Future<http.Response> deleteWithAuth(
    String path, {
    bool forceRefresh = false,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final headers = await authHeaders(forceRefresh: forceRefresh);
    final errors = <String>[];

    for (final baseUrl in candidateBaseUrls()) {
      try {
        final response = await http
            .delete(Uri.parse('$baseUrl$path'), headers: headers)
            .timeout(timeout);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          return response;
        }

        errors.add(_formatApiError(baseUrl, response));
      } catch (e) {
        errors.add('Request failed on $baseUrl: $e');
      }
    }

    throw Exception(errors.isEmpty ? 'Unable to reach backend' : errors.join(' | '));
  }

  static String _formatApiError(String baseUrl, http.Response response) {
    var message = response.body;
    try {
      final decoded = response.body;
      if (decoded.contains('"error"')) {
        final match = RegExp(r'"error"\s*:\s*"([^"]*)"').firstMatch(decoded);
        if (match != null) {
          message = match.group(1) ?? message;
        }
      }
    } catch (_) {}

    return 'API Error ${response.statusCode} on $baseUrl: $message';
  }
}
