import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/loyalty_summary_card.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_booking_card.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_surface_card.dart';
import '../widgets/referral_program_card.dart';
import '../widgets/salon_brand_mark.dart';

class PremiumCampaignsScreen extends StatelessWidget {
  const PremiumCampaignsScreen({
    super.key,
    required this.salonName,
    required this.branding,
    required this.offers,
    required this.services,
    this.logoUrl,
    this.heroImageUrl,
    this.heroTabletImageUrl,
    this.loyaltySummary,
    this.referralSummary,
    this.nextAvailableAt,
    this.onBookLeadService,
    this.onOpenWallet,
    this.onWhatsApp,
    this.onCopyReferral,
  });

  final String salonName;
  final SalonBranding branding;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? heroTabletImageUrl;
  final List<SalonOfferItem> offers;
  final List<ServiceItem> services;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final DateTime? nextAvailableAt;
  final VoidCallback? onBookLeadService;
  final VoidCallback? onOpenWallet;
  final VoidCallback? onWhatsApp;
  final VoidCallback? onCopyReferral;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final sortedOffers = [...offers]
      ..sort((left, right) {
        if (left.isActive != right.isActive) {
          return left.isActive ? -1 : 1;
        }
        return left.sortOrder.compareTo(right.sortOrder);
      });
    final hasBenefits =
        loyaltySummary?.hasVisibleContent == true ||
        referralSummary?.hasVisibleContent == true;
    final activeOffersCount = sortedOffers
        .where((offer) => offer.isActive)
        .length;
    final availableRewardsCount =
        (referralSummary?.availableRewardsCount ?? 0) +
        ((loyaltySummary?.cashbackBalance ?? 0) > 0 ? 1 : 0);
    final heroSubtitle = hasBenefits
        ? 'Campanhas, clube, cashback e indicação organizados como uma vitrine premium do seu salão.'
        : 'As campanhas ativas do salão entram aqui com leitura comercial clara e pronta para conversão.';
    final hasCommercialContent = sortedOffers.isNotEmpty || hasBenefits;

