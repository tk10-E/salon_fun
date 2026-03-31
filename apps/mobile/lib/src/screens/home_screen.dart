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
import '../navigation/salon_page_route.dart';
import '../repositories/salon_repository.dart';
import '../services/push_notification_service.dart';
import '../services/push_token_sync_service.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_experience_preset.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cancel_appointment_sheet.dart';
import '../widgets/cinematic_reveal.dart';
import '../widgets/home/home_feed_tab.dart';
import '../widgets/home/home_history_tab.dart';
import '../widgets/home/home_load_error_view.dart';
import '../widgets/home/home_profile_tab.dart';
import '../widgets/home/home_services_tab.dart';
import '../widgets/feed_comments_sheet.dart';
import '../widgets/press_feedback.dart';
import '../widgets/premium_bottom_nav_bar.dart';
import '../widgets/pulse_dot.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/salon_home_skeleton.dart';
import 'benefits_wallet_screen.dart';
import 'book_appointment_screen.dart';
import 'premium_booking_screen.dart';
import 'premium_client_profile_screen.dart';
import 'premium_notifications_screen.dart';
import 'premium_products_screen.dart';
import 'premium_professionals_screen.dart';
import 'premium_salon_profile_screen.dart';
import 'premium_service_detail_screen.dart';

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
    _tabController =
        TabController(
          length: 4,
          vsync: this,
          animationDuration: const Duration(milliseconds: 170),
        )..addListener(() {
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

  @override
  Widget build(BuildContext context) {
    final preset = SalonExperiencePreset.fromBusinessSegment(
      _profile.salonBusinessSegment,
    );
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
      businessSegment: _profile.salonBusinessSegment,
      clientAppConfig: _profile.salonClientAppConfig,
    );

    return FutureBuilder<HomeData>(
      future: _homeFuture,
      builder: (context, snapshot) {
        final data = _cachedData ?? snapshot.data;
        final isLoading =
            snapshot.connectionState == ConnectionState.waiting && data == null;
        final hasError = snapshot.hasError && data == null;
        final brandConfig = SalonBrandConfig.fromProfile(
          _profile,
          services: data?.services ?? const <ServiceItem>[],
          posts: data?.posts ?? const <SalonPost>[],
          offers: data?.offers ?? const <SalonOfferItem>[],
        );
        final professionalHighlightsCount = brandConfig
            .buildProfessionalHighlights(
              posts: data?.posts ?? const <SalonPost>[],
              appointments: data?.appointments ?? const <AppointmentItem>[],
            )
            .length;
        final notificationCount =
            data?.notifications.where((item) => !item.isRead).length ?? 0;
        final clientExperienceCount = {
          ...brandConfig.visibleModules.map((module) => module.name),
          if (data?.notifications.isNotEmpty ?? false) 'notifications',
          if (data?.posts.isNotEmpty ?? false) 'feed',
          if (data?.offers.isNotEmpty ?? false) 'offers',
          if (data?.loyaltySummary?.hasVisibleContent == true) 'loyalty',
          if (data?.referralSummary?.hasVisibleContent == true) 'referrals',
        }.length;
        final liveSignalLabel = data == null
            ? 'Conectando'
            : data.posts.isNotEmpty
            ? 'Ao vivo'
            : data.nextAvailableAt != null
            ? 'Agenda aberta'
            : 'App ativo';
        return Scaffold(
          extendBody: true,
          body: AppBackdrop(
            branding: branding,
            child: SafeArea(
              bottom: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 6),
                    child: CinematicReveal(
                      delay: const Duration(milliseconds: 24),
                      beginOffset: const Offset(0, 14),
                      child: _HomeShellHeader(
                        branding: branding,
                        title: _headerTitle,
                        subtitle: _headerSubtitle(preset),
                        salonName: _profile.salonName,
                        onOpenSalonProfile: data == null
                            ? null
                            : () {
                                unawaited(_openSalonProfile(data));
                              },
                        appBadgeLabel: preset.appBarLabel,
                        liveSignalLabel: liveSignalLabel,
                        liveActive: data != null,
                        notificationCount: notificationCount,
                        onOpenNotifications: data == null
                            ? null
                            : () {
                                unawaited(
                                  _openNotificationsCenter(data.notifications),
                                );
                              },
                        accountMenu: PopupMenuButton<_AccountMenuAction>(
                          tooltip: 'Minha conta',
                          onSelected: (action) {
                            unawaited(
                              _handleAccountMenuSelection(action, data),
                            );
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
                                leading: Icon(
                                  Icons.account_balance_wallet_outlined,
                                ),
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
                            child: _HomeProfileAvatar(
                              branding: branding,
                              label: _profile.name,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_tabController.index == 0)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
                      child: CinematicReveal(
                        delay: const Duration(milliseconds: 52),
                        beginOffset: const Offset(0, 14),
                        child: _HomeCommandDeck(
                          branding: branding,
                          salonName: _profile.salonName,
                          heroSubtitle: data == null
                              ? (_profile.salonTagline ??
                                  'Sua experiência premium com o salão começa aqui.')
                              : _buildHeroSubtitle(data),
                          leadMomentLabel: data?.nextAvailableAt != null
                              ? _formatNextAvailable(data!.nextAvailableAt)
                              : data?.vacancyAlerts.isNotEmpty == true
                              ? '${data!.vacancyAlerts.length} vagas liberadas'
                              : data?.offers.isNotEmpty == true
                              ? '${data!.offers.length} experiências ativas'
                              : 'Exploração premium liberada',
                          attendanceLabel: data == null
                              ? 'Sincronizando sua agenda'
                              : _todayAttendanceLabel(data.appointments),
                          spotlightLabel: data == null
                              ? 'Conectando novidades do salão'
                              : data.posts.isNotEmpty
                              ? '${data.posts.length} destaques da marca'
                              : notificationCount > 0
                              ? '$notificationCount alertas novos'
                              : data.offers.isNotEmpty
                              ? '${data.offers.length} ofertas em cena'
                              : 'Tudo pronto para explorar',
                          onOpenAgenda: () => _animateToTab(1),
                          onOpenGallery: () => _animateToTab(2),
                          onOpenNotifications: data == null
                              ? null
                              : () {
                                  unawaited(
                                    _openNotificationsCenter(
                                      data.notifications,
                                    ),
                                  );
                                },
                        ),
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
                            onOpenAgenda: () => _animateToTab(1),
                            onOpenGallery: () => _animateToTab(2),
                            busyVacancyAlertIds: _busyVacancyAlertIds,
                            bookedVacancyAlertIds: _bookedVacancyAlertIds,
                            onBookVacancyAlert: _claimVacancyAlert,
                            onCopyReferral: _copyReferralCode,
                            onBook: (service) => _openBooking(service, data),
                            onBookGrowthSuggestion: (service, suggestion) =>
                                _openGrowthSuggestion(
                                  service,
                                  suggestion,
                                  data,
                                ),
                            onBookSuggested: (service, suggestion) =>
                                _openSuggestedBooking(
                                  service,
                                  suggestion,
                                  data,
                                ),
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
                            onOpenServiceDetails: (service) =>
                                _openServiceDetail(service, data),
                            onOpenProfessionals: () {
                              unawaited(_openProfessionals(data));
                            },
                            onOpenProducts: () {
                              unawaited(_openProducts(data));
                            },
                          ),
                        if (isLoading)
                          SalonHomeSkeleton(
                            branding: branding,
                            historyMode: true,
                          )
                        else if (hasError)
                          HomeLoadErrorView(
                            title: 'Não foi possível carregar sua agenda',
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
                                _openGrowthSuggestion(
                                  service,
                                  suggestion,
                                  data,
                                ),
                            onCancelAppointment: _cancelAppointment,
                            onConfirmAppointmentPresence:
                                _confirmAppointmentPresence,
                          ),
                        if (isLoading)
                          SalonHomeSkeleton(
                            branding: branding,
                            historyMode: true,
                          )
                        else if (hasError)
                          HomeLoadErrorView(
                            title:
                                'Não foi possível carregar a galeria do salão',
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
                            onBookService: (service) =>
                                _openBooking(service, data),
                            busyPostIds: _busyPostIds,
                          ),
                        if (isLoading)
                          SalonHomeSkeleton(
                            branding: branding,
                            historyMode: true,
                          )
                        else if (hasError)
                          HomeLoadErrorView(
                            title: 'Não foi possível carregar seu perfil',
                            message:
                                'Atualize a tela para buscar novamente seus dados e a ligação com o salão.',
                            onRetry: _refreshData,
                            accentColor: branding.primary,
                          )
                        else
                          HomeProfileTab(
                            profile: _profile,
                            branding: branding,
                            data: data!,
                            unreadNotificationsCount: notificationCount,
                            clientExperienceCount: clientExperienceCount,
                            professionalHighlightsCount:
                                professionalHighlightsCount,
                            productHighlightsCount: brandConfig.products.length,
                            onRefresh: _refreshData,
                            onOpenProfile: () {
                              unawaited(_openProfile(data));
                            },
                            onOpenWallet: () {
                              unawaited(_openBenefitsWallet(data));
                            },
                            onOpenNotifications: () {
                              unawaited(
                                _openNotificationsCenter(data.notifications),
                              );
                            },
                            onOpenSalonProfile: () {
                              unawaited(_openSalonProfile(data));
                            },
                            onOpenProfessionals: () {
                              unawaited(_openProfessionals(data));
                            },
                            onOpenProducts: () {
                              unawaited(_openProducts(data));
                            },
                            onWhatsApp: _openWhatsApp,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          bottomNavigationBar: SafeArea(
            minimum: const EdgeInsets.fromLTRB(18, 0, 18, 14),
            child: CinematicReveal(
              delay: const Duration(milliseconds: 80),
              beginOffset: const Offset(0, 14),
              child: PremiumBottomNavBar(
                currentIndex: _tabController.index,
                items: const [
                  PremiumBottomNavItemData(
                    label: 'Inicio',
                    icon: Icons.home_rounded,
                  ),
                  PremiumBottomNavItemData(
                    label: 'Agenda',
                    icon: Icons.calendar_month_rounded,
                  ),
                  PremiumBottomNavItemData(
                    label: 'Galeria',
                    icon: Icons.photo_camera_outlined,
                  ),
                  PremiumBottomNavItemData(
                    label: 'Perfil',
                    icon: Icons.person_outline_rounded,
                  ),
                ],
                onTap: _animateToTab,
              ),
            ),
          ),
        );
      },
    );
  }

  String get _headerTitle {
    final firstName = _profile.name.trim().split(' ').first;

    switch (_tabController.index) {
      case 1:
        return 'Sua agenda';
      case 2:
        return 'Galeria real';
      case 3:
        return 'Seu perfil';
      case 0:
      default:
        return 'Olá, $firstName!';
    }
  }

  String _headerSubtitle(SalonExperiencePreset preset) {
    switch (_tabController.index) {
      case 1:
        return 'Sua agenda, confirmações e retornos em uma leitura simples.';
      case 2:
        return 'Resultados reais e referências do ${_profile.salonName}.';
      case 3:
        return 'Perfil, carteira e suporte conectados ao seu salão.';
      case 0:
      default:
        return _profile.salonTagline ??
            'Veja as novidades do ${_profile.salonName} com uma leitura feita para ${preset.label.toLowerCase()}.';
    }
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

class _HomeShellHeader extends StatelessWidget {
  const _HomeShellHeader({
    required this.branding,
    required this.title,
    required this.subtitle,
    required this.salonName,
    required this.onOpenSalonProfile,
    required this.appBadgeLabel,
    required this.liveSignalLabel,
    required this.liveActive,
    required this.notificationCount,
    required this.onOpenNotifications,
    required this.accountMenu,
  });

  final SalonBranding branding;
  final String title;
  final String subtitle;
  final String salonName;
  final VoidCallback? onOpenSalonProfile;
  final String appBadgeLabel;
  final String liveSignalLabel;
  final bool liveActive;
  final int notificationCount;
  final VoidCallback? onOpenNotifications;
  final Widget accountMenu;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  color: branding.shellForeground,
                  fontWeight: FontWeight.w900,
                  height: 0.96,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: branding.shellMutedForeground,
                  height: 1.42,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _HeaderGlassChip(
                    branding: branding,
                    child: GestureDetector(
                      onTap: onOpenSalonProfile,
                      behavior: HitTestBehavior.opaque,
                      child: PressFeedback(
                        enabled: onOpenSalonProfile != null,
                        haptic: onOpenSalonProfile != null,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SalonBrandMark(
                              salonName: salonName,
                              branding: branding,
                              size: 24,
                              borderRadius: 9,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              salonName,
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    color: branding.shellForeground,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  _HeaderGlassChip(
                    branding: branding,
                    child: Text(
                      appBadgeLabel,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: branding.shellForeground,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  _HeaderGlassChip(
                    branding: branding,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        PulseDot(
                          size: 8,
                          active: liveActive,
                          color: liveActive
                              ? branding.primary
                              : branding.shellMutedForeground,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          liveSignalLabel,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: branding.shellForeground,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Column(
          children: [
            PressFeedback(
              enabled: onOpenNotifications != null,
              haptic: onOpenNotifications != null,
              child: IconButton(
                onPressed: onOpenNotifications,
                tooltip: 'Notificações',
                style: IconButton.styleFrom(
                  backgroundColor: branding.shellGlassBackground,
                  foregroundColor: branding.shellForeground,
                  side: BorderSide(color: branding.shellNavigationBorder),
                  minimumSize: const Size(48, 48),
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
                              color: branding.usesDarkShell
                                  ? const Color(0xFF1A110D)
                                  : Colors.white,
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
                                  color: branding.onPrimary,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            accountMenu,
          ],
        ),
      ],
    );
  }
}

class _HomeCommandDeck extends StatelessWidget {
  const _HomeCommandDeck({
    required this.branding,
    required this.salonName,
    required this.heroSubtitle,
    required this.leadMomentLabel,
    required this.attendanceLabel,
    required this.spotlightLabel,
    required this.onOpenAgenda,
    required this.onOpenGallery,
    this.onOpenNotifications,
  });

  final SalonBranding branding;
  final String salonName;
  final String heroSubtitle;
  final String leadMomentLabel;
  final String attendanceLabel;
  final String spotlightLabel;
  final VoidCallback onOpenAgenda;
  final VoidCallback onOpenGallery;
  final VoidCallback? onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final metrics = [
      (
        label: 'Próximo passo',
        value: leadMomentLabel,
        note: 'O melhor momento do salão aparece aqui primeiro.',
        icon: Icons.auto_awesome_rounded,
      ),
      (
        label: 'Seu ritmo',
        value: attendanceLabel,
        note: 'Uma leitura curta da sua agenda atual.',
        icon: Icons.schedule_rounded,
      ),
      (
        label: 'Sinais da marca',
        value: spotlightLabel,
        note: 'Novidades, alertas e vitrine no mesmo radar.',
        icon: Icons.bolt_rounded,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            branding.shellNavigationBackground,
            Color.lerp(branding.primary, Colors.white, 0.82)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: branding.shellNavigationBorder),
        boxShadow: [
          BoxShadow(
            color: branding.deep.withValues(alpha: 0.14),
            blurRadius: 28,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -52,
            right: -30,
            child: IgnorePointer(
              child: Container(
                width: 170,
                height: 170,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      branding.primary.withValues(alpha: 0.22),
                      branding.primary.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -34,
            left: -10,
            child: IgnorePointer(
              child: Container(
                width: 130,
                height: 130,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withValues(alpha: 0.18),
                      Colors.white.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 18),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 700;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Seu salão abriu em modo vitrine premium',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: branding.shellForeground,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '$salonName com contexto, ritmo e próxima ação na palma da mão.',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: branding.shellForeground,
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      heroSubtitle,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.shellMutedForeground,
                        height: 1.55,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        FilledButton.icon(
                          onPressed: onOpenAgenda,
                          style: FilledButton.styleFrom(
                            backgroundColor: branding.primary,
                            foregroundColor: branding.onPrimary,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                          ),
                          icon: const Icon(Icons.calendar_month_rounded),
                          label: const Text('Ver seus horários'),
                        ),
                        OutlinedButton.icon(
                          onPressed: onOpenGallery,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: branding.shellForeground,
                            side: BorderSide(color: branding.shellNavigationBorder),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                          ),
                          icon: const Icon(Icons.auto_awesome_mosaic_rounded),
                          label: const Text('Explorar vitrine'),
                        ),
                        if (onOpenNotifications != null)
                          OutlinedButton.icon(
                            onPressed: onOpenNotifications,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: branding.shellForeground,
                              side: BorderSide(
                                color: branding.shellNavigationBorder,
                              ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 18,
                                vertical: 14,
                              ),
                            ),
                            icon: const Icon(Icons.notifications_active_rounded),
                            label: const Text('Abrir alertas'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    if (isCompact)
                      Column(
                        children: [
                          for (var index = 0; index < metrics.length; index++) ...[
                            _HomeCommandMetricCard(
                              branding: branding,
                              label: metrics[index].label,
                              value: metrics[index].value,
                              note: metrics[index].note,
                              icon: metrics[index].icon,
                            ),
                            if (index != metrics.length - 1)
                              const SizedBox(height: 10),
                          ],
                        ],
                      )
                    else
                      Row(
                        children: [
                          for (var index = 0; index < metrics.length; index++) ...[
                            Expanded(
                              child: _HomeCommandMetricCard(
                                branding: branding,
                                label: metrics[index].label,
                                value: metrics[index].value,
                                note: metrics[index].note,
                                icon: metrics[index].icon,
                              ),
                            ),
                            if (index != metrics.length - 1)
                              const SizedBox(width: 10),
                          ],
                        ],
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeCommandMetricCard extends StatelessWidget {
  const _HomeCommandMetricCard({
    required this.branding,
    required this.label,
    required this.value,
    required this.note,
    required this.icon,
  });

  final SalonBranding branding;
  final String label;
  final String value;
  final String note;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: branding.usesDarkShell ? 0.08 : 0.76),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: branding.shellNavigationBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: branding.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: branding.shellForeground, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: branding.shellForeground,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(
              color: branding.shellForeground,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            note,
            style: theme.textTheme.bodySmall?.copyWith(
              color: branding.shellMutedForeground,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderGlassChip extends StatelessWidget {
  const _HeaderGlassChip({required this.branding, required this.child});

  final SalonBranding branding;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: branding.shellGlassBackground,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.shellNavigationBorder),
        boxShadow: [
          BoxShadow(
            color: branding.deep.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _HomeProfileAvatar extends StatelessWidget {
  const _HomeProfileAvatar({required this.branding, required this.label});

  final SalonBranding branding;
  final String label;

  @override
  Widget build(BuildContext context) {
    final initials = label
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.substring(0, 1).toUpperCase())
        .join();

    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: branding.heroGradient,
        shape: BoxShape.circle,
        border: Border.all(
          color: branding.usesDarkShell
              ? Colors.white.withValues(alpha: 0.12)
              : Colors.white,
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: branding.deep.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Center(
        child: Text(
          initials.isEmpty ? 'SF' : initials,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: branding.onPrimary,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
