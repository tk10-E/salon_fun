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
import '../widgets/salon_brand_mark.dart';
import '../widgets/salon_home_skeleton.dart';
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
    _tabController = TabController(length: 3, vsync: this)
      ..addListener(() {
        if (!_tabController.indexIsChanging) {
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

        return Scaffold(
          appBar: AppBar(
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
              IconButton(
                onPressed: data == null
                    ? null
                    : () {
                        unawaited(_openNotificationsCenter(data.notifications));
                      },
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
                            border: Border.all(color: Colors.white, width: 1.4),
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
                icon: const Icon(Icons.account_circle_outlined),
              ),
            ],
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: branding.primary,
              labelColor: branding.deep,
              tabs: const [
                Tab(text: 'Salão'),
                Tab(text: 'Feed'),
                Tab(text: 'Histórico'),
              ],
            ),
          ),
          body: AppBackdrop(
            branding: branding,
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
                    onConfirmAppointmentPresence: _confirmAppointmentPresence,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
