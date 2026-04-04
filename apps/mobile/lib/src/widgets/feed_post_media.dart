import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../models/app_models.dart';
import '../services/app_analytics_service.dart';
import '../theme/app_theme.dart';
import 'premium_ui.dart';

class FeedPostMedia extends StatefulWidget {
  const FeedPostMedia({super.key, required this.post});

  final FeedPost post;

  @override
  State<FeedPostMedia> createState() => _FeedPostMediaState();
}

class _FeedPostMediaState extends State<FeedPostMedia> {
  final AppAnalyticsService _analytics = AppAnalyticsService.instance;
  VideoPlayerController? _controller;
  Future<void>? _initialization;
  bool _hasVideoError = false;

  bool get _isReel =>
      widget.post.postType == 'reel' &&
      widget.post.videoUrl != null &&
      widget.post.videoUrl!.trim().isNotEmpty;

  @override
  void initState() {
    super.initState();
    _initializeIfNeeded();
  }

  @override
  void didUpdateWidget(covariant FeedPostMedia oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.post.id != widget.post.id ||
        oldWidget.post.videoUrl != widget.post.videoUrl ||
        oldWidget.post.postType != widget.post.postType) {
      unawaited(_disposeController());
      _initializeIfNeeded();
    }
  }

  @override
  void dispose() {
    unawaited(_disposeController());
    super.dispose();
  }

  Future<void> _disposeController() async {
    final controller = _controller;
    _controller = null;
    _initialization = null;
    if (controller != null) {
      await controller.dispose();
    }
  }

  void _initializeIfNeeded() {
    _hasVideoError = false;
    if (!_isReel) {
      _controller = null;
      _initialization = null;
      return;
    }

    final uri = Uri.tryParse(widget.post.videoUrl!);
    if (uri == null) {
      _hasVideoError = true;
      return;
    }

    final controller = VideoPlayerController.networkUrl(uri);
    _controller = controller;
    _initialization = controller
        .initialize()
        .then((_) async {
          await controller.setLooping(true);
          await controller.setVolume(0);
          if (mounted) {
            setState(() {});
          }
        })
        .catchError((_) {
          _hasVideoError = true;
          if (mounted) {
            setState(() {});
          }
        });
    controller.addListener(() {
      if (mounted) {
        setState(() {});
      }
    });
  }

  Future<void> _togglePlayback() async {
    final controller = _controller;
    if (controller == null) {
      return;
    }

    if (!controller.value.isInitialized) {
      return;
    }

    if (controller.value.isPlaying) {
      await controller.pause();
      await _analytics.logFeedMediaInteraction(
        postType: widget.post.postType,
        action: 'pause',
      );
    } else {
      await controller.play();
      await _analytics.logFeedMediaInteraction(
        postType: widget.post.postType,
        action: 'play',
      );
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isReel || _hasVideoError) {
      return _FeedPostImageMedia(post: widget.post);
    }

    final controller = _controller;
    if (controller == null) {
      return _FeedPostImageMedia(post: widget.post);
    }

    return FutureBuilder<void>(
      future: _initialization,
      builder: (context, snapshot) {
        final isReady =
            snapshot.connectionState == ConnectionState.done &&
            controller.value.isInitialized;

        return GestureDetector(
          onTap: _togglePlayback,
          child: Stack(
            fit: StackFit.expand,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: context.salonTheme.heroGradient,
                ),
                child: isReady
                    ? FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: controller.value.size.width,
                          height: controller.value.size.height,
                          child: VideoPlayer(controller),
                        ),
                      )
                    : const Center(
                        child: SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(strokeWidth: 2.4),
                        ),
                      ),
              ),
              Positioned(
                top: 14,
                left: 14,
                child: _FeedMediaBadge(
                  icon: Icons.play_circle_outline_rounded,
                  label: 'Vídeo curto',
                ),
              ),
              Positioned(
                top: 14,
                right: 14,
                child: _FeedMediaBadge(
                  icon: Icons.volume_off_rounded,
                  label: 'Sem som',
                ),
              ),
              Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.32),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Icon(
                    controller.value.isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 36,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FeedPostImageMedia extends StatelessWidget {
  const _FeedPostImageMedia({required this.post});

  final FeedPost post;

  bool get _showsBeforeAfter =>
      post.postType == 'before_after' && post.imageUrls.length >= 2;

  Widget _buildPlaceholder(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: context.salonTheme.heroGradient),
      child: Center(
        child: Icon(
          _formatIconFor(post.postType),
          size: 42,
          color: Colors.white.withValues(alpha: 0.92),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        if (_showsBeforeAfter)
          Row(
            children: [
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    PremiumNetworkImage(
                      imageUrl: post.imageUrls[0],
                      width: double.infinity,
                      height: double.infinity,
                      fit: BoxFit.cover,
                      placeholder: _buildPlaceholder(context),
                    ),
                    Positioned(
                      left: 12,
                      bottom: 12,
                      child: _FeedMediaBadge(
                        icon: Icons.history_toggle_off_rounded,
                        label: 'Antes',
                      ),
                    ),
                  ],
                ),
              ),
              Container(width: 2, color: Colors.white.withValues(alpha: 0.28)),
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    PremiumNetworkImage(
                      imageUrl: post.imageUrls[1],
                      width: double.infinity,
                      height: double.infinity,
                      fit: BoxFit.cover,
                      placeholder: _buildPlaceholder(context),
                    ),
                    Positioned(
                      right: 12,
                      bottom: 12,
                      child: _FeedMediaBadge(
                        icon: Icons.auto_awesome_rounded,
                        label: 'Depois',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          )
        else
          PremiumNetworkImage(
            imageUrl: post.coverImageUrl,
            width: double.infinity,
            height: double.infinity,
            fit: BoxFit.cover,
            placeholder: _buildPlaceholder(context),
          ),
        Positioned(
          top: 14,
          left: 14,
          child: _FeedMediaBadge(
            icon: _formatIconFor(post.postType),
            label: _formatLabelFor(post.postType),
          ),
        ),
        if (post.imageUrls.length > (_showsBeforeAfter ? 2 : 1))
          Positioned(
            top: 14,
            right: 14,
            child: _FeedMediaBadge(
              icon: Icons.collections_outlined,
              label:
                  '+${post.imageUrls.length - (_showsBeforeAfter ? 2 : 1)} fotos',
            ),
          ),
      ],
    );
  }
}

class _FeedMediaBadge extends StatelessWidget {
  const _FeedMediaBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.44),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

String feedPostFormatLabel(String postType) {
  switch (postType) {
    case 'before_after':
      return 'Antes e depois';
    case 'reel':
      return 'Vídeo curto';
    default:
      return 'Foto';
  }
}

IconData _formatIconFor(String postType) {
  switch (postType) {
    case 'before_after':
      return Icons.compare_rounded;
    case 'reel':
      return Icons.play_circle_outline_rounded;
    default:
      return Icons.photo_outlined;
  }
}

String _formatLabelFor(String postType) => feedPostFormatLabel(postType);
