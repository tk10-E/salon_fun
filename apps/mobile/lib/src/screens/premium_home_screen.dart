import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../features/home/home_data.dart';
import '../models/app_models.dart';
import '../models/salon_client_app_config.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_home_template.dart';
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
import '../widgets/premium_surface_card.dart';
import '../widgets/referral_program_card.dart';
import '../widgets/salon_brand_mark.dart';
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
    this.onOpenProfessionals,
    this.onOpenProducts,
    this.onOpenServiceDetails,
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
  final VoidCallback? onOpenProfessionals;
  final VoidCallback? onOpenProducts;
  final Future<void> Function(ServiceItem service)? onOpenServiceDetails;

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
    final clientConfig =
        profile.salonClientAppConfig ?? const SalonClientAppConfig();
    final template = SalonHomeTemplate.resolve(
      config: clientConfig,
      businessSegment: profile.salonBusinessSegment,
    );
    final primarySurface = template.resolvePrimarySurface(
      clientConfig.resolveHomeEmphasis(profile.salonBusinessSegment),
    );
    final orderedModules = brandConfig.visibleModules;
    final visibleModules = orderedModules.toSet();
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

    final renderedModules = <PremiumHomeModule>{};
    final sections = <Widget>[];

    void addSection(List<Widget> widgets) {
      if (widgets.isEmpty) {
        return;
      }
      if (sections.isNotEmpty) {
        sections.add(const SizedBox(height: PremiumSpacing.xl));
      }
      sections.addAll(widgets);
    }

    addSection(
      _buildShortcutsSection(
        brandConfig: brandConfig,
        services: sortedServices,
        visibleModules: visibleModules,
      ),
    );
    if (visibleModules.contains(PremiumHomeModule.shortcuts)) {
      renderedModules.add(PremiumHomeModule.shortcuts);
    }

    addSection(
      _buildAgendaSection(
        currency: currency,
        upcomingAppointment: upcomingAppointment,
        visibleModules: visibleModules,
      ),
    );
    if (visibleModules.contains(PremiumHomeModule.nextBooking) &&
        (upcomingAppointment != null || data.nextAvailableAt != null)) {
      renderedModules.add(PremiumHomeModule.nextBooking);
    }

    addSection(_buildSmartSignalsSection(sortedServices: sortedServices));

    if (primarySurface == SalonHomeSurface.portfolio) {
      addSection(
        _buildGallerySection(brandConfig: brandConfig, prominent: true),
      );
      if (data.posts.isNotEmpty &&
          visibleModules.contains(PremiumHomeModule.gallery)) {
        renderedModules.add(PremiumHomeModule.gallery);
      }
    } else if (primarySurface == SalonHomeSurface.benefits) {
      addSection(_buildBenefitsSection(prominent: true));
      if ((data.loyaltySummary?.hasVisibleContent == true ||
              data.referralSummary != null) &&
          visibleModules.contains(PremiumHomeModule.loyalty)) {
        renderedModules.add(PremiumHomeModule.loyalty);
      }
    }

    addSection(
      _buildServicesSection(
        services: sortedServices,
        title: template.servicesTitle,
        subtitle: sortedServices.length == 1
            ? '1 opção ativa'
            : '${sortedServices.length} opções ativas',
      ),
    );

    for (final module in orderedModules) {
      if (renderedModules.contains(module)) {
        continue;
      }

      switch (module) {
        case PremiumHomeModule.shortcuts:
        case PremiumHomeModule.nextBooking:
          continue;
        case PremiumHomeModule.professionals:
          addSection(
            _buildProfessionalsSection(
              professionals: professionals,
              leadService: leadService,
            ),
          );
          break;
        case PremiumHomeModule.gallery:
          addSection(_buildGallerySection(brandConfig: brandConfig));
          break;
        case PremiumHomeModule.promotions:
          addSection(_buildPromotionsSection(currency));
          break;
        case PremiumHomeModule.products:
          addSection(_buildProductsSection(brandConfig));
          break;
        case PremiumHomeModule.loyalty:
          addSection(_buildBenefitsSection());
          break;
      }
    }

    final hasCommercialContent =
        data.services.isNotEmpty ||
        data.posts.isNotEmpty ||
        data.offers.isNotEmpty ||
        data.loyaltySummary != null;

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
            leading: _BrandHeroIdentity(
              profile: profile,
              branding: branding,
              slogan: brandConfig.slogan,
            ),
            badges: [
              _BrandBadge(label: nextAvailableLabel),
              _BrandBadge(label: todayAttendanceLabel),
            ],
            footer: Wrap(
              spacing: PremiumSpacing.sm,
              runSpacing: PremiumSpacing.sm,
              children: [
                _HeroMetricCard(
                  label: 'Agenda',
                  value: nextAvailableLabel,
                  compact: true,
                ),
                _HeroMetricCard(
                  label: 'Servicos',
                  value: '${sortedServices.length}',
                  compact: true,
                ),
                _HeroMetricCard(
                  label: data.posts.isNotEmpty
                      ? template.portfolioTitle
                      : professionals.isNotEmpty
                      ? 'Especialistas'
                      : 'Beneficios',
                  value: data.posts.isNotEmpty
                      ? '${data.posts.length}'
                      : professionals.isNotEmpty
                      ? '${professionals.length}'
                      : '${(data.loyaltySummary?.pointsBalance ?? 0)} pts',
                  compact: true,
                ),
              ],
            ),
          ),
          if (sections.isNotEmpty) const SizedBox(height: PremiumSpacing.lg),
          ...sections,
          if (!hasCommercialContent) ...[
            if (sections.isNotEmpty) const SizedBox(height: PremiumSpacing.xl),
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

  List<Widget> _buildShortcutsSection({
    required SalonBrandConfig brandConfig,
    required List<ServiceItem> services,
    required Set<PremiumHomeModule> visibleModules,
  }) {
    if (!visibleModules.contains(PremiumHomeModule.shortcuts) ||
        services.isEmpty) {
      return const <Widget>[];
    }

    return [
      const PremiumSectionHeader(
        eyebrow: 'Atalhos',
        title: 'Acesso rapido da marca',
        subtitle: 'Entradas priorizadas para reservar sem atrito.',
      ),
      const SizedBox(height: PremiumSpacing.md),
      Wrap(
        spacing: PremiumSpacing.sm,
        runSpacing: PremiumSpacing.sm,
        children: services
            .take(4)
            .map(
              (service) => SizedBox(
                width: 104,
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
    ];
  }

  List<Widget> _buildAgendaSection({
    required NumberFormat currency,
    required AppointmentItem? upcomingAppointment,
    required Set<PremiumHomeModule> visibleModules,
  }) {
    if (!visibleModules.contains(PremiumHomeModule.nextBooking) &&
        upcomingAppointment == null &&
        data.nextAvailableAt == null) {
      return const <Widget>[];
    }

    if (!visibleModules.contains(PremiumHomeModule.nextBooking) ||
        (upcomingAppointment == null && data.nextAvailableAt == null)) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: 'Agenda',
        title: upcomingAppointment != null
            ? 'Seu proximo agendamento'
            : 'Proximo horario premium',
        subtitle:
            'A clareza do proximo passo entra cedo para puxar conversao sem ruido.',
        actionLabel: 'Ver agenda',
        onAction: onOpenAgenda,
      ),
      const SizedBox(height: PremiumSpacing.md),
      PremiumBookingCard(
        eyebrow: upcomingAppointment != null ? 'Confirmado' : 'Agenda aberta',
        title:
            upcomingAppointment?.serviceName ?? 'Escolha seu proximo horario',
        subtitle: upcomingAppointment == null
            ? 'Seu proximo horario pode sair em $nextAvailableLabel.'
            : '${DateFormat('dd/MM - HH:mm').format(upcomingAppointment.date)}${upcomingAppointment.staffMemberName == null ? '' : ' com ${upcomingAppointment.staffMemberName}'}',
        meta: [
          if (upcomingAppointment != null)
            currency.format(upcomingAppointment.servicePrice),
          if (upcomingAppointment != null) upcomingAppointment.status,
          if (upcomingAppointment == null) nextAvailableLabel,
        ],
        highlightLabel: upcomingAppointment == null
            ? 'CTA principal ativo'
            : null,
        trailingLabel: 'Abrir',
        onTap: onOpenAgenda,
      ),
    ];
  }

  List<Widget> _buildSmartSignalsSection({
    required List<ServiceItem> sortedServices,
  }) {
    final widgets = <Widget>[];

    if (data.smartSchedule?.suggestions.isNotEmpty == true) {
      widgets.addAll([
        const PremiumSectionHeader(
          eyebrow: 'Retorno',
          title: 'Janela premium para voltar',
          subtitle: 'Sugestoes com encaixes reais e menor atrito de decisao.',
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
      ]);
    }

    if (data.growthSuggestions?.suggestions.isNotEmpty == true) {
      if (widgets.isNotEmpty) {
        widgets.add(const SizedBox(height: PremiumSpacing.xl));
      }
      widgets.addAll([
        const PremiumSectionHeader(
          eyebrow: 'Inteligencia',
          title: 'Sugestao inteligente',
          subtitle: 'Recorrencia e intencao comercial tratadas como curadoria.',
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
      ]);
    }

    if (data.vacancyAlerts.isNotEmpty) {
      if (widgets.isNotEmpty) {
        widgets.add(const SizedBox(height: PremiumSpacing.xl));
      }
      widgets.addAll([
        const PremiumSectionHeader(
          eyebrow: 'Ao vivo',
          title: 'Encaixes em tempo real',
          subtitle: 'Oportunidades de resposta rapida com leitura premium.',
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
      ]);
    }

    return widgets;
  }

  List<Widget> _buildProfessionalsSection({
    required List<ProfessionalHighlight> professionals,
    required ServiceItem? leadService,
  }) {
    if (professionals.isEmpty ||
        !profileHasModule(PremiumHomeModule.professionals)) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: 'Especialistas',
        title: 'Profissionais em destaque',
        subtitle: 'Talento, assinatura e disponibilidade no mesmo bloco.',
        actionLabel: onOpenProfessionals == null ? null : 'Ver time',
        onAction: onOpenProfessionals,
      ),
      const SizedBox(height: PremiumSpacing.md),
      SizedBox(
        height: 352,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: professionals.length,
          separatorBuilder: (_, _) => const SizedBox(width: PremiumSpacing.md),
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
                    ? 'Abrir agenda'
                    : 'Agendar agora',
                onBook: leadService == null
                    ? onOpenAgenda
                    : () => unawaited(onBook(leadService)),
              ),
            );
          },
        ),
      ),
    ];
  }

  List<Widget> _buildServicesSection({
    required List<ServiceItem> services,
    required String title,
    required String subtitle,
  }) {
    if (services.isEmpty) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: 'Catalogo',
        title: title,
        subtitle: subtitle,
      ),
      const SizedBox(height: PremiumSpacing.md),
      ...services
          .take(3)
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
                onExplore: onOpenServiceDetails == null
                    ? null
                    : () => unawaited(onOpenServiceDetails!(service)),
              ),
            ),
          ),
    ];
  }

  List<Widget> _buildGallerySection({
    required SalonBrandConfig brandConfig,
    bool prominent = false,
  }) {
    if (data.posts.isEmpty || !profileHasModule(PremiumHomeModule.gallery)) {
      return const <Widget>[];
    }

    final previewPosts = data.posts.take(prominent ? 4 : 5).toList();

    return [
      PremiumSectionHeader(
        eyebrow: prominent ? 'Vitrine principal' : 'Feed visual',
        title: prominent ? 'Conteudo que gera desejo' : 'Ultimos trabalhos',
        subtitle: prominent
            ? 'A vitrine entra antes para transformar referencia em vontade de reservar.'
            : 'Conteudo visual premium com conversao para agenda.',
        actionLabel: 'Ver mais',
        onAction: onOpenGallery,
      ),
      const SizedBox(height: PremiumSpacing.md),
      if (prominent && previewPosts.length >= 2) ...[
        SizedBox(
          height: 220,
          child: Row(
            children: [
              Expanded(
                child: PremiumGalleryCard(
                  title: previewPosts[0].title,
                  eyebrow: previewPosts[0].staffMemberName,
                  subtitle: previewPosts[0].caption,
                  imageUrl: previewPosts[0].coverImageUrl,
                  badge: previewPosts[0].isBeforeAfter
                      ? 'Antes e depois'
                      : previewPosts[0].isReel
                      ? 'Video'
                      : null,
                  aspectRatio: 0.78,
                  onTap: onOpenGallery,
                ),
              ),
              const SizedBox(width: PremiumSpacing.md),
              Expanded(
                child: PremiumGalleryCard(
                  title: previewPosts[1].title,
                  eyebrow: previewPosts[1].staffMemberName,
                  subtitle: previewPosts[1].caption,
                  imageUrl: previewPosts[1].coverImageUrl,
                  badge: previewPosts[1].linkedService != null
                      ? 'Reserva direta'
                      : null,
                  aspectRatio: 0.78,
                  onTap: onOpenGallery,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: PremiumSpacing.md),
      ],
      SizedBox(
        height: prominent ? 212 : 196,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: previewPosts.length,
          separatorBuilder: (_, _) => const SizedBox(width: PremiumSpacing.md),
          itemBuilder: (context, index) {
            final post = previewPosts[index];
            return SizedBox(
              width: prominent ? 180 : 172,
              child: PremiumGalleryCard(
                title: post.title,
                eyebrow: post.staffMemberName,
                subtitle: post.staffMemberRole,
                imageUrl: post.coverImageUrl,
                badge: post.isBeforeAfter
                    ? 'Antes e depois'
                    : post.isReel
                    ? 'Video'
                    : post.linkedService != null
                    ? 'Reserva'
                    : null,
                onTap: onOpenGallery,
              ),
            );
          },
        ),
      ),
      if (prominent && brandConfig.primaryCtaLabel.trim().isNotEmpty) ...[
        const SizedBox(height: PremiumSpacing.md),
        PremiumBookingCard(
          eyebrow: 'Conversao',
          icon: Icons.auto_awesome_rounded,
          title: 'Use a vitrine para decidir e reservar',
          subtitle:
              'Os conteudos mais fortes do salao ja estao organizados para inspirar e empurrar o CTA certo.',
          meta: [
            '${data.posts.length} publicacoes',
            '${data.posts.where((post) => post.isBeforeAfter).length} antes/depois',
          ],
          trailingLabel: 'Abrir galeria',
          onTap: onOpenGallery,
        ),
      ],
    ];
  }

  List<Widget> _buildPromotionsSection(NumberFormat currency) {
    if (data.offers.isEmpty ||
        !profileHasModule(PremiumHomeModule.promotions)) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: 'Campanhas',
        title: 'Promocoes ativas',
        subtitle: SalonBrandConfig.fromProfile(
          profile,
          services: data.services,
          posts: data.posts,
          offers: data.offers,
        ).promotionHeadline,
      ),
      const SizedBox(height: PremiumSpacing.md),
      ...data.offers
          .take(2)
          .map(
            (offer) => Padding(
              padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
              child: PremiumBookingCard(
                eyebrow: offer.isMembership ? 'Clube' : 'Oferta ativa',
                icon: offer.isMembership
                    ? Icons.workspace_premium_rounded
                    : Icons.local_fire_department_rounded,
                title: offer.title,
                subtitle: offer.description?.trim().isNotEmpty == true
                    ? offer.description!
                    : 'Condicao ativa no app para conversao imediata.',
                meta: [
                  if (offer.highlightText?.trim().isNotEmpty == true)
                    offer.highlightText!,
                  if (offer.price != null) currency.format(offer.price),
                ],
                highlightLabel: offer.isMembership ? 'Retencao premium' : null,
                tone: PremiumSurfaceTone.accent,
              ),
            ),
          ),
    ];
  }

  List<Widget> _buildProductsSection(SalonBrandConfig brandConfig) {
    if (brandConfig.products.isEmpty ||
        !profileHasModule(PremiumHomeModule.products)) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: 'Retail',
        title: 'Produtos em destaque',
        subtitle: 'Kits, recomendacoes e vitrine de alto valor percebido.',
        actionLabel: onOpenProducts == null ? null : 'Ver vitrine',
        onAction: onOpenProducts,
      ),
      const SizedBox(height: PremiumSpacing.md),
      SizedBox(
        height: 356,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: brandConfig.products.length,
          separatorBuilder: (_, _) => const SizedBox(width: PremiumSpacing.md),
          itemBuilder: (context, index) {
            final product = brandConfig.products[index];
            return SizedBox(
              width: 228,
              child: PremiumProductCard(
                title: product.name,
                subtitle: product.subtitle,
                priceLabel: product.priceLabel,
                badge: product.badge,
                imageUrl: product.imageUrl,
                onTap: onOpenProducts,
              ),
            );
          },
        ),
      ),
    ];
  }

  List<Widget> _buildBenefitsSection({bool prominent = false}) {
    if ((data.loyaltySummary?.hasVisibleContent != true &&
            data.referralSummary == null) ||
        !profileHasModule(PremiumHomeModule.loyalty)) {
      return const <Widget>[];
    }

    return [
      PremiumSectionHeader(
        eyebrow: prominent ? 'Surface principal' : 'Beneficios',
        title: prominent
            ? 'Beneficios com leitura premium'
            : 'Clube, cashback e fidelidade',
        subtitle: prominent
            ? 'O salao pode vender recorrencia e valor percebido sem poluir a home.'
            : 'Beneficios com acabamento de marca e leitura comercial.',
      ),
      const SizedBox(height: PremiumSpacing.md),
      if (data.loyaltySummary?.hasVisibleContent == true)
        LoyaltySummaryCard(summary: data.loyaltySummary!, branding: branding),
      if (data.referralSummary?.program != null) ...[
        if (data.loyaltySummary?.hasVisibleContent == true)
          const SizedBox(height: PremiumSpacing.md),
        ReferralProgramCard(
          summary: data.referralSummary!,
          branding: branding,
          onCopyCode: () =>
              unawaited(onCopyReferral(data.referralSummary!.referralCode)),
        ),
      ],
    ];
  }

  bool profileHasModule(PremiumHomeModule module) {
    return SalonBrandConfig.fromProfile(
      profile,
      services: data.services,
      posts: data.posts,
      offers: data.offers,
    ).visibleModules.contains(module);
  }
}

class _BrandHeroIdentity extends StatelessWidget {
  const _BrandHeroIdentity({
    required this.profile,
    required this.branding,
    required this.slogan,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final String slogan;

  @override
  Widget build(BuildContext context) {
    return Row(
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                profile.salonName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: PremiumSpacing.xs),
              Text(
                slogan,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.76),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroMetricCard extends StatelessWidget {
  const _HeroMetricCard({
    required this.label,
    required this.value,
    this.compact = false,
  });

  final String label;
  final String value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: compact ? 104 : 124,
      padding: const EdgeInsets.all(PremiumSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.76),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: PremiumSpacing.xs),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
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
