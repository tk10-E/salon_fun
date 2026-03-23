import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/serialized_refresh_controller.dart';
import '../features/home/home_data.dart';
import '../features/home/home_data_loader.dart';
import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../services/push_notification_service.dart';
import '../services/push_token_sync_service.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_experience_preset.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cancel_appointment_sheet.dart';
import '../widgets/home/home_feed_tab.dart';
import '../widgets/home/home_history_tab.dart';
import '../widgets/home/home_load_error_view.dart';
import '../widgets/home/home_services_tab.dart';
import '../widgets/feed_comments_sheet.dart';
import '../widgets/notification_center_sheet.dart';
import '../widgets/press_feedback.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/salon_home_skeleton.dart';
import '../widgets/soft_card.dart';
import 'benefits_wallet_screen.dart';
import 'book_appointment_screen.dart';
import 'profile_screen.dart';

part 'home_screen_actions.dart';
part 'home_screen_data.dart';
part 'home_screen_feed.dart';
part 'home_screen_realtime.dart';

enum _AccountMenuAction { profile, wallet, signOut }

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.repository,
    required this.profile,
    this.onActiveProfileChanged,
    this.homeDataLoader,
    this.pushTokenSyncService,
    this.enableRealtime = true,
    this.enablePushTokenSync = true,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final ValueChanged<CustomerProfile?>? onActiveProfileChanged;
  final HomeDataLoader? homeDataLoader;
  final PushTokenSyncService? pushTokenSyncService;
  final bool enableRealtime;
  final bool enablePushTokenSync;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

abstract class _HomeScreenStateBase extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late CustomerProfile _profile;
  late final TabController _tabController;
  late final HomeDataLoader _homeDataLoader;
  late final SerializedRefreshController _refreshController;
  late final PushTokenSyncService _pushTokenSyncService;
  late Future<HomeData> _homeFuture;
  HomeData? _cachedData;
  int _homeLoadVersion = 0;
  RealtimeChannel? _vacancyAlertsChannel;
  RealtimeChannel? _customerNotificationsChannel;
  RealtimeChannel? _salonContentChannel;
  Timer? _contentRefreshDebounce;
  final Set<String> _busyPostIds = <String>{};
  final Set<String> _busyVacancyAlertIds = <String>{};
  final Set<String> _busyFavoriteServiceIds = <String>{};
  final Set<String> _bookedVacancyAlertIds = <String>{};
  final Set<String> _knownVacancyAlertIds = <String>{};
  bool _primedVacancyAlerts = false;
  bool _suppressRealtimeVacancyNotice = false;

  void _handleVacancyAlertUpdates(List<VacancyAlert> alerts);

  Future<void> _refreshData();

  void _refreshDataInBackground();

  void _upsertNotificationLocally(CustomerNotificationItem notification);

  void _upsertVacancyAlertLocally(VacancyAlert alert);

  void _removeVacancyAlertLocally(String alertId);

  void _replaceCachedData(HomeData Function(HomeData current) transform);

  void _updateAppointmentLocally(
    String appointmentId,
    AppointmentItem Function(AppointmentItem current) transform,
  );

  void _updatePostLocally(
    String postId,
    SalonPost Function(SalonPost current) transform,
  );

  void _markNotificationsReadLocally(Iterable<String> notificationKeys);

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  void _showWhatsAppFallback([String? message]) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message ??
              'O WhatsApp de ${_profile.salonName} ainda não foi configurado no app.',
        ),
      ),
    );
  }

  String _humanizeFeedError(String raw) {
    if (raw.contains('duplicate key')) {
      return 'Você já curtiu esta foto.';
    }
    if (raw.contains('customer_not_found')) {
      return 'Não encontramos seu perfil agora. Tente entrar novamente.';
    }
    if (raw.contains('row-level security') || raw.contains('permission')) {
      return 'Não foi possível concluir sua interação agora.';
    }
    if (raw.contains('salon_post_') || raw.contains('salon_posts')) {
      return 'O feed ainda não foi ativado no servidor.';
    }

    return 'Não foi possível concluir sua interação agora.';
  }
}

