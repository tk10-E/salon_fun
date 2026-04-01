import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_product_card.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_service_chip.dart';
import '../widgets/premium_surface_card.dart';
import '../widgets/salon_brand_mark.dart';

class PremiumSalonProfileScreen extends StatelessWidget {
  const PremiumSalonProfileScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.services,
    required this.posts,
    required this.offers,
    this.products = const <PremiumProductItem>[],
    this.professionalHighlights = const <ProfessionalHighlight>[],
    required this.onBookService,
    required this.onWhatsApp,
    this.onOpenProfessionals,
    this.onOpenProducts,
    this.onOpenCampaigns,
    this.onOpenServiceDetails,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<ServiceItem> services;
  final List<SalonPost> posts;
  final List<SalonOfferItem> offers;
  final List<PremiumProductItem> products;
  final List<ProfessionalHighlight> professionalHighlights;
  final Future<void> Function(ServiceItem service) onBookService;
  final VoidCallback onWhatsApp;
  final VoidCallback? onOpenProfessionals;
  final VoidCallback? onOpenProducts;
  final VoidCallback? onOpenCampaigns;
  final Future<void> Function(ServiceItem service)? onOpenServiceDetails;

  @override
  Widget build(BuildContext context) {
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: services,
      posts: posts,
      offers: offers,
    );
    final productCatalog = products.isNotEmpty
        ? products
        : brandConfig.products;
    final professionals = professionalHighlights.isNotEmpty
        ? professionalHighlights
        : brandConfig.resolveProfessionalHighlights(posts: posts);
    final leadService = services.isEmpty ? null : services.first;

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil do salao')),
      body: AppBackdrop(
        branding: branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: profile.salonName,
              title: brandConfig.slogan,
              subtitle:
                  'Marca, servicos e canais de contato organizados com leitura premium e consistencia white-label.',
              imageUrl: brandConfig.profileCoverImageUrl,
              tabletImageUrl: brandConfig.profileCoverImageTabletUrl,
              imageAlignment: brandConfig.profileCoverImageAlignment,
              imageScale: brandConfig.profileCoverImageScale,
              primaryActionLabel: brandConfig.primaryCtaLabel,
              onPrimaryAction: leadService == null
                  ? onWhatsApp
                  : () => unawaited(onBookService(leadService)),
              secondaryActionLabel: 'WhatsApp',
              onSecondaryAction: onWhatsApp,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: profile.salonName,
                    logoUrl: profile.salonLogoUrl,
                    branding: branding,
                    size: 56,
                    borderRadius: 18,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      profile.salonName,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: PremiumSpacing.xl),
            const PremiumSectionHeader(
              eyebrow: 'Institucional',
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
                  '${brandConfig.ratingValue!.toStringAsFixed(1)} estrelas${brandConfig.ratingCount == null ? '' : ' | ${brandConfig.ratingCount} avaliacoes'}',
              ],
            ),
            if (brandConfig.businessHours.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Operacao',
                title: 'Funcionamento',
                subtitle: 'Horarios prontos para consulta dentro do app.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              _InfoPanel(
                title: 'Agenda da semana',
                body:
                    'O salao pode ajustar janelas por tenant sem mudar a base do app.',
                details: brandConfig.businessHours
                    .map((hour) => '${hour.dayLabel} | ${hour.hoursLabel}')
                    .toList(),
              ),
            ],
            if (services.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Servicos',
                title: 'Curadoria principal',
                subtitle:
                    'Categorias priorizadas para a identidade do negocio.',
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
                        onTap: onOpenServiceDetails == null
                            ? () => unawaited(onBookService(service))
                            : () => unawaited(onOpenServiceDetails!(service)),
                      ),
                    )
                    .toList(),
              ),
            ],
            if (professionals.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              PremiumSectionHeader(
                eyebrow: 'Equipe',
                title: 'Profissionais em evidencia',
                subtitle:
                    'Time em destaque para fortalecer confianca, prova social e desejo.',
                actionLabel: onOpenProfessionals == null ? null : 'Ver time',
                onAction: onOpenProfessionals,
              ),
              const SizedBox(height: PremiumSpacing.md),
              SizedBox(
                height: 352,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: professionals.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: PremiumSpacing.md),
                  itemBuilder: (context, index) {
                    final professional = professionals[index];
                    return SizedBox(
                      width: 272,
                      child: PremiumProfessionalCard(
                        name: professional.name,
                        specialty: professional.specialty,
                        availabilityLabel: professional.availabilityLabel,
                        ratingLabel: professional.ratingLabel,
                        imageUrl: professional.imageUrl,
                        ctaLabel: leadService == null
                            ? 'Voltar para agenda'
                            : 'Agendar agora',
                        onBook: leadService == null
                            ? () => Navigator.of(context).maybePop()
                            : () => unawaited(onBookService(leadService)),
                      ),
                    );
                  },
                ),
              ),
            ],
            if (posts.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Vitrine',
                title: 'Trabalhos recentes',
                subtitle:
                    'Prova visual da marca para inspirar a proxima reserva.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              SizedBox(
                height: 206,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: posts.take(4).length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: PremiumSpacing.md),
                  itemBuilder: (context, index) {
                    final post = posts[index];
                    return SizedBox(
                      width: 170,
                      child: PremiumGalleryCard(
                        title: post.title,
                        eyebrow: post.staffMemberName,
                        subtitle: post.caption,
                        imageUrl: post.coverImageUrl,
                        badge: post.isBeforeAfter ? 'Antes e depois' : null,
                      ),
                    );
                  },
                ),
              ),
            ],
            if (offers.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              PremiumSectionHeader(
                eyebrow: 'Campanhas',
                title: 'Ofertas vivas do salão',
                subtitle:
                    'As campanhas publicadas no painel também podem aparecer aqui com a mesma assinatura premium.',
                actionLabel: onOpenCampaigns == null ? null : 'Abrir central',
                onAction: onOpenCampaigns,
              ),
              const SizedBox(height: PremiumSpacing.md),
              ...offers
                  .take(2)
                  .map(
                    (offer) => Padding(
                      padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                      child: PremiumSurfaceCard(
                        tone: offer.isActive
                            ? PremiumSurfaceTone.accent
                            : PremiumSurfaceTone.secondary,
                        onTap: onOpenCampaigns,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 54,
                              height: 54,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [branding.primary, branding.deep],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Icon(
                                offer.isMembership
                                    ? Icons.workspace_premium_rounded
                                    : Icons.local_offer_rounded,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: PremiumSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    offer.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: PremiumSpacing.xs),
                                  Text(
                                    offer.description?.trim().isNotEmpty == true
                                        ? offer.description!
                                        : offer.isMembership
                                        ? 'Plano recorrente com leitura premium no app.'
                                        : 'Campanha ativa conectada ao painel do salão.',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodyMedium,
                                  ),
                                  const SizedBox(height: PremiumSpacing.sm),
                                  Wrap(
                                    spacing: PremiumSpacing.xs,
                                    runSpacing: PremiumSpacing.xs,
                                    children: [
                                      if (offer.highlightText
                                              ?.trim()
                                              .isNotEmpty ==
                                          true)
                                        _OfferMetaChip(
                                          label: offer.highlightText!,
                                        ),
                                      _OfferMetaChip(
                                        label: offer.isActive
                                            ? 'Disponível agora'
                                            : 'Programada',
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
            ],
            if (productCatalog.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              PremiumSectionHeader(
                eyebrow: 'Retail',
                title: 'Produtos e combos',
                subtitle:
                    'A vitrine comercial do salao tambem pode viver aqui com o mesmo acabamento premium.',
                actionLabel: onOpenProducts == null ? null : 'Ver vitrine',
                onAction: onOpenProducts,
              ),
              const SizedBox(height: PremiumSpacing.md),
              SizedBox(
                height: 340,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: productCatalog.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: PremiumSpacing.md),
                  itemBuilder: (context, index) {
                    final product = productCatalog[index];
                    return SizedBox(
                      width: 220,
                      child: PremiumProductCard(
                        title: product.name,
                        subtitle: product.subtitle,
                        priceLabel: product.priceLabel,
                        imageUrl: product.imageUrl,
                        badge: product.badge,
                        onTap: onOpenProducts,
                      ),
                    );
                  },
                ),
              ),
            ],
            const SizedBox(height: PremiumSpacing.xl),
            const PremiumSectionHeader(
              eyebrow: 'Contato',
              title: 'Canais da marca',
              subtitle:
                  'WhatsApp, mapa e Instagram quando configurados no tenant.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            PremiumSurfaceCard(
              child: Wrap(
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
            ),
          ],
        ),
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
    return PremiumSurfaceCard(
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

class _OfferMetaChip extends StatelessWidget {
  const _OfferMetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: const Color(0xFFE6D7C9)),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }
}
