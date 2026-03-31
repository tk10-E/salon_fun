import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/tenant_theme.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_surface_card.dart';
import '../widgets/salon_brand_mark.dart';

class PremiumServiceDetailScreen extends StatelessWidget {
  const PremiumServiceDetailScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.service,
    this.professionals = const <ProfessionalHighlight>[],
    this.relatedPosts = const <SalonPost>[],
    this.onBook,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final ServiceItem service;
  final List<ProfessionalHighlight> professionals;
  final List<SalonPost> relatedPosts;
  final VoidCallback? onBook;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: [service],
      posts: relatedPosts,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Detalhe do servico')),
      body: AppBackdrop(
        branding: branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: profile.salonName,
              title: service.name,
              subtitle: service.description?.trim().isNotEmpty == true
                  ? service.description!
                  : 'Experiencia premium com clareza comercial, desejo visual e CTA direto para agenda.',
              imageUrl: service.imageUrl ?? brandConfig.heroImageUrl,
              primaryActionLabel: 'Agendar',
              onPrimaryAction: onBook,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: profile.salonName,
                    logoUrl: profile.salonLogoUrl,
                    branding: branding,
                    size: 54,
                    borderRadius: 18,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  Text(
                    profile.salonName,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              badges: [
                _Badge(label: '${service.duration} min'),
                _Badge(label: currency.format(service.price)),
              ],
            ),
            const SizedBox(height: PremiumSpacing.xl),
            const PremiumSectionHeader(
              eyebrow: 'Experiencia',
              title: 'O que esperar',
              subtitle:
                  'Descricao, tempo, valor e leitura do servico em uma narrativa curta.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            PremiumSurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    service.description?.trim().isNotEmpty == true
                        ? service.description!
                        : 'Atendimento pensado para manter alto valor percebido sem perder clareza e velocidade de decisao.',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: PremiumSpacing.md),
                  Wrap(
                    spacing: PremiumSpacing.sm,
                    runSpacing: PremiumSpacing.sm,
                    children: [
                      _InfoMetric(
                        icon: Icons.sell_rounded,
                        label: 'Valor',
                        value: currency.format(service.price),
                      ),
                      _InfoMetric(
                        icon: Icons.schedule_rounded,
                        label: 'Duracao',
                        value: '${service.duration} min',
                      ),
                      if (service.category?.trim().isNotEmpty == true)
                        _InfoMetric(
                          icon: brandConfig.iconForService(service),
                          label: 'Categoria',
                          value: service.category!,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (professionals.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Especialistas',
                title: 'Quem atende este servico',
                subtitle:
                    'Profissionais relacionados para reforcar confianca e assinatura tecnica.',
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
                        ctaLabel: 'Agendar agora',
                        onBook: onBook,
                      ),
                    );
                  },
                ),
              ),
            ],
            if (relatedPosts.isNotEmpty) ...[
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Prova visual',
                title: 'Resultados relacionados',
                subtitle:
                    'O servico conversa com a vitrine para elevar desejo, contexto e conversao.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              SizedBox(
                height: 214,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: relatedPosts.take(4).length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: PremiumSpacing.md),
                  itemBuilder: (context, index) {
                    final post = relatedPosts[index];
                    return SizedBox(
                      width: 180,
                      child: PremiumGalleryCard(
                        title: post.title,
                        eyebrow: post.staffMemberName,
                        subtitle: post.caption,
                        imageUrl: post.coverImageUrl,
                        badge: post.isBeforeAfter
                            ? 'Antes e depois'
                            : post.linkedService != null
                            ? 'Ligado ao servico'
                            : null,
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FilledButton(
          onPressed: onBook,
          child: const Text('Agendar este servico'),
        ),
      ),
    );
  }
}

class _InfoMetric extends StatelessWidget {
  const _InfoMetric({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.md,
        vertical: PremiumSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: theme.surfaceSecondary,
        borderRadius: BorderRadius.circular(PremiumRadius.card),
        border: Border.all(color: theme.strokeSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: theme.textPrimary),
          const SizedBox(width: PremiumSpacing.sm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: theme.textMuted,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: PremiumSpacing.xs),
              Text(
                value,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: theme.textPrimary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

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
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