class _HomeScreenState extends _HomeScreenStateBase
    with
        _HomeScreenDataMixin,
        _HomeScreenRealtimeMixin,
        _HomeScreenActionsMixin,
        _HomeScreenFeedMixin {
  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    widget.onActiveProfileChanged?.call(_profile);
    _homeDataLoader =
        widget.homeDataLoader ?? HomeDataLoader(repository: widget.repository);
    _refreshController = SerializedRefreshController(_performRefresh);
    _pushTokenSyncService =
        widget.pushTokenSyncService ??
        PushTokenSyncService(repository: widget.repository);
    _tabController = TabController(
      length: 3,
      vsync: this,
      animationDuration: const Duration(milliseconds: 170),
    )
      ..addListener(() {
        if (mounted) {
          setState(() {});
        }
      });
    _loadData();
    if (widget.enableRealtime) {
      _subscribeToVacancyAlerts();
      _subscribeToCustomerNotifications();
      _subscribeToSalonContent();
    }
    if (widget.enablePushTokenSync) {
      unawaited(_pushTokenSyncService.start());
    }
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile.id != widget.profile.id ||
        oldWidget.profile.name != widget.profile.name ||
        oldWidget.profile.salonName != widget.profile.salonName ||
        oldWidget.profile.salonBrandColor != widget.profile.salonBrandColor ||
        oldWidget.profile.salonBusinessSegment !=
            widget.profile.salonBusinessSegment ||
        oldWidget.profile.salonLogoUrl != widget.profile.salonLogoUrl) {
      _profile = widget.profile;
      widget.onActiveProfileChanged?.call(_profile);
    }
  }

  @override
  void dispose() {
    final channel = _vacancyAlertsChannel;
    if (channel != null) {
      unawaited(widget.repository.client.removeChannel(channel));
    }
    final notificationsChannel = _customerNotificationsChannel;
    if (notificationsChannel != null) {
      unawaited(widget.repository.client.removeChannel(notificationsChannel));
    }
    final contentChannel = _salonContentChannel;
    if (contentChannel != null) {
      unawaited(widget.repository.client.removeChannel(contentChannel));
    }
    _refreshController.dispose();
    unawaited(_pushTokenSyncService.dispose());
    _contentRefreshDebounce?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  String _buildHeroSubtitle(HomeData data) {
    final preset = SalonExperiencePreset.fromBusinessSegment(
      _profile.salonBusinessSegment,
    );
    final services = data.services;
    final profileTagline = _profile.salonTagline?.trim();
    if (profileTagline != null && profileTagline.isNotEmpty) {
      return profileTagline;
    }

    if (data.nextAvailableAt != null && services.isNotEmpty) {
      return preset.nextAvailableSubtitle(
        _formatNextAvailable(data.nextAvailableAt),
      );
    }

    if (data.offers.any((offer) => offer.isMembership)) {
      return preset.membershipSubtitle;
    }

    if (data.offers.isNotEmpty) {
      return preset.offerSubtitle;
    }

    if (data.posts.isNotEmpty) {
      return preset.postsSubtitle;
    }

    if (data.loyaltySummary?.hasVisibleContent == true) {
      return preset.benefitsSubtitle;
    }

    if (services.isEmpty) {
      return preset.noServicesSubtitle;
    }

    final highlights = services
        .take(3)
        .map((service) => service.name.trim())
        .where((name) => name.isNotEmpty)
        .toList();

    return preset.servicesAvailableSubtitle(highlights);
  }

  String _formatNextAvailable(DateTime? slot) {
    if (slot == null) {
      return 'Fale com o salão';
    }

    final now = DateTime.now();
    final sameDay =
        slot.year == now.year && slot.month == now.month && slot.day == now.day;
    final timeFormat = DateFormat('HH:mm');

    if (sameDay) {
      return 'Hoje, ${timeFormat.format(slot)}';
    }

    return '${DateFormat('dd/MM').format(slot)} • ${timeFormat.format(slot)}';
  }

  String _todayAttendanceLabel(List<AppointmentItem> appointments) {
    final now = DateTime.now();
    final todayAppointments = appointments.where((appointment) {
      final date = appointment.date;
      return date.year == now.year &&
          date.month == now.month &&
          date.day == now.day &&
          appointment.status.toLowerCase() != 'cancelled';
    }).length;

    if (todayAppointments == 0) {
      return 'Nenhum horário hoje';
    }

    if (todayAppointments == 1) {
      return '1 atendimento';
    }

    return '$todayAppointments atendimentos';
  }

  int _upcomingAppointmentCount(List<AppointmentItem> appointments) {
    final now = DateTime.now();
    return appointments
        .where(
          (appointment) =>
              (appointment.status == 'pending' ||
                  appointment.status == 'confirmed') &&
              appointment.date.isAfter(now),
        )
        .length;
  }

  int _completedAppointmentCount(List<AppointmentItem> appointments) {
    return appointments
        .where((appointment) => appointment.status == 'completed')
        .length;
  }

  int _uniqueFeedStaffCount(List<SalonPost> posts) {
    return posts
        .map((post) => post.staffMemberName?.trim() ?? '')
        .where((name) => name.isNotEmpty)
        .toSet()
        .length;
  }

  String _formatCountLabel(
    int count, {
    required String singular,
    required String plural,
    String? zero,
  }) {
    if (count == 0) {
      return zero ?? 'Sem $plural';
    }

    if (count == 1) {
      return '1 $singular';
    }

    return '$count $plural';
  }

  _HomeShellSnapshot _buildHomeShellSnapshot(
    HomeData? data,
    SalonExperiencePreset preset,
    int notificationCount,
  ) {
    final tabIndex = _tabController.index;
    final services = data?.services ?? const <ServiceItem>[];
    final appointments = data?.appointments ?? const <AppointmentItem>[];
    final posts = data?.posts ?? const <SalonPost>[];
    final offers = data?.offers ?? const <SalonOfferItem>[];
    final hasBenefits = data?.loyaltySummary?.hasVisibleContent == true;
    final feedStaffCount = _uniqueFeedStaffCount(posts);
    final beforeAfterCount = posts.where((post) => post.isBeforeAfter).length;
    final reservablePostsCount = posts
        .where((post) => post.linkedService != null)
        .length;
    final upcomingCount = _upcomingAppointmentCount(appointments);
    final completedCount = _completedAppointmentCount(appointments);
    final nextAvailableLabel = data == null
        ? 'Preparando agenda'
        : _formatNextAvailable(data.nextAvailableAt);

    switch (tabIndex) {
      case 1:
        return _HomeShellSnapshot(
          eyebrow: 'Feed do salão',
          title: 'Inspirações, resultados e agenda em movimento.',
          description: posts.isEmpty
              ? 'Quando o salão publicar novidades, fotos e referências vão aparecer aqui para ajudar na decisão.'
              : '${_formatCountLabel(posts.length, singular: 'post', plural: 'posts')} para decidir mais rápido antes da próxima reserva.',
          icon: Icons.auto_awesome_mosaic_rounded,
          emphasisLabel: beforeAfterCount > 0
              ? _formatCountLabel(
                  beforeAfterCount,
                  singular: 'resultado real',
                  plural: 'resultados reais',
                )
              : notificationCount > 0
              ? _formatCountLabel(
                  notificationCount,
                  singular: 'novo aviso',
                  plural: 'novos avisos',
                )
              : 'Feed atualizado',
          metrics: [
            _HomeShellMetric(
              icon: Icons.photo_library_outlined,
              label: 'No feed',
              value: posts.isEmpty
                  ? 'Aguardando posts'
                  : _formatCountLabel(
                      posts.length,
                      singular: 'publicação',
                      plural: 'publicações',
                    ),
            ),
            _HomeShellMetric(
              icon: Icons.person_search_rounded,
              label: 'Equipe',
              value: feedStaffCount == 0
                  ? 'Salão em destaque'
                  : _formatCountLabel(
                      feedStaffCount,
                      singular: 'profissional',
                      plural: 'profissionais',
                    ),
            ),
            _HomeShellMetric(
              icon: Icons.event_available_rounded,
              label: 'Reserva',
              value: reservablePostsCount == 0
                  ? 'Chame no chat'
                  : _formatCountLabel(
                      reservablePostsCount,
                      singular: 'post reservável',
                      plural: 'posts reserváveis',
                    ),
            ),
          ],
        );
      case 2:
        return _HomeShellSnapshot(
          eyebrow: 'Histórico organizado',
          title: 'Seu histórico fica pronto para voltar na hora certa.',
          description: appointments.isEmpty
              ? 'Seus próximos horários e atendimentos passados vão aparecer aqui em uma linha do tempo mais clara.'
              : 'Rebook, confirmações e benefícios aparecem juntos para você retomar sua rotina com menos atrito.',
          icon: Icons.history_rounded,
          emphasisLabel: upcomingCount > 0
              ? _formatCountLabel(
                  upcomingCount,
                  singular: 'próximo horário',
                  plural: 'próximos horários',
                )
              : completedCount > 0
              ? _formatCountLabel(
                  completedCount,
                  singular: 'retorno salvo',
                  plural: 'retornos salvos',
                )
              : 'Historico pronto',
          metrics: [
            _HomeShellMetric(
              icon: Icons.upcoming_rounded,
              label: 'Próximos',
              value: upcomingCount == 0
                  ? 'Sem agenda'
                  : _formatCountLabel(
                      upcomingCount,
                      singular: 'agendado',
                      plural: 'agendados',
                    ),
            ),
            _HomeShellMetric(
              icon: Icons.check_circle_outline_rounded,
              label: 'Concluídos',
              value: completedCount == 0
                  ? 'Sem concluídos'
                  : _formatCountLabel(
                      completedCount,
                      singular: 'atendimento',
                      plural: 'atendimentos',
                    ),
            ),
            _HomeShellMetric(
              icon: hasBenefits
                  ? Icons.loyalty_rounded
                  : Icons.sell_outlined,
              label: hasBenefits ? 'Benefícios' : 'Campanhas',
              value: hasBenefits
                  ? 'Carteira ativa'
                  : offers.isEmpty
                  ? 'Fale com o salão'
                  : _formatCountLabel(
                      offers.length,
                      singular: 'oferta',
                      plural: 'ofertas',
                    ),
            ),
          ],
        );
      case 0:
      default:
        return _HomeShellSnapshot(
          eyebrow: 'Centro do salão',
          title: 'Tudo para decidir, reservar e falar com o salão.',
          description: data == null
              ? 'Agenda, benefícios, inspirações e contato do salão ficam organizados aqui em um só lugar.'
              : _buildHeroSubtitle(data),
          icon: Icons.spa_outlined,
          emphasisLabel: notificationCount > 0
              ? _formatCountLabel(
                  notificationCount,
                  singular: 'novo aviso',
                  plural: 'novos avisos',
                )
              : preset.appBarLabel,
          metrics: [
            _HomeShellMetric(
              icon: Icons.schedule_rounded,
              label: 'Próximo horário',
              value: nextAvailableLabel,
            ),
            _HomeShellMetric(
              icon: Icons.today_outlined,
              label: 'Hoje',
              value: data == null
                  ? 'Preparando agenda'
                  : _todayAttendanceLabel(appointments),
            ),
            _HomeShellMetric(
              icon: hasBenefits
                  ? Icons.workspace_premium_outlined
                  : Icons.content_cut_rounded,
              label: hasBenefits ? 'Benefícios' : 'Serviços',
              value: hasBenefits
                  ? 'Carteira ativa'
                  : services.isEmpty
                  ? 'Fale com o salão'
                  : _formatCountLabel(
                      services.length,
                      singular: 'serviço',
                      plural: 'serviços',
                    ),
            ),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final preset = SalonExperiencePreset.fromBusinessSegment(
      _profile.salonBusinessSegment,
    );
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
      businessSegment: _profile.salonBusinessSegment,
    );

    return FutureBuilder<HomeData>(
      future: _homeFuture,
      builder: (context, snapshot) {
        final data = _cachedData ?? snapshot.data;
        final isLoading =
            snapshot.connectionState == ConnectionState.waiting && data == null;
        final hasError = snapshot.hasError && data == null;
        final notificationCount =
            data?.notifications.where((item) => !item.isRead).length ?? 0;
        final shellSnapshot = _buildHomeShellSnapshot(
          data,
          preset,
          notificationCount,
        );

        return Scaffold(
          appBar: AppBar(
            automaticallyImplyLeading: false,
            backgroundColor: Colors.transparent,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            scrolledUnderElevation: 0,
            toolbarHeight: 84,
            titleSpacing: 20,
            title: Row(
              children: [
                SalonBrandMark(
                  salonName: _profile.salonName,
                  logoUrl: _profile.salonLogoUrl,
                  branding: branding,
                  size: 44,
                  borderRadius: 16,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _profile.salonName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: branding.deep,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        preset.appBarLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: branding.mutedText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            foregroundColor: branding.deep,
            actions: [
              PressFeedback(
                enabled: data != null,
                haptic: data != null,
                child: IconButton(
                  onPressed: data == null
                      ? null
                      : () {
                          unawaited(
                            _openNotificationsCenter(data.notifications),
                          );
                        },
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.82),
                    foregroundColor: branding.deep,
                    side: BorderSide(
                      color: branding.outline.withValues(alpha: 0.68),
                    ),
                    minimumSize: const Size(46, 46),
                  ),
                  icon: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      const Icon(Icons.notifications_none_rounded),
                      if (notificationCount > 0)
                        Positioned(
                          right: -6,
                          top: -5,
                          child: Container(
                            constraints: const BoxConstraints(minWidth: 18),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 5,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: branding.primary,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: Colors.white,
                                width: 1.4,
                              ),
                            ),
                            child: Text(
                              notificationCount > 9
                                  ? '9+'
                                  : notificationCount.toString(),
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ),
                        ),
                    ],
                  ),
                  tooltip: 'Notificações',
                ),
              ),
              PopupMenuButton<_AccountMenuAction>(
                tooltip: 'Minha conta',
                onSelected: (action) {
                  unawaited(_handleAccountMenuSelection(action, data));
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(
                    value: _AccountMenuAction.profile,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.person_outline_rounded),
                      title: Text('Minha conta'),
                    ),
                  ),
                  PopupMenuItem(
                    value: _AccountMenuAction.wallet,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.account_balance_wallet_outlined),
                      title: Text('Minha carteira'),
                    ),
                  ),
                  PopupMenuDivider(),
                  PopupMenuItem(
                    value: _AccountMenuAction.signOut,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.logout_rounded),
                      title: Text('Sair'),
                    ),
                  ),
                ],
                child: PressFeedback(
                  haptic: true,
                  child: _HomeToolbarActionIcon(
                    branding: branding,
                    icon: Icons.account_circle_outlined,
                  ),
                ),
              ),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(78),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.76),
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(
                      color: branding.outline.withValues(alpha: 0.7),
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12000000),
                        blurRadius: 18,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(6),
                    child: Row(
                      children: [
                        Expanded(
                          child: _HomePanelTabButton(
                            label: 'Salão',
                            icon: Icons.storefront_outlined,
                            branding: branding,
                            selected: _tabController.index == 0,
                            onTap: () => _animateToTab(0),
                          ),
                        ),
                        Expanded(
                          child: _HomePanelTabButton(
                            label: 'Feed',
                            icon: Icons.auto_awesome_mosaic_outlined,
                            branding: branding,
                            selected: _tabController.index == 1,
                            onTap: () => _animateToTab(1),
                          ),
                        ),
                        Expanded(
                          child: _HomePanelTabButton(
                            label: 'Histórico',
                            icon: Icons.history_rounded,
                            branding: branding,
                            selected: _tabController.index == 2,
                            onTap: () => _animateToTab(2),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          body: AppBackdrop(
            branding: branding,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
                  child: _HomePrimaryShell(
                    branding: branding,
                    snapshot: shellSnapshot,
                  ),
                ),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      if (isLoading)
                        SalonHomeSkeleton(branding: branding)
                      else if (hasError)
                        HomeLoadErrorView(
                          title: 'Não foi possível carregar o salão',
                          message:
                              'Verifique sua conexão e tente atualizar para buscar os dados novamente.',
                          onRetry: _refreshData,
                          accentColor: branding.primary,
                        )
                      else
                        HomeServicesTab(
                          profile: _profile,
                          branding: branding,
                          data: data!,
                          onRefresh: _refreshData,
                          onWhatsApp: () {
                            _openWhatsApp();
                          },
                          busyVacancyAlertIds: _busyVacancyAlertIds,
                          bookedVacancyAlertIds: _bookedVacancyAlertIds,
                          onBookVacancyAlert: _claimVacancyAlert,
                          onCopyReferral: _copyReferralCode,
                          onBook: (service) => _openBooking(service, data),
                          onBookGrowthSuggestion: (service, suggestion) =>
                              _openGrowthSuggestion(service, suggestion, data),
                          onBookSuggested: (service, suggestion) =>
                              _openSuggestedBooking(service, suggestion, data),
                          heroSubtitle: _buildHeroSubtitle(data),
                          nextAvailableLabel: _formatNextAvailable(
                            data.nextAvailableAt,
                          ),
                          todayAttendanceLabel: _todayAttendanceLabel(
                            data.appointments,
                          ),
                          favoriteServiceIds: data.favoriteServiceIds,
                          busyFavoriteServiceIds: _busyFavoriteServiceIds,
                          onToggleFavoriteService: _toggleFavoriteService,
                        ),
                      if (isLoading)
                        SalonHomeSkeleton(branding: branding, historyMode: true)
                      else if (hasError)
                        HomeLoadErrorView(
                          title: 'Não foi possível carregar o feed do salão',
                          message:
                              'Atualize a tela para buscar novamente as fotos e os comentários.',
                          onRetry: _refreshData,
                          accentColor: branding.primary,
                        )
                      else
                        HomeFeedTab(
                          profile: _profile,
                          branding: branding,
                          posts: data!.posts,
                          onRefresh: _refreshData,
                          onWhatsApp: () {
                            _openWhatsApp();
                          },
                          onToggleLike: _togglePostLike,
                          onOpenComments: _openComments,
                          onOpenVideo: _openPostVideo,
                          onBookService: (service) => _openBooking(service, data),
                          busyPostIds: _busyPostIds,
                        ),
                      if (isLoading)
                        SalonHomeSkeleton(branding: branding, historyMode: true)
                      else if (hasError)
                        HomeLoadErrorView(
                          title: 'Não foi possível carregar seu histórico',
                          message:
                              'Atualize a tela para buscar novamente os horários do salão.',
                          onRetry: _refreshData,
                          accentColor: branding.primary,
                        )
                      else
                        HomeHistoryTab(
                          profile: _profile,
                          branding: branding,
                          appointments: data!.appointments,
                          onRefresh: _refreshData,
                          onWhatsApp: () {
                            _openWhatsApp();
                          },
                          insightData: data,
                          onOpenWallet: () {
                            _openBenefitsWallet(data);
                          },
                          onBookGrowthSuggestion: (service, suggestion) =>
                              _openGrowthSuggestion(service, suggestion, data),
                          onCancelAppointment: _cancelAppointment,
                          onConfirmAppointmentPresence:
                              _confirmAppointmentPresence,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _animateToTab(int index) {
    if (_tabController.index == index && !_tabController.indexIsChanging) {
      return;
    }

    _tabController.animateTo(
      index,
      duration: const Duration(milliseconds: 170),
      curve: Curves.easeOutCubic,
    );
  }
}

class _HomeToolbarActionIcon extends StatelessWidget {
  const _HomeToolbarActionIcon({
    required this.branding,
    required this.icon,
  });

  final SalonBranding branding;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.68)),
      ),
      child: Icon(icon, color: branding.deep),
    );
  }
}

