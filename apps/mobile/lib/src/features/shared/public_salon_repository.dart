import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../../core/utils/formatters.dart';
import 'app_models.dart';

class PublicSalonRepository {
  static const _requestTimeout = Duration(seconds: 8);
  static const _landingCacheTtl = Duration(seconds: 45);

  PublicSalonRepository({
    required this.environment,
    required this.client,
    this.supabaseClient,
  });

  final AppEnvironment environment;
  final http.Client client;
  final SupabaseClient? supabaseClient;
  final SnapshotReadCache _cache = SnapshotReadCache();

  Future<SalonLandingData?> fetchLanding(
    String joinCode, {
    bool bypassCache = false,
  }) async {
    final normalizedJoinCode = normalizeJoinCode(joinCode);
    if (normalizedJoinCode.isEmpty) {
      return null;
    }

    return _cache.read<SalonLandingData?>(
      key: 'landing:$normalizedJoinCode',
      ttl: _landingCacheTtl,
      bypassCache: bypassCache,
      loader: () => _fetchLandingRemote(
        normalizedJoinCode,
        bypassCache: bypassCache,
      ),
    );
  }

  Future<SalonLandingData?> _fetchLandingRemote(
    String normalizedJoinCode, {
    required bool bypassCache,
  }) async {
    final uri = environment.publicApiUri(
      '/api/public/salons/$normalizedJoinCode',
    );
    if (uri == null) {
      return _fetchLandingFromCanonicalRpc(normalizedJoinCode);
    }

    final requestUri = bypassCache
        ? uri.replace(
            queryParameters: <String, String>{
              ...uri.queryParameters,
              'refresh': DateTime.now().microsecondsSinceEpoch.toString(),
            },
          )
        : uri;
    final response = await client
        .get(
          requestUri,
          headers: bypassCache
              ? const <String, String>{
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache, no-store, max-age=0',
                  'Pragma': 'no-cache',
                }
              : const <String, String>{'Accept': 'application/json'},
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      return _fetchLandingFromCanonicalRpc(normalizedJoinCode);
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return SalonLandingData.fromJson(payload);
  }

  Future<SalonLandingData?> _fetchLandingFromCanonicalRpc(String joinCode) async {
    final rpc = supabaseClient;
    if (rpc == null) {
      return null;
    }

    try {
      final dynamic payload = await rpc.rpc(
        'get_public_salon_landing_by_join_code',
        params: <String, dynamic>{'input_join_code': joinCode},
      );
      final landingPayload = _coerceJsonMap(payload);
      if (landingPayload != null && landingPayload.isNotEmpty) {
        return SalonLandingData.fromJson(landingPayload);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic>? _coerceJsonMap(dynamic payload) {
    if (payload is Map) {
      return payload.map(
        (dynamic key, dynamic value) => MapEntry(key.toString(), value),
      );
    }
    return null;
  }
}
