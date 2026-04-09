class ApiConfig {
  static const String _configuredBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const List<String> _fallbackBaseUrls = [
    'http://127.0.0.1:3000',
    'http://10.0.2.2:3000',
    'http://10.42.0.1:3000',
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
