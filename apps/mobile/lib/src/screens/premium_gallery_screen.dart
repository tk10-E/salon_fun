import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_service_chip.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/salon_feed_post_card.dart';

enum _PremiumGalleryFilter { all, beforeAfter, reels, linked }

class PremiumGalleryScreen extends StatefulWidget {
  const PremiumGalleryScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.posts,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.onToggleLike,
    required this.onOpenComments,
    required this.onBookService,
    required this.busyPostIds,
    this.initialPostId,
    this.onOpenVideo,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<SalonPost> posts;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final Future<void> Function(SalonPost post) onToggleLike;
  final Future<void> Function(SalonPost post) onOpenComments;
  final Future<void> Function(ServiceItem service) onBookService;
  final Set<String> busyPostIds;
  final String? initialPostId;
  final Future<void> Function(SalonPost post)? onOpenVideo;

  @override
  State<PremiumGalleryScreen> createState() => _PremiumGalleryScreenState();
}

class _PremiumGalleryScreenState extends State<PremiumGalleryScreen> {
  _PremiumGalleryFilter _filter = _PremiumGalleryFilter.all;
  late final PageController _featuredController;
  int _featuredIndex = 0;

  @override
  void initState() {
    super.initState();
    _featuredController = PageController(viewportFraction: 0.82);
    final initialPostId = widget.initialPostId?.trim();
    if (initialPostId != null && initialPostId.isNotEmpty) {
      final initialIndex = widget.posts.indexWhere(
        (post) => post.id == initialPostId,
      );
      if (initialIndex >= 0) {
        _featuredIndex = initialIndex;
      }
    }
  }

  @override
  void dispose() {
    _featuredController.dispose();
    super.dispose();
  }

