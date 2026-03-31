part of 'home_screen.dart';

mixin _HomeScreenFeedMixin on _HomeScreenStateBase {
  Future<void> _runPostAction(
    String postId,
    Future<void> Function() action, {
    SalonPost Function(SalonPost current)? localTransform,
    String? successMessage,
  }) async {
    if (_busyPostIds.contains(postId)) {
      return;
    }

    setState(() => _busyPostIds.add(postId));

    try {
      await action();
      if (localTransform != null) {
        _updatePostLocally(postId, localTransform);
      }
      if (!mounted) {
        return;
      }

      if (successMessage != null) {
        _showMessage(successMessage);
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (mounted) {
        _showMessage(_humanizeFeedError(error.message));
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível concluir sua interação agora.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyPostIds.remove(postId));
      }
    }
  }

  Future<void> _togglePostLike(SalonPost post) async {
    final liking = !post.likedByMe;
    await _runPostAction(
      post.id,
      () async {
        if (post.likedByMe) {
          await widget.repository.unlikePost(
            postId: post.id,
            customerId: _profile.id,
          );
        } else {
          await widget.repository.likePost(postId: post.id);
        }
      },
      localTransform: (current) => current.copyWith(
        likedByMe: liking,
        likeCount: liking
            ? current.likeCount + 1
            : (current.likeCount > 0 ? current.likeCount - 1 : 0),
      ),
    );
  }

  Future<void> _openComments(SalonPost post) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) => FeedCommentsSheet(
        post: post,
        branding: SalonBranding.fromName(
          _profile.salonName,
          overrideHexColor: _profile.salonBrandColor,
          businessSegment: _profile.salonBusinessSegment,
          clientAppConfig: _profile.salonClientAppConfig,
        ),
        onSubmitComment: (body) =>
            widget.repository.addPostComment(postId: post.id, body: body),
      ),
    );

    if (created == true) {
      if (mounted) {
        _showMessage('Comentário enviado com sucesso.');
      }
      _refreshDataInBackground();
    }
  }
}
