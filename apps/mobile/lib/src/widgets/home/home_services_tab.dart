import 'dart:async';

import 'package:flutter/material.dart';

import '../../features/home/home_data.dart';
import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../../theme/salon_experience_preset.dart';
import '../customer_growth_suggestion_card.dart';
import '../empty_state.dart';
import '../featured_smart_schedule_card.dart';
import '../loyalty_summary_card.dart';
import '../press_feedback.dart';
import '../salon_hero_card.dart';
import '../salon_offer_card.dart';
import '../soft_card.dart';
import '../smart_schedule_opportunity_card.dart';
import '../vacancy_alert_card.dart';
import 'home_highlights_grid.dart';
import 'home_section_intro.dart';
import 'home_services_grid.dart';

class HomeServicesTab extends StatelessWidget {
  const HomeServicesTab({
    super.key,
    required this.profile,
    required this.branding,
    required this.data,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.busyVacancyAlertIds,
    required this.bookedVacancyAlertIds,
    required this.onBookVacancyAlert,
    required this.onCopyReferral,
    required this.onBook,
    required this.onBookGrowthSuggestion,
    required this.onBookSuggested,
    required this.heroSubtitle,
    required this.nextAvailableLabel,
    required this.todayAttendanceLabel,
    required this.favoriteServiceIds,
    required this.busyFavoriteServiceIds,
    required this.onToggleFavoriteService,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final HomeData data;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final Set<String> busyVacancyAlertIds;
  final Set<String> bookedVacancyAlertIds;
  final Future<void> Function(VacancyAlert alert) onBookVacancyAlert;
  final Future<void> Function(String code) onCopyReferral;
  final Future<void> Function(ServiceItem service) onBook;
  final Future<void> Function(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion,
  )
  onBookGrowthSuggestion;
  final Future<void> Function(
    ServiceItem service,
    SmartScheduleSuggestionItem suggestion,
  )
  onBookSuggested;
  final String heroSubtitle;
  final String nextAvailableLabel;
  final String todayAttendanceLabel;
  final Set<String> favoriteServiceIds;
  final Set<String> busyFavoriteServiceIds;
  final Future<void> Function(ServiceItem service) onToggleFavoriteService;

  @override
  Widget build(BuildContext context) {
    final preset = SalonExperiencePreset.fromBusinessSegment(
      profile.salonBusinessSegment,
    );
    final sortedServices = [...data.services]
      ..sort((left, right) {
        final leftFavorite = favoriteServiceIds.contains(left.id);
        final rightFavorite = favoriteServiceIds.contains(right.id);
        if (leftFavorite != rightFavorite) {
          return leftFavorite ? -1 : 1;
        }

        if (left.sortOrder != right.sortOrder) {
          return left.sortOrder.compareTo(right.sortOrder);
        }

        return left.name.compareTo(right.name);
      });

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
        children: [
          SalonHeroCard(
            profile: profile,
            branding: branding,
            subtitle: heroSubtitle,
            logoUrl: profile.salonLogoUrl,
            metrics: [
              SalonHeroMetric(
                label: preset.agendaMetricLabel,
                value: nextAvailableLabel,
                icon: Icons.schedule_rounded,
              ),
              SalonHeroMetric(
                label: preset.benefitsMetricLabel,
                value: data.offers.isNotEmpty
                    ? '${data.offers.length} ativos'
                    : data.loyaltySummary?.hasVisibleContent == true
                    ? 'Carteira ativa'
                    : 'Acompanhe aqui',
                icon: Icons.card_giftcard_rounded,
              ),
              SalonHeroMetric(
                label: preset.portfolioMetricLabel,
                value: data.posts.isEmpty
                    ? 'Em breve'
                    : data.posts.length == 1
                    ? '1 inspiração'
                    : '${data.posts.length} inspirações',
                icon: Icons.auto_awesome_rounded,
              ),
            ],
            onWhatsApp: onWhatsApp,
          ),
          const SizedBox(height: 22),
          _HomeMomentumCard(
            branding: branding,
            nextAvailableLabel: nextAvailableLabel,
            hasFeed: data.posts.isNotEmpty,
            hasOffers: data.offers.isNotEmpty,
            hasBenefits:
                data.loyaltySummary?.hasVisibleContent == true ||
                data.referralSummary?.hasVisibleContent == true,
            preset: preset,
          ),
          const SizedBox(height: 16),
          _HomeServicesOverviewCard(
            branding: branding,
            nextAvailableLabel: nextAvailableLabel,
            favoriteCount: favoriteServiceIds.length,
            serviceCount: data.services.length,
            offerCount: data.offers.length,
            feedCount: data.posts.length,
            hasBenefits:
                data.loyaltySummary?.hasVisibleContent == true ||
                data.referralSummary?.hasVisibleContent == true,
            onWhatsApp: onWhatsApp,
          ),
          const SizedBox(height: 22),
          if (data.growthSuggestions?.hasVisibleContent == true) ...[
            const HomeSectionIntro(
              eyebrow: 'Retorno inteligente',
              title: 'O app já sabe o que pode render sua próxima visita',
              description:
                  'Sugestões baseadas no seu último atendimento e no melhor momento de voltar.',
            ),
            const SizedBox(height: 14),
            Column(
              children: data.growthSuggestions!.suggestions.take(2).map((
                suggestion,
              ) {
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) => service?.id == suggestion.serviceId,
                      orElse: () => null,
                    );

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: CustomerGrowthSuggestionCard(
                    suggestion: suggestion,
                    branding: branding,
                    onBook: matchedService == null
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Esse serviço não está disponível para agendamento agora.',
                                ),
                              ),
                            );
                          }
                        : () {
                            unawaited(
                              onBookGrowthSuggestion(
                                matchedService,
                                suggestion,
                              ),
                            );
                          },
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 6),
          ],
          if (data.smartSchedule?.hasSuggestions == true) ...[
            const HomeSectionIntro(
              eyebrow: 'Agenda inteligente',
              title: 'Melhor encaixe real encontrado agora',
              description:
                  'Esse destaque usa a agenda real do salão para mostrar o melhor horário livre agora.',
            ),
            const SizedBox(height: 14),
            Builder(
              builder: (context) {
                final featuredSuggestion =
                    data.smartSchedule!.suggestions.first;
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) =>
                          service?.id == featuredSuggestion.suggestedService.id,
                      orElse: () => null,
                    );

                return FeaturedSmartScheduleCard(
                  suggestion: featuredSuggestion,
                  branding: branding,
                  onBook: matchedService == null
                      ? () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Esse encaixe ainda não está disponível para reserva.',
                              ),
                            ),
                          );
                        }
                      : () {
                          unawaited(
                            onBookSuggested(matchedService, featuredSuggestion),
                          );
                        },
                );
              },
            ),
            const SizedBox(height: 20),
          ],
          if (data.vacancyAlerts.isNotEmpty) ...[
            const HomeSectionIntro(
              eyebrow: 'Horários liberados',
              title: 'Vagas abertas recentemente no salão',
              description:
                  'Quando alguém desmarca, a vaga aparece aqui para você aproveitar rápido.',
            ),
            const SizedBox(height: 14),
            Column(
              children: data.vacancyAlerts
                  .map(
                    (alert) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: VacancyAlertCard(
                        alert: alert,
                        branding: branding,
                        isBooking: busyVacancyAlertIds.contains(alert.id),
                        isBooked: bookedVacancyAlertIds.contains(alert.id),
                        onBook: () {
                          unawaited(onBookVacancyAlert(alert));
                        },
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 14),
          ],
          const HomeSectionIntro(
            eyebrow: 'Destaques do dia',
            title: 'Tudo o que você precisa ver antes de reservar',
            description:
                'Horários, serviços e sinais rápidos para você decidir e reservar sem atrito.',
          ),
          const SizedBox(height: 14),
          HomeHighlightsGrid(
            branding: branding,
            nextAvailableLabel: nextAvailableLabel,
            serviceCount: data.services.length,
            todayAttendanceLabel: todayAttendanceLabel,
            offerCount: data.offers.length,
            feedCount: data.posts.length,
            hasBenefits:
                data.loyaltySummary?.hasVisibleContent == true ||
                data.referralSummary?.hasVisibleContent == true,
            businessSegment: profile.salonBusinessSegment,
          ),
          const SizedBox(height: 28),
          HomeSectionIntro(
            eyebrow: favoriteServiceIds.isNotEmpty
                ? 'Serviços do salão e favoritos'
                : 'Serviços do salão',
            title: 'Escolha seu próximo cuidado',
            description: favoriteServiceIds.isNotEmpty
                ? 'Seus serviços salvos aparecem primeiro para você voltar mais rápido ao que já gosta.'
                : 'Veja preços, compare opções e reserve direto pelo app.',
          ),
          const SizedBox(height: 16),
          if (sortedServices.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.auto_awesome_rounded,
              eyebrow: 'Agenda em preparação',
              title: 'Os serviços ainda não apareceram por aqui',
              message:
                  'Assim que ${profile.salonName} liberar os atendimentos no app, você já poderá reservar seus horários.',
              actionLabel: 'Falar com o salão',
              onAction: onWhatsApp,
              accentColor: branding.primary,
            )
          else
            HomeServicesGrid(
              branding: branding,
              services: sortedServices,
              onBook: onBook,
              favoriteServiceIds: favoriteServiceIds,
              busyFavoriteServiceIds: busyFavoriteServiceIds,
              onToggleFavorite: onToggleFavoriteService,
            ),
          if ((data.smartSchedule?.suggestions.length ?? 0) > 1) ...[
            const SizedBox(height: 28),
            const HomeSectionIntro(
              eyebrow: 'Agenda inteligente',
              title: 'Outros encaixes encontrados para hoje',
              description:
                  'Além do destaque principal, estes horários também estão livres na agenda real do salão.',
            ),
            const SizedBox(height: 16),
            Column(
              children: data.smartSchedule!.suggestions.skip(1).take(3).map((
                suggestion,
              ) {
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) =>
                          service?.id == suggestion.suggestedService.id,
                      orElse: () => null,
                    );

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: SmartScheduleOpportunityCard(
                    suggestion: suggestion,
                    branding: branding,
                    onBook: matchedService == null
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Esse encaixe ainda não está disponível para reserva.',
                                ),
                              ),
                            );
                          }
                        : () {
                            unawaited(
                              onBookSuggested(matchedService, suggestion),
                            );
                          },
                  ),
                );
              }).toList(),
            ),
          ],
          if (data.loyaltySummary?.hasVisibleContent == true) ...[
            const SizedBox(height: 28),
            HomeSectionIntro(
              eyebrow: data.loyaltySummary?.isVip == true
                  ? 'Clube VIP'
                  : 'Ranking e fidelidade',
              title: data.loyaltySummary?.isVip == true
                  ? 'Seu lugar no topo do salão'
                  : 'Cada visita acumula vantagem real',
              description: data.loyaltySummary?.isVip == true
                  ? 'Seu status VIP, cashback e desconto progressivo ficam atualizados aqui sempre que um atendimento é concluído.'
                  : 'Pontos por visita, cashback e desconto progressivo aparecem aqui no ritmo da sua frequência.',
            ),
            const SizedBox(height: 16),
            LoyaltySummaryCard(
              summary: data.loyaltySummary!,
              branding: branding,
            ),
          ],
          if (data.offers.isNotEmpty) ...[
            const SizedBox(height: 28),
            const HomeSectionIntro(
              eyebrow: 'Promoções, planos e pacotes',
              title: 'Ofertas publicadas pelo salão',
              description:
                  'Pacotes, descontos e campanhas com vigência e valor reais aparecem aqui.',
            ),
            const SizedBox(height: 16),
            Column(
              children: data.offers
                  .map(
                    (offer) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: SalonOfferCard(offer: offer, branding: branding),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (data.referralSummary?.hasVisibleContent == true) ...[
            const SizedBox(height: 28),
            HomeSectionIntro(
              eyebrow: data.referralSummary!.availableRewardsCount > 0
                  ? 'Recompensa disponível'
                  : data.referralSummary!.qualifiedCount > 0
                  ? 'Progresso de indicação'
                  : 'Indicação válida',
              title: data.referralSummary!.availableRewardsCount > 0
                  ? 'Sua recompensa já está liberada'
                  : data.referralSummary!.qualifiedCount > 0
                  ? 'Faltam ${data.referralSummary!.nextRewardRemaining} para a próxima recompensa'
                  : 'Compartilhe seu código pelo app',
              description: data.referralSummary!.availableRewardsCount > 0
                  ? 'Sua recompensa já está pronta para uso no salão.'
                  : 'A indicação só conta depois da primeira visita concluída.',
            ),
            const SizedBox(height: 16),
            _HomeReferralSnapshotCard(
              summary: data.referralSummary!,
              branding: branding,
              onCopyCode: () {
                unawaited(onCopyReferral(data.referralSummary!.referralCode));
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _HomeMomentumCard extends StatelessWidget {
  const _HomeMomentumCard({
    required this.branding,
    required this.nextAvailableLabel,
    required this.hasFeed,
    required this.hasOffers,
    required this.hasBenefits,
    required this.preset,
  });

  final SalonBranding branding;
  final String nextAvailableLabel;
  final bool hasFeed;
  final bool hasOffers;
  final bool hasBenefits;
  final SalonExperiencePreset preset;

  @override
  Widget build(BuildContext context) {
    final title = hasFeed
        ? preset.momentumTitleWithFeed
        : preset.momentumTitleWithoutFeed;
    final description = hasFeed
        ? preset.momentumDescriptionWithFeed
        : preset.momentumDescriptionWithoutFeed;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.98),
            branding.highlightBackground.withValues(alpha: 0.72),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: branding.outline.withValues(alpha: 0.68)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x101A120D),
            blurRadius: 22,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.88),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.42),
              ),
            ),
            child: Text(
              preset.momentumLabel,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: branding.deep,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.mutedText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MomentumPill(
                icon: Icons.schedule_rounded,
                label: 'Agenda aberta em $nextAvailableLabel',
                branding: branding,
              ),
              _MomentumPill(
                icon: hasBenefits
                    ? Icons.card_giftcard_rounded
                    : Icons.chat_bubble_outline_rounded,
                label: hasBenefits
                    ? preset.benefitsPillLabel
                    : 'Contato direto com o salão',
                branding: branding,
              ),
              _MomentumPill(
                icon: hasOffers
                    ? Icons.local_offer_outlined
                    : hasFeed
                    ? Icons.photo_library_outlined
                    : Icons.tips_and_updates_outlined,
                label: hasOffers
                    ? preset.offersPillLabel
                    : hasFeed
                    ? preset.feedPillLabel
                    : 'Escolha com mais clareza',
                branding: branding,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MomentumPill extends StatelessWidget {
  const _MomentumPill({
    required this.label,
    required this.branding,
    required this.icon,
  });

  final String label;
  final SalonBranding branding;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.46)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: branding.deep,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeServicesOverviewCard extends StatelessWidget {
  const _HomeServicesOverviewCard({
    required this.branding,
    required this.nextAvailableLabel,
    required this.favoriteCount,
    required this.serviceCount,
    required this.offerCount,
    required this.feedCount,
    required this.hasBenefits,
    required this.onWhatsApp,
  });

  final SalonBranding branding;
  final String nextAvailableLabel;
  final int favoriteCount;
  final int serviceCount;
  final int offerCount;
  final int feedCount;
  final bool hasBenefits;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.98),
          branding.surface.withValues(alpha: 0.98),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline.withValues(alpha: 0.6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Visão rápida do salão',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Tudo o que mais ajuda na decisão ficou junto: agenda viva, serviços, favoritos e sinais de retorno.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.mutedText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _OverviewMetricTile(
                branding: branding,
                icon: Icons.schedule_rounded,
                label: 'Próximo horário',
                value: nextAvailableLabel,
              ),
              _OverviewMetricTile(
                branding: branding,
                icon: Icons.favorite_border_rounded,
                label: favoriteCount > 0 ? 'Salvos por você' : 'Favoritos',
                value: favoriteCount > 0
                    ? '$favoriteCount serviços'
                    : 'Monte sua lista',
              ),
              _OverviewMetricTile(
                branding: branding,
                icon: Icons.content_cut_rounded,
                label: 'Serviços do salão',
                value: serviceCount == 1 ? '1 opção' : '$serviceCount opções',
              ),
              _OverviewMetricTile(
                branding: branding,
                icon: hasBenefits
                    ? Icons.card_giftcard_rounded
                    : Icons.photo_library_outlined,
                label: hasBenefits ? 'Benefícios ativos' : 'Feed do salão',
                value: hasBenefits
                    ? offerCount > 0
                          ? '$offerCount ativos'
                          : 'Carteira ativa'
                    : feedCount == 1
                    ? '1 inspiração'
                    : '$feedCount inspirações',
              ),
            ],
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: PressFeedback(
              haptic: true,
              child: OutlinedButton.icon(
                onPressed: onWhatsApp,
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('Abrir conversa'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OverviewMetricTile extends StatelessWidget {
  const _OverviewMetricTile({
    required this.branding,
    required this.icon,
    required this.label,
    required this.value,
  });

  final SalonBranding branding;
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: branding.deep),
          const SizedBox(height: 10),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF7A5E4E),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeReferralSnapshotCard extends StatelessWidget {
  const _HomeReferralSnapshotCard({
    required this.summary,
    required this.branding,
    required this.onCopyCode,
  });

  final ReferralSummary summary;
  final SalonBranding branding;
  final VoidCallback onCopyCode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final rewardTarget = summary.requiredQualifiedReferrals;
    final cycleProgress = rewardTarget > 0
        ? summary.currentCycleProgress.clamp(0, rewardTarget)
        : summary.currentCycleProgress;
    final progressRatio = rewardTarget > 0 ? cycleProgress / rewardTarget : 0.0;
    final rewardLabel = _rewardLabel;
    final latestReferral = summary.referrals.isEmpty
        ? null
        : summary.referrals.first;
    final progressText = summary.availableRewardsCount > 0 && cycleProgress == 0
        ? 'Meta concluída. Agora é só resgatar no salão.'
        : summary.nextRewardRemaining <= 0
        ? 'Sua próxima recompensa está pronta para liberar.'
        : summary.nextRewardRemaining == 1
        ? 'Falta 1 indicação validada para liberar a próxima recompensa.'
        : 'Faltam ${summary.nextRewardRemaining} indicações validadas para liberar a próxima recompensa.';

    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: branding.outline.withValues(alpha: 0.72),
      gradient: LinearGradient(
        colors: [
          branding.primary.withValues(alpha: 0.16),
          Colors.white.withValues(alpha: 0.98),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(Icons.card_giftcard_rounded, color: branding.deep),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Indique e ganhe',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      summary.referralCode.trim().isEmpty
                          ? 'Seu código aparece aqui quando a campanha estiver ativa.'
                          : 'Seu código: ${summary.referralCode}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (summary.availableRewardsCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: branding.outline.withValues(alpha: 0.54),
                    ),
                  ),
                  child: Text(
                    summary.availableRewardsCount == 1
                        ? '1 disponível'
                        : '${summary.availableRewardsCount} disponíveis',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.86),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.56),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rewardTarget == 1
                      ? 'A cada indicação validada'
                      : 'A cada $rewardTarget indicações validadas',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  rewardLabel,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: branding.deep,
                  ),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progressRatio.clamp(0, 1),
                    minHeight: 12,
                    backgroundColor: const Color(0xFFF1E4D7),
                    valueColor: AlwaysStoppedAnimation<Color>(branding.deep),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '$cycleProgress/$rewardTarget validadas neste ciclo',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  progressText,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF715A4C),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MomentumPill(
                icon: Icons.hourglass_bottom_rounded,
                label: '${summary.pendingCount} pendentes',
                branding: branding,
              ),
              _MomentumPill(
                icon: Icons.verified_rounded,
                label: '${summary.qualifiedCount} validadas',
                branding: branding,
              ),
              _MomentumPill(
                icon: Icons.card_giftcard_rounded,
                label: '${summary.availableRewardsCount} disponíveis',
                branding: branding,
              ),
            ],
          ),
          if (latestReferral != null) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.78),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: branding.outline.withValues(alpha: 0.48),
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          latestReferral.customerName,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          latestReferral.status == 'qualified'
                              ? 'Já concluiu a primeira visita.'
                              : 'Entrou no salão e está em andamento.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFF715A4C),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.92),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      latestReferral.status == 'qualified'
                          ? 'Validada'
                          : 'Pendente',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: PressFeedback(
              haptic: true,
              child: OutlinedButton.icon(
                onPressed: onCopyCode,
                icon: const Icon(Icons.copy_rounded),
                label: const Text('Copiar código de indicação'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String get _rewardLabel {
    final rewardServiceName = summary.program?.rewardServiceName?.trim();
    if (rewardServiceName != null && rewardServiceName.isNotEmpty) {
      return rewardServiceName;
    }

    final rewardForReferrer = summary.program?.rewardForReferrer.trim();
    if (rewardForReferrer != null && rewardForReferrer.isNotEmpty) {
      return rewardForReferrer;
    }

    return 'Recompensa do salão';
  }
}