  void _applyFilter(_PremiumGalleryFilter filter) {
    setState(() {
      _filter = filter;
      _featuredIndex = 0;
    });

    if (_featuredController.hasClients) {
      _featuredController.jumpToPage(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final galleryTitle = _galleryTitle(widget.profile.salonBusinessSegment);
    final galleryEmptyTitle = _galleryEmptyTitle(
      widget.profile.salonBusinessSegment,
    );
    final galleryEmptyMessage = _galleryEmptyMessage(
      widget.profile.salonBusinessSegment,
    );
    final visiblePosts = widget.posts
        .where((post) {
          switch (_filter) {
            case _PremiumGalleryFilter.beforeAfter:
              return post.isBeforeAfter;
            case _PremiumGalleryFilter.reels:
              return post.isReel;
            case _PremiumGalleryFilter.linked:
              return post.linkedService != null;
            case _PremiumGalleryFilter.all:
              return true;
          }
        })
        .toList(growable: false);
    final discoverPosts = visiblePosts.isEmpty ? widget.posts : visiblePosts;
    final safeFeaturedIndex = discoverPosts.isEmpty
        ? 0
        : _featuredIndex.clamp(0, discoverPosts.length - 1);

    return AppBackdrop(
      branding: widget.branding,
      child: RefreshIndicator(
        onRefresh: widget.onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
          children: [
            PremiumSectionHeader(
              eyebrow: 'Discover',
              title: galleryTitle,
              subtitle:
                  'Resultados reais e referências para decidir sem excesso de informação.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            if (widget.posts.isEmpty)
              PremiumEmptyState(
                eyebrow: 'Vitrine da marca',
                title: galleryEmptyTitle,
                message: galleryEmptyMessage,
                actionLabel: 'Falar com o salão',
                onAction: widget.onWhatsApp,
                icon: Icons.photo_library_outlined,
              )
            else ...[
              _DiscoverStage(
                profile: widget.profile,
                branding: widget.branding,
                posts: discoverPosts,
                currentIndex: safeFeaturedIndex,
                controller: _featuredController,
                onPageChanged: (index) =>
                    setState(() => _featuredIndex = index),
                onWhatsApp: widget.onWhatsApp,
                onToggleLike: (post) => unawaited(widget.onToggleLike(post)),
                onOpenComments: (post) =>
                    unawaited(widget.onOpenComments(post)),
                onBookService: (service) =>
                    unawaited(widget.onBookService(service)),
                onOpenVideo: widget.onOpenVideo == null
                    ? null
                    : (post) => unawaited(widget.onOpenVideo!(post)),
              ),
              const SizedBox(height: PremiumSpacing.lg),
              Wrap(
                spacing: PremiumSpacing.sm,
                runSpacing: PremiumSpacing.sm,
                children: [
                  _GalleryInsightChip(
                    branding: widget.branding,
                    icon: Icons.auto_awesome_rounded,
                    label: '${widget.posts.length} referências reais',
                  ),
                  _GalleryInsightChip(
                    branding: widget.branding,
                    icon: Icons.calendar_month_rounded,
                    label:
                        '${widget.posts.where((post) => post.linkedService != null).length} com reserva',
                  ),
                  _GalleryInsightChip(
                    branding: widget.branding,
                    icon: Icons.compare_arrows_rounded,
                    label:
                        '${widget.posts.where((post) => post.isBeforeAfter).length} transformações',
                  ),
                  _GalleryInsightChip(
                    branding: widget.branding,
                    icon: Icons.play_circle_outline_rounded,
                    label:
                        '${widget.posts.where((post) => post.isReel).length} vídeos curtos',
                  ),
                ],
              ),
              const SizedBox(height: PremiumSpacing.xl),
              PremiumSectionHeader(
                eyebrow: 'Curadoria',
                title: 'Coleções em destaque',
                subtitle:
                    'Filtros premium para navegar o conteúdo com mais rapidez.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              Wrap(
                spacing: PremiumSpacing.sm,
                runSpacing: PremiumSpacing.sm,
                children: [
                  _FilterChip(
                    label: 'Tudo',
                    selected: _filter == _PremiumGalleryFilter.all,
                    onTap: () => _applyFilter(_PremiumGalleryFilter.all),
                  ),
                  _FilterChip(
                    label: 'Reel',
                    selected: _filter == _PremiumGalleryFilter.reels,
                    onTap: () => _applyFilter(_PremiumGalleryFilter.reels),
                  ),
                  _FilterChip(
                    label: 'Antes e depois',
                    selected: _filter == _PremiumGalleryFilter.beforeAfter,
                    onTap: () =>
                        _applyFilter(_PremiumGalleryFilter.beforeAfter),
                  ),
                  _FilterChip(
                    label: 'Reserva',
                    selected: _filter == _PremiumGalleryFilter.linked,
                    onTap: () => _applyFilter(_PremiumGalleryFilter.linked),
                  ),
                ],
              ),
              const SizedBox(height: PremiumSpacing.xl),
              if (visiblePosts.isEmpty)
                PremiumEmptyState(
                  eyebrow: 'Coleção vazia',
                  title: 'Ainda não há conteúdo nessa seleção',
                  message:
                      'Volte para a curadoria completa ou fale com o salão para pedir uma referência mais próxima do que você quer agora.',
                  actionLabel: _filter == _PremiumGalleryFilter.all
                      ? 'Falar com o salão'
                      : 'Ver tudo',
                  onAction: _filter == _PremiumGalleryFilter.all
                      ? widget.onWhatsApp
                      : () => _applyFilter(_PremiumGalleryFilter.all),
                  icon: Icons.filter_alt_off_rounded,
                )
              else ...[
                if (visiblePosts.length >= 2) ...[
                  PremiumSectionHeader(
                    eyebrow: 'Radar visual',
                    title: 'Duas referências de impacto',
                    subtitle:
                        'Um recorte rápido para quem quer decidir sem rolar muito.',
                  ),
                  const SizedBox(height: PremiumSpacing.md),
                  SizedBox(
                    height: 188,
                    child: Row(
                      children: [
                        Expanded(
                          child: PremiumGalleryCard(
                            title: visiblePosts[0].title,
                            subtitle: visiblePosts[0].staffMemberName,
                            imageUrl: visiblePosts[0].coverImageUrl,
                            badge: visiblePosts[0].postType.label,
                          ),
                        ),
                        const SizedBox(width: PremiumSpacing.md),
                        Expanded(
                          child: PremiumGalleryCard(
                            title: visiblePosts[1].title,
                            subtitle: visiblePosts[1].staffMemberName,
                            imageUrl: visiblePosts[1].coverImageUrl,
                            badge: visiblePosts[1].linkedService != null
                                ? 'Agenda'
                                : visiblePosts[1].postType.label,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: PremiumSpacing.xl),
                ],
                PremiumSectionHeader(
                  eyebrow: 'Conversão',
                  title: 'Feed do salão',
                  subtitle:
                      'Interação, prova social e CTA de agenda no mesmo fluxo.',
                ),
                const SizedBox(height: PremiumSpacing.md),
                ...visiblePosts.map(
                  (post) => Padding(
                    padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                    child: SalonFeedPostCard(
                      post: post,
                      branding: widget.branding,
                      interactionBusy: widget.busyPostIds.contains(post.id),
                      onToggleLike: () => widget.onToggleLike(post),
                      onOpenComments: () => widget.onOpenComments(post),
                      onContactSalon: widget.onWhatsApp,
                      onOpenVideo:
                          post.videoUrl == null || widget.onOpenVideo == null
                          ? null
                          : () => widget.onOpenVideo!(post),
                      onBookService: post.linkedService == null
                          ? null
                          : () => widget.onBookService(post.linkedService!),
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _DiscoverStage extends StatelessWidget {
  const _DiscoverStage({
    required this.profile,
    required this.branding,
    required this.posts,
    required this.currentIndex,
    required this.controller,
    required this.onPageChanged,
    required this.onWhatsApp,
    required this.onToggleLike,
    required this.onOpenComments,
    required this.onBookService,
    this.onOpenVideo,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<SalonPost> posts;
  final int currentIndex;
  final PageController controller;
  final ValueChanged<int> onPageChanged;
  final VoidCallback onWhatsApp;
  final ValueChanged<SalonPost> onToggleLike;
  final ValueChanged<SalonPost> onOpenComments;
  final ValueChanged<ServiceItem> onBookService;
  final ValueChanged<SalonPost>? onOpenVideo;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activePost = posts[currentIndex];
    final secondaryLeft = posts.length > 1
        ? posts[(currentIndex + 1) % posts.length]
        : null;
    final secondaryRight = posts.length > 2
        ? posts[(currentIndex + 2) % posts.length]
        : null;
    final discoverSubtitle = profile.salonTagline?.trim().isNotEmpty == true
        ? profile.salonTagline!.trim()
        : 'Curadoria de resultados reais do ${profile.salonName}.';

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(PremiumRadius.cardLarge),
        gradient: LinearGradient(
          colors: [
            Color.lerp(branding.primary, Colors.white, 0.78)!,
            Color.lerp(branding.soft, Colors.white, 0.35)!,
            Colors.white,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: branding.outline.withValues(alpha: 0.28)),
        boxShadow: PremiumShadow.strong(branding.primary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.88),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: branding.outline.withValues(alpha: 0.28),
                  ),
                ),
                child: Center(
                  child: SalonBrandMark(
                    salonName: profile.salonName,
                    branding: branding,
                    logoUrl: profile.salonLogoUrl,
                    size: 30,
                  ),
                ),
              ),
              const SizedBox(width: PremiumSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Discover',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: const Color(0xFF211913),
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      discoverSubtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B5548),
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: PremiumSpacing.sm),
              _DiscoverCounterPill(
                branding: branding,
                currentIndex: currentIndex,
                total: posts.length,
              ),
            ],
          ),
          const SizedBox(height: PremiumSpacing.xl),
          SizedBox(
            height: 470,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  top: 4,
                  left: 12,
                  child: _GlowBubble(
                    color: branding.primary.withValues(alpha: 0.18),
                    size: 76,
                  ),
                ),
                Positioned(
                  top: 62,
                  right: 24,
                  child: _GlowBubble(
                    color: branding.deep.withValues(alpha: 0.12),
                    size: 36,
                  ),
                ),
                Positioned(
                  bottom: 32,
                  left: 0,
                  child: _GlowBubble(
                    color: Colors.white.withValues(alpha: 0.68),
                    size: 120,
                  ),
                ),
                if (secondaryLeft != null)
                  Positioned(
                    left: 22,
                    right: 88,
                    top: 56,
                    bottom: 58,
                    child: Transform.rotate(
                      angle: -0.16,
                      child: _DiscoverBackdropCard(
                        post: secondaryLeft,
                        branding: branding,
                      ),
                    ),
                  ),
                if (secondaryRight != null)
                  Positioned(
                    left: 94,
                    right: 16,
                    top: 40,
                    bottom: 78,
                    child: Transform.rotate(
                      angle: 0.13,
                      child: _DiscoverBackdropCard(
                        post: secondaryRight,
                        branding: branding,
                      ),
                    ),
                  ),
                Positioned.fill(
                  child: PageView.builder(
                    controller: controller,
                    clipBehavior: Clip.none,
                    itemCount: posts.length,
                    onPageChanged: onPageChanged,
                    itemBuilder: (context, index) {
                      final post = posts[index];
                      return AnimatedBuilder(
                        animation: controller,
                        child: Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _DiscoverActiveCard(
                            post: post,
                            branding: branding,
                            onWhatsApp: onWhatsApp,
                            onToggleLike: () => onToggleLike(post),
                            onOpenComments: () => onOpenComments(post),
                            onBookService: post.linkedService == null
                                ? null
                                : () => onBookService(post.linkedService!),
                            onOpenVideo:
                                post.videoUrl == null || onOpenVideo == null
                                ? null
                                : () => onOpenVideo!(post),
                          ),
                        ),
                        builder: (context, child) {
                          var page = currentIndex.toDouble();
                          if (controller.hasClients &&
                              controller.positions.length == 1) {
                            final position = controller.position;
                            if (position.hasContentDimensions) {
                              page = controller.page ?? currentIndex.toDouble();
                            }
                          }

                          final delta = index - page;
                          final distance = delta.abs().clamp(0.0, 1.0);
                          final scale = 1 - (distance * 0.08);
                          final translateY = 22 * distance;
                          final rotation = delta * 0.04;

                          return Transform.translate(
                            offset: Offset(delta * 4, translateY),
                            child: Transform.rotate(
                              angle: rotation,
                              child: Transform.scale(
                                scale: scale,
                                alignment: Alignment.bottomCenter,
                                child: child,
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: PremiumSpacing.sm),
          Row(
            children: [
              Wrap(
                spacing: 8,
                children: List<Widget>.generate(
                  posts.length,
                  (index) => AnimatedContainer(
                    duration: PremiumMotion.normal,
                    width: index == currentIndex ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: index == currentIndex
                          ? branding.primary
                          : branding.outline.withValues(alpha: 0.48),
                      borderRadius: BorderRadius.circular(PremiumRadius.pill),
                    ),
                  ),
                ),
              ),
              const Spacer(),
              Text(
                '${activePost.likeCount} curtidas • ${activePost.commentCount} comentários',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF6B5548),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DiscoverActiveCard extends StatelessWidget {
  const _DiscoverActiveCard({
    required this.post,
    required this.branding,
    required this.onWhatsApp,
    required this.onToggleLike,
    required this.onOpenComments,
    this.onBookService,
    this.onOpenVideo,
  });

  final SalonPost post;
  final SalonBranding branding;
  final VoidCallback onWhatsApp;
  final VoidCallback onToggleLike;
  final VoidCallback onOpenComments;
  final VoidCallback? onBookService;
  final VoidCallback? onOpenVideo;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final caption = post.caption?.trim();
    final detailLine = [
      post.staffMemberName,
      post.staffMemberRole,
      post.linkedService?.name,
    ].whereType<String>().where((item) => item.trim().isNotEmpty).join(' • ');

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(34),
        boxShadow: PremiumShadow.strong(branding.deep, dark: true),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(34),
        child: Stack(
          children: [
            Positioned.fill(
              child: _DiscoverImage(
                imageUrl: post.coverImageUrl,
                alignment: post.isBeforeAfter
                    ? Alignment.centerLeft
                    : Alignment.center,
              ),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.black.withValues(alpha: 0.08),
                      Colors.black.withValues(alpha: 0.16),
                      Colors.black.withValues(alpha: 0.68),
                    ],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
            Positioned(
              top: 18,
              left: 18,
              child: Wrap(
                spacing: PremiumSpacing.xs,
                runSpacing: PremiumSpacing.xs,
                children: [
                  _DiscoverTopChip(
                    label: post.postType.label,
                    icon: post.isReel
                        ? Icons.play_circle_outline_rounded
                        : post.isBeforeAfter
                        ? Icons.compare_rounded
                        : Icons.photo_camera_back_outlined,
                  ),
                  if (post.linkedService != null)
                    const _DiscoverTopChip(
                      label: 'Reserva',
                      icon: Icons.calendar_month_rounded,
                    ),
                ],
              ),
            ),
            Positioned(
              top: 18,
              right: 18,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: PremiumSpacing.sm,
                  vertical: PremiumSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(PremiumRadius.pill),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Text(
                  DateFormat('dd/MM').format(post.createdAt),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            Positioned(
              right: 16,
              bottom: 124,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _DiscoverRailAction(
                    icon: post.isReel && onOpenVideo != null
                        ? Icons.play_arrow_rounded
                        : Icons.mode_comment_outlined,
                    filled: false,
                    onTap: post.isReel && onOpenVideo != null
                        ? onOpenVideo!
                        : onOpenComments,
                  ),
                  const SizedBox(height: PremiumSpacing.sm),
                  _DiscoverRailAction(
                    icon: onBookService != null
                        ? Icons.calendar_month_rounded
                        : Icons.chat_bubble_outline_rounded,
                    filled: false,
                    onTap: onBookService ?? onWhatsApp,
                  ),
                  const SizedBox(height: PremiumSpacing.sm),
                  _DiscoverRailAction(
                    icon: post.likedByMe
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                    filled: true,
                    backgroundColor: const Color(0xFFF85179),
                    iconColor: Colors.white,
                    onTap: onToggleLike,
                  ),
                ],
              ),
            ),
            Positioned(
              left: 20,
              right: 92,
              bottom: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    post.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      height: 1.04,
                    ),
                  ),
                  if (detailLine.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      detailLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (caption?.isNotEmpty == true) ...[
                    const SizedBox(height: 8),
                    Text(
                      caption!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.84),
                        height: 1.3,
                      ),
                    ),
                  ],
                  const SizedBox(height: PremiumSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: onBookService ?? onWhatsApp,
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF221A13),
                            padding: const EdgeInsets.symmetric(
                              horizontal: PremiumSpacing.md,
                              vertical: PremiumSpacing.sm,
                            ),
                            textStyle: theme.textTheme.labelLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          icon: Icon(
                            onBookService != null
                                ? Icons.calendar_month_rounded
                                : Icons.chat_rounded,
                          ),
                          label: Text(
                            onBookService != null
                                ? 'Quero esse resultado'
                                : 'Falar com o salão',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DiscoverBackdropCard extends StatelessWidget {
  const _DiscoverBackdropCard({required this.post, required this.branding});

  final SalonPost post;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: 0.88,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: Colors.white.withValues(alpha: 0.42)),
          boxShadow: PremiumShadow.soft(branding.primary),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(30),
          child: Stack(
            children: [
              Positioned.fill(
                child: _DiscoverImage(
                  imageUrl: post.coverImageUrl,
                  alignment: Alignment.center,
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.white.withValues(alpha: 0.12),
                        Colors.black.withValues(alpha: 0.46),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Text(
                  post.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    height: 1.05,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscoverImage extends StatelessWidget {
  const _DiscoverImage({required this.imageUrl, required this.alignment});

  final String imageUrl;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      alignment: alignment,
      errorBuilder: (context, error, stackTrace) => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFEAD8D1), Color(0xFFD6B9AE)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(
          child: Icon(
            Icons.photo_camera_back_outlined,
            color: Color(0xFF8F6E62),
            size: 42,
          ),
        ),
      ),
    );
  }
}

class _DiscoverRailAction extends StatelessWidget {
  const _DiscoverRailAction({
    required this.icon,
    required this.onTap,
    required this.filled,
    this.backgroundColor,
    this.iconColor,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;
  final Color? backgroundColor;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final bg =
        backgroundColor ??
        (filled ? Colors.white : Colors.white.withValues(alpha: 0.18));

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          ),
          child: Icon(
            icon,
            color:
                iconColor ?? (filled ? const Color(0xFF251B15) : Colors.white),
            size: 26,
          ),
        ),
      ),
    );
  }
}

class _DiscoverTopChip extends StatelessWidget {
  const _DiscoverTopChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _DiscoverCounterPill extends StatelessWidget {
  const _DiscoverCounterPill({
    required this.branding,
    required this.currentIndex,
    required this.total,
  });

  final SalonBranding branding;
  final int currentIndex;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: branding.outline.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.tune_rounded, color: branding.deep, size: 18),
          const SizedBox(width: 8),
          Text(
            '${currentIndex + 1}/$total',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowBubble extends StatelessWidget {
  const _GlowBubble({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _GalleryInsightChip extends StatelessWidget {
  const _GalleryInsightChip({
    required this.branding,
    required this.icon,
    required this.label,
  });

  final SalonBranding branding;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.md,
        vertical: PremiumSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: branding.outline.withValues(alpha: 0.36)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: const Color(0xFF2B2019),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PremiumServiceChip(
      label: label,
      icon: Icons.tune_rounded,
      selected: selected,
      onTap: onTap,
    );
  }
}

String _galleryTitle(String? segment) {
  switch (segment) {
    case 'barbershop':
      return 'Portfólio da barbearia';
    default:
      return 'Galeria do salão';
  }
}

String _galleryEmptyTitle(String? segment) {
  switch (segment) {
    case 'barbershop':
      return 'A assinatura da barbearia vai aparecer aqui';
    default:
      return 'Os próximos resultados do salão vão aparecer aqui';
  }
}

String _galleryEmptyMessage(String? segment) {
  switch (segment) {
    case 'barbershop':
      return 'Quando a barbearia publicar cortes, barba e finalizações, o feed vira uma vitrine de autoridade e desejo.';
    default:
      return 'Quando o salão publicar trabalhos, a galeria vira uma vitrine comercial pronta para gerar desejo e agendamento.';
  }
}
