import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:mobile/src/features/shared/storage_asset_urls.dart';

void main() {
  test('recognizes absolute asset urls', () {
    expect(
      isAbsoluteStorageAssetUrl('https://cdn.example.com/equipe/tania.webp'),
      isTrue,
    );
    expect(
      isAbsoluteStorageAssetUrl('http://cdn.example.com/equipe/tania.webp'),
      isTrue,
    );
    expect(isAbsoluteStorageAssetUrl('salon-1/staff/tania.webp'), isFalse);
    expect(isAbsoluteStorageAssetUrl(''), isFalse);
  });

  test('returns absolute public asset urls even without supabase client', () {
    expect(
      resolvePublicStorageAssetUrl(
        null,
        bucket: 'salon-assets',
        assetPath: 'https://cdn.example.com/equipe/tania.webp',
      ),
      'https://cdn.example.com/equipe/tania.webp',
    );
  });

  test('keeps salon asset urls on the stable public object endpoint', () {
    final client = SupabaseClient(
      'https://example.supabase.co',
      'public-anon-key',
    );

    final resolved = resolvePublicStorageAssetUrl(
      client,
      bucket: 'salon-assets',
      assetPath: 'salon-1/staff/tania.webp',
      transform: TransformOptions(width: 320, height: 320, quality: 100),
    );

    expect(
      resolved,
      'https://example.supabase.co/storage/v1/object/public/salon-assets/salon-1/staff/tania.webp',
    );
    expect(resolved, isNot(contains('/render/image/public/')));
  });

  test('keeps transforms for non salon asset buckets', () {
    final client = SupabaseClient(
      'https://example.supabase.co',
      'public-anon-key',
    );

    final resolved = resolvePublicStorageAssetUrl(
      client,
      bucket: 'service-assets',
      assetPath: 'salon-1/services/escova.webp',
      transform: TransformOptions(width: 320, height: 320, quality: 100),
    );

    expect(resolved, contains('/storage/v1/render/image/public/service-assets/'));
    expect(resolved, contains('width=320'));
    expect(resolved, contains('height=320'));
  });

  test('returns absolute signed asset urls even without supabase client', () async {
    await expectLater(
      resolveSignedStorageAssetUrl(
        null,
        bucket: 'customer-profiles',
        assetPath: 'https://cdn.example.com/clientes/maria.webp',
      ),
      completion('https://cdn.example.com/clientes/maria.webp'),
    );
  });
}
