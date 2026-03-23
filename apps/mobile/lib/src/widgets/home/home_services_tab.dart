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
import '../referral_program_card.dart';
import '../salon_hero_card.dart';
import '../salon_offer_card.dart';
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
                    : 'No app',
                icon: Icons.card_giftcard_rounded,
              ),
              SalonHeroMetric(
                label: preset.portfolioMetricLabel,
                value: data.posts.isEmpty
                    ? 'Em atualização'
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
          const SizedBox(height: 22),
          if (data.growthSuggestions?.hasVisibleContent == true) ...[
            const HomeSectionIntro(
              eyebrow: 'Retorno inteligente',
              title: 'O app já sabe o que pode render sua próxima visita',
              description:
                  'Sugestões automáticas baseadas no seu último atendimento, no ciclo ideal do serviço e em oportunidades reais de retorno para o salão.',
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
                  'Esse destaque usa a agenda real do salão e dos profissionais para mostrar o melhor horário livre do momento.',
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
                  'Quando alguém desmarca um horário, a vaga aparece aqui para você aproveitar mais rápido.',
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
                'Horário livre, serviços e sinais rápidos para você decidir e reservar sem atrito.',
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
          if ((data.smartSchedule?.suggestions.length ?? 0) > 1) ...[
            const SizedBox(height: 28),
            const HomeSectionIntro(
              eyebrow: 'Agenda inteligente',
              title: 'Outros encaixes encontrados para hoje',
              description:
                  'Além do destaque principal, estes horários também cabem na agenda real do salão sem criar conflito.',
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
                  : 'Pontos por visita, cashback, desconto progressivo e ranking aparecem aqui no ritmo da sua frequência no salão.',
            ),
            const SizedBox(height: 16),
            LoyaltySummaryCard(
              summary: data.loyaltySummary!,
              branding: branding,
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
                  ? 'Quando quiser, mostre no salão e peça o resgate da recompensa que já foi registrada no sistema.'
                  : 'Cada indicação só conta quando a pessoa entra com o código, agenda e conclui a primeira visita. A cada ${data.referralSummary!.requiredQualifiedReferrals} validadas, o salão libera uma nova recompensa.',
            ),
            const SizedBox(height: 16),
            ReferralProgramCard(
              summary: data.referralSummary!,
              branding: branding,
              onCopyCode: () {
                unawaited(onCopyReferral(data.referralSummary!.referralCode));
              },
            ),
          ],
          if (data.offers.isNotEmpty) ...[
            const SizedBox(height: 28),
            const HomeSectionIntro(
              eyebrow: 'Promoções, planos e pacotes',
              title: 'Ofertas publicadas pelo salão',
              description:
                  'Pacotes, descontos e campanhas que o salão ativou no painel aparecem aqui com vigência e valor reais.',
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
              eyebrow: 'Agenda em preparacao',
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
        color: Colors.white.withValues(alpha: 0.92),
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
          Text(
            preset.momentumLabel,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
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
                label: 'Agenda aberta em $nextAvailableLabel',
                branding: branding,
              ),
              _MomentumPill(
                label: hasBenefits
                    ? preset.benefitsPillLabel
                    : 'Contato direto com o salão',
                branding: branding,
              ),
              _MomentumPill(
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
  const _MomentumPill({required this.label, required this.branding});

  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: branding.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.58)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: branding.deep,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
