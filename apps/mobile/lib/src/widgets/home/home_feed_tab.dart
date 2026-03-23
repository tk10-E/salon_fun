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
                'Veja cortes, unhas, sobrancelhas e outros resultados publicados pelo salão, incluindo antes e depois e videos curtos.',
          ),
          const SizedBox(height: 16),
          if (posts.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.photo_library_outlined,
              eyebrow: 'Feed em preparacao',
              title: 'As fotos do salão vão aparecer aqui',
              message:
                  'Quando o salão publicar seus resultados, você vai poder curtir e comentar sem sair do app.',
              actionLabel: 'Falar com o salão',
              onAction: onWhatsApp,
              accentColor: branding.primary,
            )
          else
            Column(
              children: [
                _FeedConversionCard(
                  linkedPostsCount: linkedPostsCount,
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
    required this.linkedPostsCount,
    required this.onWhatsApp,
  });

  final int linkedPostsCount;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final title = linkedPostsCount > 0
        ? '$linkedPostsCount ${linkedPostsCount == 1 ? 'resultado já pode virar reserva' : 'resultados já podem virar reserva'}'
        : 'Use o feed para decidir com mais confiança';
    final description = linkedPostsCount > 0
        ? 'Gostou de uma foto? Você pode reservar o serviço ligado ao resultado ou falar com o salão para adaptar o visual ao seu estilo.'
        : 'Mesmo quando a foto não tiver serviço vinculado, vale falar com o salão para descobrir o melhor caminho antes de reservar.';

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Text(
            description,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: onWhatsApp,
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            label: const Text('Falar com o salão'),
          ),
        ],
      ),
    );
  }
}
