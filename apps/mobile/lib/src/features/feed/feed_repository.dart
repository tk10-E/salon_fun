import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;

import '../../core/network/network_guard.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../shared/app_models.dart';
import '../shared/storage_asset_urls.dart';

class FeedRepository {
  FeedRepository({
    required this.client,
    http.Client? httpClient,
    String? publicWebBaseUrl,
  }) : _httpClient = httpClient ?? http.Client(),
       _publicWebBaseUrl = _normalizeBaseUrl(publicWebBaseUrl);

  final SupabaseClient? client;
  final http.Client _httpClient;
  final String _publicWebBaseUrl;
  final SnapshotReadCache _cache = SnapshotReadCache();

  static const _customerStoryOwnerKeyPrefix = 'customer-story://';
  static const _postsCacheTtl = Duration(seconds: 35);
  static const _storiesCacheTtl = Duration(seconds: 25);
  static const _storiesCacheKey = 'feed:stories';

  static final RegExp _legacyStoryTitlePattern = RegExp(
    r'^\[story\|(\d{1,2})h\]\s*',
    caseSensitive: false,
  );

  Future<List<FeedPost>> fetchPosts({required String customerId}) async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    return _cache.read<List<FeedPost>>(
      key: 'feed:posts:${customerId.trim()}',
      ttl: _postsCacheTtl,
      loader: () async {
        final rows = await _loadFeedRows(includeExpiryMetadata: false);

        return rows
            .map((entry) => jsonMap(entry))
            .where((map) => !_resolveStoryState(map).isStory)
            .map((map) {
              final service = jsonMapOrNull(map['services']);
              final staff = jsonMapOrNull(map['staff_members']);
              final gallery = jsonMapList(map['salon_post_images'])
                ..sort(
                  (left, right) => intValue(
                    left['sort_order'],
                  ).compareTo(intValue(right['sort_order'])),
                );
              final coverPath = stringOrNull(map['image_path']);
              final imageUrls = gallery
                  .map((item) => stringOrNull(item['image_path']))
                  .whereType<String>()
                  .map(
                    (path) => resolvePublicStorageAssetUrl(
                      safeClient,
                      bucket: 'salon-posts',
                      assetPath: path,
                    ),
                  )
                  .whereType<String>()
                  .toList(growable: true);
              if (imageUrls.isEmpty && coverPath != null) {
                final coverUrl = resolvePublicStorageAssetUrl(
                  safeClient,
                  bucket: 'salon-posts',
                  assetPath: coverPath,
                );
                if (coverUrl != null) {
                  imageUrls.add(coverUrl);
                }
              }

              final likes = jsonMapList(map['salon_post_likes']);
              final comments = jsonMapList(map['salon_post_comments'])
                ..sort(
                  (left, right) => stringValue(
                    right['created_at'],
                  ).compareTo(stringValue(left['created_at'])),
                );

              return FeedPost(
                id: stringValue(map['id']),
                title: _visibleTitle(map),
                caption: stringOrNull(map['caption']),
                postType: stringOrNull(map['post_type']) ?? 'standard',
                createdAt: dateTimeValue(map['created_at']) ?? DateTime.now(),
                imageUrls: imageUrls,
                authorAvatarUrl: stringOrNull(map['external_author_avatar_url']),
                authorUsername: stringOrNull(map['external_author_username']),
                permalinkUrl: stringOrNull(map['external_permalink']),
                sourceType: stringOrNull(map['source_type']),
                serviceName: stringOrNull(service?['name']),
                staffName: stringOrNull(staff?['name']),
                staffRole: stringOrNull(staff?['role']),
                likesCount: likes.length,
                comments: comments
                    .map(
                      (comment) => FeedComment(
                        id: stringValue(comment['id']),
                        customerName:
                            stringOrNull(comment['customer_name']) ?? 'Cliente',
                        body: stringValue(comment['body']),
                        createdAt:
                            dateTimeValue(comment['created_at']) ?? DateTime.now(),
                      ),
                    )
                    .toList(growable: false),
                isLikedByCustomer: likes.any(
                  (like) => stringOrNull(like['customer_id']) == customerId,
                ),
              );
            })
            .toList(growable: false);
      },
    );
  }

  Future<List<FeedStory>> fetchStories() async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    return _cache.read<List<FeedStory>>(
      key: _storiesCacheKey,
      ttl: _storiesCacheTtl,
      loader: () async {
        final rows = await _loadFeedRows(includeExpiryMetadata: true);

        return rows
            .map((entry) => jsonMap(entry))
            .where((map) => _resolveStoryState(map).isActiveStory)
            .map((map) {
              final service = jsonMapOrNull(map['services']);
              final staff = jsonMapOrNull(map['staff_members']);
              final gallery = jsonMapList(map['salon_post_images'])
                ..sort(
                  (left, right) => intValue(
                    left['sort_order'],
                  ).compareTo(intValue(right['sort_order'])),
                );
              final coverPath = stringOrNull(map['image_path']);
              String? imageUrl;

              for (final item in gallery) {
                final path = stringOrNull(item['image_path']);
                if (path == null) {
                  continue;
                }
                final resolved = resolvePublicStorageAssetUrl(
                  safeClient,
                  bucket: 'salon-posts',
                  assetPath: path,
                );
                if (resolved != null) {
                  imageUrl = resolved;
                  break;
                }
              }

              if (imageUrl == null && coverPath != null) {
                imageUrl = resolvePublicStorageAssetUrl(
                  safeClient,
                  bucket: 'salon-posts',
                  assetPath: coverPath,
                );
              }

              final storyState = _resolveStoryState(map);
              final ownerCustomerId = _resolveStoryOwnerCustomerId(
                externalPermalink: stringOrNull(map['external_permalink']),
              );
              final rawSourceType = stringOrNull(map['source_type']);
              return FeedStory(
                id: stringValue(map['id']),
                title: storyState.cleanTitle,
                caption: stringOrNull(map['caption']),
                imageUrl: imageUrl,
                createdAt: dateTimeValue(map['created_at']) ?? DateTime.now(),
                expiresAt:
                    storyState.expiresAt ??
                    DateTime.now().add(const Duration(hours: 24)),
                serviceName: stringOrNull(service?['name']),
                staffName: stringOrNull(staff?['name']),
                staffRole: stringOrNull(staff?['role']),
                authorAvatarUrl: stringOrNull(map['external_author_avatar_url']),
                authorUsername: stringOrNull(map['external_author_username']),
                sourceType: ownerCustomerId == null
                    ? rawSourceType
                    : 'customer_story',
                ownerCustomerId: ownerCustomerId,
              );
            })
            .toList(growable: false);
      },
    );
  }

  Future<void> uploadCustomerStory({
    required List<int> bytes,
    required String fileExtension,
    required String contentType,
    String? caption,
  }) async {
    final safeClient = client;
    final accessToken = safeClient?.auth.currentSession?.accessToken.trim();
    final uri = _buildCustomerFeedStoriesUri();
    if (safeClient == null ||
        accessToken == null ||
        accessToken.isEmpty ||
        uri == null) {
      throw Exception(
        'Sua sessao do app expirou. Entre novamente para publicar seu story.',
      );
    }

    final request = http.MultipartRequest('POST', uri)
      ..headers.addAll(_authorizedPublicApiHeaders(accessToken));

    final normalizedCaption = caption?.trim();
    if (normalizedCaption != null && normalizedCaption.isNotEmpty) {
      request.fields['caption'] = normalizedCaption;
    }

    request.files.add(
      http.MultipartFile.fromBytes(
        'image',
        bytes,
        filename:
            'story.${fileExtension.trim().isEmpty ? 'jpg' : fileExtension.trim().toLowerCase()}',
      ),
    );

    final streamed = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamed);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      _cache.invalidate(_storiesCacheKey);
      return;
    }

    final payload = jsonMapOrNull(_tryDecodeJson(response.body));
    final errorCode = stringOrNull(payload?['error']) ?? 'unknown_error';
    throw Exception(_formatCustomerStoryUploadError(errorCode));
  }

  Future<List<dynamic>> _loadFeedRows({
    required bool includeExpiryMetadata,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    try {
      final response = await runGuardedRead<dynamic>(
        () => safeClient
            .from('salon_posts')
            .select(
              includeExpiryMetadata
                  ? 'id, title, caption, image_path, post_type, source_type, created_at, expires_at, external_author_avatar_url, external_author_username, external_permalink, services(name), staff_members(name, role), salon_post_images(image_path, sort_order), salon_post_likes(customer_id), salon_post_comments(id, customer_name, body, created_at)'
                  : 'id, title, caption, image_path, post_type, source_type, created_at, external_author_avatar_url, external_author_username, external_permalink, services(name), staff_members(name, role), salon_post_images(image_path, sort_order), salon_post_likes(customer_id), salon_post_comments(id, customer_name, body, created_at)',
            )
            .order('created_at', ascending: false),
      );
      return response as List<dynamic>;
    } on PostgrestException catch (error) {
      if (!_isMissingFeedStorySchema(error)) {
        rethrow;
      }
    }

    final fallbackResponse = await runGuardedRead<dynamic>(
      () => safeClient
          .from('salon_posts')
          .select(
            'id, title, caption, image_path, post_type, source_type, created_at, external_author_avatar_url, external_author_username, external_permalink, services(name), staff_members(name, role), salon_post_images(image_path, sort_order), salon_post_likes(customer_id), salon_post_comments(id, customer_name, body, created_at)',
          )
          .order('created_at', ascending: false),
    );
    return fallbackResponse as List<dynamic>;
  }

  _StoryState _resolveStoryState(Map<String, dynamic> map) {
    final title = stringOrNull(map['title']) ?? '';
    final postType = (stringOrNull(map['post_type']) ?? 'standard')
        .trim()
        .toLowerCase();
    final createdAt = dateTimeValue(map['created_at']);
    final expiresAt = dateTimeValue(map['expires_at']);

    if (postType == 'story') {
      final cleanTitle = _cleanStoryTitle(title);
      return _StoryState(
        cleanTitle: cleanTitle,
        expiresAt: expiresAt,
        isStory: true,
        isActiveStory: expiresAt != null && expiresAt.isAfter(DateTime.now()),
      );
    }

    final match = _legacyStoryTitlePattern.firstMatch(title.trim());
    if (match == null) {
      return _StoryState(
        cleanTitle: title.trim().isEmpty ? 'Story' : title.trim(),
        expiresAt: null,
        isStory: false,
        isActiveStory: false,
      );
    }

    final durationHours = _normalizeStoryDurationHours(
      int.tryParse(match.group(1) ?? ''),
    );
    final computedExpiresAt = createdAt?.add(Duration(hours: durationHours));

    return _StoryState(
      cleanTitle: _cleanStoryTitle(title),
      expiresAt: computedExpiresAt,
      isStory: true,
      isActiveStory:
          computedExpiresAt != null &&
          computedExpiresAt.isAfter(DateTime.now()),
    );
  }

  String _visibleTitle(Map<String, dynamic> map) {
    return _resolveStoryState(map).cleanTitle;
  }

  String _cleanStoryTitle(String title) {
    final normalized = title.trim();
    if (normalized.isEmpty) {
      return 'Story';
    }

    return normalized.replaceFirst(_legacyStoryTitlePattern, '').trim().isEmpty
        ? 'Story'
        : normalized.replaceFirst(_legacyStoryTitlePattern, '').trim();
  }

  int _normalizeStoryDurationHours(int? value) {
    switch (value) {
      case 12:
      case 24:
      case 48:
        return value!;
      default:
        return 24;
    }
  }

  bool _isMissingFeedStorySchema(PostgrestException error) {
    final normalized =
        '${error.message} ${error.details ?? ''} ${error.hint ?? ''}'
            .trim()
            .toLowerCase();

    return (normalized.contains('expires_at') &&
            normalized.contains('salon_posts') &&
            (normalized.contains('does not exist') ||
                normalized.contains('schema cache'))) ||
        (normalized.contains('salon_posts_post_type_check') &&
            normalized.contains('story')) ||
        (normalized.contains('invalid input value') &&
            normalized.contains('story')) ||
        (normalized.contains('post_type') &&
            normalized.contains('schema cache') &&
            normalized.contains('story'));
  }

  Uri? _buildCustomerFeedStoriesUri() {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    return Uri.parse('$_publicWebBaseUrl/api/public/customer-feed-stories');
  }

  Map<String, String> _authorizedPublicApiHeaders(String accessToken) {
    return <String, String>{'authorization': 'Bearer $accessToken'};
  }

  String? _resolveStoryOwnerCustomerId({required String? externalPermalink}) {
    final normalizedPermalink = externalPermalink?.trim();
    if (normalizedPermalink == null ||
        !normalizedPermalink.startsWith(_customerStoryOwnerKeyPrefix)) {
      return null;
    }

    final ownerCustomerId = normalizedPermalink.substring(
      _customerStoryOwnerKeyPrefix.length,
    );
    return ownerCustomerId.trim().isEmpty ? null : ownerCustomerId.trim();
  }

  String _formatCustomerStoryUploadError(String errorCode) {
    switch (errorCode) {
      case 'customer_story_image_required':
        return 'Escolha uma foto para publicar no seu story.';
      case 'customer_story_invalid_image':
        return 'Envie uma imagem valida para o story.';
      case 'customer_story_upload_unavailable':
        return 'Nao foi possivel publicar seu story agora.';
      case 'unauthenticated':
        return 'Sua sessao do app expirou. Entre novamente para publicar seu story.';
      default:
        return 'Nao foi possivel publicar seu story agora.';
    }
  }

  Object? _tryDecodeJson(String value) {
    try {
      return value.trim().isEmpty ? null : jsonDecode(value);
    } catch (_) {
      return null;
    }
  }

  Future<void> toggleLike({
    required FeedPost post,
    required String customerId,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    final query = safeClient
        .from('salon_post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('customer_id', customerId);

    if (post.isLikedByCustomer) {
      await runGuardedWrite<void>(() => query);
      _cache.invalidate('feed:posts:${customerId.trim()}');
      return;
    }

    await runGuardedWrite<void>(
      () => safeClient.from('salon_post_likes').insert(<String, dynamic>{
        'post_id': post.id,
        'customer_id': customerId,
      }),
    );
    _cache.invalidate('feed:posts:${customerId.trim()}');
  }

  Future<FeedComment> addComment({
    required String postId,
    required String customerId,
    required String customerName,
    required String body,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    final inserted = await runGuardedWrite<dynamic>(
      () => safeClient
          .from('salon_post_comments')
          .insert(<String, dynamic>{
            'post_id': postId,
            'customer_id': customerId,
            'customer_name': customerName,
            'body': body.trim(),
          })
          .select('id, customer_name, body, created_at')
          .single(),
    );
    _cache.invalidatePrefix('feed:posts:');

    return FeedComment(
      id: stringValue(inserted['id']),
      customerName: stringOrNull(inserted['customer_name']) ?? customerName,
      body: stringValue(inserted['body']),
      createdAt: dateTimeValue(inserted['created_at']) ?? DateTime.now(),
    );
  }
}

class _StoryState {
  const _StoryState({
    required this.cleanTitle,
    required this.expiresAt,
    required this.isStory,
    required this.isActiveStory,
  });

  final String cleanTitle;
  final DateTime? expiresAt;
  final bool isStory;
  final bool isActiveStory;
}

String _normalizeBaseUrl(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) {
    return '';
  }

  return normalized.endsWith('/')
      ? normalized.substring(0, normalized.length - 1)
      : normalized;
}
