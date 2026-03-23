import 'dart:ui';

import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../../theme/salon_experience_preset.dart';
import '../empty_state.dart';
import '../press_feedback.dart';
import '../salon_feed_post_card.dart';
import '../soft_card.dart';
import 'home_history_brand_header.dart';
import 'home_section_intro.dart';

class HomeFeedTab extends StatefulWidget {
  const HomeFeedTab({
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
  final Future<void> Function(SalonPost post)? onOpenVideo;

  @override
  State<HomeFeedTab> createState() => _HomeFeedTabState();
}

class _HomeFeedTabState extends State<HomeFeedTab> {
  _FeedStoryFilter _selectedFilter = _FeedStoryFilter.all;

  @override
  void didUpdateWidget(covariant HomeFeedTab oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (_selectedFilter != _FeedStoryFilter.all &&
        !_hasMatches(widget.posts, _selectedFilter)) {
      _selectedFilter = _FeedStoryFilter.all;
    }
  }

  @override
  Widget build(BuildContext context) {
    final preset = SalonExperiencePreset.fromBusinessSegment(
      widget.profile.salonBusinessSegment,
    );
    final linkedPostsCount = widget.posts
        .where((post) => post.linkedService != null)
        .length;
    final beforeAfterCount = widget.posts
        .where((post) => post.isBeforeAfter)
        .length;
    final reelCount = widget.posts.where((post) => post.isReel).length;
    final highlightedProfessionalsCount = widget.posts
        .map((post) => post.staffMemberName)
        .whereType<String>()
        .toSet()
        .length;
    final visiblePosts = widget.posts
        .where((post) => _matchesFilter(post, _selectedFilter))
        .toList();

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          HomeHistoryBrandHeader(
            profile: widget.profile,
            branding: widget.branding,
            appointmentCount: widget.posts.length,
            collectionLabel: widget.posts.length == 1
                ? '1 resultado publicado'
                : '${widget.posts.length} resultados publicados',
            fallbackMessage:
                'Resultados, referências e novidades com a identidade do seu salão.',
          ),
          const SizedBox(height: 20),
          HomeSectionIntro(
            eyebrow: preset.feedEyebrow,
            title: preset.feedTitle,
            description: preset.feedDescription,
          ),
          const SizedBox(height: 16),
          if (widget.posts.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.photo_library_outlined,
              eyebrow: preset.feedEyebrow,
              title: preset.feedEmptyTitle,
              message: preset.feedEmptyMessage,
              actionLabel: 'Falar com o salão',
              onAction: widget.onWhatsApp,
              accentColor: widget.branding.primary,
            )
          else
            Column(
              children: [
                _FeedConversionCard(
                  branding: widget.branding,
                  preset: preset,
                  postCount: widget.posts.length,
                  linkedPostsCount: linkedPostsCount,
                  beforeAfterCount: beforeAfterCount,
                  reelCount: reelCount,
                  highlightedProfessionalsCount: highlightedProfessionalsCount,
                  onWhatsApp: widget.onWhatsApp,
                  selectedFilter: _selectedFilter,
                  visiblePostCount: visiblePosts.length,
                  onSelectFilter: (filter) {
                    setState(() => _selectedFilter = filter);
                  },
                  onOpenStoryViewer: _openStoryViewer,
                ),
                const SizedBox(height: 16),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  child: visiblePosts.isEmpty
                      ? _FeedFilterEmptyState(
                          key: ValueKey<_FeedStoryFilter>(_selectedFilter),
                          branding: widget.branding,
                          filter: _selectedFilter,
                          onReset: () {
                            setState(
                              () => _selectedFilter = _FeedStoryFilter.all,
                            );
                          },
                        )
                      : Column(
                          key: ValueKey<_FeedStoryFilter>(_selectedFilter),
                          children: visiblePosts
                              .map(
                                (post) => Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: SalonFeedPostCard(
                                    post: post,
                                    branding: widget.branding,
                                    interactionBusy: widget.busyPostIds
                                        .contains(post.id),
                                    onToggleLike: () =>
                                        widget.onToggleLike(post),
                                    onOpenComments: () =>
                                        widget.onOpenComments(post),
                                    onContactSalon: widget.onWhatsApp,
                                    onOpenVideo:
                                        post.videoUrl == null ||
                                            widget.onOpenVideo == null
                                        ? null
                                        : () => widget.onOpenVideo!(post),
                                    onBookService: post.linkedService == null
                                        ? null
                                        : () => widget.onBookService(
                                            post.linkedService!,
                                          ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Future<void> _openStoryViewer(_FeedStoryFilter filter) async {
    final matchingPosts = widget.posts
        .where((post) => _matchesFilter(post, filter))
        .toList();

    if (matchingPosts.isEmpty) {
      return;
    }

    final action = await showGeneralDialog<_FeedStoryViewerAction>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Fechar stories',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 280),
      pageBuilder: (context, _, _) => _FeedStoryViewer(
        posts: matchingPosts,
        filter: filter,
        branding: widget.branding,
      ),
      transitionBuilder: (context, animation, _, child) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );

        return FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, 0.05),
              end: Offset.zero,
            ).animate(curved),
            child: child,
          ),
        );
      },
    );

    if (!mounted || action == null) {
      return;
    }

    switch (action) {
      case _FeedStoryViewerAction.applyFilter:
        setState(() => _selectedFilter = filter);
        break;
      case _FeedStoryViewerAction.contactSalon:
        widget.onWhatsApp();
        break;
    }
  }

  bool _hasMatches(List<SalonPost> posts, _FeedStoryFilter filter) {
    if (filter == _FeedStoryFilter.all) {
      return true;
    }

    return posts.any((post) => _matchesFilter(post, filter));
  }

  bool _matchesFilter(SalonPost post, _FeedStoryFilter filter) {
    switch (filter) {
      case _FeedStoryFilter.all:
        return true;
      case _FeedStoryFilter.beforeAfter:
        return post.isBeforeAfter;
      case _FeedStoryFilter.reels:
        return post.isReel;
      case _FeedStoryFilter.reservable:
        return post.linkedService != null;
      case _FeedStoryFilter.professionals:
        return post.staffMemberName != null;
    }
  }
}

class _FeedConversionCard extends StatelessWidget {
  const _FeedConversionCard({
    required this.branding,
    required this.preset,
    required this.postCount,
    required this.linkedPostsCount,
    required this.beforeAfterCount,
    required this.reelCount,
    required this.highlightedProfessionalsCount,
    required this.onWhatsApp,
    required this.selectedFilter,
    required this.visiblePostCount,
    required this.onSelectFilter,
    required this.onOpenStoryViewer,
  });

  final SalonBranding branding;
  final SalonExperiencePreset preset;
  final int postCount;
  final int linkedPostsCount;
  final int beforeAfterCount;
  final int reelCount;
  final int highlightedProfessionalsCount;
  final VoidCallback onWhatsApp;
  final _FeedStoryFilter selectedFilter;
  final int visiblePostCount;
  final ValueChanged<_FeedStoryFilter> onSelectFilter;
  final ValueChanged<_FeedStoryFilter> onOpenStoryViewer;

  @override
  Widget build(BuildContext context) {
    final title = linkedPostsCount > 0
        ? preset.feedConversionTitleWithLinked
        : preset.feedConversionTitleWithoutLinked;
    final description = linkedPostsCount > 0
        ? preset.feedConversionDescriptionWithLinked
        : preset.feedConversionDescriptionWithoutLinked;
    final activeSummary = _buildFilterSummary(
      filter: selectedFilter,
      title: title,
      description: description,
      supportLine: preset.feedSupportLine,
      visiblePostCount: visiblePostCount,
    );
    final storyItems = <_FeedStoryData>[
      _FeedStoryData(
        filter: _FeedStoryFilter.all,
        label: 'Tudo',
        countLabel: '$postCount',
        icon: Icons.auto_awesome_rounded,
        accent: branding.primary,
        emphasized: true,
      ),
      if (beforeAfterCount > 0)
        _FeedStoryData(
          filter: _FeedStoryFilter.beforeAfter,
          label: 'Antes e depois',
          countLabel: '$beforeAfterCount',
          icon: Icons.compare_rounded,
          accent: Color.lerp(branding.primary, branding.deep, 0.32)!,
        ),
      if (reelCount > 0)
        _FeedStoryData(
          filter: _FeedStoryFilter.reels,
          label: reelCount == 1 ? 'Reel' : 'Reels',
          countLabel: '$reelCount',
          icon: Icons.play_circle_fill_rounded,
          accent: Color.lerp(branding.primary, Colors.white, 0.12)!,
        ),
      if (linkedPostsCount > 0)
        _FeedStoryData(
          filter: _FeedStoryFilter.reservable,
          label: 'Reserva',
          countLabel: '$linkedPostsCount',
          icon: Icons.calendar_month_rounded,
          accent: Color.lerp(branding.deep, branding.primary, 0.4)!,
        ),
      if (highlightedProfessionalsCount > 0)
        _FeedStoryData(
          filter: _FeedStoryFilter.professionals,
          label: highlightedProfessionalsCount == 1 ? 'Profissional' : 'Equipe',
          countLabel: '$highlightedProfessionalsCount',
          icon: Icons.person_outline_rounded,
          accent: Color.lerp(branding.primary, Colors.white, 0.28)!,
        ),
    ];

    return SoftCard(
      padding: EdgeInsets.zero,
      gradient: LinearGradient(
        colors: [
          Color.lerp(branding.surface, Colors.white, 0.08)!,
          Color.lerp(branding.soft, Colors.white, 0.16)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline.withValues(alpha: 0.78),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.74),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: branding.outline.withValues(alpha: 0.52),
                    ),
                  ),
                  child: Text(
                    'Destaques do feed',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  selectedFilter == _FeedStoryFilter.all
                      ? 'Atualizado agora'
                      : 'Filtro ativo',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: branding.mutedText,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 110,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: storyItems.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) => _FeedStoryBubble(
                item: storyItems[index],
                branding: branding,
                selected: storyItems[index].filter == selectedFilter,
                onTap: () => onOpenStoryViewer(storyItems[index].filter),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: branding.outline.withValues(alpha: 0.48),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    activeSummary.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: branding.deep,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    activeSummary.description,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: branding.mutedText,
                      height: 1.45,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          activeSummary.supportLine,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: const Color(0xFF6C5547),
                                fontWeight: FontWeight.w700,
                                height: 1.35,
                              ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 12),
                      selectedFilter == _FeedStoryFilter.all
                          ? PressFeedback(
                              haptic: true,
                              child: TextButton.icon(
                                onPressed: onWhatsApp,
                                style: TextButton.styleFrom(
                                  foregroundColor: branding.deep,
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                icon: const Icon(
                                  Icons.chat_bubble_outline_rounded,
                                ),
                                label: const Text('Falar com o salão'),
                              ),
                            )
                          : PressFeedback(
                              haptic: true,
                              child: TextButton(
                                onPressed: () =>
                                    onSelectFilter(_FeedStoryFilter.all),
                                style: TextButton.styleFrom(
                                  foregroundColor: branding.deep,
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text('Ver tudo'),
                              ),
                            ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedStoryBubble extends StatelessWidget {
  const _FeedStoryBubble({
    required this.item,
    required this.branding,
    required this.selected,
    required this.onTap,
  });

  final _FeedStoryData item;
  final SalonBranding branding;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ringColors = item.emphasized
        ? [item.accent, Color.lerp(item.accent, Colors.white, 0.12)!]
        : [
            Color.lerp(item.accent, Colors.white, 0.16)!,
            Color.lerp(item.accent, branding.deep, 0.1)!,
          ];

    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: SizedBox(
          width: 84,
          child: Column(
            children: [
              AnimatedScale(
                duration: const Duration(milliseconds: 180),
                scale: selected ? 1 : 0.94,
                curve: Curves.easeOutCubic,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 74,
                  height: 74,
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: ringColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: item.accent.withValues(
                          alpha: selected ? 0.28 : 0.18,
                        ),
                        blurRadius: selected ? 22 : 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: selected
                          ? Color.lerp(item.accent, Colors.white, 0.9)!
                          : Colors.white,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.92),
                        width: 2,
                      ),
                    ),
                    child: Stack(
                      children: [
                        Center(
                          child: Icon(item.icon, color: item.accent, size: 28),
                        ),
                        Positioned(
                          right: 4,
                          top: 4,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: item.accent,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.92),
                              ),
                            ),
                            child: Text(
                              item.countLabel,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                item.label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: selected ? item.accent : const Color(0xFF3A2A22),
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedStoryViewer extends StatefulWidget {
  const _FeedStoryViewer({
    required this.posts,
    required this.filter,
    required this.branding,
  });

  final List<SalonPost> posts;
  final _FeedStoryFilter filter;
  final SalonBranding branding;

  @override
  State<_FeedStoryViewer> createState() => _FeedStoryViewerState();
}

class _FeedStoryViewerState extends State<_FeedStoryViewer>
    with SingleTickerProviderStateMixin {
  static const _storyDuration = Duration(seconds: 4);
  static const _dismissDragThreshold = 140.0;
  static const _dismissVelocityThreshold = 1100.0;
  static const _dismissAnimationDuration = Duration(milliseconds: 190);
  static const _resetAnimationDuration = Duration(milliseconds: 240);
  static const _elasticDragAnchor = 116.0;
  static const _elasticDragFactor = 0.36;
  static const _maxDragDistance = 620.0;

  late final PageController _pageController;
  late final AnimationController _progressController;
  int _activeIndex = 0;
  bool _paused = false;
  double _dragDistanceY = 0;
  double _dragOffsetY = 0;
  bool _draggingViewer = false;
  bool _dismissingViewer = false;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _progressController = AnimationController(
      vsync: this,
      duration: _storyDuration,
    )..addStatusListener(_handleProgressStatus);
    _restartProgress();
  }

  @override
  void dispose() {
    _progressController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final post = widget.posts[_activeIndex];
    final title = _filterTitle(widget.filter);
    final caption = post.caption?.trim().isNotEmpty == true
        ? post.caption!.trim()
        : post.title;
    final serviceLabel = post.linkedService?.name;
    final staffLabel = post.staffMemberName == null
        ? null
        : post.staffMemberRole == null
        ? post.staffMemberName
        : '${post.staffMemberName} • ${post.staffMemberRole}';
    final dragProgress = (_dragOffsetY / 260).clamp(0.0, 1.0);
    final backdropTopColor = Color.lerp(
      const Color(0xE8140F0C),
      const Color(0x4C140F0C),
      dragProgress * 0.92,
    )!;
    final backdropBottomColor = Color.lerp(
      const Color(0xC6140F0C),
      const Color(0x18140F0C),
      dragProgress * 0.92,
    )!;
    final backdropBlur = 18 - (dragProgress * 11);
    final viewerScale = 1 - (dragProgress * 0.05);
    final viewerOffset = Offset(0, _dragOffsetY / viewportHeight);
    final viewerShadowAlpha = (0.28 - (dragProgress * 0.14)).clamp(0.1, 0.28);
    final chromeOpacity = (1 - (dragProgress * 0.55)).clamp(0.0, 1.0);
    final footerOpacity = (1 - (dragProgress * 0.72)).clamp(0.0, 1.0);
    final topChromeOffset = -12.0 * dragProgress;
    final footerOffset = 20.0 * dragProgress;
    final viewerMotionDuration = _draggingViewer
        ? Duration.zero
        : _dismissingViewer
        ? _dismissAnimationDuration
        : _resetAnimationDuration;
    final viewerMotionCurve = _dismissingViewer
        ? Curves.easeInCubic
        : Curves.easeOutCubic;

    return Material(
      color: Colors.transparent,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                  sigmaX: backdropBlur,
                  sigmaY: backdropBlur,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [backdropTopColor, backdropBottomColor],
                    ),
                  ),
                ),
              ),
            ),
          ),
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onVerticalDragStart: _dismissingViewer
                ? null
                : (_) => _handleVerticalDragStart(),
            onVerticalDragUpdate: _dismissingViewer
                ? null
                : _handleVerticalDragUpdate,
            onVerticalDragEnd: _dismissingViewer
                ? null
                : _handleVerticalDragEnd,
            child: AbsorbPointer(
              absorbing: _dismissingViewer,
              child: SafeArea(
                child: AnimatedSlide(
                  duration: viewerMotionDuration,
                  curve: viewerMotionCurve,
                  offset: viewerOffset,
                  child: AnimatedScale(
                    duration: viewerMotionDuration,
                    curve: viewerMotionCurve,
                    alignment: Alignment.topCenter,
                    scale: viewerScale,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 18),
                      child: Column(
                        children: [
                          Opacity(
                            opacity: chromeOpacity,
                            child: Transform.translate(
                              offset: Offset(0, topChromeOffset),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: AnimatedBuilder(
                                      animation: _progressController,
                                      builder: (context, _) => Row(
                                        children: List.generate(
                                          widget.posts.length,
                                          (index) => Expanded(
                                            child: Container(
                                              height: 4,
                                              margin: EdgeInsets.only(
                                                right:
                                                    index ==
                                                        widget.posts.length - 1
                                                    ? 0
                                                    : 4,
                                              ),
                                              decoration: BoxDecoration(
                                                color: Colors.white.withValues(
                                                  alpha: 0.22,
                                                ),
                                                borderRadius:
                                                    BorderRadius.circular(999),
                                              ),
                                              clipBehavior: Clip.antiAlias,
                                              child: Align(
                                                alignment: Alignment.centerLeft,
                                                child: FractionallySizedBox(
                                                  widthFactor: _segmentProgress(
                                                    index,
                                                  ),
                                                  child: Container(
                                                    decoration: BoxDecoration(
                                                      color: Colors.white,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            999,
                                                          ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  IconButton(
                                    tooltip: 'Fechar stories',
                                    onPressed: () => _dismissViewer(),
                                    style: IconButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      backgroundColor: Colors.white.withValues(
                                        alpha: 0.12,
                                      ),
                                    ),
                                    icon: const Icon(Icons.close_rounded),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Expanded(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(30),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(
                                      alpha: viewerShadowAlpha,
                                    ),
                                    blurRadius: 36,
                                    spreadRadius: 2,
                                    offset: const Offset(0, 18),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(30),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    PageView.builder(
                                      controller: _pageController,
                                      itemCount: widget.posts.length,
                                      onPageChanged: (index) {
                                        setState(() => _activeIndex = index);
                                        _restartProgress();
                                      },
                                      itemBuilder: (context, index) =>
                                          _StoryViewerMedia(
                                            post: widget.posts[index],
                                            branding: widget.branding,
                                          ),
                                    ),
                                    Positioned.fill(
                                      child: DecoratedBox(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [
                                              Colors.black.withValues(
                                                alpha: 0.08,
                                              ),
                                              Colors.black.withValues(
                                                alpha: 0.16,
                                              ),
                                              Colors.black.withValues(
                                                alpha: 0.34,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    Positioned.fill(
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: _StoryNavigationZone(
                                              onTap: _goToPrevious,
                                              onPause: _pauseProgress,
                                              onResume: _resumeProgress,
                                            ),
                                          ),
                                          Expanded(
                                            child: _StoryNavigationZone(
                                              onTap: _goToNext,
                                              onPause: _pauseProgress,
                                              onResume: _resumeProgress,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Positioned(
                                      top: 16,
                                      left: 16,
                                      right: 16,
                                      child: Opacity(
                                        opacity: chromeOpacity,
                                        child: Transform.translate(
                                          offset: Offset(
                                            0,
                                            topChromeOffset * 0.7,
                                          ),
                                          child: Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              ClipRRect(
                                                borderRadius:
                                                    BorderRadius.circular(999),
                                                child: BackdropFilter(
                                                  filter: ImageFilter.blur(
                                                    sigmaX: 10,
                                                    sigmaY: 10,
                                                  ),
                                                  child: Container(
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 12,
                                                          vertical: 7,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: Colors.black
                                                          .withValues(
                                                            alpha: 0.24,
                                                          ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            999,
                                                          ),
                                                      border: Border.all(
                                                        color: Colors.white
                                                            .withValues(
                                                              alpha: 0.1,
                                                            ),
                                                      ),
                                                    ),
                                                    child: Text(
                                                      'Stories do feed',
                                                      style: theme
                                                          .textTheme
                                                          .labelLarge
                                                          ?.copyWith(
                                                            color: Colors.white,
                                                            fontWeight:
                                                                FontWeight.w900,
                                                          ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                              const Spacer(),
                                              Text(
                                                '${_activeIndex + 1}/${widget.posts.length}',
                                                style: theme
                                                    .textTheme
                                                    .bodyMedium
                                                    ?.copyWith(
                                                      color: Colors.white,
                                                      fontWeight:
                                                          FontWeight.w800,
                                                    ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    Positioned(
                                      left: 16,
                                      right: 16,
                                      bottom: 16,
                                      child: Opacity(
                                        opacity: footerOpacity,
                                        child: Transform.translate(
                                          offset: Offset(0, footerOffset),
                                          child: ClipRRect(
                                            borderRadius: BorderRadius.circular(
                                              24,
                                            ),
                                            child: BackdropFilter(
                                              filter: ImageFilter.blur(
                                                sigmaX: 14,
                                                sigmaY: 14,
                                              ),
                                              child: Container(
                                                padding: const EdgeInsets.all(
                                                  16,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: const Color(
                                                    0x9E1B130F,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(24),
                                                  border: Border.all(
                                                    color: Colors.white
                                                        .withValues(
                                                          alpha: 0.14,
                                                        ),
                                                  ),
                                                ),
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      title,
                                                      style: theme
                                                          .textTheme
                                                          .labelLarge
                                                          ?.copyWith(
                                                            color: const Color(
                                                              0xFFF2DCCF,
                                                            ),
                                                            fontWeight:
                                                                FontWeight.w900,
                                                          ),
                                                    ),
                                                    const SizedBox(height: 6),
                                                    Text(
                                                      post.title,
                                                      style: theme
                                                          .textTheme
                                                          .headlineSmall
                                                          ?.copyWith(
                                                            color: Colors.white,
                                                            fontWeight:
                                                                FontWeight.w900,
                                                            height: 1.05,
                                                          ),
                                                      maxLines: 2,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                    ),
                                                    if (serviceLabel != null ||
                                                        staffLabel != null) ...[
                                                      const SizedBox(height: 8),
                                                      Wrap(
                                                        spacing: 8,
                                                        runSpacing: 8,
                                                        children: [
                                                          if (serviceLabel !=
                                                              null)
                                                            _StoryInfoChip(
                                                              label:
                                                                  serviceLabel,
                                                              icon: Icons
                                                                  .calendar_month_rounded,
                                                            ),
                                                          if (staffLabel !=
                                                              null)
                                                            _StoryInfoChip(
                                                              label: staffLabel,
                                                              icon: Icons
                                                                  .person_outline_rounded,
                                                            ),
                                                        ],
                                                      ),
                                                    ],
                                                    const SizedBox(height: 10),
                                                    Text(
                                                      caption,
                                                      style: theme
                                                          .textTheme
                                                          .bodyMedium
                                                          ?.copyWith(
                                                            color: const Color(
                                                              0xFFF6EDE7,
                                                            ),
                                                            height: 1.45,
                                                          ),
                                                      maxLines: 3,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                    ),
                                                    const SizedBox(height: 14),
                                                    Row(
                                                      children: [
                                                        Text(
                                                          _paused
                                                              ? 'Pausado'
                                                              : 'Segure para pausar',
                                                          style: theme
                                                              .textTheme
                                                              .bodySmall
                                                              ?.copyWith(
                                                                color:
                                                                    const Color(
                                                                      0xFFDCC7BB,
                                                                    ),
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700,
                                                              ),
                                                        ),
                                                        const SizedBox(
                                                          width: 12,
                                                        ),
                                                        TextButton.icon(
                                                          onPressed: () =>
                                                              _closeViewerWithAction(
                                                                _FeedStoryViewerAction
                                                                    .contactSalon,
                                                              ),
                                                          style: TextButton.styleFrom(
                                                            foregroundColor:
                                                                Colors.white,
                                                            padding:
                                                                EdgeInsets.zero,
                                                            minimumSize:
                                                                Size.zero,
                                                            tapTargetSize:
                                                                MaterialTapTargetSize
                                                                    .shrinkWrap,
                                                          ),
                                                          icon: const Icon(
                                                            Icons
                                                                .chat_bubble_outline_rounded,
                                                          ),
                                                          label: const Text(
                                                            'Falar com o salão',
                                                          ),
                                                        ),
                                                        const Spacer(),
                                                        FilledButton(
                                                          onPressed: () =>
                                                              _closeViewerWithAction(
                                                                _FeedStoryViewerAction
                                                                    .applyFilter,
                                                              ),
                                                          style: FilledButton.styleFrom(
                                                            backgroundColor:
                                                                widget
                                                                    .branding
                                                                    .primary,
                                                            foregroundColor:
                                                                widget
                                                                    .branding
                                                                    .onPrimary,
                                                          ),
                                                          child: const Text(
                                                            'Ver no feed',
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _goToPrevious() {
    if (_activeIndex == 0) {
      _restartProgress();
      return;
    }

    _pageController.previousPage(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    );
  }

  void _goToNext() {
    if (_activeIndex == widget.posts.length - 1) {
      _dismissViewer();
      return;
    }

    _pageController.nextPage(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    );
  }

  double _segmentProgress(int index) {
    if (index < _activeIndex) {
      return 1;
    }
    if (index > _activeIndex) {
      return 0;
    }

    return _progressController.value.clamp(0, 1);
  }

  void _handleProgressStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || _paused || !mounted) {
      return;
    }

    _goToNext();
  }

  void _restartProgress() {
    _progressController
      ..stop()
      ..value = 0;

    if (!_paused) {
      _progressController.forward();
    }
  }

  void _pauseProgress() {
    if (_paused) {
      return;
    }

    setState(() => _paused = true);
    _progressController.stop(canceled: false);
  }

  void _resumeProgress() {
    if (!_paused) {
      return;
    }

    setState(() => _paused = false);

    if (_progressController.value < 1) {
      _progressController.forward();
    }
  }

  void _handleVerticalDragStart() {
    if (_dismissingViewer) {
      return;
    }

    _pauseProgress();
    setState(() => _draggingViewer = true);
  }

  void _handleVerticalDragUpdate(DragUpdateDetails details) {
    final nextDistance = (_dragDistanceY + (details.primaryDelta ?? 0)).clamp(
      0.0,
      _maxDragDistance,
    );
    final nextOffset = _applyElasticOffset(nextDistance);

    if (nextDistance == _dragDistanceY && nextOffset == _dragOffsetY) {
      return;
    }

    setState(() {
      _dragDistanceY = nextDistance;
      _dragOffsetY = nextOffset;
    });
  }

  void _handleVerticalDragEnd(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    final shouldDismiss =
        _dragOffsetY >= _dismissDragThreshold ||
        velocity >= _dismissVelocityThreshold;

    if (shouldDismiss) {
      _dismissViewer(velocity: velocity);
      return;
    }

    setState(() {
      _draggingViewer = false;
      _dragDistanceY = 0;
      _dragOffsetY = 0;
    });
    _resumeProgress();
  }

  double _applyElasticOffset(double rawOffset) {
    if (rawOffset <= _elasticDragAnchor) {
      return rawOffset;
    }

    final overflow = rawOffset - _elasticDragAnchor;
    return _elasticDragAnchor + (overflow * _elasticDragFactor);
  }

  Future<void> _dismissViewer({
    double velocity = 0,
    _FeedStoryViewerAction? action,
  }) async {
    if (_dismissingViewer || !mounted) {
      return;
    }

    _progressController.stop(canceled: false);
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final flingExtra = (velocity.abs() * 0.16).clamp(
      0.0,
      viewportHeight * 0.38,
    );

    setState(() {
      _paused = true;
      _draggingViewer = false;
      _dismissingViewer = true;
      _dragDistanceY = viewportHeight + flingExtra;
      _dragOffsetY = viewportHeight + flingExtra;
    });

    await Future<void>.delayed(_dismissAnimationDuration);

    if (!mounted) {
      return;
    }

    Navigator.of(context).pop(action);
  }

  void _closeViewerWithAction(_FeedStoryViewerAction action) {
    _dismissViewer(action: action);
  }
}

class _StoryNavigationZone extends StatelessWidget {
  const _StoryNavigationZone({
    required this.onTap,
    required this.onPause,
    required this.onResume,
  });

  final VoidCallback onTap;
  final VoidCallback onPause;
  final VoidCallback onResume;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: onTap,
      onLongPressStart: (_) => onPause(),
      onLongPressEnd: (_) => onResume(),
      onLongPressCancel: onResume,
    );
  }
}

class _StoryViewerMedia extends StatelessWidget {
  const _StoryViewerMedia({required this.post, required this.branding});

  final SalonPost post;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    if (post.isBeforeAfter && post.imageUrls.length >= 2) {
      return Row(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                _StoryViewerImage(
                  imageUrl: post.imageUrls[0],
                  branding: branding,
                ),
                const Positioned(
                  top: 18,
                  left: 18,
                  child: _StoryMediaLabel(label: 'Antes'),
                ),
              ],
            ),
          ),
          Container(width: 2, color: Colors.white.withValues(alpha: 0.7)),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                _StoryViewerImage(
                  imageUrl: post.imageUrls[1],
                  branding: branding,
                ),
                const Positioned(
                  top: 18,
                  left: 18,
                  child: _StoryMediaLabel(label: 'Depois'),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        _StoryViewerImage(imageUrl: post.coverImageUrl, branding: branding),
        if (post.isReel)
          Center(
            child: Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.play_arrow_rounded,
                color: branding.deep,
                size: 48,
              ),
            ),
          ),
      ],
    );
  }
}

class _StoryViewerImage extends StatelessWidget {
  const _StoryViewerImage({required this.imageUrl, required this.branding});

  final String imageUrl;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Image.network(
      imageUrl,
      fit: BoxFit.cover,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) {
          return child;
        }

        return ColoredBox(
          color: branding.surface,
          child: Center(
            child: CircularProgressIndicator(
              color: branding.primary,
              strokeWidth: 2.4,
            ),
          ),
        );
      },
      errorBuilder: (_, _, _) => ColoredBox(
        color: branding.surface,
        child: Center(
          child: Icon(
            Icons.image_not_supported_rounded,
            size: 40,
            color: branding.deep,
          ),
        ),
      ),
    );
  }
}

class _StoryInfoChip extends StatelessWidget {
  const _StoryInfoChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _StoryMediaLabel extends StatelessWidget {
  const _StoryMediaLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xB827170F),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _FeedStoryData {
  const _FeedStoryData({
    required this.filter,
    required this.label,
    required this.countLabel,
    required this.icon,
    required this.accent,
    this.emphasized = false,
  });

  final _FeedStoryFilter filter;
  final String label;
  final String countLabel;
  final IconData icon;
  final Color accent;
  final bool emphasized;
}

class _FeedFilterEmptyState extends StatelessWidget {
  const _FeedFilterEmptyState({
    super.key,
    required this.branding,
    required this.filter,
    required this.onReset,
  });

  final SalonBranding branding;
  final _FeedStoryFilter filter;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _filterTitle(filter),
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Esse destaque não tem posts disponíveis agora. Você pode voltar para a visão completa do feed.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.mutedText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          TextButton(
            onPressed: onReset,
            style: TextButton.styleFrom(
              foregroundColor: branding.deep,
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Ver tudo'),
          ),
        ],
      ),
    );
  }
}

class _FeedFilterSummary {
  const _FeedFilterSummary({
    required this.title,
    required this.description,
    required this.supportLine,
  });

  final String title;
  final String description;
  final String supportLine;
}

_FeedFilterSummary _buildFilterSummary({
  required _FeedStoryFilter filter,
  required String title,
  required String description,
  required String supportLine,
  required int visiblePostCount,
}) {
  final countLabel = visiblePostCount == 1
      ? '1 post'
      : '$visiblePostCount posts';

  switch (filter) {
    case _FeedStoryFilter.all:
      return _FeedFilterSummary(
        title: title,
        description: description,
        supportLine: supportLine,
      );
    case _FeedStoryFilter.beforeAfter:
      return _FeedFilterSummary(
        title: 'Transformações reais em destaque',
        description:
            '$countLabel com comparação de antes e depois para ajudar na decisão.',
        supportLine:
            'Veja mudança, acabamento e caimento antes de reservar o seu próximo horário.',
      );
    case _FeedStoryFilter.reels:
      return _FeedFilterSummary(
        title: 'Reels para decidir mais rápido',
        description:
            '$countLabel com movimento, brilho e acabamento do resultado final.',
        supportLine:
            'Use os vídeos como referência rápida antes de falar com o salão ou reservar.',
      );
    case _FeedStoryFilter.reservable:
      return _FeedFilterSummary(
        title: 'Resultados que já viram reserva',
        description:
            '$countLabel com serviço conectado para sair da inspiração direto para o agendamento.',
        supportLine:
            'Abra apenas posts com caminho curto até o próximo horário dentro do app.',
      );
    case _FeedStoryFilter.professionals:
      return _FeedFilterSummary(
        title: 'Profissionais em destaque no feed',
        description:
            '$countLabel assinados pela equipe para você enxergar quem faz cada resultado.',
        supportLine:
            'Filtre posts da equipe para decidir com mais confiança qual assinatura combina com você.',
      );
  }
}

String _filterTitle(_FeedStoryFilter filter) {
  switch (filter) {
    case _FeedStoryFilter.all:
      return 'Tudo';
    case _FeedStoryFilter.beforeAfter:
      return 'Antes e depois';
    case _FeedStoryFilter.reels:
      return 'Reels';
    case _FeedStoryFilter.reservable:
      return 'Reserva';
    case _FeedStoryFilter.professionals:
      return 'Profissionais';
  }
}

enum _FeedStoryFilter { all, beforeAfter, reels, reservable, professionals }

enum _FeedStoryViewerAction { applyFilter, contactSalon }
