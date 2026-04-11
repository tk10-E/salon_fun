import 'package:flutter/material.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_brand_hero.dart';
import '../../core/widgets/salon_ui.dart';
import '../auth/session_controller.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';

class HomeDashboardPage extends StatefulWidget {
  const HomeDashboardPage({
    super.key,
    required this.bootstrap,
    required this.sessionController,
    required this.notificationsController,
    required this.onNavigate,
  });

  final AppBootstrap bootstrap;
  final SessionController sessionController;
  final CustomerNotificationsController notificationsController;
  final ValueChanged<int> onNavigate;

  @override
  State<HomeDashboardPage> createState() => _HomeDashboardPageState();
}

class _HomeDashboardPageState extends State<HomeDashboardPage> {
  bool _loading = true;
  LoyaltySummary? _loyalty;
  ReferralSummary? _referral;
  List<CustomerAppointment> _appointments = const [];
  List<StoreOrder> _orders = const [];
  late int _lastHomeRevision;

  @override
  void initState() {
    super.initState();
    _lastHomeRevision = widget.notificationsController.homeRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _load();
  }

  @override
  void didUpdateWidget(covariant HomeDashboardPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleSyncChange);
      _lastHomeRevision = widget.notificationsController.homeRevision;
      widget.notificationsController.addListener(_handleSyncChange);
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleSyncChange);
    super.dispose();
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.homeRevision;
    if (_lastHomeRevision == revision || _loading) {
      return;
    }

    _lastHomeRevision = revision;
    _load();
  }

  Future<void> _load() async {
    final results = await Future.wait<dynamic>([
      widget.bootstrap.profileRepository.fetchLoyaltySummary(),
      widget.bootstrap.profileRepository.fetchReferralSummary(),
      widget.bootstrap.bookingRepository.fetchAppointments(),
      widget.bootstrap.storeRepository.fetchOrders(),
      widget.sessionController.refreshLandingData(),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _loyalty = results[0] as LoyaltySummary?;
      _referral = results[1] as ReferralSummary?;
      _appointments = results[2] as List<CustomerAppointment>;
      _orders = results[3] as List<StoreOrder>;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.sessionController.session!;
    final landing = session.landingData;
    final preview = landing?.preview;
    final accent = parseHexColor(preview?.brandColor);
    final now = DateTime.now();
    final upcomingAppointments =
        _appointments
            .where((item) => item.date.isAfter(now))
            .where((item) => item.status != 'cancelled')
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final nextAppointment = upcomingAppointments.isEmpty
        ? null
        : upcomingAppointments.first;
    final activeOrdersCount = _orders
        .where((order) => order.status != 'completed')
        .where((order) => order.status != 'cancelled')
        .length;
    final latestOrder = _orders.isEmpty ? null : _orders.first;
    final recentPosts = landing?.recentPosts ?? const <SalonGalleryHighlight>[];
    final featuredServices =
        landing?.featuredServices ?? const <SalonServiceHighlight>[];
    final activeOffers = landing?.activeOffers ?? const <SalonOfferHighlight>[];
    final highlightedService = featuredServices.isEmpty
        ? null
        : featuredServices.first;
    final highlightedPost = recentPosts.isEmpty ? null : recentPosts.first;
    final highlightedOffer = activeOffers.isEmpty ? null : activeOffers.first;
    final campaigns = landing?.centralCampaigns ?? const <SalonCampaign>[];
    final feedPulseCount =
        landing?.stats.recentPostsCount ?? recentPosts.length;
    final offersCount =
        landing?.stats.activeOffersCount ?? landing?.activeOffers.length ?? 0;
    final servicesCount =
        landing?.stats.servicesCount ?? featuredServices.length;
    final visibleHomeModules = preview?.visibleHomeModules ?? const <String>[];
    final homeEmphasis = preview?.homeEmphasis?.trim().toLowerCase();

    bool showModule(String module) {
      return visibleHomeModules.isEmpty || visibleHomeModules.contains(module);
    }

    int sectionPriority(String key) {
      final order = switch (homeEmphasis) {
        'services' => const ['services', 'benefits', 'portfolio'],
        'portfolio' => const ['portfolio', 'benefits', 'services'],
        'benefits' => const ['benefits', 'services', 'portfolio'],
        'schedule' => const ['benefits', 'services', 'portfolio'],
        _ => const ['benefits', 'services', 'portfolio'],
      };

      final index = order.indexOf(key);
      return index >= 0 ? index : order.length;
    }

    final heroMetrics = <Widget>[
      if (showModule('nextBooking'))
        _HomeMetricCard(
          icon: Icons.calendar_month_rounded,
          label: 'Próximo horário',
          value: nextAppointment == null
              ? 'Livre'
              : formatShortDate(nextAppointment.date),
          support: nextAppointment == null
              ? 'Sem reserva futura'
              : formatTime(nextAppointment.date),
          tone: accent,
        ),
      if (showModule('loyalty'))
        _HomeMetricCard(
          icon: Icons.workspace_premium_rounded,
          label: 'Pontos ativos',
          value: '${_loyalty?.pointsBalance ?? 0}',
          support: _loyalty?.currentTierName ?? 'Programa ativo',
          tone: AppTheme.primary,
        ),
      if (showModule('products'))
        _HomeMetricCard(
          icon: Icons.storefront_rounded,
          label: 'Pedidos em aberto',
          value: '$activeOrdersCount',
          support: activeOrdersCount == 0
              ? 'Loja tranquila agora'
              : '${_orders.length} pedidos no histórico',
          tone: AppTheme.secondary,
        ),
      if (showModule('gallery'))
        _HomeMetricCard(
          icon: Icons.slideshow_rounded,
          label: 'Feed vivo',
          value: '$feedPulseCount',
          support: feedPulseCount == 0
              ? 'Sem posts novos ainda'
              : 'Vitrine em movimento',
          tone: AppTheme.accent,
        ),
    ];
    final momentumCards = <Widget>[
      if (showModule('loyalty'))
        _MomentumCard(
          icon: Icons.workspace_premium_rounded,
          title: _loyalty?.currentTierName ?? 'Programa ativo',
          subtitle: '${_loyalty?.completedVisits ?? 0} visitas concluídas',
          support: _loyalty?.nextTierName == null
              ? 'Você já está no nível atual'
              : 'Faltam ${_loyalty?.visitsToNextTier ?? 0} visitas para ${_loyalty?.nextTierName}',
          tone: AppTheme.primary,
        ),
      if (showModule('loyalty'))
        _MomentumCard(
          icon: Icons.payments_rounded,
          title: formatCurrency(_loyalty?.cashbackBalance ?? 0),
          subtitle: 'Cashback disponível',
          support: 'Use seu saldo em serviços e compras.',
          tone: AppTheme.accent,
        ),
      if (showModule('loyalty'))
        _MomentumCard(
          icon: Icons.card_giftcard_rounded,
          title: _referral?.referralCode ?? 'Código em andamento',
          subtitle: '${_referral?.qualifiedCount ?? 0} indicações qualificadas',
          support: _referral?.rewardLabel ?? 'Ganhos por indicação ativos.',
          tone: AppTheme.secondary,
        ),
      if (showModule('promotions'))
        _MomentumCard(
          icon: Icons.local_offer_rounded,
          title: '$offersCount ofertas',
          subtitle: '$servicesCount serviços em vitrine',
          support: offersCount == 0
              ? 'Sem promoção ativa agora.'
              : 'Campanhas e condições comerciais em andamento.',
          tone: accent,
        ),
      if (showModule('products'))
        _MomentumCard(
          icon: Icons.shopping_bag_rounded,
          title: '$activeOrdersCount pedidos',
          subtitle: 'Loja do salão acompanhada aqui',
          support: latestOrder == null
              ? 'Quando um pedido chegar, ele aparece nesta leitura.'
              : 'Último pedido #${latestOrder.orderNumber} em ${formatShortDate(latestOrder.createdAt)}.',
          tone: AppTheme.secondary,
        ),
      if (showModule('gallery'))
        _MomentumCard(
          icon: Icons.photo_library_rounded,
          title: '$feedPulseCount posts',
          subtitle: 'Vitrine social em movimento',
          support: feedPulseCount == 0
              ? 'Sem post recente puxando desejo agora.'
              : 'Abra o feed para ver o que está em alta hoje.',
          tone: AppTheme.accent,
        ),
    ];
    final primarySections =
        <({String key, int position, List<Widget> children})>[
          if (showModule('promotions') && campaigns.isNotEmpty)
            (
              key: 'benefits',
              position: 0,
              children: [
                const SectionTitle(
                  title: 'Em destaque',
                  subtitle: 'Campanhas e ações vivas do salão.',
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 196,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: campaigns.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final campaign = campaigns[index];
                      return SizedBox(
                        width: 288,
                        child: _CampaignCard(
                          campaign: campaign,
                          accent: accent,
                          onTap: () {
                            final target = campaign.ctaTarget
                                ?.trim()
                                .toLowerCase();
                            if (target == 'appointments') {
                              widget.onNavigate(1);
                              return;
                            }
                            if (target == 'feed') {
                              widget.onNavigate(3);
                              return;
                            }
                            widget.onNavigate(2);
                          },
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (showModule('promotions') && highlightedOffer != null)
            (
              key: 'benefits',
              position: 1,
              children: [
                const SectionTitle(
                  title: 'Oferta em destaque',
                  subtitle:
                      'O que o salão deixou ativo no painel aparece aqui com leitura direta.',
                ),
                const SizedBox(height: 14),
                _OfferFeatureCard(
                  offer: highlightedOffer,
                  accent: accent,
                  ctaLabel: preview?.primaryCtaLabel,
                  onTap: () => widget.onNavigate(1),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (momentumCards.isNotEmpty)
            (
              key: 'benefits',
              position: 2,
              children: [
                const SectionTitle(
                  title: 'Seu momento no salão',
                  subtitle:
                      'Uma leitura rápida do que está puxando sua experiência agora.',
                ),
                const SizedBox(height: 14),
                _HomeMetricGrid(children: momentumCards),
              ],
            ),
          if (showModule('shortcuts') && highlightedService != null)
            (
              key: 'services',
              position: 3,
              children: [
                const SizedBox(height: 20),
                const SectionTitle(
                  title: 'Serviço em alta',
                  subtitle:
                      'O serviço mais reservado pelos clientes aparece primeiro aqui.',
                ),
                const SizedBox(height: 14),
                _ServiceFeatureCard(
                  service: highlightedService,
                  accent: accent,
                  ctaLabel: preview?.primaryCtaLabel,
                  onTap: () => widget.onNavigate(1),
                ),
              ],
            ),
          if (showModule('gallery') && highlightedPost != null)
            (
              key: 'portfolio',
              position: 4,
              children: [
                const SizedBox(height: 20),
                SectionTitle(
                  title: 'Feed em alta',
                  subtitle:
                      'Um recorte forte para entrar no clima do salão sem lotar a home.',
                  trailing: TextButton(
                    onPressed: () => widget.onNavigate(3),
                    child: const Text('Abrir feed'),
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 320,
                  child: _FeedPreviewCard(
                    post: highlightedPost,
                    accent: accent,
                    fallbackAvatarUrl:
                        preview?.instagramProfileImageUrl ?? preview?.logoUrl,
                    onTap: () => widget.onNavigate(3),
                  ),
                ),
              ],
            ),
        ]..sort((left, right) {
          final priorityComparison = sectionPriority(
            left.key,
          ).compareTo(sectionPriority(right.key));
          if (priorityComparison != 0) {
            return priorityComparison;
          }

          return left.position.compareTo(right.position);
        });

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl: preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                SalonBrandHero(
                  preview: preview,
                  accent: accent,
                  greeting: 'Olá, ${firstName(session.customer.name)}',
                  joinCode: session.joinCode,
                  title:
                      preview?.heroHeadline ??
                      preview?.welcomeHeadline ??
                      preview?.appDisplayName ??
                      preview?.name,
                  description:
                      preview?.welcomeMessage ??
                      preview?.promotionHeadline ??
                      preview?.tagline ??
                      'Agenda, loja e novidades do salão organizadas para você em um lugar só.',
                  bottom: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (heroMetrics.isNotEmpty)
                        _HomeMetricGrid(children: heroMetrics),
                      if (showModule('nextBooking') &&
                          nextAppointment != null) ...[
                        const SizedBox(height: 20),
                        _HighlightedAppointmentCard(
                          appointment: nextAppointment,
                          accent: accent,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 30),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  ...primarySections.expand((section) => section.children),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OfferFeatureCard extends StatelessWidget {
  const _OfferFeatureCard({
    required this.offer,
    required this.accent,
    required this.ctaLabel,
    required this.onTap,
  });

  final SalonOfferHighlight offer;
  final Color accent;
  final String? ctaLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      padding: const EdgeInsets.all(18),
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: offer.kindLabel,
                backgroundColor: accent.withValues(alpha: 0.12),
                foregroundColor: accent,
              ),
              Pill(label: offer.lifecycleLabel),
            ],
          ),
          const SizedBox(height: 14),
          Text(offer.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            sentenceOrFallback(
              offer.description,
              'Oferta ativa no painel do salão pronta para entrar na conversa com a cliente.',
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (offer.highlightText?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Pill(
              label: offer.highlightText!,
              backgroundColor: AppTheme.accent.withValues(alpha: 0.16),
              foregroundColor: AppTheme.ink,
            ),
          ],
          if (offer.priceLabel?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(
              offer.priceLabel!,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onTap,
              icon: const Icon(Icons.auto_awesome_rounded),
              label: Text(sentenceOrFallback(ctaLabel, 'Agendar')),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeMetricGrid extends StatelessWidget {
  const _HomeMetricGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final twoColumns = constraints.maxWidth >= 320;
        final itemWidth = twoColumns
            ? (constraints.maxWidth - 12) / 2
            : constraints.maxWidth;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

class _HomeMetricCard extends StatelessWidget {
  const _HomeMetricCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.support,
    required this.tone,
  });

  final IconData icon;
  final String label;
  final String value;
  final String support;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return SurfaceMetricCard(
      icon: icon,
      label: label,
      value: value,
      support: support,
      tone: tone,
    );
  }
}

class _MomentumCard extends StatelessWidget {
  const _MomentumCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.support,
    required this.tone,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String support;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      padding: const EdgeInsets.all(18),
      accent: tone,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 156),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ToneIconBadge(icon: icon, tone: tone),
            const SizedBox(height: 14),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 10),
            Text(
              support,
              style: Theme.of(context).textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceFeatureCard extends StatelessWidget {
  const _ServiceFeatureCard({
    required this.service,
    required this.accent,
    required this.ctaLabel,
    required this.onTap,
  });

  final SalonServiceHighlight service;
  final Color accent;
  final String? ctaLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      padding: const EdgeInsets.all(16),
      accent: accent,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 330;
          final image = SizedBox(
            width: compact ? double.infinity : 116,
            child: NetworkCardImage(
              imageUrl: service.imageUrl,
              height: compact ? 152 : 116,
              borderRadius: 22,
            ),
          );
          final content = compact
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _buildContent(context),
                )
              : Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: _buildContent(context),
                  ),
                );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [image, const SizedBox(height: 14), content],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [image, const SizedBox(width: 16), content],
          );
        },
      ),
    );
  }

  List<Widget> _buildContent(BuildContext context) {
    return [
      Pill(
        label: 'Mais reservado',
        icon: Icons.local_fire_department_rounded,
        backgroundColor: accent.withValues(alpha: 0.12),
        foregroundColor: accent,
      ),
      const SizedBox(height: 12),
      Text(
        service.name,
        style: Theme.of(context).textTheme.titleLarge,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      if (service.category?.trim().isNotEmpty == true) ...[
        const SizedBox(height: 4),
        Text(
          service.category!,
          style: Theme.of(context).textTheme.labelMedium,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
      const SizedBox(height: 8),
      Text(
        service.description ?? 'Pronto para reservar agora.',
        style: Theme.of(context).textTheme.bodySmall,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      const SizedBox(height: 12),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          Pill(label: '${service.duration} min', icon: Icons.schedule_rounded),
          Pill(
            label: formatCurrency(service.price),
            backgroundColor: accent.withValues(alpha: 0.12),
            foregroundColor: accent,
          ),
        ],
      ),
      const SizedBox(height: 14),
      SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          onPressed: onTap,
          icon: const Icon(Icons.calendar_month_rounded),
          label: Text(sentenceOrFallback(ctaLabel, 'Agendar')),
        ),
      ),
    ];
  }
}

class _FeedPreviewCard extends StatelessWidget {
  const _FeedPreviewCard({
    required this.post,
    required this.accent,
    required this.fallbackAvatarUrl,
    required this.onTap,
  });

  final SalonGalleryHighlight post;
  final Color accent;
  final String? fallbackAvatarUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(28),
      child: SalonPanel(
        padding: const EdgeInsets.all(14),
        accent: accent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                NetworkCardImage(
                  imageUrl: post.imageUrl,
                  height: 198,
                  borderRadius: 22,
                ),
                if (post.badge?.trim().isNotEmpty == true)
                  Positioned(
                    left: 10,
                    top: 10,
                    child: Pill(
                      label: post.badge!,
                      backgroundColor: Colors.white.withValues(alpha: 0.9),
                      foregroundColor: AppTheme.ink,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            if ((post.authorAvatarUrl?.trim().isNotEmpty == true) ||
                (fallbackAvatarUrl?.trim().isNotEmpty == true) ||
                (post.sourceLabel?.trim().isNotEmpty == true)) ...[
              Row(
                children: [
                  _PreviewAuthorAvatar(
                    imageUrl:
                        (post.authorAvatarUrl?.trim().isNotEmpty == true
                                ? post.authorAvatarUrl
                                : fallbackAvatarUrl)
                            ?.trim(),
                    accent: accent,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      post.sourceLabel ?? 'Feed do salão',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            Text(
              post.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              post.caption ?? post.serviceName ?? 'Abra o feed para ver mais.',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _PreviewAuthorAvatar extends StatelessWidget {
  const _PreviewAuthorAvatar({required this.imageUrl, required this.accent});

  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        alignment: Alignment.center,
        child: Icon(Icons.cut_rounded, color: accent, size: 16),
      );
    }

    return ClipOval(
      child: Image.network(
        imageUrl!,
        width: 30,
        height: 30,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.cut_rounded, color: accent, size: 16),
          );
        },
      ),
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({
    required this.campaign,
    required this.accent,
    required this.onTap,
  });

  final SalonCampaign campaign;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tone = campaign.priority == 'high' ? AppTheme.accent : accent;
    return SalonPanel(
      accent: tone,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 196),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Pill(
                  label: campaign.campaignLabel ?? 'Destaque',
                  backgroundColor: tone.withValues(alpha: 0.16),
                  foregroundColor: tone == AppTheme.accent
                      ? AppTheme.ink
                      : tone,
                ),
                if (campaign.eyebrow?.trim().isNotEmpty == true)
                  Pill(label: campaign.eyebrow!),
              ],
            ),
            const SizedBox(height: 14),
            Text(campaign.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Expanded(
              child: Text(
                campaign.message,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onTap,
                icon: const Icon(Icons.arrow_forward_rounded),
                label: Text(campaign.ctaLabel ?? 'Abrir'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HighlightedAppointmentCard extends StatelessWidget {
  const _HighlightedAppointmentCard({
    required this.appointment,
    required this.accent,
  });

  final CustomerAppointment appointment;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        children: [
          Container(
            width: 68,
            height: 68,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [accent.withValues(alpha: 0.22), Colors.white],
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.calendar_month_rounded, color: accent, size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Seu próximo momento',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 6),
                Text(
                  appointment.serviceName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  '${formatFullDate(appointment.date)} • ${formatTime(appointment.date)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (appointment.staffName?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Com ${appointment.staffName}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
