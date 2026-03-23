import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import 'soft_card.dart';

class SalonFeedPostCard extends StatefulWidget {
  const SalonFeedPostCard({
    super.key,
    required this.post,
    required this.branding,
    required this.interactionBusy,
    required this.onToggleLike,
    required this.onOpenComments,
    this.onBookService,
    this.onContactSalon,
    this.onOpenVideo,
  });

  final SalonPost post;
  final SalonBranding branding;
  final bool interactionBusy;
  final VoidCallback onToggleLike;
  final VoidCallback onOpenComments;
  final VoidCallback? onBookService;
  final VoidCallback? onContactSalon;
  final VoidCallback? onOpenVideo;

  @override
  State<SalonFeedPostCard> createState() => _SalonFeedPostCardState();
}

class _SalonFeedPostCardState extends State<SalonFeedPostCard> {
  late final PageController _pageController;
  int _activePage = 0;

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
    final theme = Theme.of(context);
    final post = widget.post;
    final branding = widget.branding;
    final postedAt = DateFormat('dd/MM • HH:mm').format(post.createdAt);
    final previewComments = post.comments.take(2).toList();
    final linkedServiceVisual = post.linkedService == null
        ? null
        : resolveServiceCategoryVisual(
            category: post.linkedService!.category,
            name: post.linkedService!.name,
          );
    final hasVideoAction = post.videoUrl != null && widget.onOpenVideo != null;

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline.withValues(alpha: 0.72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: _buildMedia(post, branding),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Novo no salão • $postedAt',
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: branding.deep,
                  ),
                ),
                const SizedBox(height: 10),
                Text(post.title, style: theme.textTheme.titleLarge),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _ActionChip(
                      icon: post.isReel
                          ? Icons.play_circle_outline_rounded
                          : post.isBeforeAfter
                          ? Icons.compare_rounded
                          : Icons.photo_library_outlined,
                      label: post.postType.label,
                      busy: false,
                      branding: branding,
                      onTap: hasVideoAction ? widget.onOpenVideo : null,
                    ),
                    if (post.staffMemberName != null)
                      _ActionChip(
                        icon: Icons.person_outline_rounded,
                        label: post.staffMemberRole == null
                            ? post.staffMemberName!
                            : '${post.staffMemberName!} • ${post.staffMemberRole!}',
                        busy: false,
                        branding: branding,
                        onTap: null,
                      ),
                    if (post.linkedService != null)
                      _ActionChip(
                        icon:
                            linkedServiceVisual?.icon ??
                            Icons.auto_awesome_rounded,
                        label: post.linkedService!.name,
                        busy: false,
                        branding: branding,
                        onTap: null,
                      ),
                    if (post.linkedService != null)
                      _ActionChip(
                        icon: Icons.schedule_rounded,
                        label: '${post.linkedService!.duration} min',
                        busy: false,
                        branding: branding,
                        onTap: null,
                      ),
                  ],
                ),
                if (post.linkedService != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    post.isReel
                        ? widget.onContactSalon != null
                              ? 'Gostou desse video? Reserve ${post.linkedService!.name} no app ou fale com o salão para adaptar esse resultado ao seu estilo.'
                              : 'Gostou desse video? Reserve ${post.linkedService!.name} direto pelo app.'
                        : widget.onContactSalon != null
                        ? 'Gostou desse resultado? Reserve ${post.linkedService!.name} no app ou fale com o salão para alinhar detalhes.'
                        : 'Gostou desse resultado? Reserve ${post.linkedService!.name} direto pelo app.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF6D5647),
                    ),
                  ),
                ] else if (post.isBeforeAfter) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Use esse antes e depois para entender o resultado final e conversar com o salão sobre a melhor versao para voce.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF6D5647),
                    ),
                  ),
                ] else if (post.isReel) ...[
                  const SizedBox(height: 12),
                  Text(
                    'Esse video curto ajuda a ver movimento, acabamento e estilo final antes de decidir seu proximo agendamento.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF6D5647),
                    ),
                  ),
                ],
                if (post.caption != null && post.caption!.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    post.caption!,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: const Color(0xFF6D5647),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _ActionChip(
                      icon: post.likedByMe
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      label: post.likeCount == 1
                          ? '1 curtida'
                          : '${post.likeCount} curtidas',
                      active: post.likedByMe,
                      busy: widget.interactionBusy,
                      branding: branding,
                      onTap: widget.onToggleLike,
                    ),
                    _ActionChip(
                      icon: Icons.mode_comment_outlined,
                      label: post.commentCount == 1
                          ? '1 comentário'
                          : '${post.commentCount} comentários',
                      busy: widget.interactionBusy,
                      branding: branding,
                      onTap: widget.onOpenComments,
                    ),
                  ],
                ),
                if (hasVideoAction) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.interactionBusy
                          ? null
                          : widget.onOpenVideo,
                      icon: const Icon(Icons.play_circle_outline_rounded),
                      label: const Text('Assistir video curto'),
                    ),
                  ),
                ],
                if (widget.onBookService != null &&
                    post.linkedService != null) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () {
                        if (widget.interactionBusy) {
                          return;
                        }

                        widget.onBookService?.call();
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: branding.primary,
                      ),
                      icon: const Icon(Icons.calendar_month_rounded, size: 18),
                      label: const Text('Agendar este serviço'),
                    ),
                  ),
                  if (widget.onContactSalon != null) ...[
                    const SizedBox(height: 10),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: widget.interactionBusy
                            ? null
                            : widget.onContactSalon,
                        icon: const Icon(Icons.chat_bubble_outline_rounded),
                        label: Text(
                          post.isReel
                              ? 'Falar sobre esse video'
                              : 'Falar com o salão',
                        ),
                      ),
                    ),
                  ],
                ] else if (widget.onContactSalon != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    post.isReel
                        ? 'Se esse video combinou com voce, fale com o salão para descobrir o melhor serviço e o melhor encaixe.'
                        : 'Se esse visual combinou com você, fale com o salão para descobrir o melhor serviço e o melhor encaixe.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF6D5647),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.interactionBusy
                          ? null
                          : widget.onContactSalon,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: Text(
                        post.isReel
                            ? 'Falar sobre esse video'
                            : 'Falar sobre esse resultado',
                      ),
                    ),
                  ),
                ],
                if (previewComments.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Column(
                    children: previewComments
                        .map(
                          (comment) => Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: branding.highlightBackground,
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  comment.customerName,
                                  style: theme.textTheme.labelLarge?.copyWith(
                                    color: branding.deep,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  comment.body,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: const Color(0xFF5F483A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMedia(SalonPost post, SalonBranding branding) {
    if (post.isBeforeAfter && post.imageUrls.length >= 2) {
      return AspectRatio(
        aspectRatio: 4 / 5,
        child: Row(
          children: [
            Expanded(
              child: _BeforeAfterPanel(
                label: 'Antes',
                imageUrl: post.imageUrls[0],
                branding: branding,
              ),
            ),
            Expanded(
              child: _BeforeAfterPanel(
                label: 'Depois',
                imageUrl: post.imageUrls[1],
                branding: branding,
              ),
            ),
          ],
        ),
      );
    }

    if (post.isReel) {
      return AspectRatio(
        aspectRatio: 4 / 5,
        child: InkWell(
          onTap: widget.interactionBusy ? null : widget.onOpenVideo,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _FeedImage(imageUrl: post.coverImageUrl, branding: branding),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [const Color(0x08160E08), const Color(0x99160E08)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
              Positioned(
                top: 14,
                right: 14,
                child: _MediaBadge(label: post.postType.label),
              ),
              Center(
                child: Container(
                  width: 74,
                  height: 74,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.9),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.play_arrow_rounded,
                    size: 40,
                    color: branding.deep,
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Text(
                  'Toque para assistir o video curto',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.96),
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return AspectRatio(
      aspectRatio: 4 / 5,
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: post.imageUrls.length,
            onPageChanged: (index) {
              setState(() => _activePage = index);
            },
            itemBuilder: (context, index) {
              return _FeedImage(
                imageUrl: post.imageUrls[index],
                branding: branding,
              );
            },
          ),
          if (post.imageUrls.length > 1)
            Positioned(
              top: 14,
              right: 14,
              child: _MediaBadge(
                label: '${_activePage + 1}/${post.imageUrls.length}',
              ),
            ),
          if (post.imageUrls.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: 14,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  post.imageUrls.length,
                  (index) => AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: index == _activePage ? 18 : 8,
                    height: 8,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: index == _activePage
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.48),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FeedImage extends StatelessWidget {
  const _FeedImage({required this.imageUrl, required this.branding});

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

        return Container(
          color: branding.surface,
          alignment: Alignment.center,
          child: CircularProgressIndicator(
            color: branding.primary,
            strokeWidth: 2.4,
          ),
        );
      },
      errorBuilder: (_, _, _) => Container(
        color: branding.surface,
        alignment: Alignment.center,
        child: Icon(
          Icons.image_not_supported_rounded,
          size: 36,
          color: branding.deep,
        ),
      ),
    );
  }
}

class _BeforeAfterPanel extends StatelessWidget {
  const _BeforeAfterPanel({
    required this.label,
    required this.imageUrl,
    required this.branding,
  });

  final String label;
  final String imageUrl;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        _FeedImage(imageUrl: imageUrl, branding: branding),
        Positioned(top: 14, left: 14, child: _MediaBadge(label: label)),
      ],
    );
  }
}

class _MediaBadge extends StatelessWidget {
  const _MediaBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xBF27170F),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.busy,
    required this.branding,
    this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final bool busy;
  final SalonBranding branding;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final foreground = active ? branding.onPrimary : branding.deep;
    final background = active ? branding.primary : branding.highlightBackground;

    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: busy ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
          border: onTap == null
              ? Border.all(color: branding.outline.withValues(alpha: 0.7))
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2.2,
                  color: foreground,
                ),
              )
            else
              Icon(icon, size: 17, color: foreground),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
