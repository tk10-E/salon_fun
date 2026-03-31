import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/tenant_theme.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_service_chip.dart';

class PremiumSalonProfileScreen extends StatelessWidget {
  const PremiumSalonProfileScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.services,
    required this.posts,
    required this.offers,
    required this.onBookService,
    required this.onWhatsApp,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<ServiceItem> services;
  final List<SalonPost> posts;
  final List<SalonOfferItem> offers;
  final Future<void> Function(ServiceItem service) onBookService;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: services,
      posts: posts,
      offers: offers,
    );
    final professionals = brandConfig.buildProfessionalHighlights(posts: posts);

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil do salao')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          PremiumBanner(
            eyebrow: profile.salonName,
            title: brandConfig.slogan,
            subtitle:
                'Marca, servicos e canais de contato organizados com leitura de franquia premium.',
            imageUrl: brandConfig.profileCoverImageUrl,
            tabletImageUrl: brandConfig.profileCoverImageTabletUrl,
            imageAlignment: brandConfig.profileCoverImageAlignment,
            imageScale: brandConfig.profileCoverImageScale,
            primaryActionLabel: brandConfig.primaryCtaLabel,
            onPrimaryAction: services.firstOrNull == null
                ? onWhatsApp
                : () {
                    unawaited(onBookService(services.first));
                  },
            secondaryActionLabel: 'WhatsApp',
            onSecondaryAction: onWhatsApp,
          ),
          const SizedBox(height: PremiumSpacing.xl),
          PremiumSectionHeader(
            title: 'Sobre a marca',
            subtitle:
                'Identidade forte, instituicao clara e informacao util para conversao.',
          ),
          const SizedBox(height: PremiumSpacing.md),
          _InfoPanel(
            title: profile.salonName,
            body: profile.salonTagline?.trim().isNotEmpty == true
                ? profile.salonTagline!
                : brandConfig.slogan,
            details: [
              if (brandConfig.addressLabel != null) brandConfig.addressLabel!,
              if (brandConfig.ratingValue != null)
                '${brandConfig.ratingValue!.toStringAsFixed(1)} estrelas${brandConfig.ratingCount == null ? '' : ' • ${brandConfig.ratingCount} avaliacoes'}',
            ],
          ),
          if (brandConfig.businessHours.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Funcionamento',
              subtitle: 'Horarios prontos para consulta dentro do app.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            _InfoPanel(
              title: 'Agenda da semana',
              body:
                  'O salao pode ajustar janelas por tenant sem mudar a base do app.',
              details: brandConfig.businessHours
                  .map((hour) => '${hour.dayLabel} • ${hour.hoursLabel}')
                  .toList(),
            ),
          ],
          const SizedBox(height: PremiumSpacing.xl),
          PremiumSectionHeader(
            title: 'Servicos principais',
            subtitle: 'Categorias priorizadas para a identidade do negocio.',
          ),
          const SizedBox(height: PremiumSpacing.md),
          Wrap(
            spacing: PremiumSpacing.sm,
            runSpacing: PremiumSpacing.sm,
            children: services
                .take(6)
                .map(
                  (service) => PremiumServiceChip(
                    label: service.name,
                    icon: brandConfig.iconForService(service),
                    onTap: () {
                      unawaited(onBookService(service));
                    },
                  ),
                )
                .toList(),
          ),
          if (professionals.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Profissionais',
              subtitle: 'Time em evidencia para fortalecer confianca e desejo.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            SizedBox(
              height: 238,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: professionals.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: PremiumSpacing.md),
                itemBuilder: (context, index) {
                  final professional = professionals[index];
                  return SizedBox(
                    width: 260,
                    child: PremiumProfessionalCard(
                      name: professional.name,
                      specialty: professional.specialty,
                      availabilityLabel: professional.availabilityLabel,
                      onBook: services.firstOrNull == null
                          ? null
                          : () {
                              unawaited(onBookService(services.first));
                            },
                    ),
                  );
                },
              ),
            ),
          ],
          if (posts.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Vitrine visual',
              subtitle: 'Trabalhos recentes usados como prova visual da marca.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            SizedBox(
              height: 178,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: posts.take(4).length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: PremiumSpacing.md),
                itemBuilder: (context, index) {
                  final post = posts[index];
                  return SizedBox(
                    width: 160,
                    child: PremiumGalleryCard(
                      title: post.title,
                      subtitle: post.staffMemberName,
                      imageUrl: post.coverImageUrl,
                    ),
                  );
                },
              ),
            ),
          ],
          const SizedBox(height: PremiumSpacing.xl),
          PremiumSectionHeader(
            title: 'Canais da marca',
            subtitle:
                'WhatsApp, mapa e Instagram quando configurados no tenant.',
          ),
          const SizedBox(height: PremiumSpacing.md),
          Wrap(
            spacing: PremiumSpacing.sm,
            runSpacing: PremiumSpacing.sm,
            children: [
              FilledButton.icon(
                onPressed: onWhatsApp,
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('WhatsApp'),
              ),
              if (brandConfig.instagramUrl != null)
                OutlinedButton.icon(
                  onPressed: () => _launchUrl(brandConfig.instagramUrl!),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('Instagram'),
                ),
              if (brandConfig.mapUrl != null)
                OutlinedButton.icon(
                  onPressed: () => _launchUrl(brandConfig.mapUrl!),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Mapa'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _launchUrl(String value) async {
    final uri = Uri.tryParse(value);
    if (uri == null) {
      return;
    }

    await launchUrl(uri, mode: LaunchMode.platformDefault);
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({
    required this.title,
    required this.body,
    required this.details,
  });

  final String title;
  final String body;
  final List<String> details;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(PremiumSpacing.lg),
      decoration: BoxDecoration(
        color: context.premiumTheme.surfacePrimary,
        borderRadius: BorderRadius.circular(PremiumRadius.card),
        border: Border.all(color: context.premiumTheme.strokeSoft),
        boxShadow: context.premiumTheme.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: PremiumSpacing.sm),
          Text(body),
          if (details.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.md),
            ...details.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: PremiumSpacing.xs),
                child: Text(item, style: Theme.of(context).textTheme.bodySmall),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
