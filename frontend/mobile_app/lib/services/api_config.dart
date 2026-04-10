class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://final-year-project-r2h8.onrender.com',
  );

  static const List<String> _fallbackBaseUrls = [
    'https://final-year-project-r2h8.onrender.com',
  ];

  static List<String> candidateBaseUrls() {
    final urls = <String>[
      if (_configuredBaseUrl.isNotEmpty) _configuredBaseUrl,
      ..._fallbackBaseUrls,
    ];
    return urls.toSet().toList();
  }

  static String get preferredBaseUrl => candidateBaseUrls().first;
}
