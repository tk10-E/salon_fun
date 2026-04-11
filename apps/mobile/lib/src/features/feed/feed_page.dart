import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';
import 'feed_repository.dart';

class FeedPage extends StatefulWidget {
  const FeedPage({
    super.key,
    required this.feedRepository,
    required this.notificationsController,
    required this.session,
  });

  final FeedRepository feedRepository;
  final CustomerNotificationsController notificationsController;
  final AppSession session;

  @override
  State<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends State<FeedPage> {
  bool _loading = true;
  List<FeedPost> _posts = const [];
  late int _lastFeedRevision;

  @override
  void initState() {
    super.initState();
    _lastFeedRevision = widget.notificationsController.feedRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _load();
  }

  @override
  void didUpdateWidget(covariant FeedPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleSyncChange);
      _lastFeedRevision = widget.notificationsController.feedRevision;
      widget.notificationsController.addListener(_handleSyncChange);
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleSyncChange);
    super.dispose();
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.feedRevision;
    if (_lastFeedRevision == revision || _loading) {
      return;
    }

    _lastFeedRevision = revision;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final posts = await widget.feedRepository.fetchPosts(
      customerId: widget.session.customer.id,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      _posts = posts;
      _loading = false;
    });
  }

  Future<void> _toggleLike(FeedPost post) async {
    final index = _posts.indexWhere((item) => item.id == post.id);
    if (index == -1) {
      return;
    }

    final optimistic = post.copyWith(
      isLikedByCustomer: !post.isLikedByCustomer,
      likesCount: post.likesCount + (post.isLikedByCustomer ? -1 : 1),
    );

    setState(() => _posts[index] = optimistic);

    try {
      await widget.feedRepository.toggleLike(
        post: post,
        customerId: widget.session.customer.id,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _posts[index] = post);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _openComments(FeedPost post) async {
    final controller = TextEditingController();
    final index = _posts.indexWhere((item) => item.id == post.id);
    if (index == -1) {
      return;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        bool sending = false;
        return StatefulBuilder(
          builder: (context, setModalState) {
            final currentPost = _posts[index];
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Comentários',
                    subtitle: 'Conversa rápida, limpa e dentro do post.',
                  ),
                  const SizedBox(height: 14),
                  Flexible(
                    child: currentPost.comments.isEmpty
                        ? const EmptyStateCard(
                            title: 'Sem comentários ainda',
                            message:
                                'Seja a primeira cliente a puxar a conversa.',
                            icon: Icons.chat_bubble_outline_rounded,
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            itemCount: currentPost.comments.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, commentIndex) {
                              final comment =
                                  currentPost.comments[commentIndex];
                              return SalonPanel(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      comment.customerName,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      comment.body,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Escreva um comentário',
                      hintText: 'Ex.: amei esse resultado',
                    ),
                  ),
                  const SizedBox(height: 12),
                  AsyncButton(
                    label: 'Publicar comentário',
                    isBusy: sending,
                    icon: Icons.send_rounded,
                    onPressed: () async {
                      if (controller.text.trim().isEmpty) {
                        return;
                      }
                      setModalState(() => sending = true);
                      try {
                        final comment = await widget.feedRepository.addComment(
                          postId: post.id,
                          customerId: widget.session.customer.id,
                          customerName: widget.session.customer.name,
                          body: controller.text,
                        );
                        if (!mounted) {
                          return;
                        }
                        setState(() {
                          _posts[index] = currentPost.copyWith(
                            comments: [comment, ...currentPost.comments],
                          );
                        });
                        controller.clear();
                        setModalState(() => sending = false);
                      } catch (error) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$error'.replaceFirst('Exception: ', ''),
                            ),
                          ),
                        );
                        setModalState(() => sending = false);
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(preview?.brandColor);
    final now = DateTime.now();
    final todaysHighlights = _posts
        .where((post) => isFeedHighlightForDay(post, now))
        .take(6)
        .toList();
    final totalLikes = _posts.fold<int>(
      0,
      (sum, post) => sum + post.likesCount,
    );
    final totalComments = _posts.fold<int>(
      0,
      (sum, post) => sum + post.commentsCount,
    );
    final postWithGalleryCount = _posts
        .where((post) => post.imageUrls.length > 1)
        .length;
    final likedPostsCount = _posts
        .where((post) => post.isLikedByCustomer)
        .length;
    final latestPost = _posts.isEmpty ? null : _posts.first;

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl:
            preview?.galleryCoverImageUrl ?? preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                SalonPanel(
                  accent: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Pill(
                            label: 'Feed social',
                            icon: Icons.auto_awesome_rounded,
                            backgroundColor: accent.withValues(alpha: 0.12),
                            foregroundColor: accent,
                          ),
                          if (preview?.segmentLabel.trim().isNotEmpty == true)
                            Pill(
                              label: preview!.segmentLabel,
                              icon: Icons.storefront_rounded,
                            ),
                          if (latestPost != null)
                            Pill(
                              label:
                                  'Último post ${formatShortDate(latestPost.createdAt)}',
                              icon: Icons.history_toggle_off_rounded,
                              backgroundColor: AppTheme.accent.withValues(
                                alpha: 0.22,
                              ),
                              foregroundColor: AppTheme.ink,
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Feed com cara de vitrine viva e conversa real.',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Veja resultados, bastidores e novidades do salão em uma experiência social mais polida, rápida e visual.',
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(height: 20),
                      _FeedMetricGrid(
                        children: [
                          _FeedMetricCard(
                            icon: Icons.grid_view_rounded,
                            label: 'Posts ativos',
                            value: '${_posts.length}',
                            support: _posts.isEmpty
                                ? 'Sem publicações no momento'
                                : 'Vitrine social em movimento',
                            tone: accent,
                          ),
                          _FeedMetricCard(
                            icon: Icons.favorite_rounded,
                            label: 'Curtidas',
                            value: '$totalLikes',
                            support: likedPostsCount == 0
                                ? 'Nenhum like seu por enquanto'
                                : '$likedPostsCount posts curtidos por você',
                            tone: AppTheme.primary,
                          ),
                          _FeedMetricCard(
                            icon: Icons.chat_bubble_rounded,
                            label: 'Comentários',
                            value: '$totalComments',
                            support: totalComments == 0
                                ? 'Conversa ainda pode crescer'
                                : 'Comunidade respondendo ao salão',
                            tone: AppTheme.secondary,
                          ),
                          _FeedMetricCard(
                            icon: Icons.collections_rounded,
                            label: 'Galerias',
                            value: '$postWithGalleryCount',
                            support: postWithGalleryCount == 0
                                ? 'Posts diretos e objetivos'
                                : 'Posts com múltiplas imagens',
                            tone: AppTheme.accent,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_posts.isEmpty)
                  const EmptyStateCard(
                    title: 'Feed sem posts no momento',
                    message:
                        'Assim que o salão publicar algo novo, tudo aparece aqui.',
                    icon: Icons.perm_media_outlined,
                  )
                else ...[
                  if (todaysHighlights.isNotEmpty) ...[
                    const SectionTitle(
                      title: 'Destaques do dia',
                      subtitle:
                          'Só entram aqui as publicações feitas hoje pelo salão.',
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 124,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: todaysHighlights.length,
                        separatorBuilder: (context, index) =>
                            const SizedBox(width: 12),
                        itemBuilder: (context, index) {
                          return _FeedHighlightCard(
                            post: todaysHighlights[index],
                            accent: accent,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  ..._posts.map(
                    (post) => Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _FeedPostCard(
                        post: post,
                        accent: accent,
                        fallbackAvatarUrl:
                            preview?.instagramProfileImageUrl ??
                            preview?.logoUrl,
                        onLike: () => _toggleLike(post),
                        onComment: () => _openComments(post),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FeedMetricGrid extends StatelessWidget {
  const _FeedMetricGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

class _FeedMetricCard extends StatelessWidget {
  const _FeedMetricCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.support,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final String value;
  final String support;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return SurfaceMetricCard(
      icon: icon,
      label: label,
      value: value,
      support: support,
      tone: tone,
    );
  }
}

class _FeedHighlightCard extends StatelessWidget {
  const _FeedHighlightCard({required this.post, required this.accent});

  final FeedPost post;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 92,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [accent, AppTheme.accent],
              ),
              borderRadius: BorderRadius.circular(999),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: SizedBox(
                width: 78,
                height: 78,
                child: post.imageUrls.isEmpty
                    ? _FeedImagePlaceholder(accent: accent)
                    : Image.network(
                        post.imageUrls.first,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) {
                          return _FeedImagePlaceholder(accent: accent);
                        },
                        loadingBuilder: (context, child, progress) {
                          if (progress == null) {
                            return child;
                          }
                          return _FeedImagePlaceholder(accent: accent);
                        },
                      ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            post.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: AppTheme.ink),
          ),
        ],
      ),
    );
  }
}

class _FeedPostCard extends StatefulWidget {
  const _FeedPostCard({
    required this.post,
    required this.accent,
    required this.fallbackAvatarUrl,
    required this.onLike,
    required this.onComment,
  });

  final FeedPost post;
  final Color accent;
  final String? fallbackAvatarUrl;
  final VoidCallback onLike;
  final VoidCallback onComment;

  @override
  State<_FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends State<_FeedPostCard> {
  late final PageController _pageController;
  int _pageIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final visibleCaption = visibleFeedCaptionForDisplay(post);
    return SalonPanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _FeedAuthorAvatar(
                post: post,
                accent: widget.accent,
                fallbackAvatarUrl: widget.fallbackAvatarUrl,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      post.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _feedMetaLabel(post),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (post.serviceName?.trim().isNotEmpty == true)
                Pill(label: post.serviceName!, icon: Icons.spa_rounded),
              if (post.staffName?.trim().isNotEmpty == true)
                Pill(
                  label: post.staffName!,
                  icon: Icons.person_rounded,
                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.08),
                ),
              Pill(
                label: _postTypeLabel(post.postType),
                backgroundColor: widget.accent.withValues(alpha: 0.12),
                foregroundColor: widget.accent,
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: SizedBox(
              height: 368,
              child: post.imageUrls.isEmpty
                  ? _FeedImagePlaceholder(accent: widget.accent)
                  : PageView.builder(
                      controller: _pageController,
                      itemCount: post.imageUrls.length,
                      onPageChanged: (index) =>
                          setState(() => _pageIndex = index),
                      itemBuilder: (context, index) {
                        return NetworkCardImage(
                          imageUrl: post.imageUrls[index],
                          height: 368,
                          borderRadius: 0,
                        );
                      },
                    ),
            ),
          ),
          if (post.imageUrls.length > 1) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                post.imageUrls.length,
                (index) => AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: index == _pageIndex ? 18 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: index == _pageIndex ? widget.accent : AppTheme.line,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              IconButton.filledTonal(
                onPressed: widget.onLike,
                icon: Icon(
                  post.isLikedByCustomer
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  color: post.isLikedByCustomer ? AppTheme.primary : null,
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                onPressed: widget.onComment,
                icon: const Icon(Icons.mode_comment_outlined),
              ),
              const Spacer(),
              Pill(
                label: '${post.likesCount} curtidas',
                backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                foregroundColor: AppTheme.primary,
              ),
              const SizedBox(width: 8),
              Pill(
                label: '${post.commentsCount} comentários',
                backgroundColor: AppTheme.secondary.withValues(alpha: 0.08),
                foregroundColor: AppTheme.secondary,
              ),
            ],
          ),
          if (visibleCaption != null) ...[
            const SizedBox(height: 12),
            Text(visibleCaption, style: Theme.of(context).textTheme.bodyLarge),
          ],
          if (post.comments.isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: post.comments
                    .take(2)
                    .map(
                      (comment) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: RichText(
                          text: TextSpan(
                            style: Theme.of(context).textTheme.bodySmall,
                            children: [
                              TextSpan(
                                text: '${comment.customerName} ',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              TextSpan(text: comment.body),
                            ],
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _FeedAuthorAvatar extends StatelessWidget {
  const _FeedAuthorAvatar({
    required this.post,
    required this.accent,
    this.fallbackAvatarUrl,
  });

  final FeedPost post;
  final Color accent;
  final String? fallbackAvatarUrl;

  @override
  Widget build(BuildContext context) {
    final avatarUrl =
        (post.authorAvatarUrl?.trim().isNotEmpty == true
                ? post.authorAvatarUrl?.trim()
                : fallbackAvatarUrl?.trim())
            ?.trim();

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.22), Colors.white],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(2),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: avatarUrl == null || avatarUrl.isEmpty
            ? Container(
                color: Colors.transparent,
                alignment: Alignment.center,
                child: Icon(Icons.cut_rounded, color: accent, size: 22),
              )
            : Image.network(
                avatarUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: Colors.transparent,
                    alignment: Alignment.center,
                    child: Icon(Icons.cut_rounded, color: accent, size: 22),
                  );
                },
                loadingBuilder: (context, child, progress) {
                  if (progress == null) {
                    return child;
                  }
                  return Container(
                    color: Colors.transparent,
                    alignment: Alignment.center,
                    child: Icon(Icons.cut_rounded, color: accent, size: 22),
                  );
                },
              ),
      ),
    );
  }
}

class _FeedImagePlaceholder extends StatelessWidget {
  const _FeedImagePlaceholder({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.22), AppTheme.panel],
        ),
      ),
      child: Center(
        child: Icon(Icons.auto_awesome_rounded, size: 32, color: accent),
      ),
    );
  }
}

String _postTypeLabel(String value) {
  switch (value.trim().toLowerCase()) {
    case 'before_after':
      return 'Antes e depois';
    case 'reel':
      return 'Vídeo';
    case 'standard':
      return 'Foto';
    default:
      return 'Destaque';
  }
}

String _feedMetaLabel(FeedPost post) {
  final parts = <String>[formatCompactDateTime(post.createdAt)];
  final sourceType = post.sourceType?.trim().toLowerCase();
  final authorUsername = post.authorUsername?.trim();

  if (sourceType == 'instagram_mention' ||
      sourceType == 'instagram_owned_post') {
    parts.add(
      authorUsername == null || authorUsername.isEmpty
          ? 'Instagram'
          : 'Instagram • @${authorUsername.replaceFirst(RegExp(r'^@+'), '')}',
    );
  }

  return parts.join(' • ');
}

bool isFeedHighlightForDay(FeedPost post, DateTime day) {
  return _isSameLocalDay(post.createdAt, day);
}

String? visibleFeedCaptionForDisplay(FeedPost post) {
  return _visibleFeedCaption(post);
}

bool _isSameLocalDay(DateTime left, DateTime right) {
  final leftLocal = left.toLocal();
  final rightLocal = right.toLocal();
  return leftLocal.year == rightLocal.year &&
      leftLocal.month == rightLocal.month &&
      leftLocal.day == rightLocal.day;
}

String? _visibleFeedCaption(FeedPost post) {
  final rawCaption = post.caption?.trim();
  if (rawCaption == null || rawCaption.isEmpty) {
    return null;
  }

  if (post.imageUrls.isEmpty) {
    return rawCaption;
  }

  final withoutUrls = rawCaption
      .replaceAll(RegExp(r'https?://\S+', caseSensitive: false), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  return withoutUrls.isEmpty ? null : withoutUrls;
}
