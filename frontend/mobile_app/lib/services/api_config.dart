class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://final-year-project-r2h8.onrender.com',
  );

  static const List<String> _fallbackBaseUrls = [
    'https://final-year-project-r2h8.onrender.com',
  ];

  static String _normalizeBaseUrl(String raw) {
    var value = raw.trim();
    if (value.isEmpty) {
      return value;
    }

    while (value.endsWith('/')) {
      value = value.substring(0, value.length - 1);
    }

    if (value.toLowerCase().endsWith('/api')) {
      value = value.substring(0, value.length - 4);
    }

    return value;
  }

  static List<String> candidateBaseUrls() {
    final urls = <String>[
      if (_configuredBaseUrl.isNotEmpty) _normalizeBaseUrl(_configuredBaseUrl),
      ..._fallbackBaseUrls,
    ].map(_normalizeBaseUrl).where((url) => url.isNotEmpty).toList();
    return urls.toSet().toList();
  }

  static String get preferredBaseUrl => candidateBaseUrls().first;
}
