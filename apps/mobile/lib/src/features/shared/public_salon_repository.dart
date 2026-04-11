import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/config/app_environment.dart';
import 'app_models.dart';

class PublicSalonRepository {
  PublicSalonRepository({required this.environment, required this.client});

  final AppEnvironment environment;
  final http.Client client;

  Future<SalonLandingData?> fetchLanding(
    String joinCode, {
    bool bypassCache = false,
  }) async {
    final normalizedJoinCode = joinCode.trim().toUpperCase();
    if (normalizedJoinCode.isEmpty) {
      return null;
    }

    final uri = environment.publicApiUri(
      '/api/public/salons/$normalizedJoinCode',
    );
    if (uri == null) {
      return null;
    }

    final requestUri = bypassCache
        ? uri.replace(
            queryParameters: <String, String>{
              ...uri.queryParameters,
              'refresh': DateTime.now().microsecondsSinceEpoch.toString(),
            },
          )
        : uri;
    final response = await client.get(
      requestUri,
      headers: bypassCache
          ? const <String, String>{
              'Cache-Control': 'no-cache, no-store, max-age=0',
              'Pragma': 'no-cache',
            }
          : null,
    );
    if (response.statusCode >= 400) {
      return null;
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return SalonLandingData.fromJson(payload);
  }
}
