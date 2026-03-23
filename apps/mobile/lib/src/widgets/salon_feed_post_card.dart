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
  bool _showLikeBurst = false;
  int _likeBurstToken = 0;

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

  void _handleMediaDoubleTap() {
    if (widget.interactionBusy) {
      return;
    }

    if (!widget.post.likedByMe) {
      widget.onToggleLike();
    }

    _triggerLikeBurst();
  }

  Future<void> _triggerLikeBurst() async {
    final token = _likeBurstToken + 1;

    setState(() {
      _likeBurstToken = token;
      _showLikeBurst = true;
    });

    await Future<void>.delayed(const Duration(milliseconds: 520));

    if (!mounted || _likeBurstToken != token) {
      return;
    }

    setState(() => _showLikeBurst = false);
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
    final servicePriceLabel = post.linkedService == null
        ? null
        : NumberFormat.currency(
            locale: 'pt_BR',
            symbol: r'R$',
            decimalDigits: post.linkedService!.price % 1 == 0 ? 0 : 2,
          ).format(post.linkedService!.price);
    final mediaFooterLabel = _buildMediaFooterLabel(post);
    final signatureLabel = _buildSignatureLabel(post);
    final helperText = post.caption?.isNotEmpty == true
        ? null
        : _buildEditorialCopy(post);
    final captionText = post.caption?.isNotEmpty == true
        ? post.caption!
        : helperText;
    final headerTitle = post.staffMemberName ?? 'Seleção do salão';
    final headerSubtitle =
        post.staffMemberRole ??
        post.linkedService?.name ??
        (post.isReel
            ? 'Vídeo do salão'
            : post.isBeforeAfter
            ? 'Antes e depois'
            : 'Curadoria do salão');
    final primaryMediaLabel = post.isBeforeAfter
        ? 'Transformação real'
        : post.isReel
        ? 'Vídeo curto'
        : 'Resultado real';
    final primaryMediaIcon = post.isReel
        ? Icons.play_circle_outline_rounded
        : post.isBeforeAfter
        ? Icons.compare_rounded
        : Icons.auto_awesome_rounded;
    final serviceSummaryLabel = post.linkedService == null
        ? null
        : servicePriceLabel == null
        ? '${post.linkedService!.duration} min'
        : '${post.linkedService!.duration} min • $servicePriceLabel';
    final referenceDetailLabel = post.linkedService == null
        ? (signatureLabel ?? mediaFooterLabel)
        : mediaFooterLabel;

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline.withValues(alpha: 0.42),
      backgroundColor: const Color(0xFFFFFEFC),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            child: _FeedPostHeader(
              branding: branding,
              title: headerTitle,
              subtitle: headerSubtitle,
              postedAt: postedAt,
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ClipRRect(
              borderRadius: const BorderRadius.all(Radius.circular(22)),
              child: _buildMedia(post, branding),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _FeedIconActionButton(
                      tooltip: 'Curtir publicação',
                      icon: post.likedByMe
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      active: post.likedByMe,
                      busy: widget.interactionBusy,
                      branding: branding,
                      onTap: widget.onToggleLike,
                    ),
                    const SizedBox(width: 6),
                    _FeedIconActionButton(
                      tooltip: 'Abrir comentários',
                      icon: Icons.mode_comment_outlined,
                      busy: widget.interactionBusy,
                      branding: branding,
                      onTap: widget.onOpenComments,
                    ),
                    if (widget.onContactSalon != null) ...[
                      const SizedBox(width: 6),
                      _FeedIconActionButton(
                        tooltip: 'Falar com o salão',
                        icon: Icons.send_outlined,
                        busy: widget.interactionBusy,
                        branding: branding,
                        onTap: widget.onContactSalon,
                      ),
                    ],
                    const Spacer(),
                    _FeedInlineBadge(
                      icon: primaryMediaIcon,
                      label: primaryMediaLabel,
                      branding: branding,
                    ),
                  ],
                ),
                if (referenceDetailLabel != null ||
                    post.staffMemberName == null) ...[
                  const SizedBox(height: 12),
                  _FeedReferenceCard(
                    branding: branding,
                    eyebrow: 'Referência do salão',
                    detail:
                        referenceDetailLabel ??
                        'Seleção editorial do salão para inspirar sua próxima visita.',
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  post.likeCount == 1
                      ? '1 curtida'
                      : '${post.likeCount} curtidas',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF2F231C),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (post.commentCount > 0) ...[
                  const SizedBox(height: 2),
                  TextButton(
                    onPressed: widget.interactionBusy
                        ? null
                        : widget.onOpenComments,
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      foregroundColor: const Color(0xFF7A5E4E),
                    ),
                    child: Text(
                      post.commentCount == 1
                          ? 'Ver 1 comentário'
                          : 'Ver ${post.commentCount} comentários',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF7A5E4E),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  post.title,
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: const Color(0xFF2B2019),
                    fontWeight: FontWeight.w900,
                    height: 1.08,
                  ),
                ),
                if (captionText != null) ...[
                  const SizedBox(height: 6),
                  _FeedCaptionLine(author: headerTitle, text: captionText),
                ],
                if (previewComments.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: previewComments
                        .map(
                          (comment) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: _FeedCommentLine(
                              author: comment.customerName,
                              text: comment.body,
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                if (post.linkedService != null) ...[
                  const SizedBox(height: 14),
                  _FeedServiceCallout(
                    branding: branding,
                    icon:
                        linkedServiceVisual?.icon ?? Icons.auto_awesome_rounded,
                    serviceName: post.linkedService!.name,
                    serviceDetail:
                        serviceSummaryLabel ?? 'Horário sob consulta',
                    signatureLabel: signatureLabel,
                  ),
                ] else if (widget.onContactSalon != null) ...[
                  const SizedBox(height: 14),
                  _FeedEditorialHint(
                    branding: branding,
                    text: post.isReel
                        ? 'Use esse vídeo como referência e alinhe com o salão o melhor serviço para chegar nesse acabamento.'
                        : 'Use esse resultado como referência e converse com o salão para adaptar o visual ao seu estilo.',
                  ),
                ],
                if (hasVideoAction) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.interactionBusy
                          ? null
                          : widget.onOpenVideo,
                      icon: const Icon(Icons.play_circle_outline_rounded),
                      label: const Text('Assistir em movimento'),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (widget.onBookService != null &&
                    post.linkedService != null) ...[
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
                        foregroundColor: branding.onPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: const Icon(Icons.calendar_month_rounded, size: 18),
                      label: const Text('Quero esse resultado'),
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
                              ? 'Falar sobre esse vídeo'
                              : 'Falar com o salão',
                        ),
                      ),
                    ),
                  ],
                ] else if (widget.onContactSalon != null) ...[
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.interactionBusy
                          ? null
                          : widget.onContactSalon,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: Text(
                        post.isReel
                            ? 'Falar sobre esse vídeo'
                            : 'Falar sobre esse resultado',
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Text(
                  postedAt,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF8D7566),
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String? _buildSignatureLabel(SalonPost post) {
    if (post.staffMemberName == null) {
      return null;
    }

    return post.staffMemberRole == null
        ? 'Assinado por ${post.staffMemberName}'
        : 'Assinado por ${post.staffMemberName} • ${post.staffMemberRole}';
  }

  String? _buildEditorialCopy(SalonPost post) {
    final serviceName = post.linkedService?.name;

    if (serviceName != null && post.isReel) {
      return 'Veja brilho, movimento e acabamento antes de reservar. Se esse estilo combina com você, $serviceName já pode entrar no seu próximo horário.';
    }

    if (serviceName != null && post.isBeforeAfter) {
      return 'Uma transformação real para enxergar caimento, forma e acabamento. Se esse resultado conversa com o que você busca, $serviceName pode ser seu próximo horário.';
    }

    if (serviceName != null) {
      return 'Esse resultado mostra a assinatura do salão em $serviceName. Se você quer sair assim, dá para reservar pelo app.';
    }

    if (post.isBeforeAfter) {
      return 'Esse antes e depois ajuda a enxergar o resultado final. Vale falar com o salão para adaptar a referência ao seu estilo.';
    }

    if (post.isReel) {
      return 'Use esse vídeo como referência de brilho, movimento e acabamento e descubra com o salão qual é o serviço ideal.';
    }

    return 'Se esse visual te ganhou, vale falar com o salão para descobrir o melhor caminho até esse resultado.';
  }

  String? _buildMediaFooterLabel(SalonPost post) {
    if (post.linkedService != null && post.staffMemberName != null) {
      return '${post.linkedService!.name} • ${post.staffMemberName!}';
    }

    if (post.linkedService != null) {
      return post.linkedService!.name;
    }

    if (post.staffMemberName != null) {
      return 'Assinado por ${post.staffMemberName!}';
    }

    return null;
  }

  Widget _buildMedia(SalonPost post, SalonBranding branding) {
    if (post.isBeforeAfter && post.imageUrls.length >= 2) {
      return _wrapMediaShell(
        enableDoubleTapLike: true,
        child: AspectRatio(
          aspectRatio: 4 / 5,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _BeforeAfterPanel(
                      label: 'Antes',
                      imageUrl: post.imageUrls[0],
                      branding: branding,
                    ),
                  ),
                  Container(
                    width: 2,
                    color: Colors.white.withValues(alpha: 0.88),
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
              Center(
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.9),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.compare_arrows_rounded,
                    color: branding.deep,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (post.isReel) {
      final mediaFooterLabel = _buildMediaFooterLabel(post);
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
                    colors: [const Color(0x08160E08), const Color(0xCC160E08)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
              const Positioned(
                top: 14,
                left: 14,
                child: _MediaBadge(
                  label: 'Vídeo curto',
                  icon: Icons.play_circle_outline_rounded,
                ),
              ),
              Center(
                child: Container(
                  width: 82,
                  height: 82,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    shape: BoxShape.circle,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x3327170F),
                        blurRadius: 28,
                        offset: Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.play_arrow_rounded,
                    size: 46,
                    color: branding.deep,
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: _MediaFooter(
                  eyebrow: 'Veja brilho, movimento e acabamento',
                  label: mediaFooterLabel ?? 'Toque para ver em movimento',
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _wrapMediaShell(
      enableDoubleTapLike: post.imageUrls.length == 1,
      child: AspectRatio(
        aspectRatio: 4 / 5,
        child: Stack(
          fit: StackFit.expand,
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
                bottom: 18,
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
      ),
    );
  }

  Widget _wrapMediaShell({
    required Widget child,
    required bool enableDoubleTapLike,
  }) {
    return GestureDetector(
      onDoubleTap: enableDoubleTapLike ? _handleMediaDoubleTap : null,
      child: Stack(
        children: [
          child,
          Positioned.fill(
            child: IgnorePointer(
              child: Center(child: _buildLikeBurstOverlay()),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLikeBurstOverlay() {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      switchInCurve: Curves.easeOutBack,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        final curved = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutBack,
          reverseCurve: Curves.easeInCubic,
        );

        return FadeTransition(
          opacity: curved,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.45, end: 1).animate(curved),
            child: child,
          ),
        );
      },
      child: _showLikeBurst
          ? Container(
              key: ValueKey<int>(_likeBurstToken),
              width: 102,
              height: 102,
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.favorite_rounded,
                color: Colors.white,
                size: 58,
              ),
            )
          : const SizedBox.shrink(),
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

class _FeedPostHeader extends StatelessWidget {
  const _FeedPostHeader({
    required this.branding,
    required this.title,
    required this.subtitle,
    required this.postedAt,
  });

  final SalonBranding branding;
  final String title;
  final String subtitle;
  final String postedAt;

  @override
  Widget build(BuildContext context) {
    final normalizedTitle = title.trim();
    final initial = normalizedTitle.isEmpty ? 'S' : normalizedTitle[0];

    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                Color.lerp(branding.primary, Colors.white, 0.12)!,
                branding.primary,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            shape: BoxShape.circle,
          ),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initial.toUpperCase(),
                style: TextStyle(
                  color: branding.deep,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF2B2019),
                  fontWeight: FontWeight.w900,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF7A5E4E),
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6),
                    child: Text(
                      '•',
                      style: TextStyle(
                        color: Color(0xFF7A5E4E),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    postedAt,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF876F5F),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: const Color(0xFFF7EEE6),
            borderRadius: BorderRadius.circular(999),
          ),
          alignment: Alignment.center,
          child: const Icon(
            Icons.more_horiz_rounded,
            size: 20,
            color: Color(0xFF876F5F),
          ),
        ),
      ],
    );
  }
}

class _FeedInlineBadge extends StatelessWidget {
  const _FeedInlineBadge({
    required this.icon,
    required this.label,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Color.lerp(branding.highlightBackground, Colors.white, 0.42),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: branding.outline.withValues(alpha: 0.42)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: branding.deep),
          const SizedBox(width: 7),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedReferenceCard extends StatelessWidget {
  const _FeedReferenceCard({
    required this.branding,
    required this.eyebrow,
    required this.detail,
  });

  final SalonBranding branding;
  final String eyebrow;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Color.lerp(branding.highlightBackground, Colors.white, 0.5),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(999),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.bookmark_border_rounded,
              size: 18,
              color: branding.deep,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF7A5E4E),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF2B2019),
                    fontWeight: FontWeight.w800,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedCaptionLine extends StatelessWidget {
  const _FeedCaptionLine({required this.author, required this.text});

  final String author;
  final String text;

  @override
  Widget build(BuildContext context) {
    return RichText(
      maxLines: 4,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: const Color(0xFF5F483A),
          height: 1.45,
        ),
        children: [
          TextSpan(
            text: '$author ',
            style: const TextStyle(
              color: Color(0xFF2B2019),
              fontWeight: FontWeight.w900,
            ),
          ),
          TextSpan(text: text),
        ],
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

class _FeedIconActionButton extends StatelessWidget {
  const _FeedIconActionButton({
    required this.tooltip,
    required this.icon,
    required this.busy,
    required this.branding,
    this.onTap,
    this.active = false,
  });

  final String tooltip;
  final IconData icon;
  final bool busy;
  final SalonBranding branding;
  final VoidCallback? onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final foreground = active
        ? const Color(0xFFD34A63)
        : const Color(0xFF2B2019);

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: busy ? null : onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: active ? const Color(0xFFFFEDF1) : const Color(0xFFF8F2EC),
            shape: BoxShape.circle,
            border: Border.all(
              color: active
                  ? const Color(0xFFFFD4DC)
                  : branding.outline.withValues(alpha: 0.24),
            ),
          ),
          alignment: Alignment.center,
          child: busy
              ? SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    color: foreground,
                  ),
                )
              : Icon(icon, size: 23, color: foreground),
        ),
      ),
    );
  }
}

class _MediaBadge extends StatelessWidget {
  const _MediaBadge({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xA627170F),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: Colors.white),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaFooter extends StatelessWidget {
  const _MediaFooter({required this.eyebrow, required this.label});

  final String eyebrow;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xB526170F),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: const TextStyle(
              color: Color(0xFFF0D8CA),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedServiceCallout extends StatelessWidget {
  const _FeedServiceCallout({
    required this.branding,
    required this.icon,
    required this.serviceName,
    required this.serviceDetail,
    required this.signatureLabel,
  });

  final SalonBranding branding;
  final IconData icon;
  final String serviceName;
  final String serviceDetail;
  final String? signatureLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Color.lerp(branding.highlightBackground, Colors.white, 0.32),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.38)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.86),
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 19, color: branding.deep),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  serviceName,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF2B2019),
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  serviceDetail,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF7A5E4E),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (signatureLabel != null) ...[
                  const SizedBox(height: 6),
                  _MetaPill(
                    icon: Icons.bookmark_border_rounded,
                    label: signatureLabel!,
                    branding: branding,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedEditorialHint extends StatelessWidget {
  const _FeedEditorialHint({required this.branding, required this.text});

  final SalonBranding branding;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Color.lerp(branding.surface, Colors.white, 0.18),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.32)),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: const Color(0xFF6D5647),
          height: 1.45,
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({
    required this.icon,
    required this.label,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
      decoration: BoxDecoration(
        color: Color.lerp(branding.highlightBackground, Colors.white, 0.5),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: branding.outline.withValues(alpha: 0.36)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedCommentLine extends StatelessWidget {
  const _FeedCommentLine({required this.author, required this.text});

  final String author;
  final String text;

  @override
  Widget build(BuildContext context) {
    return RichText(
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      text: TextSpan(
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: const Color(0xFF5F483A),
          height: 1.4,
        ),
        children: [
          TextSpan(
            text: '$author ',
            style: const TextStyle(
              color: Color(0xFF2B2019),
              fontWeight: FontWeight.w900,
            ),
          ),
          TextSpan(text: text),
        ],
      ),
    );
  }
}
