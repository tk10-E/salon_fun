import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/formatters.dart';
import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../screens/booking_screen.dart';
import '../screens/notifications_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/premium_ui.dart';

class ClientShellScreen extends StatefulWidget {
  const ClientShellScreen({
    super.key,
    required this.repository,
    required this.profile,
    required this.onProfileChanged,
    required this.onSignOutRequested,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final ValueChanged<CustomerProfile> onProfileChanged;
  final Future<void> Function() onSignOutRequested;

  @override
  State<ClientShellScreen> createState() => _ClientShellScreenState();
}

class _ClientShellScreenState extends State<ClientShellScreen> {
  int _currentIndex = 0;
  int _refreshSeed = 0;

  Future<void> _openBooking(ServiceItem service) async {
    final booked = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookingScreen(
          repository: widget.repository,
          profile: widget.profile,
          service: service,
        ),
      ),
    );

    if (booked == true && mounted) {
      setState(() => _refreshSeed += 1);
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(repository: widget.repository),
      ),
    );

    if (mounted) {
      setState(() => _refreshSeed += 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      _HomeTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
        onOpenNotifications: _openNotifications,
        onNavigateToTab: (index) => setState(() => _currentIndex = index),
      ),
      _ExploreTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
      ),
      _AppointmentsTab(
        repository: widget.repository,
        refreshSeed: _refreshSeed,
        onRefreshRequested: () => setState(() => _refreshSeed += 1),
      ),
      _FeedTab(
        repository: widget.repository,
        customerId: widget.profile.id,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
      ),
      _ProfileTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenNotifications: _openNotifications,
        onProfileChanged: (profile) {
          widget.onProfileChanged(profile);
          setState(() => _refreshSeed += 1);
        },
        onSignOut: () async {
          await widget.onSignOutRequested();
        },
      ),
    ];

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: NavigationBar(
            selectedIndex: _currentIndex,
            height: 74,
            onDestinationSelected: (value) {
              setState(() => _currentIndex = value);
            },
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.calendar_month_outlined),
                selectedIcon: Icon(Icons.calendar_month_rounded),
                label: 'Reservar',
              ),
              NavigationDestination(
                icon: Icon(Icons.event_note_outlined),
                selectedIcon: Icon(Icons.event_note_rounded),
                label: 'Agenda',
              ),
              NavigationDestination(
                icon: Icon(Icons.auto_awesome_mosaic_outlined),
                selectedIcon: Icon(Icons.auto_awesome_mosaic_rounded),
                label: 'Feed',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Perfil',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab({
    required this.repository,
    required this.profile,
    required this.refreshSeed,
    required this.onOpenBooking,
    required this.onOpenNotifications,
    required this.onNavigateToTab,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final Future<void> Function(ServiceItem service) onOpenBooking;
  final Future<void> Function() onOpenNotifications;
  final ValueChanged<int> onNavigateToTab;

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  late Future<CachedView<HomeSnapshot>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _HomeTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed ||
        oldWidget.profile.id != widget.profile.id) {
      _future = _load();
    }
  }

  Future<CachedView<HomeSnapshot>> _load() {
    return widget.repository.loadHomeSnapshot(customerId: widget.profile.id);
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final firstName = widget.profile.name.split(' ').first;
    final config = widget.profile.salonClientAppConfig;

    return PremiumBackground(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: FutureBuilder<CachedView<HomeSnapshot>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView();
          }
          if (snapshot.hasError) {
            return ErrorStateCard(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }

          final view = snapshot.data!;
          final data = view.data;
          final nextAppointment = data.nextAppointment;
          final heroImage =
              config.resolvedHeroImage ??
              config.resolvedGalleryCoverImage ??
              (data.posts.isNotEmpty ? data.posts.first.coverImageUrl : null);

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                StaggerReveal(
                  key: ValueKey('home-header-${widget.refreshSeed}'),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${greetingForNow(DateTime.now())}, $firstName',
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              widget.profile.salonName,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      IconButton.filledTonal(
                        onPressed: widget.onOpenNotifications,
                        icon: Badge(
                          isLabelVisible: data.unreadNotificationsCount > 0,
                          label: Text('${data.unreadNotificationsCount}'),
                          child: const Icon(Icons.notifications_none_rounded),
                        ),
                      ),
                    ],
                  ),
                ),
                if (view.isFromCache) ...[
                  const SizedBox(height: 14),
                  StaggerReveal(
                    key: ValueKey('home-status-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 70),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: StatusPill(label: _cacheStatusLabel(view)),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                StaggerReveal(
                  key: ValueKey('home-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 110),
                  child: HeroImagePanel(
                    imageUrl: heroImage,
                    height: 340,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            widget.profile.salonTagline ??
                                'Experiência do salão',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          config.welcomeHeadline ??
                              config.heroHeadline ??
                              'Sua próxima visita pode sair daqui em poucos toques.',
                          style: Theme.of(context).textTheme.displaySmall
                              ?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          config.welcomeMessage ??
                              config.heroSupportLine ??
                              'Agenda, conteúdo, benefícios e relacionamento do salão numa jornada só.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.85),
                              ),
                        ),
                        const SizedBox(height: 18),
                        Row(
                          children: [
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: context.salonTheme.brandDark,
                              ),
                              onPressed: data.services.isEmpty
                                  ? null
                                  : () => widget.onOpenBooking(
                                      data.services.first,
                                    ),
                              child: Text(
                                config.primaryCtaLabel ?? 'Agendar agora',
                              ),
                            ),
                            const SizedBox(width: 12),
                            OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white,
                                side: BorderSide(
                                  color: Colors.white.withValues(alpha: 0.38),
                                ),
                              ),
                              onPressed: () => widget.onNavigateToTab(3),
                              child: const Text('Ver feed'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                StaggerReveal(
                  key: ValueKey('home-metrics-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 170),
                  child: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      if (nextAppointment != null)
                        MetricPill(
                          label: 'Próximo horário',
                          value: formatDateTime(nextAppointment.date),
                        ),
                      if (data.loyaltySummary != null)
                        MetricPill(
                          label: 'Pontos',
                          value: '${data.loyaltySummary!.pointsBalance}',
                          toneColor: context.salonTheme.accent,
                        ),
                      if (data.referralSummary != null)
                        MetricPill(
                          label: 'Indicações',
                          value: '${data.referralSummary!.qualifiedCount}',
                          toneColor: context.salonTheme.warning,
                        ),
                      MetricPill(
                        label: 'Notificações',
                        value: '${data.notifications.length}',
                        toneColor: context.salonTheme.success,
                      ),
                    ],
                  ),
                ),
                if (nextAppointment != null) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-next-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 230),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Seu próximo passo',
                            subtitle:
                                'A agenda do salão já trouxe o compromisso que está mais perto.',
                          ),
                          const SizedBox(height: 16),
                          _AppointmentHighlightCard(
                            appointment: nextAppointment,
                          ),
                          if (nextAppointment.requiresPresenceConfirmation) ...[
                            const SizedBox(height: 12),
                            Text(
                              'Este horário já pode ser confirmado no app.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ] else if (data.vacancyAlerts.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-vacancy-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 230),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Vaga quente no radar',
                            subtitle:
                                'O salão liberou um encaixe compatível com a sua jornada.',
                          ),
                          const SizedBox(height: 16),
                          _VacancyHighlightCard(
                            alert: data.vacancyAlerts.first,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('home-services-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 290),
                  child: _SectionWithHorizontalList<ServiceItem>(
                    title: 'Serviços em destaque',
                    subtitle:
                        'Escolha seu próximo cuidado com preço, duração e leitura premium.',
                    items: data.services.take(5).toList(growable: false),
                    itemBuilder: (service) => _ServicePreviewCard(
                      service: service,
                      onPressed: () => widget.onOpenBooking(service),
                    ),
                  ),
                ),
                if (data.offers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-offers-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 350),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SectionHeader(
                            title: 'Campanhas e clubes',
                            subtitle:
                                config.promotionHeadline ??
                                'Tudo o que o painel publicar aparece aqui em uma vitrine mais desejável.',
                          ),
                          const SizedBox(height: 16),
                          for (final offer in data.offers.take(3)) ...[
                            _OfferTile(offer: offer),
                            if (offer != data.offers.take(3).last)
                              const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
                if (data.posts.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-posts-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 410),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Resultados reais',
                            subtitle:
                                'Prova visual, desejo e contexto comercial conectados à reserva.',
                          ),
                          const SizedBox(height: 16),
                          for (final post in data.posts.take(2)) ...[
                            _FeedPreviewTile(post: post),
                            if (post != data.posts.take(2).last)
                              const SizedBox(height: 12),
                          ],
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: () => widget.onNavigateToTab(3),
                            child: const Text('Abrir feed completo'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ExploreTab extends StatefulWidget {
  const _ExploreTab({
    required this.repository,
    required this.profile,
    required this.refreshSeed,
    required this.onOpenBooking,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final Future<void> Function(ServiceItem service) onOpenBooking;

  @override
  State<_ExploreTab> createState() => _ExploreTabState();
}

class _ExploreTabState extends State<_ExploreTab> {
  late Future<CachedView<ExploreSnapshot>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _ExploreTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed ||
        oldWidget.profile.id != widget.profile.id) {
      _future = _load();
    }
  }

  Future<CachedView<ExploreSnapshot>> _load() {
    return widget.repository.loadExploreSnapshot();
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return PremiumBackground(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: FutureBuilder<CachedView<ExploreSnapshot>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView(label: 'Montando vitrine do salão...');
          }
          if (snapshot.hasError) {
            return ErrorStateCard(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }

          final view = snapshot.data!;
          final data = view.data;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                if (view.isFromCache) ...[
                  StaggerReveal(
                    key: ValueKey('explore-status-${widget.refreshSeed}'),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: StatusPill(label: _cacheStatusLabel(view)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                StaggerReveal(
                  key: ValueKey('explore-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 80),
                  child: HeroImagePanel(
                    imageUrl: widget
                        .profile
                        .salonClientAppConfig
                        .resolvedGalleryCoverImage,
                    height: 240,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Reservar com contexto',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                        ),
                        const Spacer(),
                        Text(
                          'Catálogo, profissionais, campanhas e produtos na mesma jornada.',
                          style: Theme.of(context).textTheme.displaySmall
                              ?.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('explore-services-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 150),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Serviços do salão',
                          subtitle:
                              'Escolha o que faz sentido agora e parta direto para os horários.',
                        ),
                        const SizedBox(height: 16),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: data.services.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                                childAspectRatio: 0.73,
                              ),
                          itemBuilder: (context, index) {
                            final service = data.services[index];
                            return _ServiceGridCard(
                              service: service,
                              onPressed: () => widget.onOpenBooking(service),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                if (data.teamMembers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-team-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 220),
                    child: _SectionWithHorizontalList<TeamMember>(
                      title: 'Quem cuida de você',
                      subtitle:
                          'Profissionais, especialidades e leitura rápida de disponibilidade.',
                      items: data.teamMembers.take(8).toList(growable: false),
                      itemBuilder: (member) => _TeamMemberCard(member: member),
                    ),
                  ),
                ],
                if (data.offers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-offers-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 290),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Campanhas em evidência',
                            subtitle:
                                'Combos, promoções e memberships publicados pelo salão.',
                          ),
                          const SizedBox(height: 16),
                          for (final offer in data.offers.take(3)) ...[
                            _OfferTile(offer: offer),
                            if (offer != data.offers.take(3).last)
                              const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
                if (data.products.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-products-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 360),
                    child: _SectionWithHorizontalList<RetailProduct>(
                      title: 'Produtos selecionados',
                      subtitle:
                          'Catálogo de venda consultiva vindo da operação do salão.',
                      items: data.products.take(8).toList(growable: false),
                      itemBuilder: (product) => _ProductCard(product: product),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _AppointmentsTab extends StatefulWidget {
  const _AppointmentsTab({
    required this.repository,
    required this.refreshSeed,
    required this.onRefreshRequested,
  });

  final SalonRepository repository;
  final int refreshSeed;
  final VoidCallback onRefreshRequested;

  @override
  State<_AppointmentsTab> createState() => _AppointmentsTabState();
}

class _AppointmentsTabState extends State<_AppointmentsTab> {
  late Future<CachedView<AppointmentsSnapshot>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _AppointmentsTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed) {
      _future = _load();
    }
  }

  Future<CachedView<AppointmentsSnapshot>> _load() {
    return widget.repository.loadAppointmentsSnapshot();
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _cancelAppointment(AppointmentItem item) async {
    final controller = TextEditingController();
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: PremiumCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Cancelar horário',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 10),
                Text(
                  'Explique em uma frase curta o motivo. Isso ajuda o salão a organizar a agenda.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: controller,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Motivo do cancelamento',
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(controller.text),
                  child: const Text('Confirmar cancelamento'),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (reason == null || reason.trim().isEmpty) {
      return;
    }

    try {
      await widget.repository.cancelAppointment(
        appointmentId: item.id,
        reason: reason,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Horário cancelado.')));
      widget.onRefreshRequested();
      await _reload();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _confirmPresence(AppointmentItem item) async {
    try {
      await widget.repository.confirmUpcomingAppointmentPresence(
        appointmentId: item.id,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Presença confirmada.')));
      widget.onRefreshRequested();
      await _reload();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _claimVacancy(VacancyAlert alert) async {
    try {
      await widget.repository.claimVacancyAlert(alertId: alert.id);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vaga liberada reservada com sucesso.')),
      );
      widget.onRefreshRequested();
      await _reload();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return PremiumBackground(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: FutureBuilder<CachedView<AppointmentsSnapshot>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView(label: 'Consultando sua agenda...');
          }
          if (snapshot.hasError) {
            return ErrorStateCard(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }

          final view = snapshot.data!;
          final data = view.data;
          final upcoming =
              data.appointments
                  .where((item) => item.isUpcoming)
                  .toList(growable: false)
                ..sort((left, right) => left.date.compareTo(right.date));
          final history = data.appointments
              .where((item) => !item.isUpcoming)
              .toList(growable: false);

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                if (view.isFromCache) ...[
                  StaggerReveal(
                    key: ValueKey('appointments-status-${widget.refreshSeed}'),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: StatusPill(label: _cacheStatusLabel(view)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (data.vacancyAlerts.isNotEmpty) ...[
                  StaggerReveal(
                    key: ValueKey('appointments-vacancy-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 70),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Vagas liberadas agora',
                            subtitle:
                                'Quando o salão abrir um encaixe, ele aparece aqui em alta prioridade.',
                          ),
                          const SizedBox(height: 16),
                          for (final alert in data.vacancyAlerts.take(2)) ...[
                            _VacancyHighlightCard(
                              alert: alert,
                              actionLabel: 'Pegar vaga',
                              onPressed: () => _claimVacancy(alert),
                            ),
                            if (alert != data.vacancyAlerts.take(2).last)
                              const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                ],
                StaggerReveal(
                  key: ValueKey('appointments-upcoming-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 140),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Próximos horários',
                          subtitle:
                              'Seu calendário vivo com confirmação e cancelamento quando necessário.',
                        ),
                        const SizedBox(height: 16),
                        if (upcoming.isEmpty)
                          const EmptyStateCard(
                            title: 'Nenhum horário futuro',
                            message:
                                'Assim que você reservar pelo app, seus compromissos aparecem aqui.',
                          )
                        else
                          for (final appointment in upcoming) ...[
                            _AppointmentCard(
                              appointment: appointment,
                              onCancel: appointment.canBeCancelled
                                  ? () => _cancelAppointment(appointment)
                                  : null,
                              onConfirmPresence:
                                  appointment.requiresPresenceConfirmation
                                  ? () => _confirmPresence(appointment)
                                  : null,
                            ),
                            if (appointment != upcoming.last)
                              const SizedBox(height: 12),
                          ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('appointments-history-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 210),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Histórico',
                          subtitle:
                              'Visitas concluídas, canceladas e tudo o que já passou pelo salão.',
                        ),
                        const SizedBox(height: 16),
                        if (history.isEmpty)
                          const EmptyStateCard(
                            title: 'Sem histórico ainda',
                            message:
                                'Depois da primeira visita concluída, esta área vira seu arquivo de cuidado.',
                          )
                        else
                          for (final appointment in history.take(10)) ...[
                            _AppointmentCard(appointment: appointment),
                            if (appointment != history.take(10).last)
                              const SizedBox(height: 12),
                          ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FeedTab extends StatefulWidget {
  const _FeedTab({
    required this.repository,
    required this.customerId,
    required this.refreshSeed,
    required this.onOpenBooking,
  });

  final SalonRepository repository;
  final String customerId;
  final int refreshSeed;
  final Future<void> Function(ServiceItem service) onOpenBooking;

  @override
  State<_FeedTab> createState() => _FeedTabState();
}

class _FeedTabState extends State<_FeedTab> {
  bool _isLoading = true;
  Object? _error;
  List<FeedPost> _posts = const [];
  CachedView<FeedSnapshot>? _snapshot;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant _FeedTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed ||
        oldWidget.customerId != widget.customerId) {
      unawaited(_load());
    }
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final snapshot = await widget.repository.loadFeedSnapshot(
        customerId: widget.customerId,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _snapshot = snapshot;
        _posts = snapshot.data.posts;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error;
        _isLoading = false;
      });
    }
  }

  Future<void> _toggleLike(FeedPost post) async {
    final nextPost = post.copyWith(
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    );

    setState(() {
      _posts = _posts
          .map((item) => item.id == post.id ? nextPost : item)
          .toList(growable: false);
    });

    try {
      if (post.likedByMe) {
        await widget.repository.unlikePost(
          postId: post.id,
          customerId: widget.customerId,
        );
      } else {
        await widget.repository.likePost(postId: post.id);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _posts = _posts
            .map((item) => item.id == post.id ? post : item)
            .toList(growable: false);
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _openComments(FeedPost post) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _CommentsSheet(
        post: post,
        onSend: (body) async {
          await widget.repository.addPostComment(postId: post.id, body: body);
          await _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = _isLoading
        ? const LoadingView(label: 'Carregando feed premium...')
        : _error != null
        ? ErrorStateCard(message: _error.toString(), onRetry: _load)
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                StaggerReveal(
                  key: ValueKey('feed-header-${widget.refreshSeed}'),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Feed de desejo',
                          subtitle:
                              'Resultados, provas sociais e referências que já conversam com a reserva.',
                        ),
                        if (_snapshot?.isFromCache == true) ...[
                          const SizedBox(height: 14),
                          StatusPill(
                            label: _cacheStatusLabel(_snapshot!),
                            icon: Icons.cloud_off_rounded,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_posts.isEmpty)
                  const EmptyStateCard(
                    title: 'O feed ainda está vazio',
                    message:
                        'Quando o salão publicar fotos, vídeos curtos ou antes e depois, tudo aparece aqui.',
                  )
                else
                  for (var index = 0; index < _posts.length; index++) ...[
                    Builder(
                      builder: (context) {
                        final post = _posts[index];
                        return StaggerReveal(
                          key: ValueKey(
                            'feed-post-${widget.refreshSeed}-${post.id}',
                          ),
                          delay: Duration(milliseconds: 70 + (index * 45)),
                          child: _FeedPostCard(
                            post: post,
                            onLike: () => _toggleLike(post),
                            onComment: () => _openComments(post),
                            onBook: post.linkedService == null
                                ? null
                                : () =>
                                      widget.onOpenBooking(post.linkedService!),
                          ),
                        );
                      },
                    ),
                    if (index != _posts.length - 1) const SizedBox(height: 16),
                  ],
              ],
            ),
          );

    return PremiumBackground(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: body,
    );
  }
}

class _ProfileTab extends StatefulWidget {
  const _ProfileTab({
    required this.repository,
    required this.profile,
    required this.refreshSeed,
    required this.onOpenNotifications,
    required this.onProfileChanged,
    required this.onSignOut,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final Future<void> Function() onOpenNotifications;
  final ValueChanged<CustomerProfile> onProfileChanged;
  final Future<void> Function() onSignOut;

  @override
  State<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<_ProfileTab> {
  late Future<CachedView<ProfileSnapshot>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant _ProfileTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed ||
        oldWidget.profile.id != widget.profile.id ||
        oldWidget.profile.name != widget.profile.name) {
      _future = _load();
    }
  }

  Future<CachedView<ProfileSnapshot>> _load() {
    return widget.repository.loadProfileSnapshot();
  }

  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _editProfile() async {
    final nameController = TextEditingController(text: widget.profile.name);
    final phoneController = TextEditingController(
      text: widget.profile.phone ?? '',
    );
    final preferencesController = TextEditingController(
      text: widget.profile.preferences ?? '',
    );
    final allergiesController = TextEditingController(
      text: widget.profile.allergies ?? '',
    );
    final beautyProductsController = TextEditingController(
      text: widget.profile.beautyProducts ?? '',
    );

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: PremiumCard(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Editar perfil',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Nome'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneController,
                    decoration: const InputDecoration(labelText: 'Telefone'),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: preferencesController,
                    decoration: const InputDecoration(
                      labelText: 'Preferências',
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: allergiesController,
                    decoration: const InputDecoration(labelText: 'Alergias'),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: beautyProductsController,
                    decoration: const InputDecoration(
                      labelText: 'Produtos/rotina de beleza',
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: () async {
                      await widget.repository.updateCustomerProfile(
                        customerId: widget.profile.id,
                        customerName: nameController.text,
                        phone: phoneController.text,
                        preferences: preferencesController.text,
                        allergies: allergiesController.text,
                        beautyProducts: beautyProductsController.text,
                      );
                      if (!context.mounted) {
                        return;
                      }
                      Navigator.of(context).pop(true);
                    },
                    child: const Text('Salvar perfil'),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (saved != true) {
      return;
    }

    final refreshed = await widget.repository.getCustomerProfile();
    if (refreshed != null) {
      widget.onProfileChanged(refreshed);
    }
    await _reload();
  }

  Future<void> _openExternal(String? url) async {
    if (url == null || url.isEmpty) {
      return;
    }

    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.profile.salonClientAppConfig;
    final whatsappUrl = buildWhatsAppUrl(widget.profile.salonWhatsappPhone);

    return PremiumBackground(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: FutureBuilder<CachedView<ProfileSnapshot>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const LoadingView(label: 'Montando seu perfil...');
          }
          if (snapshot.hasError) {
            return ErrorStateCard(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }

          final view = snapshot.data!;
          final data = view.data;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                if (view.isFromCache) ...[
                  StaggerReveal(
                    key: ValueKey('profile-status-${widget.refreshSeed}'),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: StatusPill(label: _cacheStatusLabel(view)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                StaggerReveal(
                  key: ValueKey('profile-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 80),
                  child: HeroImagePanel(
                    imageUrl:
                        config.resolvedProfileCoverImage ??
                        config.resolvedHeroImage,
                    height: 300,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            widget.profile.salonName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Text(
                          widget.profile.name,
                          style: Theme.of(context).textTheme.displaySmall
                              ?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          widget.profile.salonTagline ??
                              'Sua conta, sua rotina e tudo o que o salão prepara para você.',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.85),
                              ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('profile-info-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 150),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionHeader(
                          title: 'Seu perfil de beleza',
                          subtitle:
                              'Esses dados ajudam o salão a atender com mais contexto.',
                          trailing: IconButton.filledTonal(
                            onPressed: _editProfile,
                            icon: const Icon(Icons.edit_outlined),
                          ),
                        ),
                        const SizedBox(height: 16),
                        _InfoRow(label: 'Nome', value: widget.profile.name),
                        _InfoRow(
                          label: 'Telefone',
                          value: widget.profile.phone ?? 'Ainda não informado',
                        ),
                        _InfoRow(
                          label: 'Preferências',
                          value:
                              widget.profile.preferences ??
                              'Conte ao salão como você gosta de ser atendida.',
                        ),
                        _InfoRow(
                          label: 'Alergias',
                          value:
                              widget.profile.allergies ??
                              'Nenhuma observação cadastrada.',
                        ),
                        _InfoRow(
                          label: 'Produtos / rotina',
                          value:
                              widget.profile.beautyProducts ??
                              'Seu histórico de produtos ainda pode ser preenchido.',
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('profile-links-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 220),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Relação com o salão',
                          subtitle:
                              'Atalhos para contato, localização, Instagram e alertas da marca.',
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (whatsappUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openExternal(whatsappUrl),
                                icon: const Icon(Icons.chat_bubble_outline),
                                label: const Text('WhatsApp'),
                              ),
                            if (config.instagramUrl != null)
                              OutlinedButton.icon(
                                onPressed: () =>
                                    _openExternal(config.instagramUrl),
                                icon: const Icon(Icons.camera_alt_outlined),
                                label: const Text('Instagram'),
                              ),
                            if (config.mapUrl != null)
                              OutlinedButton.icon(
                                onPressed: () => _openExternal(config.mapUrl),
                                icon: const Icon(Icons.map_outlined),
                                label: const Text('Como chegar'),
                              ),
                            OutlinedButton.icon(
                              onPressed: widget.onOpenNotifications,
                              icon: Badge(
                                isLabelVisible:
                                    data.unreadNotificationsCount > 0,
                                label: Text('${data.unreadNotificationsCount}'),
                                child: const Icon(
                                  Icons.notifications_none_rounded,
                                ),
                              ),
                              label: const Text('Notificações'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                if (data.loyaltySummary != null ||
                    data.referralSummary != null) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('profile-benefits-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 290),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Benefícios e recorrência',
                            subtitle:
                                'Tudo o que o painel configurou para fidelidade, ranking e indicação do cliente.',
                          ),
                          const SizedBox(height: 16),
                          if (data.loyaltySummary != null)
                            _LoyaltyCard(summary: data.loyaltySummary!),
                          if (data.loyaltySummary != null &&
                              data.referralSummary != null)
                            const SizedBox(height: 12),
                          if (data.referralSummary != null)
                            _ReferralCard(summary: data.referralSummary!),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('profile-signout-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 360),
                  child: FilledButton.tonal(
                    onPressed: widget.onSignOut,
                    child: const Text('Sair da conta'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionWithHorizontalList<T> extends StatelessWidget {
  const _SectionWithHorizontalList({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.itemBuilder,
  });

  final String title;
  final String subtitle;
  final List<T> items;
  final Widget Function(T item) itemBuilder;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, subtitle: subtitle),
          const SizedBox(height: 16),
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) =>
                  SizedBox(width: 220, child: itemBuilder(items[index])),
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemCount: items.length,
            ),
          ),
        ],
      ),
    );
  }
}

class _ServicePreviewCard extends StatelessWidget {
  const _ServicePreviewCard({required this.service, required this.onPressed});

  final ServiceItem service;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(28),
              ),
              child: service.imageUrl == null
                  ? DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: context.salonTheme.heroGradient,
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.auto_awesome_rounded,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                    )
                  : Image.network(
                      service.imageUrl!,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.category ?? 'Serviço',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 4),
                Text(
                  service.name,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  '${formatCurrency(service.price)} • ${service.duration} min',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: onPressed,
                  child: const Text('Reservar'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceGridCard extends StatelessWidget {
  const _ServiceGridCard({required this.service, required this.onPressed});

  final ServiceItem service;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(28),
              ),
              child: service.imageUrl == null
                  ? DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: context.salonTheme.heroGradient,
                      ),
                      child: Center(
                        child: Text(
                          service.name.substring(0, 1).toUpperCase(),
                          style: Theme.of(context).textTheme.displayMedium
                              ?.copyWith(color: Colors.white),
                        ),
                      ),
                    )
                  : Image.network(
                      service.imageUrl!,
                      fit: BoxFit.cover,
                      width: double.infinity,
                    ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  '${formatCurrency(service.price)} • ${service.duration} min',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: onPressed,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(double.infinity, 42),
                  ),
                  child: const Text('Horários'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TeamMemberCard extends StatelessWidget {
  const _TeamMemberCard({required this.member});

  final TeamMember member;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: context.salonTheme.brand.withValues(alpha: 0.14),
            child: Text(
              member.name.substring(0, 1).toUpperCase(),
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(color: context.salonTheme.brand),
            ),
          ),
          const SizedBox(height: 16),
          Text(member.name, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            member.primarySpecialty,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Text(
            member.isWorkingToday
                ? 'Atende hoje ${member.opensAt ?? ''}${member.closesAt == null ? '' : ' • até ${member.closesAt}'}'
                : 'Agenda de hoje indisponível',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _OfferTile extends StatelessWidget {
  const _OfferTile({required this.offer});

  final OfferItem offer;

  @override
  Widget build(BuildContext context) {
    final tone = offer.isMembership
        ? context.salonTheme.accent
        : context.salonTheme.brand;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          tone.withValues(alpha: 0.08),
          Theme.of(context).cardColor,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            offer.isMembership ? 'Plano / membership' : 'Oferta ativa',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tone,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(offer.title, style: Theme.of(context).textTheme.titleLarge),
          if (offer.description != null) ...[
            const SizedBox(height: 6),
            Text(
              offer.description!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (offer.highlightText != null) ...[
            const SizedBox(height: 8),
            Text(
              offer.highlightText!,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
          if (offer.price != null) ...[
            const SizedBox(height: 10),
            Text(
              formatCurrency(offer.price!),
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: tone),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});

  final RetailProduct product;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(product.name, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            product.brand ?? 'Seleção da marca',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const Spacer(),
          Text(
            product.retailPrice == null
                ? 'Consulte no salão'
                : formatCurrency(product.retailPrice!),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: context.salonTheme.brand),
          ),
        ],
      ),
    );
  }
}

class _FeedPreviewTile extends StatelessWidget {
  const _FeedPreviewTile({required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(18),
          child: Image.network(
            post.coverImageUrl,
            width: 88,
            height: 88,
            fit: BoxFit.cover,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(post.title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(
                post.caption ?? 'Resultado real compartilhado pelo salão.',
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AppointmentHighlightCard extends StatelessWidget {
  const _AppointmentHighlightCard({required this.appointment});

  final AppointmentItem appointment;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: context.salonTheme.outline),
        color: Theme.of(context).cardColor,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            appointment.serviceName,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 6),
          Text(
            '${formatLongDate(appointment.date)} • ${formatTime(appointment.date)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (appointment.staffMemberName != null) ...[
            const SizedBox(height: 4),
            Text(
              'Com ${appointment.staffMemberName}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _VacancyHighlightCard extends StatelessWidget {
  const _VacancyHighlightCard({
    required this.alert,
    this.actionLabel = 'Ver agenda',
    this.onPressed,
  });

  final VacancyAlert alert;
  final String actionLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: Color.alphaBlend(
          context.salonTheme.warning.withValues(alpha: 0.08),
          Theme.of(context).cardColor,
        ),
        border: Border.all(
          color: context.salonTheme.warning.withValues(alpha: 0.24),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(alert.headline, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(alert.body, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 8),
          Text(
            '${formatLongDate(alert.startsAt)} • ${formatTime(alert.startsAt)}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (onPressed != null) ...[
            const SizedBox(height: 12),
            FilledButton(onPressed: onPressed, child: Text(actionLabel)),
          ],
        ],
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.appointment,
    this.onCancel,
    this.onConfirmPresence,
  });

  final AppointmentItem appointment;
  final VoidCallback? onCancel;
  final VoidCallback? onConfirmPresence;

  @override
  Widget build(BuildContext context) {
    final tone = switch (appointment.status) {
      'completed' => context.salonTheme.success,
      'cancelled' => const Color(0xFFB86060),
      'confirmed' => context.salonTheme.brand,
      _ => context.salonTheme.warning,
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: tone.withValues(alpha: 0.22)),
        color: Color.alphaBlend(
          tone.withValues(alpha: 0.06),
          Theme.of(context).cardColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  appointment.serviceName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Text(
                appointment.status.toUpperCase(),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tone,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${formatLongDate(appointment.date)} • ${formatTime(appointment.date)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (appointment.staffMemberName != null) ...[
            const SizedBox(height: 4),
            Text(
              'Com ${appointment.staffMemberName}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (appointment.cancellationReason != null) ...[
            const SizedBox(height: 8),
            Text(
              'Motivo: ${appointment.cancellationReason}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (onCancel != null || onConfirmPresence != null) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (onConfirmPresence != null)
                  FilledButton(
                    onPressed: onConfirmPresence,
                    child: const Text('Confirmar presença'),
                  ),
                if (onCancel != null)
                  OutlinedButton(
                    onPressed: onCancel,
                    child: const Text('Cancelar'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _FeedPostCard extends StatelessWidget {
  const _FeedPostCard({
    required this.post,
    required this.onLike,
    required this.onComment,
    this.onBook,
  });

  final FeedPost post;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback? onBook;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: Stack(
              children: [
                Image.network(
                  post.coverImageUrl,
                  width: double.infinity,
                  height: 320,
                  fit: BoxFit.cover,
                ),
                if (post.imageUrls.length > 1)
                  Positioned(
                    top: 14,
                    right: 14,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.44),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '+${post.imageUrls.length - 1} fotos',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: Colors.white),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(post.title, style: Theme.of(context).textTheme.titleLarge),
                if (post.caption != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    post.caption!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    IconButton(
                      onPressed: onLike,
                      icon: Icon(
                        post.likedByMe
                            ? Icons.favorite_rounded
                            : Icons.favorite_border_rounded,
                        color: post.likedByMe ? const Color(0xFFD75D7A) : null,
                      ),
                    ),
                    Text('${post.likeCount}'),
                    const SizedBox(width: 10),
                    IconButton(
                      onPressed: onComment,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                    ),
                    Text('${post.commentCount}'),
                    const Spacer(),
                    if (onBook != null)
                      FilledButton(
                        onPressed: onBook,
                        child: const Text('Reservar este estilo'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CommentsSheet extends StatefulWidget {
  const _CommentsSheet({required this.post, required this.onSend});

  final FeedPost post;
  final Future<void> Function(String body) onSend;

  @override
  State<_CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<_CommentsSheet> {
  final _controller = TextEditingController();
  bool _isSending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      return;
    }

    setState(() => _isSending = true);
    try {
      await widget.onSend(text);
      if (!mounted) {
        return;
      }
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: PremiumCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comentários',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 14),
            if (widget.post.comments.isEmpty)
              const Text('Ainda não há comentários neste post.')
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 260),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: widget.post.comments.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final comment = widget.post.comments[index];
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          comment.customerName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          comment.body,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    );
                  },
                ),
              ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Escreva um comentário',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _isSending ? null : _submit,
              child: Text(_isSending ? 'Enviando...' : 'Publicar comentário'),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _LoyaltyCard extends StatelessWidget {
  const _LoyaltyCard({required this.summary});

  final LoyaltySummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: context.salonTheme.accent.withValues(alpha: 0.2),
        ),
        color: Color.alphaBlend(
          context.salonTheme.accent.withValues(alpha: 0.08),
          Theme.of(context).cardColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Fidelidade', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            '${summary.pointsBalance} pontos • ${formatCurrency(summary.cashbackBalance)} de saldo',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 6),
          Text(
            summary.nextTierLabel == null
                ? 'Você já está acumulando histórico no salão.'
                : 'Faltam ${summary.visitsToNextTier} visita(s) para chegar em ${summary.nextTierLabel}.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _ReferralCard extends StatelessWidget {
  const _ReferralCard({required this.summary});

  final ReferralSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: context.salonTheme.warning.withValues(alpha: 0.2),
        ),
        color: Color.alphaBlend(
          context.salonTheme.warning.withValues(alpha: 0.08),
          Theme.of(context).cardColor,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Indicações', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            summary.referralCode.isEmpty
                ? 'Seu código ainda não foi gerado.'
                : 'Código ${summary.referralCode}',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 6),
          Text(
            '${summary.qualifiedCount} indicação(ões) qualificadas • ${summary.availableRewardsCount} recompensa(s) disponível(is)',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

String _cacheStatusLabel<T>(CachedView<T> view) {
  final freshness = view.cachedAt == null
      ? null
      : formatRelativeFreshness(view.cachedAt!);
  if (freshness == null) {
    return 'Modo offline ativo';
  }

  return 'Modo offline • atualizado $freshness';
}
