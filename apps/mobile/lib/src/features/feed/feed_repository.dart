import 'package:supabase_flutter/supabase_flutter.dart';

import '../shared/app_models.dart';

class FeedRepository {
  FeedRepository({required this.client});

  final SupabaseClient? client;

  Future<List<FeedPost>> fetchPosts({required String customerId}) async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    final response = await safeClient
        .from('salon_posts')
        .select(
          'id, title, caption, image_path, post_type, source_type, created_at, external_author_avatar_url, external_author_username, services(name), staff_members(name, role), salon_post_images(image_path, sort_order), salon_post_likes(customer_id), salon_post_comments(id, customer_name, body, created_at)',
        )
        .order('created_at', ascending: false);

    return (response as List<dynamic>).map((entry) => jsonMap(entry)).map((
      map,
    ) {
      final service = jsonMapOrNull(map['services']);
      final staff = jsonMapOrNull(map['staff_members']);
      final gallery = jsonMapList(map['salon_post_images'])
        ..sort(
          (left, right) => intValue(
            left['sort_order'],
          ).compareTo(intValue(right['sort_order'])),
        );
      final coverPath = stringOrNull(map['image_path']);
      final imageUrls = <String>[
        ...gallery
            .map((item) => stringOrNull(item['image_path']))
            .whereType<String>()
            .map(
              (path) =>
                  safeClient.storage.from('salon-posts').getPublicUrl(path),
            ),
      ];
      if (imageUrls.isEmpty && coverPath != null) {
        imageUrls.add(
          safeClient.storage.from('salon-posts').getPublicUrl(coverPath),
        );
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
        title: stringValue(map['title']),
        caption: stringOrNull(map['caption']),
        postType: stringOrNull(map['post_type']) ?? 'standard',
        createdAt: dateTimeValue(map['created_at']) ?? DateTime.now(),
        imageUrls: imageUrls,
        authorAvatarUrl: stringOrNull(map['external_author_avatar_url']),
        authorUsername: stringOrNull(map['external_author_username']),
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
            .toList(),
        isLikedByCustomer: likes.any(
          (like) => stringOrNull(like['customer_id']) == customerId,
        ),
      );
    }).toList();
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
      await query;
      return;
    }

    await safeClient.from('salon_post_likes').insert(<String, dynamic>{
      'post_id': post.id,
      'customer_id': customerId,
    });
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

    final inserted = await safeClient
        .from('salon_post_comments')
        .insert(<String, dynamic>{
          'post_id': postId,
          'customer_id': customerId,
          'customer_name': customerName,
          'body': body.trim(),
        })
        .select('id, customer_name, body, created_at')
        .single();

    return FeedComment(
      id: stringValue(inserted['id']),
      customerName: stringOrNull(inserted['customer_name']) ?? customerName,
      body: stringValue(inserted['body']),
      createdAt: dateTimeValue(inserted['created_at']) ?? DateTime.now(),
    );
  }
}
