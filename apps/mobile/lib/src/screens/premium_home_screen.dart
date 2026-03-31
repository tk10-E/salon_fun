import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../features/home/home_data.dart';
import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/customer_growth_suggestion_card.dart';
import '../widgets/featured_smart_schedule_card.dart';
import '../widgets/loyalty_summary_card.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_booking_card.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_gallery_card.dart';
import '../widgets/premium_product_card.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_service_card.dart';
import '../widgets/premium_service_chip.dart';
import '../widgets/referral_program_card.dart';
import '../widgets/vacancy_alert_card.dart';

class PremiumHomeScreen extends StatelessWidget {
  const PremiumHomeScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.data,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.onOpenAgenda,
    required this.onOpenGallery,
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
  final VoidCallback onOpenAgenda;
  final VoidCallback onOpenGallery;
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
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final firstName = profile.name.trim().split(' ').first;
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: data.services,
      posts: data.posts,
      offers: data.offers,
    );
    final sortedServices = [...data.services]
      ..sort((left, right) => left.sortOrder.compareTo(right.sortOrder));
    final leadService = sortedServices.isNotEmpty ? sortedServices.first : null;
    final upcomingAppointment = data.appointments
        .where(
          (item) =>
              item.date.isAfter(DateTime.now()) &&
              item.status.toLowerCase() != 'cancelled',
        )
        .cast<AppointmentItem?>()
        .firstWhere((item) => item != null, orElse: () => null);
    final professionals = brandConfig.buildProfessionalHighlights(
      posts: data.posts,
      appointments: data.appointments,
    );
    final visibleModules = brandConfig.visibleModules.toSet();

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
        children: [
          PremiumBanner(
            eyebrow: profile.salonName,
            title: brandConfig.welcomeHeadline.replaceAll('{name}', firstName),
            subtitle: profile.salonTagline?.trim().isNotEmpty == true
                ? brandConfig.welcomeMessage
                : heroSubtitle,
            imageUrl: brandConfig.heroImageUrl,
            tabletImageUrl: brandConfig.heroImageTabletUrl,
            imageAlignment: brandConfig.heroImageAlignment,
            imageScale: brandConfig.heroImageScale,
            primaryActionLabel: brandConfig.primaryCtaLabel,
            onPrimaryAction: leadService == null
                ? onOpenAgenda
                : () => unawaited(onBook(leadService)),
            secondaryActionLabel: data.posts.isEmpty ? null : 'Ver galeria',
            onSecondaryAction: data.posts.isEmpty ? null : onOpenGallery,
            badges: [
              _BrandBadge(label: nextAvailableLabel),
              _BrandBadge(label: todayAttendanceLabel),
            ],
          ),
          if (visibleModules.contains(PremiumHomeModule.shortcuts) &&
              sortedServices.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.lg),
            PremiumSectionHeader(
              title: 'Atalhos da marca',
              subtitle:
                  'Servicos priorizados para o segmento e para sua rotina.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            Wrap(
              spacing: PremiumSpacing.sm,
              runSpacing: PremiumSpacing.sm,
              children: sortedServices
                  .take(4)
                  .map(
                    (service) => SizedBox(
                      width: 96,
                      child: PremiumServiceChip(
                        label: service.category?.trim().isNotEmpty == true
                            ? service.category!
                            : service.name,
                        icon: brandConfig.iconForService(service),
                        onTap: () => unawaited(onBook(service)),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (visibleModules.contains(PremiumHomeModule.nextBooking) &&
              (upcomingAppointment != null ||
                  data.nextAvailableAt != null)) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: upcomingAppointment != null
                  ? 'Proximo agendamento'
                  : 'Proximo horario',
              subtitle:
                  'Clareza imediata sobre o seu proximo passo dentro do app.',
              actionLabel: 'Ver agenda',
              onAction: onOpenAgenda,
            ),
            const SizedBox(height: PremiumSpacing.md),
            PremiumBookingCard(
              title: upcomingAppointment?.serviceName ?? 'Agenda aberta',
              subtitle: upcomingAppointment == null
                  ? 'Seu proximo horario pode sair em $nextAvailableLabel.'
                  : '${DateFormat('dd/MM • HH:mm').format(upcomingAppointment.date)}${upcomingAppointment.staffMemberName == null ? '' : ' com ${upcomingAppointment.staffMemberName}'}',
              meta: [
                if (upcomingAppointment != null)
                  currency.format(upcomingAppointment.servicePrice),
                if (upcomingAppointment != null) upcomingAppointment.status,
                if (upcomingAppointment == null) nextAvailableLabel,
              ],
              trailingLabel: 'Abrir',
              onTap: onOpenAgenda,
            ),
          ],
          if (data.smartSchedule?.suggestions.isNotEmpty == true) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Janela premium para voltar',
              subtitle:
                  'Sugestoes com encaixes reais e menor atrito de decisao.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            FeaturedSmartScheduleCard(
              suggestion: data.smartSchedule!.suggestions.first,
              branding: branding,
              onBook: () {
                final suggestion = data.smartSchedule!.suggestions.first;
                final service = sortedServices.cast<ServiceItem?>().firstWhere(
                  (item) => item?.id == suggestion.suggestedService.id,
                  orElse: () => null,
                );
                if (service != null) {
                  unawaited(onBookSuggested(service, suggestion));
                }
              },
            ),
          ],
          if (data.growthSuggestions?.suggestions.isNotEmpty == true) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Sugestao inteligente',
              subtitle:
                  'Automacoes de recorrencia com leitura comercial premium.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            CustomerGrowthSuggestionCard(
              suggestion: data.growthSuggestions!.suggestions.first,
              branding: branding,
              onBook: () {
                final suggestion = data.growthSuggestions!.suggestions.first;
                final service = sortedServices.cast<ServiceItem?>().firstWhere(
                  (item) => item?.id == suggestion.serviceId,
                  orElse: () => null,
                );
                if (service != null) {
                  unawaited(onBookGrowthSuggestion(service, suggestion));
                }
              },
            ),
          ],
          if (data.vacancyAlerts.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Encaixes ao vivo',
              subtitle: 'Oportunidades com resposta rapida e alta conversao.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            ...data.vacancyAlerts
                .take(2)
                .map(
                  (alert) => Padding(
                    padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                    child: VacancyAlertCard(
                      alert: alert,
                      branding: branding,
                      isBooking: busyVacancyAlertIds.contains(alert.id),
                      isBooked: bookedVacancyAlertIds.contains(alert.id),
                      onBook: () => unawaited(onBookVacancyAlert(alert)),
                    ),
                  ),
                ),
          ],
          if (visibleModules.contains(PremiumHomeModule.professionals) &&
              professionals.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Profissionais em destaque',
              subtitle: 'Talento, assinatura e disponibilidade no mesmo bloco.',
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
                      ratingLabel: professional.ratingLabel,
                      imageUrl: professional.imageUrl,
                    ),
                  );
                },
              ),
            ),
          ],
          if (sortedServices.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Serviços em destaque',
              subtitle: sortedServices.length == 1
                  ? '1 opção ativa'
                  : '${sortedServices.length} opções ativas',
            ),
            const SizedBox(height: PremiumSpacing.md),
            ...sortedServices
                .take(2)
                .map(
                  (service) => Padding(
                    padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                    child: PremiumServiceCard(
                      service: service,
                      branding: branding,
                      isFavorite: favoriteServiceIds.contains(service.id),
                      favoriteBusy: busyFavoriteServiceIds.contains(service.id),
                      onToggleFavorite: () =>
                          unawaited(onToggleFavoriteService(service)),
                      onBook: () => unawaited(onBook(service)),
                    ),
                  ),
                ),
          ],
          if (visibleModules.contains(PremiumHomeModule.gallery) &&
              data.posts.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Ultimos trabalhos',
              subtitle: 'Conteudo visual premium com conversao para agenda.',
              actionLabel: 'Ver mais',
              onAction: onOpenGallery,
            ),
            const SizedBox(height: PremiumSpacing.md),
            SizedBox(
              height: 180,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: data.posts.take(5).length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: PremiumSpacing.md),
                itemBuilder: (context, index) {
                  final post = data.posts[index];
                  return SizedBox(
                    width: 168,
                    child: PremiumGalleryCard(
                      title: post.title,
                      subtitle: post.staffMemberName,
                      imageUrl: post.coverImageUrl,
                      badge: post.isBeforeAfter
                          ? 'Antes e depois'
                          : post.isReel
                          ? 'Video'
                          : null,
                      onTap: onOpenGallery,
                    ),
                  );
                },
              ),
            ),
          ],
          if (visibleModules.contains(PremiumHomeModule.promotions) &&
              data.offers.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Promocoes ativas',
              subtitle: brandConfig.promotionHeadline,
            ),
            const SizedBox(height: PremiumSpacing.md),
            ...data.offers
                .take(2)
                .map(
                  (offer) => Padding(
                    padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                    child: PremiumBookingCard(
                      title: offer.title,
                      subtitle: offer.description?.trim().isNotEmpty == true
                          ? offer.description!
                          : 'Condicao ativa no app para conversao imediata.',
                      meta: [
                        if (offer.highlightText?.trim().isNotEmpty == true)
                          offer.highlightText!,
                        if (offer.price != null) currency.format(offer.price),
                      ],
                    ),
                  ),
                ),
          ],
          if (visibleModules.contains(PremiumHomeModule.products) &&
              brandConfig.products.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Produtos em destaque',
              subtitle:
                  'Kits, recomendacoes e vitrine de alto valor percebido.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            SizedBox(
              height: 320,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: brandConfig.products.length,
                separatorBuilder: (_, _) =>
                    const SizedBox(width: PremiumSpacing.md),
                itemBuilder: (context, index) {
                  final product = brandConfig.products[index];
                  return SizedBox(
                    width: 220,
                    child: PremiumProductCard(
                      title: product.name,
                      subtitle: product.subtitle,
                      priceLabel: product.priceLabel,
                      badge: product.badge,
                      imageUrl: product.imageUrl,
                    ),
                  );
                },
              ),
            ),
          ],
          if (visibleModules.contains(PremiumHomeModule.loyalty) &&
              (data.loyaltySummary?.hasVisibleContent == true ||
                  data.referralSummary != null)) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Clube, cashback e fidelidade',
              subtitle:
                  'Beneficios com acabamento de marca e leitura comercial.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            if (data.loyaltySummary?.hasVisibleContent == true)
              LoyaltySummaryCard(
                summary: data.loyaltySummary!,
                branding: branding,
              ),
            if (data.referralSummary?.program != null) ...[
              const SizedBox(height: PremiumSpacing.md),
              ReferralProgramCard(
                summary: data.referralSummary!,
                branding: branding,
                onCopyCode: () => unawaited(
                  onCopyReferral(data.referralSummary!.referralCode),
                ),
              ),
            ],
          ],
          if (data.services.isEmpty &&
              data.posts.isEmpty &&
              data.offers.isEmpty &&
              data.loyaltySummary == null) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumEmptyState(
              eyebrow: 'Em preparacao',
              title: 'A vitrine premium do salao aparece aqui',
              message:
                  'Assim que a marca liberar agenda, conteudo e campanhas, esta home assume a identidade completa do tenant.',
              actionLabel: 'Falar com o salao',
              onAction: onWhatsApp,
            ),
          ],
        ],
      ),
    );
  }
}

class _BrandBadge extends StatelessWidget {
  const _BrandBadge({required this.label});

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