    return Scaffold(
      appBar: AppBar(title: const Text('Campanhas e benefícios')),
      body: AppBackdrop(
        branding: branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: salonName,
              title: 'Central comercial do cliente',
              subtitle: heroSubtitle,
              imageUrl: heroImageUrl,
              tabletImageUrl: heroTabletImageUrl,
              primaryActionLabel: services.isEmpty
                  ? 'Falar com o salão'
                  : 'Agendar agora',
              onPrimaryAction: services.isEmpty
                  ? onWhatsApp
                  : onBookLeadService,
              secondaryActionLabel: onOpenWallet == null
                  ? null
                  : 'Abrir carteira',
              onSecondaryAction: onOpenWallet,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: salonName,
                    logoUrl: logoUrl,
                    branding: branding,
                    size: 56,
                    borderRadius: 18,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  Text(
                    '$activeOffersCount campanhas',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              badges: [
                _HeroBadge(
                  label: activeOffersCount == 0
                      ? 'Clube ativo'
                      : '$activeOffersCount ativas',
                ),
                if (referralSummary?.program?.title.trim().isNotEmpty == true)
                  _HeroBadge(label: referralSummary!.program!.title),
                _HeroBadge(
                  label: nextAvailableAt == null
                      ? 'Agenda conectada'
                      : 'Próximo horário ${DateFormat('dd/MM').format(nextAvailableAt!)}',
                ),
              ],
              footer: Wrap(
                spacing: PremiumSpacing.sm,
                runSpacing: PremiumSpacing.sm,
                children: [
                  _MetricTile(label: 'Ofertas', value: '$activeOffersCount'),
                  _MetricTile(
                    label: 'Benefícios',
                    value: loyaltySummary?.hasVisibleContent == true
                        ? 'Ativos'
                        : 'Base',
                  ),
                  _MetricTile(
                    label: 'Recompensas',
                    value: '$availableRewardsCount',
                  ),
                ],
              ),
            ),
            const SizedBox(height: PremiumSpacing.xl),
            if (!hasCommercialContent)
              PremiumEmptyState(
                eyebrow: 'Em ativação',
                title: 'As campanhas premium do salão entram aqui',
                message:
                    'Quando o salão publicar promoções, clube ou indicações, esta central vira o ponto comercial mais forte do app.',
                icon: Icons.auto_awesome_rounded,
                actionLabel: onWhatsApp == null ? null : 'Falar com o salão',
                onAction: onWhatsApp,
              )
            else ...[
              if (sortedOffers.isNotEmpty) ...[
                const PremiumSectionHeader(
                  eyebrow: 'Campanhas',
                  title: 'Ofertas ativas no app',
                  subtitle:
                      'Condições reais do painel web, organizadas para leitura rápida e decisão imediata.',
                ),
                const SizedBox(height: PremiumSpacing.md),
                ...sortedOffers.map(
                  (offer) => Padding(
                    padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                    child: PremiumBookingCard(
                      eyebrow: offer.isMembership
                          ? (offer.isActive ? 'Clube ativo' : 'Clube pausado')
                          : offer.isActive
                          ? 'Oferta ativa'
                          : 'Oferta programada',
                      icon: offer.isMembership
                          ? Icons.workspace_premium_rounded
                          : Icons.local_offer_rounded,
                      title: offer.title,
                      subtitle: offer.description?.trim().isNotEmpty == true
                          ? offer.description!
                          : offer.isMembership
                          ? 'Plano recorrente configurado pelo salão para retenção premium.'
                          : 'Campanha publicada no painel e liberada para o app do cliente.',
                      meta: [
                        if (offer.highlightText?.trim().isNotEmpty == true)
                          offer.highlightText!,
                        if (offer.price != null) currency.format(offer.price),
                        if (offer.startsOn != null || offer.endsOn != null)
                          _dateWindowLabel(offer),
                      ],
                      highlightLabel: offer.isMembership
                          ? 'Recorrência premium'
                          : offer.isActive
                          ? 'Disponível agora'
                          : 'Em preparação',
                      trailingLabel: services.isEmpty ? null : 'Agendar',
                      onTap: services.isEmpty ? null : onBookLeadService,
                      tone: offer.isActive
                          ? PremiumSurfaceTone.accent
                          : PremiumSurfaceTone.secondary,
                    ),
                  ),
                ),
              ],
              if (hasBenefits) ...[
                if (sortedOffers.isNotEmpty)
                  const SizedBox(height: PremiumSpacing.xl),
                const PremiumSectionHeader(
                  eyebrow: 'Clube e indicação',
                  title: 'Benefícios que acompanham sua frequência',
                  subtitle:
                      'Cashback, ranking, código de indicação e recompensas no mesmo hub.',
                ),
                const SizedBox(height: PremiumSpacing.md),
                if (loyaltySummary?.hasVisibleContent == true)
                  LoyaltySummaryCard(
                    summary: loyaltySummary!,
                    branding: branding,
                  ),
                if (referralSummary?.hasVisibleContent == true) ...[
                  if (loyaltySummary?.hasVisibleContent == true)
                    const SizedBox(height: PremiumSpacing.md),
                  if (referralSummary?.program?.title.trim().isNotEmpty ==
                      true) ...[
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(
                          bottom: PremiumSpacing.sm,
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: PremiumSpacing.md,
                          vertical: PremiumSpacing.sm,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              branding.primary.withValues(alpha: 0.16),
                              Colors.white.withValues(alpha: 0.9),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(
                            PremiumRadius.pill,
                          ),
                          border: Border.all(
                            color: branding.outline.withValues(alpha: 0.44),
                          ),
                        ),
                        child: Text(
                          referralSummary!.program!.title,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: branding.deep,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                      ),
                    ),
                  ],
                  ReferralProgramCard(
                    summary: referralSummary!,
                    branding: branding,
                    onCopyCode: onCopyReferral ?? () {},
                  ),
                ],
              ],
              const SizedBox(height: PremiumSpacing.xl),
              const PremiumSectionHeader(
                eyebrow: 'Próximo passo',
                title: 'O que vale fazer agora',
                subtitle:
                    'A central já fecha o ciclo entre desejo, benefício e ação.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              PremiumSurfaceCard(
                tone: PremiumSurfaceTone.contrast,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      services.isEmpty
                          ? 'O salão já deixou sua vitrine e seus benefícios prontos.'
                          : 'Você já consegue aproveitar campanha, benefício e agenda no mesmo fluxo.',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: PremiumSpacing.sm),
                    Text(
                      services.isEmpty
                          ? 'Use o WhatsApp para confirmar detalhes com o salão enquanto ele ativa o próximo serviço.'
                          : 'Se a campanha fizer sentido para você, o melhor caminho é reservar agora e manter seus benefícios girando.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: PremiumSpacing.md),
                    Wrap(
                      spacing: PremiumSpacing.sm,
                      runSpacing: PremiumSpacing.sm,
                      children: [
                        if (services.isNotEmpty)
                          FilledButton.icon(
                            onPressed: onBookLeadService,
                            icon: const Icon(Icons.calendar_month_rounded),
                            label: const Text('Agendar agora'),
                          ),
                        if (onOpenWallet != null)
                          OutlinedButton.icon(
                            onPressed: onOpenWallet,
                            icon: const Icon(
                              Icons.account_balance_wallet_outlined,
                            ),
                            label: const Text('Abrir carteira'),
                          ),
                        if (onWhatsApp != null)
                          OutlinedButton.icon(
                            onPressed: onWhatsApp,
                            icon: const Icon(Icons.chat_bubble_outline_rounded),
                            label: const Text('WhatsApp'),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _dateWindowLabel(SalonOfferItem offer) {
  final formatter = DateFormat('dd/MM');
  final starts = offer.startsOn == null
      ? null
      : formatter.format(offer.startsOn!);
  final ends = offer.endsOn == null ? null : formatter.format(offer.endsOn!);

  if (starts != null && ends != null) {
    return '$starts - $ends';
  }
  if (starts != null) {
    return 'A partir de $starts';
  }
  if (ends != null) {
    return 'Até $ends';
  }

  return 'Sem janela definida';
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.md,
        vertical: PremiumSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(PremiumRadius.card),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.76),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: PremiumSpacing.xs),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.label});

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
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
