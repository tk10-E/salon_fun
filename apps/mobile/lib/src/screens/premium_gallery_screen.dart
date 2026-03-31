import 'dart:async';

import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_service_chip.dart';
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
  State<PremiumGalleryScreen> createState() => _PremiumGalleryScreenState();
}

class _PremiumGalleryScreenState extends State<PremiumGalleryScreen> {
  _PremiumGalleryFilter _filter = _PremiumGalleryFilter.all;

  @override
  Widget build(BuildContext context) {
    final brandConfig = SalonBrandConfig.fromProfile(
      widget.profile,
      posts: widget.posts,
    );
    final galleryTitle = _galleryTitle(widget.profile.salonBusinessSegment);
    final galleryEmptyTitle = _galleryEmptyTitle(
      widget.profile.salonBusinessSegment,
    );
    final galleryEmptyMessage = _galleryEmptyMessage(
      widget.profile.salonBusinessSegment,
    );
    final featuredPost = widget.posts.isEmpty ? null : widget.posts.first;
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

    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        children: [
          PremiumBanner(
            eyebrow: widget.profile.salonName,
            title: galleryTitle,
            subtitle:
                'Resultados reais e referências para decidir sem excesso de informação.',
            imageUrl:
                brandConfig.galleryCoverImageUrl ?? featuredPost?.coverImageUrl,
            tabletImageUrl:
                brandConfig.galleryCoverImageTabletUrl ??
                brandConfig.galleryCoverImageUrl ??
                featuredPost?.coverImageUrl,
            imageAlignment: brandConfig.galleryCoverImageAlignment,
            imageScale: brandConfig.galleryCoverImageScale,
            primaryActionLabel: 'Agendar a partir do feed',
            onPrimaryAction: widget.posts.firstOrNull?.linkedService == null
                ? widget.onWhatsApp
                : () {
                    unawaited(
                      widget.onBookService(widget.posts.first.linkedService!),
                    );
                  },
            badges: [
              _GalleryBadge(label: '${widget.posts.length} publicacoes'),
              _GalleryBadge(
                label:
                    '${widget.posts.where((post) => post.isBeforeAfter).length} antes e depois',
              ),
            ],
          ),
          const SizedBox(height: PremiumSpacing.xl),
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
            PremiumSectionHeader(
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
                  onTap: () =>
                      setState(() => _filter = _PremiumGalleryFilter.all),
                ),
                _FilterChip(
                  label: 'Reel',
                  selected: _filter == _PremiumGalleryFilter.reels,
                  onTap: () =>
                      setState(() => _filter = _PremiumGalleryFilter.reels),
                ),
                _FilterChip(
                  label: 'Antes e depois',
                  selected: _filter == _PremiumGalleryFilter.beforeAfter,
                  onTap: () => setState(
                    () => _filter = _PremiumGalleryFilter.beforeAfter,
                  ),
                ),
                _FilterChip(
                  label: 'Reserva',
                  selected: _filter == _PremiumGalleryFilter.linked,
                  onTap: () =>
                      setState(() => _filter = _PremiumGalleryFilter.linked),
                ),
              ],
            ),
            const SizedBox(height: PremiumSpacing.xl),
            if (visiblePosts.length >= 2) ...[
              PremiumSectionHeader(
                title: 'Selecao visual',
                subtitle: 'Um recorte rapido das imagens com maior impacto.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              SizedBox(
                height: 176,
                child: Row(
                  children: [
                    Expanded(
                      child: PremiumGalleryCard(
                        title: visiblePosts[0].title,
                        subtitle: visiblePosts[0].staffMemberName,
                        imageUrl: visiblePosts[0].coverImageUrl,
                        badge: visiblePosts[0].isBeforeAfter
                            ? 'Antes e depois'
                            : null,
                      ),
                    ),
                    const SizedBox(width: PremiumSpacing.md),
                    Expanded(
                      child: PremiumGalleryCard(
                        title: visiblePosts[1].title,
                        subtitle: visiblePosts[1].staffMemberName,
                        imageUrl: visiblePosts[1].coverImageUrl,
                        badge: visiblePosts[1].isReel ? 'Video' : null,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: PremiumSpacing.xl),
            ],
            PremiumSectionHeader(
              title: 'Feed do salao',
              subtitle:
                  'Interacao, prova social e CTA de agenda no mesmo fluxo.',
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
                      : () {
                          unawaited(widget.onBookService(post.linkedService!));
                        },
                ),
              ),
            ),
          ],
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

class _GalleryBadge extends StatelessWidget {
  const _GalleryBadge({required this.label});

  final String label;

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
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: Colors.white),
      ),
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

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
