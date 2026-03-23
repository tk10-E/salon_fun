part of 'salon_repository.dart';

mixin _SalonRepositoryFeedMixin on _SalonRepositoryBase {
  Future<List<SalonPost>> getFeedPosts({required String customerId}) async {
    try {
      final data = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,post_type,video_path,created_at,services(id,name,price,duration),staff_members(name,role),salon_post_images(image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
          )
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((postMap) {
            final imagePath = _readNullableString(postMap['image_path']) ?? '';
            final galleryMaps = _readListMap(postMap['salon_post_images'])
              ..sort(
                (left, right) => ((left['sort_order'] ?? 0) as num).compareTo(
                  ((right['sort_order'] ?? 0) as num),
                ),
              );
            final imageUrls = galleryMaps.isNotEmpty
                ? galleryMaps
                      .map(
                        (image) => _buildSalonPostImageUrl(
                          image['image_path'] as String,
                        ),
                      )
                      .toList()
                : [_buildSalonPostImageUrl(imagePath)];
            final videoPath = _readNullableString(postMap['video_path']);
            return SalonPost.fromMap(
              {
                ...postMap,
                'video_url': videoPath == null
                    ? null
                    : _buildSalonPostImageUrl(videoPath),
              },
              currentCustomerId: customerId,
              imageUrls: imageUrls,
            );
          })
          .toList();
    } on PostgrestException catch (error) {
      if (_isLegacyFeedSchemaError(error)) {
        return _getLegacyFeedPosts(customerId: customerId);
      }
      rethrow;
    }
  }

  Future<void> likePost({required String postId}) async {
    await client.from('salon_post_likes').insert({'post_id': postId});
  }

  Future<void> unlikePost({
    required String postId,
    required String customerId,
  }) async {
    await client
        .from('salon_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('customer_id', customerId);
  }

  Future<void> addPostComment({
    required String postId,
    required String body,
  }) async {
    await client.from('salon_post_comments').insert({
      'post_id': postId,
      'body': body.trim(),
    });
  }

  Future<List<SalonPost>> _getLegacyFeedPosts({
    required String customerId,
  }) async {
    try {
      final data = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,created_at,salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
          )
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((postMap) {
            final imagePath = _readNullableString(postMap['image_path']) ?? '';
            return SalonPost.fromMap(
              postMap,
              currentCustomerId: customerId,
              imageUrls: [_buildSalonPostImageUrl(imagePath)],
            );
          })
          .toList();
    } on PostgrestException catch (error) {
      if (_isMissingFeedSchemaError(error)) {
        return const [];
      }
      rethrow;
    }
  }
}