class _HomePrimaryShell extends StatelessWidget {
  const _HomePrimaryShell({
    required this.branding,
    required this.snapshot,
  });

  final SalonBranding branding;
  final _HomeShellSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: const EdgeInsets.all(20),
      gradient: LinearGradient(
        colors: [
          Color.lerp(branding.deep, Colors.black, 0.08)!,
          branding.primary,
          Color.lerp(branding.primary, Colors.white, 0.18)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.primary.withValues(alpha: 0.48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Icon(snapshot.icon, color: Colors.white),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      snapshot.eyebrow,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: Colors.white.withValues(alpha: 0.82),
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      snapshot.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Text(
                    snapshot.emphasisLabel,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            snapshot.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.88),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var index = 0; index < snapshot.metrics.length; index++) ...[
                  _HomeShellMetricChip(metric: snapshot.metrics[index]),
                  if (index != snapshot.metrics.length - 1)
                    const SizedBox(width: 10),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomePanelTabButton extends StatelessWidget {
  const _HomePanelTabButton({
    required this.label,
    required this.icon,
    required this.branding,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final SalonBranding branding;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foregroundColor = selected
        ? branding.onPrimary
        : branding.deep.withValues(alpha: 0.82);

    return PressFeedback(
      haptic: true,
      pressedScale: 0.985,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 170),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              gradient: selected ? branding.heroGradient : null,
              color: selected ? null : Colors.transparent,
              borderRadius: BorderRadius.circular(20),
              boxShadow: selected
                  ? const [
                      BoxShadow(
                        color: Color(0x18000000),
                        blurRadius: 14,
                        offset: Offset(0, 6),
                      ),
                    ]
                  : null,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedScale(
                  scale: selected ? 1 : 0.96,
                  duration: const Duration(milliseconds: 170),
                  curve: Curves.easeOutCubic,
                  child: Icon(icon, size: 20, color: foregroundColor),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: foregroundColor,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _HomeShellMetricChip extends StatelessWidget {
  const _HomeShellMetricChip({required this.metric});

  final _HomeShellMetric metric;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 136),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(metric.icon, size: 17, color: Colors.white),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                metric.label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.76),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                metric.value,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HomeShellSnapshot {
  const _HomeShellSnapshot({
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.icon,
    required this.emphasisLabel,
    required this.metrics,
  });

  final String eyebrow;
  final String title;
  final String description;
  final IconData icon;
  final String emphasisLabel;
  final List<_HomeShellMetric> metrics;
}

class _HomeShellMetric {
  const _HomeShellMetric({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;
}
