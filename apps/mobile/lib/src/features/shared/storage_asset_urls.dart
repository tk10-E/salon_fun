import 'package:supabase_flutter/supabase_flutter.dart';

bool isAbsoluteStorageAssetUrl(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    return false;
  }

  final uri = Uri.tryParse(normalized);
  return uri != null &&
      (uri.scheme == 'http' || uri.scheme == 'https') &&
      (uri.host.isNotEmpty);
}

String? resolvePublicStorageAssetUrl(
  SupabaseClient? client, {
  required String bucket,
  required String? assetPath,
  TransformOptions? transform,
}) {
  final normalized = assetPath?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  if (isAbsoluteStorageAssetUrl(normalized)) {
    return normalized;
  }

  if (client == null) {
    return null;
  }

  if (bucket == 'salon-assets') {
    return client.storage.from(bucket).getPublicUrl(normalized);
  }

  return client.storage.from(bucket).getPublicUrl(
    normalized,
    transform: transform,
  );
}

Future<String?> resolveSignedStorageAssetUrl(
  SupabaseClient? client, {
  required String bucket,
  required String? assetPath,
  int expiresInSeconds = 60 * 60 * 24 * 14,
}) async {
  final normalized = assetPath?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  if (isAbsoluteStorageAssetUrl(normalized)) {
    return normalized;
  }

  if (client == null) {
    return null;
  }

  return client.storage.from(bucket).createSignedUrl(
    normalized,
    expiresInSeconds,
  );
}
