import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../empty_state.dart';
import '../salon_feed_post_card.dart';
import '../soft_card.dart';
import 'home_history_brand_header.dart';
import 'home_section_intro.dart';

class HomeFeedTab extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final linkedPostsCount = posts
        .where((post) => post.linkedService != null)
        .length;
    final beforeAfterCount = posts.where((post) => post.isBeforeAfter).length;
    final reelCount = posts.where((post) => post.isReel).length;
    final highlightedProfessionalsCount = posts
        .map((post) => post.staffMemberName)
        .whereType<String>()
        .toSet()
        .length;

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          HomeHistoryBrandHeader(
            profile: profile,
            branding: branding,
            appointmentCount: posts.length,
            collectionLabel: posts.length == 1
                ? '1 publicação no feed do salão'
                : '${posts.length} publicações no feed do salão',
            fallbackMessage:
                'Resultados, novidades e inspirações com a identidade do seu salão.',
          ),
          const SizedBox(height: 20),
          const HomeSectionIntro(
            eyebrow: 'Feed do salão',
            title: 'Resultados, novidades e inspirações',
            description:
                'Veja transformações reais, vídeos curtos e resultados assinados pelo salão para escolher seu próximo atendimento com mais desejo e confiança.',
          ),
          const SizedBox(height: 16),
          if (posts.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.photo_library_outlined,
              eyebrow: 'Vitrine do salão',
              title: 'Seu próximo visual favorito vai aparecer aqui',
              message:
                  'Quando o salão publicar transformações, vídeos e resultados reais, você vai poder salvar a referência, conversar e decidir com muito mais confiança.',
              actionLabel: 'Falar com o salão',
              onAction: onWhatsApp,
              accentColor: branding.primary,
            )
          else
            Column(
              children: [
                _FeedConversionCard(
                  branding: branding,
                  postCount: posts.length,
                  linkedPostsCount: linkedPostsCount,
                  beforeAfterCount: beforeAfterCount,
                  reelCount: reelCount,
                  highlightedProfessionalsCount: highlightedProfessionalsCount,
                  onWhatsApp: onWhatsApp,
                ),
                const SizedBox(height: 16),
                ...posts.map(
                  (post) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: SalonFeedPostCard(
                      post: post,
                      branding: branding,
                      interactionBusy: busyPostIds.contains(post.id),
                      onToggleLike: () => onToggleLike(post),
                      onOpenComments: () => onOpenComments(post),
                      onContactSalon: onWhatsApp,
                      onOpenVideo: post.videoUrl == null || onOpenVideo == null
                          ? null
                          : () => onOpenVideo!(post),
                      onBookService: post.linkedService == null
                          ? null
                          : () => onBookService(post.linkedService!),
                    ),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

class _FeedConversionCard extends StatelessWidget {
  const _FeedConversionCard({
    required this.branding,
    required this.postCount,
    required this.linkedPostsCount,
    required this.beforeAfterCount,
    required this.reelCount,
    required this.highlightedProfessionalsCount,
    required this.onWhatsApp,
  });

  final SalonBranding branding;
  final int postCount;
  final int linkedPostsCount;
  final int beforeAfterCount;
  final int reelCount;
  final int highlightedProfessionalsCount;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final title = linkedPostsCount > 0
        ? 'Seu próximo visual pode sair do feed de hoje'
        : 'Use o feed para descobrir o atendimento que mais combina com você';
    final description = linkedPostsCount > 0
        ? 'Há resultados com reserva direta, transformações reais e referências que ajudam você a imaginar como vai sair do salão antes mesmo de marcar.'
        : 'Mesmo quando a publicação ainda não estiver ligada a um serviço, ela já funciona como referência para você conversar com o salão e montar o visual ideal.';

    return SoftCard(
      gradient: LinearGradient(
        colors: [
          branding.deep,
          branding.primary,
          Color.lerp(branding.primary, Colors.white, 0.08)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.primary.withValues(alpha: 0.38),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Portfólio vivo do salão',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.white.withValues(alpha: 0.82),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.88),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _FeedHighlightPill(
                label: postCount == 1
                    ? '1 inspiração no feed'
                    : '$postCount inspirações no feed',
              ),
              if (beforeAfterCount > 0)
                _FeedHighlightPill(
                  label: beforeAfterCount == 1
                      ? '1 antes e depois'
                      : '$beforeAfterCount antes e depois',
                ),
              if (reelCount > 0)
                _FeedHighlightPill(
                  label: reelCount == 1
                      ? '1 vídeo curto'
                      : '$reelCount vídeos curtos',
                ),
              if (highlightedProfessionalsCount > 0)
                _FeedHighlightPill(
                  label: highlightedProfessionalsCount == 1
                      ? '1 profissional em destaque'
                      : '$highlightedProfessionalsCount profissionais em destaque',
                ),
              if (linkedPostsCount > 0)
                _FeedHighlightPill(
                  label: linkedPostsCount == 1
                      ? '1 resultado com reserva direta'
                      : '$linkedPostsCount resultados com reserva direta',
                ),
            ],
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: onWhatsApp,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.7)),
            ),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            label: const Text('Falar com o salão'),
          ),
        ],
      ),
    );
  }
}

class _FeedHighlightPill extends StatelessWidget {
  const _FeedHighlightPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
