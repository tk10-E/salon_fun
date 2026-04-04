import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/notification_destination.dart';
import '../core/formatters.dart';
import '../core/pix_payload.dart';
import '../core/support_channel.dart';
import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../models/client_app_config.dart';
import '../screens/booking_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/trust_document_screen.dart';
import '../services/app_analytics_service.dart';
import '../theme/app_theme.dart';
import '../widgets/feed_post_media.dart';
import '../widgets/premium_ui.dart';

String formatManagedDepositProviderStatusLabel(String? status) {
  switch ((status ?? '').trim().toUpperCase()) {
    case 'PENDING':
      return 'Pix aguardando pagamento';
    case 'RECEIVED':
      return 'Pix recebido automaticamente';
    case 'CONFIRMED':
      return 'Pix confirmado pelo Asaas';
    case 'OVERDUE':
      return 'Pix vencido no Asaas';
    case 'REFUNDED':
      return 'Pix estornado no Asaas';
    default:
      return (status ?? '').trim().isEmpty
          ? 'Pix gerenciado pelo sistema'
          : 'Status Asaas: $status';
  }
}

enum _SalonSignalTone { brand, accent, success, warning }

class _SalonSignal {
  const _SalonSignal({
    required this.icon,
    required this.kicker,
    required this.title,
    required this.body,
    required this.happenedAt,
    required this.tone,
    required this.actionLabel,
    this.destinationTabIndex,
    this.opensNotificationsCenter = false,
    this.service,
  });

  final IconData icon;
  final String kicker;
  final String title;
  final String body;
  final DateTime happenedAt;
  final _SalonSignalTone tone;
  final String actionLabel;
  final int? destinationTabIndex;
  final bool opensNotificationsCenter;
  final ServiceItem? service;
}

List<_SalonSignal> _buildSalonSignals(HomeSnapshot data) {
  final serviceById = <String, ServiceItem>{
    for (final service in data.services) service.id: service,
  };
  final signals = <_SalonSignal>[];

  for (final notification in data.notifications.take(5)) {
    final destination = resolveNotificationDestination(notification.type);
    signals.add(
      _SalonSignal(
        icon: _notificationSignalIcon(notification.type),
        kicker: notification.isRead ? 'Mensagem do salão' : 'Novo aviso',
        title: notification.title,
        body: notification.body.trim().isEmpty
            ? 'O salão publicou uma nova atualização para você no app.'
            : notification.body,
        happenedAt: notification.createdAt,
        tone: _notificationSignalTone(notification.type),
        actionLabel: destination.actionLabel,
        destinationTabIndex: destination.tabIndex,
        opensNotificationsCenter: destination.opensNotificationsCenter,
      ),
    );
  }

  final nextAppointment = data.nextAppointment;
  if (nextAppointment != null) {
    final staffLabel = (nextAppointment.staffMemberName ?? '').trim().isEmpty
        ? ''
        : ' com ${nextAppointment.staffMemberName}';
    signals.add(
      _SalonSignal(
        icon: nextAppointment.requiresPresenceConfirmation
            ? Icons.verified_user_rounded
            : Icons.event_available_rounded,
        kicker: nextAppointment.requiresPresenceConfirmation
            ? 'Confirmação pendente'
            : 'Agenda confirmada',
        title: nextAppointment.serviceName,
        body:
            '${formatLongDate(nextAppointment.date)} às ${formatTime(nextAppointment.date)}$staffLabel.',
        happenedAt: nextAppointment.date,
        tone: nextAppointment.requiresPresenceConfirmation
            ? _SalonSignalTone.warning
            : _SalonSignalTone.brand,
        actionLabel: nextAppointment.requiresPresenceConfirmation
            ? 'Ver agenda'
            : 'Abrir agenda',
        destinationTabIndex: ClientShellTabIndex.appointments,
      ),
    );
  }

  for (final alert in data.vacancyAlerts.take(2)) {
    final relatedService = serviceById[alert.serviceId];
    signals.add(
      _SalonSignal(
        icon: Icons.flash_on_rounded,
        kicker: 'Encaixe liberado',
        title: alert.headline,
        body: alert.body.trim().isEmpty
            ? '${relatedService?.name ?? 'Um cuidado do salão'} abriu em ${formatLongDate(alert.startsAt)} às ${formatTime(alert.startsAt)}.'
            : alert.body,
        happenedAt: alert.createdAt,
        tone: _SalonSignalTone.success,
        actionLabel: relatedService == null ? 'Ver agenda' : 'Reservar encaixe',
        destinationTabIndex: relatedService == null
            ? ClientShellTabIndex.appointments
            : null,
        service: relatedService,
      ),
    );
  }

  final loyaltySummary = data.loyaltySummary;
  if (loyaltySummary?.lastRewardAt != null) {
    final rewardService = (loyaltySummary!.vipRewardServiceName ?? '').trim();
    signals.add(
      _SalonSignal(
        icon: Icons.workspace_premium_rounded,
        kicker: 'Recompensa do salão',
        title: rewardService.isEmpty
            ? 'Seu histórico já gerou benefício'
            : 'Benefício liberado: $rewardService',
        body: (loyaltySummary.programTitle ?? '').trim().isEmpty
            ? 'Seu saldo de pontos e recorrência já está sendo reconhecido pelo salão.'
            : '${loyaltySummary.programTitle} está liberando vantagens dentro do app.',
        happenedAt: loyaltySummary.lastRewardAt!,
        tone: _SalonSignalTone.accent,
        actionLabel: 'Ver benefícios',
        destinationTabIndex: ClientShellTabIndex.profile,
      ),
    );
  }

  final referralSummary = data.referralSummary;
  for (final unlock
      in referralSummary?.rewardUnlocks.take(2) ??
          const <ReferralRewardUnlockSummary>[]) {
    final rewardName =
        (unlock.rewardServiceName ?? unlock.rewardDescription ?? '').trim();
    signals.add(
      _SalonSignal(
        icon: Icons.card_giftcard_rounded,
        kicker: 'Indicação premiada',
        title: rewardName.isEmpty ? 'Nova recompensa disponível' : rewardName,
        body: rewardName.isEmpty
            ? 'Uma recompensa por indicação ficou disponível para você usar com o salão.'
            : 'Sua indicação liberou $rewardName dentro do app.',
        happenedAt: unlock.unlockedAt,
        tone: _SalonSignalTone.warning,
        actionLabel: 'Ver benefícios',
        destinationTabIndex: ClientShellTabIndex.profile,
      ),
    );
  }

  for (final post in data.posts.take(3)) {
    signals.add(
      _SalonSignal(
        icon: post.postType == 'reel'
            ? Icons.play_circle_fill_rounded
            : Icons.auto_awesome_rounded,
        kicker: post.postType == 'before_after'
            ? 'Resultado real'
            : 'Novo conteúdo',
        title: post.title,
        body: _buildPostSignalBody(post),
        happenedAt: post.createdAt,
        tone: _SalonSignalTone.accent,
        actionLabel: post.linkedService == null
            ? 'Abrir feed'
            : 'Reservar cuidado',
        destinationTabIndex: post.linkedService == null
            ? ClientShellTabIndex.feed
            : null,
        service: post.linkedService,
      ),
    );
  }

  signals.sort((left, right) => right.happenedAt.compareTo(left.happenedAt));
  return signals;
}

String _buildPostSignalBody(FeedPost post) {
  final caption = _normalizeFeedCaption(post, maxLength: 180);
  if (caption != null && caption.isNotEmpty) {
    return caption;
  }

  final parts = <String>[];
  if ((post.staffMemberName ?? '').trim().isNotEmpty) {
    parts.add('Publicado por ${post.staffMemberName}');
  }
  if (post.linkedService != null) {
    parts.add('conectado a ${post.linkedService!.name}');
  }
  if (post.commentCount > 0) {
    parts.add(
      '${post.commentCount} comentário${post.commentCount == 1 ? '' : 's'} no app',
    );
  }

  if (parts.isEmpty) {
    return 'O salão publicou um novo resultado para inspirar sua próxima reserva.';
  }

  return '${parts.join(' • ')}.';
}

IconData _notificationSignalIcon(String rawType) {
  final type = rawType.trim().toLowerCase();

  if (type == 'vacancy_alert') {
    return Icons.flash_on_rounded;
  }
  if (type.startsWith('appointment_')) {
    return Icons.calendar_month_rounded;
  }
  if (type == 'feed_post_published') {
    return Icons.photo_library_rounded;
  }
  if (type == 'winback_offer' ||
      type.startsWith('promotion_') ||
      type.startsWith('membership_')) {
    return Icons.local_offer_rounded;
  }
  if (type.startsWith('service_')) {
    return Icons.content_cut_rounded;
  }
  if (type.startsWith('referral_') || type.startsWith('loyalty_')) {
    return Icons.workspace_premium_rounded;
  }

  return Icons.notifications_active_rounded;
}

_SalonSignalTone _notificationSignalTone(String rawType) {
  final type = rawType.trim().toLowerCase();

  if (type == 'vacancy_alert') {
    return _SalonSignalTone.success;
  }
  if (type.startsWith('appointment_')) {
    return _SalonSignalTone.brand;
  }
  if (type == 'feed_post_published') {
    return _SalonSignalTone.accent;
  }
  if (type == 'winback_offer' ||
      type.startsWith('promotion_') ||
      type.startsWith('membership_')) {
    return _SalonSignalTone.warning;
  }
  if (type.startsWith('referral_') || type.startsWith('loyalty_')) {
    return _SalonSignalTone.accent;
  }

  return _SalonSignalTone.brand;
}

Color _resolveSalonSignalColor(BuildContext context, _SalonSignalTone tone) {
  final tokens = context.salonTheme;
  return switch (tone) {
    _SalonSignalTone.brand => tokens.brand,
    _SalonSignalTone.accent => tokens.accent,
    _SalonSignalTone.success => tokens.success,
    _SalonSignalTone.warning => tokens.warning,
  };
}

String _formatSalonSignalMoment(DateTime value) {
  if (value.isAfter(DateTime.now())) {
    return '${formatMediumDate(value)} • ${formatTime(value)}';
  }

  return formatRelativeFreshness(value);
}

Color _resolveCampaignColor(
  BuildContext context,
  SalonCentralCampaignPriority priority,
) {
  final tokens = context.salonTheme;
  switch (priority) {
    case SalonCentralCampaignPriority.high:
      return tokens.warning;
    case SalonCentralCampaignPriority.low:
      return tokens.accent;
    case SalonCentralCampaignPriority.medium:
      return tokens.brand;
  }
}

String _formatCampaignPriorityLabel(SalonCentralCampaignPriority priority) {
  switch (priority) {
    case SalonCentralCampaignPriority.high:
      return 'Alta prioridade';
    case SalonCentralCampaignPriority.low:
      return 'Baixa prioridade';
    case SalonCentralCampaignPriority.medium:
      return 'Prioridade media';
  }
}

String _formatCampaignTargetLabel(SalonCentralCampaignTarget target) {
  switch (target) {
    case SalonCentralCampaignTarget.appointments:
      return 'Abre agenda';
    case SalonCentralCampaignTarget.feed:
      return 'Abre feed';
    case SalonCentralCampaignTarget.profile:
      return 'Abre beneficios';
    case SalonCentralCampaignTarget.notifications:
      return 'Abre avisos';
    case SalonCentralCampaignTarget.support:
      return 'Abre suporte';
    case SalonCentralCampaignTarget.explore:
      return 'Abre reservar';
  }
}

String? _normalizeDisplayCopy(String? value, {int maxLength = 240}) {
  if (value == null) {
    return null;
  }

  final normalized = value
      .replaceAll(RegExp(r'[\r\n\t]+'), ' ')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();

  if (normalized.isEmpty) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return '${normalized.substring(0, maxLength).trimRight()}...';
}

final RegExp _displayUrlPattern = RegExp(
  r'((?:https?:\/\/)|(?:www\.))\S+',
  caseSensitive: false,
);

String? _normalizeFeedCaption(FeedPost post, {int maxLength = 220}) {
  final normalized = _normalizeDisplayCopy(post.caption, maxLength: 4000);
  if (normalized == null) {
    return null;
  }

  final withoutUrls = normalized
      .replaceAll(_displayUrlPattern, ' ')
      .replaceAll(RegExp(r'\s{2,}'), ' ')
      .trim();

  if (withoutUrls.isEmpty) {
    return null;
  }

  final normalizedTitle = _normalizeDisplayCopy(post.title, maxLength: 4000);
  if (normalizedTitle != null &&
      withoutUrls.toLowerCase() == normalizedTitle.toLowerCase()) {
    return null;
  }

  if (withoutUrls.length <= maxLength) {
    return withoutUrls;
  }

  return '${withoutUrls.substring(0, maxLength).trimRight()}...';
}

String _normalizeDisplayLabel(
  String? value, {
  required String fallback,
  int maxLength = 120,
}) {
  return _normalizeDisplayCopy(value, maxLength: maxLength) ?? fallback;
}

String _safeDisplayInitial(String? value, {String fallback = '?'}) {
  final normalized = _normalizeDisplayCopy(value, maxLength: 1);
  if (normalized == null) {
    return fallback;
  }

  return normalized.substring(0, 1).toUpperCase();
}

String _buildFeedPostMetaLine(FeedPost post) {
  final moment = formatDateTime(post.createdAt);

  if (post.isInstagramMention) {
    return 'Marcou o salão • $moment';
  }

  if (post.isOwnedInstagramPost) {
    return 'Instagram do salão • $moment';
  }

  if (post.isInstagramPost) {
    return 'Importado do Instagram • $moment';
  }

  return '${feedPostFormatLabel(post.postType)} • $moment';
}

String _formatProductStockLabel(RetailProduct product) {
  final digits = product.currentStock % 1 == 0 ? 0 : 2;
  final formatted = NumberFormat.decimalPatternDigits(
    locale: 'pt_BR',
    decimalDigits: digits,
  ).format(product.currentStock);
  return '$formatted ${product.unit}';
}

bool _canCheckoutRetailProduct(RetailProduct product) {
  final price = product.retailPrice;
  return price != null && price > 0 && product.currentStock >= 1;
}

int _resolveProductOrderLimit(RetailProduct product) {
  final stockUnits = product.currentStock.floor();
  final purchasableStock = stockUnits < 1 ? 1 : stockUnits;
  final purchaseLimit = product.maxSelectableQuantity;
  return purchasableStock < purchaseLimit ? purchasableStock : purchaseLimit;
}

String _formatStoreOrderStatusLabel(CustomerStoreOrder order) {
  switch (order.status) {
    case 'confirmed':
      return 'Confirmado';
    case 'ready':
      return 'Pronto para retirada';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Recebido pelo salão';
  }
}

Color _resolveStoreOrderTone(BuildContext context, CustomerStoreOrder order) {
  if (order.isCancelled) {
    return const Color(0xFFB86060);
  }
  if (order.isCompleted) {
    return context.salonTheme.success;
  }
  if (order.isReady) {
    return context.salonTheme.accent;
  }
  if (order.isConfirmed) {
    return context.salonTheme.brand;
  }

  return context.salonTheme.warning;
}

String _buildStoreOrderStatusSupportCopy(CustomerStoreOrder order) {
  if (order.isCancelled) {
    return order.cancellationReason?.trim().isNotEmpty == true
        ? 'Cancelado: ${order.cancellationReason}'
        : 'O pedido foi cancelado e o estoque voltou para a loja.';
  }
  if (order.isCompleted) {
    return 'Pedido concluído pelo salão e finalizado no app.';
  }
  if (order.isReady) {
    return 'Tudo pronto. O salão já pode entregar ou separar sua retirada.';
  }
  if (order.isConfirmed) {
    return 'O salão confirmou os itens e está preparando o pedido.';
  }

  return 'O salão já recebeu seu pedido e ainda pode confirmar os próximos passos.';
}

class _StoreCartEntry {
  const _StoreCartEntry({required this.product, required this.quantity});

  final RetailProduct product;
  final int quantity;

  double get subtotal => (product.retailPrice ?? 0) * quantity;

  _StoreCartEntry copyWith({RetailProduct? product, int? quantity}) {
    return _StoreCartEntry(
      product: product ?? this.product,
      quantity: quantity ?? this.quantity,
    );
  }
}

class _StoreCartCheckoutRequest {
  const _StoreCartCheckoutRequest({required this.items, this.notes});

  final List<_StoreCartEntry> items;
  final String? notes;
}

Future<void> _handleCentralCampaignAction({
  required CustomerProfile profile,
  required SalonCentralCampaign campaign,
  required Future<void> Function() onOpenNotifications,
  required ValueChanged<int> onNavigateToTab,
}) async {
  switch (campaign.ctaTarget) {
    case SalonCentralCampaignTarget.appointments:
      onNavigateToTab(ClientShellTabIndex.appointments);
      return;
    case SalonCentralCampaignTarget.feed:
      onNavigateToTab(ClientShellTabIndex.feed);
      return;
    case SalonCentralCampaignTarget.profile:
      onNavigateToTab(ClientShellTabIndex.profile);
      return;
    case SalonCentralCampaignTarget.notifications:
      await onOpenNotifications();
      return;
    case SalonCentralCampaignTarget.support:
      final supportChannel = resolveSalonSupportChannel(
        config: profile.salonClientAppConfig,
        salonWhatsappPhone: profile.salonWhatsappPhone,
      );
      if (supportChannel == null || supportChannel.url.trim().isEmpty) {
        onNavigateToTab(ClientShellTabIndex.profile);
        return;
      }

      await launchUrl(
        Uri.parse(supportChannel.url),
        mode: LaunchMode.externalApplication,
      );
      return;
    case SalonCentralCampaignTarget.explore:
      onNavigateToTab(ClientShellTabIndex.explore);
      return;
  }
}

bool _hasActiveBenefits(HomeSnapshot data) {
  return data.activeMemberships.isNotEmpty ||
      data.offers.isNotEmpty ||
      data.loyaltySummary != null ||
      data.referralSummary != null;
}

List<SalonCentralCampaign> _resolveVisibleCentralCampaigns({
  required SalonClientAppConfig config,
  required HomeSnapshot data,
  DateTime? referenceTime,
}) {
  final hasUpcomingAppointment = data.nextAppointment != null;
  final hasActiveBenefits = _hasActiveBenefits(data);

  return config.centralCampaigns
      .where(
        (campaign) => campaign.isVisibleFor(
          hasUpcomingAppointment: hasUpcomingAppointment,
          hasActiveBenefits: hasActiveBenefits,
          referenceTime: referenceTime,
        ),
      )
      .toList(growable: false);
}

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
  State<ClientShellScreen> createState() => ClientShellScreenState();
}

class ClientShellScreenState extends State<ClientShellScreen> {
  static const List<String> _tabScreenNames = <String>[
    'client_home',
    'client_explore',
    'client_appointments',
    'client_central',
    'client_profile',
  ];

  final AppAnalyticsService _analytics = AppAnalyticsService.instance;
  int _currentIndex = 0;
  int _refreshSeed = 0;
  final Map<String, _StoreCartEntry> _cartEntries = <String, _StoreCartEntry>{};
  bool _submittingStoreOrder = false;

  List<_StoreCartEntry> get _cartItems =>
      _cartEntries.values.toList(growable: false);

  int get _cartTotalItems =>
      _cartEntries.values.fold<int>(0, (total, item) => total + item.quantity);

  double get _cartSubtotal => _cartEntries.values.fold<double>(
    0,
    (total, item) => total + item.subtotal,
  );

  int cartQuantityForProduct(String productId) {
    return _cartEntries[productId]?.quantity ?? 0;
  }

  void addProductToCart(RetailProduct product, int quantity) {
    if (quantity <= 0 || !_canCheckoutRetailProduct(product)) {
      return;
    }

    final existing = _cartEntries[product.id];
    final nextQuantity = (existing?.quantity ?? 0) + quantity;
    final orderLimit = _resolveProductOrderLimit(product);
    final safeQuantity = nextQuantity.clamp(1, orderLimit);
    final hitLimit = safeQuantity < nextQuantity;

    setState(() {
      _cartEntries[product.id] = _StoreCartEntry(
        product: product,
        quantity: safeQuantity,
      );
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          hitLimit
              ? '${product.name} ficou com o limite maximo permitido no carrinho.'
              : '${product.name} foi adicionado ao carrinho.',
        ),
        action: SnackBarAction(
          label: 'Ver carrinho',
          onPressed: _openStoreCart,
        ),
      ),
    );
  }

  Future<void> _openStoreCart() async {
    if (_cartItems.isEmpty || _submittingStoreOrder) {
      return;
    }

    final checkoutRequest =
        await showModalBottomSheet<_StoreCartCheckoutRequest>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (context) => _StoreCartSheet(
            profile: widget.profile,
            initialItems: _cartItems,
          ),
        );

    if (checkoutRequest == null || checkoutRequest.items.isEmpty || !mounted) {
      return;
    }

    await _submitStoreOrder(checkoutRequest);
  }

  Future<void> _submitStoreOrder(_StoreCartCheckoutRequest request) async {
    setState(() => _submittingStoreOrder = true);
    try {
      final result = await widget.repository.submitStoreOrder(
        items: request.items
            .map(
              (item) => StoreOrderLineInput(
                productId: item.product.id,
                quantity: item.quantity,
              ),
            )
            .toList(growable: false),
        notes: request.notes,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _cartEntries.clear();
        _refreshSeed += 1;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Pedido #${result.orderNumber} enviado para ${widget.profile.salonName}.',
          ),
        ),
      );
      navigateToTab(ClientShellTabIndex.profile);
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submittingStoreOrder = false);
      }
    }
  }

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

  @override
  void initState() {
    super.initState();
    unawaited(_analytics.logScreenView(_tabScreenNames[_currentIndex]));
  }

  void navigateToTab(int index, {bool refresh = true}) {
    if (!mounted) {
      return;
    }

    final normalizedIndex = index.clamp(
      ClientShellTabIndex.home,
      ClientShellTabIndex.profile,
    );
    setState(() {
      _currentIndex = normalizedIndex;
      if (refresh) {
        _refreshSeed += 1;
      }
    });
    unawaited(_analytics.logScreenView(_tabScreenNames[normalizedIndex]));
  }

  Future<void> openNotificationDestination(
    CustomerNotificationItem item,
  ) async {
    final destination = resolveNotificationDestination(item.type);
    await _analytics.logNotificationCenterAction(
      type: item.type,
      target: destination.analyticsTarget,
    );

    if (destination.opensNotificationsCenter) {
      if (mounted) {
        setState(() => _refreshSeed += 1);
      }
      return;
    }

    navigateToTab(destination.tabIndex!);
  }

  Future<CustomerNotificationItem?> openNotificationsCenter() async {
    final navigator = Navigator.of(context);
    await _analytics.logNotificationCenterOpened();
    final selectedItem = await navigator.push<CustomerNotificationItem?>(
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(repository: widget.repository),
      ),
    );

    if (selectedItem != null) {
      await openNotificationDestination(selectedItem);
      return selectedItem;
    }

    if (mounted) {
      setState(() => _refreshSeed += 1);
    }

    return null;
  }

  Future<void> _openNotifications() async {
    await openNotificationsCenter();
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final pages = <Widget>[
      _HomeTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
        onOpenNotifications: _openNotifications,
        onNavigateToTab: navigateToTab,
        onAddProductToCart: addProductToCart,
        cartQuantityForProduct: cartQuantityForProduct,
        onOpenStoreCart: _openStoreCart,
      ),
      _ExploreTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
        onAddProductToCart: addProductToCart,
        cartQuantityForProduct: cartQuantityForProduct,
        onOpenStoreCart: _openStoreCart,
      ),
      _AppointmentsTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onRefreshRequested: () => setState(() => _refreshSeed += 1),
        onBrowseServices: () => navigateToTab(ClientShellTabIndex.explore),
      ),
      _FeedTab(
        repository: widget.repository,
        profile: widget.profile,
        refreshSeed: _refreshSeed,
        onOpenBooking: _openBooking,
        onOpenNotifications: _openNotifications,
        onNavigateToTab: navigateToTab,
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
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_cartItems.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: _StoreCartBar(
                totalItems: _cartTotalItems,
                subtotal: _cartSubtotal,
                busy: _submittingStoreOrder,
                onPressed: _openStoreCart,
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: tokens.outline.withValues(alpha: 0.75),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x1E000000),
                    blurRadius: 28,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28),
                child: NavigationBar(
                  selectedIndex: _currentIndex,
                  height: 76,
                  labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
                  onDestinationSelected: navigateToTab,
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.home_outlined),
                      selectedIcon: Icon(Icons.home_rounded),
                      label: 'Início',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.explore_outlined),
                      selectedIcon: Icon(Icons.explore_rounded),
                      label: 'Reservar',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.event_note_outlined),
                      selectedIcon: Icon(Icons.event_note_rounded),
                      label: 'Agenda',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.dynamic_feed_outlined),
                      selectedIcon: Icon(Icons.dynamic_feed_rounded),
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
          ),
        ],
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
    required this.onAddProductToCart,
    required this.cartQuantityForProduct,
    required this.onOpenStoreCart,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final Future<void> Function(ServiceItem service) onOpenBooking;
  final Future<void> Function() onOpenNotifications;
  final ValueChanged<int> onNavigateToTab;
  final void Function(RetailProduct product, int quantity) onAddProductToCart;
  final int Function(String productId) cartQuantityForProduct;
  final VoidCallback onOpenStoreCart;

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

  Future<void> _handleSalonSignal(_SalonSignal signal) async {
    if (signal.service != null) {
      await widget.onOpenBooking(signal.service!);
      return;
    }

    if (signal.opensNotificationsCenter) {
      await widget.onOpenNotifications();
      return;
    }

    if (signal.destinationTabIndex != null) {
      widget.onNavigateToTab(signal.destinationTabIndex!);
    }
  }

  String _resolvePrimaryCtaLabel(HomeSnapshot data) {
    final config = widget.profile.salonClientAppConfig;
    if ((config.primaryCtaLabel ?? '').trim().isNotEmpty) {
      return config.primaryCtaLabel!.trim();
    }

    switch (config.homeEmphasis) {
      case SalonHomeEmphasis.portfolio:
        return 'Abrir feed';
      case SalonHomeEmphasis.schedule:
        return data.nextAppointment == null ? 'Agendar agora' : 'Ver agenda';
      case SalonHomeEmphasis.benefits:
        return 'Ver benefícios';
      case SalonHomeEmphasis.services:
      case SalonHomeEmphasis.auto:
        return 'Agendar agora';
    }
  }

  Future<void> _handlePrimaryCta(HomeSnapshot data) async {
    final config = widget.profile.salonClientAppConfig;
    switch (config.homeEmphasis) {
      case SalonHomeEmphasis.portfolio:
        widget.onNavigateToTab(ClientShellTabIndex.feed);
        return;
      case SalonHomeEmphasis.schedule:
        if (data.nextAppointment != null) {
          widget.onNavigateToTab(ClientShellTabIndex.appointments);
          return;
        }
      case SalonHomeEmphasis.services:
      case SalonHomeEmphasis.auto:
        if (data.services.isNotEmpty) {
          await widget.onOpenBooking(data.services.first);
        }
        return;
      case SalonHomeEmphasis.benefits:
        widget.onNavigateToTab(ClientShellTabIndex.profile);
        return;
    }
  }

  String _resolveSecondaryPromptLabel(HomeSnapshot data) {
    final visibleCentralCampaigns = _resolveVisibleCentralCampaigns(
      config: widget.profile.salonClientAppConfig,
      data: data,
    );
    if (data.unreadNotificationsCount > 0) {
      return 'Ver avisos do salão';
    }

    if (data.nextAppointment != null) {
      return 'Ver agenda completa';
    }

    if (data.vacancyAlerts.isNotEmpty) {
      return 'Ver vaga liberada';
    }

    if (data.posts.isNotEmpty) {
      return 'Abrir feed do salão';
    }

    if (data.offers.isNotEmpty) {
      return 'Ver campanhas ativas';
    }

    if (visibleCentralCampaigns.isNotEmpty) {
      return visibleCentralCampaigns.first.resolvedActionLabel;
    }

    return 'Explorar o salão';
  }

  void _handleSecondaryPrompt(HomeSnapshot data) {
    final visibleCentralCampaigns = _resolveVisibleCentralCampaigns(
      config: widget.profile.salonClientAppConfig,
      data: data,
    );
    if (data.unreadNotificationsCount > 0) {
      widget.onNavigateToTab(ClientShellTabIndex.feed);
      return;
    }

    if (data.nextAppointment != null) {
      widget.onNavigateToTab(ClientShellTabIndex.appointments);
      return;
    }

    if (data.vacancyAlerts.isNotEmpty) {
      widget.onNavigateToTab(ClientShellTabIndex.appointments);
      return;
    }

    if (data.posts.isNotEmpty) {
      widget.onNavigateToTab(ClientShellTabIndex.feed);
      return;
    }

    if (visibleCentralCampaigns.isNotEmpty) {
      unawaited(
        _handleCentralCampaignAction(
          profile: widget.profile,
          campaign: visibleCentralCampaigns.first,
          onOpenNotifications: widget.onOpenNotifications,
          onNavigateToTab: widget.onNavigateToTab,
        ),
      );
      return;
    }

    widget.onNavigateToTab(ClientShellTabIndex.explore);
  }

  String _resolveHomeHeroTitle() {
    final config = widget.profile.salonClientAppConfig;
    return config.welcomeHeadline ??
        config.heroHeadline ??
        switch (config.experienceModel) {
          SalonExperienceModel.nailGallery =>
            'Escolha o visual e acompanhe tudo o que o salão liberar daqui.',
          SalonExperienceModel.barberHouse =>
            'Sua próxima passada na casa e os avisos do salão vivem aqui.',
          SalonExperienceModel.browsAtelier =>
            'Design, manutenção e resultados do salão num feed só.',
          SalonExperienceModel.aestheticClinic =>
            'Protocolos, agenda e comunicação do salão em leitura mais viva.',
          SalonExperienceModel.beautySignature || SalonExperienceModel.auto =>
            'Tudo o que o salão publicar para você agora vive aqui.',
        };
  }

  String _resolveHomeHeroSupport() {
    final config = widget.profile.salonClientAppConfig;
    return config.welcomeMessage ??
        config.heroSupportLine ??
        switch (config.experienceModel) {
          SalonExperienceModel.nailGallery =>
            'Galeria, agenda, benefícios e avisos do salão em uma experiência mais desejável.',
          SalonExperienceModel.barberHouse =>
            'Agenda, comunicação direta e vantagens da barbearia numa jornada mais forte.',
          SalonExperienceModel.browsAtelier =>
            'Cuidados autorais, retorno inteligente e relacionamento premium com leitura clara.',
          SalonExperienceModel.aestheticClinic =>
            'Cuidados, confirmações, campanhas e contexto do salão em um só lugar.',
          SalonExperienceModel.beautySignature || SalonExperienceModel.auto =>
            'Avisos, agenda, campanhas, benefícios e conteúdo do salão numa jornada só.',
        };
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
          final activeMemberships = data.activeMemberships;
          final membershipOffers = data.membershipOffers;
          final promotionOffers = data.promotionOffers;
          final compactHero = MediaQuery.sizeOf(context).width < 430;
          final prefersTabletVariant = MediaQuery.sizeOf(context).width >= 720;
          final nextAppointment = data.nextAppointment;
          final heroImage =
              config.resolveHeroImageForLayout(
                prefersTabletVariant: prefersTabletVariant,
              ) ??
              config.resolveGalleryCoverImageForLayout(
                prefersTabletVariant: prefersTabletVariant,
              ) ??
              (data.posts.isNotEmpty ? data.posts.first.coverImageUrl : null);
          final showShortcuts = config.showsHomeModule(
            SalonHomeModuleId.shortcuts,
          );
          final showNextBooking = config.showsHomeModule(
            SalonHomeModuleId.nextBooking,
          );
          final showProfessionals = config.showsHomeModule(
            SalonHomeModuleId.professionals,
          );
          final showGallery = config.showsHomeModule(SalonHomeModuleId.gallery);
          final showPromotions = config.showsHomeModule(
            SalonHomeModuleId.promotions,
          );
          final showProducts = config.showsHomeModule(
            SalonHomeModuleId.products,
          );
          final showLoyalty = config.showsHomeModule(SalonHomeModuleId.loyalty);
          final visibleCentralCampaigns = _resolveVisibleCentralCampaigns(
            config: config,
            data: data,
          );
          final compactMobile = MediaQuery.sizeOf(context).width < 430;
          final salonSignals = _buildSalonSignals(data);
          final primaryCtaLabel = _resolvePrimaryCtaLabel(data);
          final secondaryPromptLabel = _resolveSecondaryPromptLabel(data);

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                StaggerReveal(
                  key: ValueKey('home-header-${widget.refreshSeed}'),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 54,
                        height: 54,
                        decoration: BoxDecoration(
                          color: Color.alphaBlend(
                            context.salonTheme.brand.withValues(alpha: 0.12),
                            context.salonTheme.surfaceStrong,
                          ),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: context.salonTheme.brand.withValues(
                              alpha: 0.18,
                            ),
                          ),
                        ),
                        child: Center(
                          child: Text(
                            _safeDisplayInitial(
                              widget.profile.name,
                              fallback: 'C',
                            ),
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(color: context.salonTheme.brand),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${greetingForNow(DateTime.now())}, $firstName',
                              style: Theme.of(context).textTheme.headlineMedium,
                            ),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  widget.profile.salonName,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                _ContextChip(
                                  label: formatShortDate(DateTime.now()),
                                  backgroundColor: Color.alphaBlend(
                                    context.salonTheme.brand.withValues(
                                      alpha: 0.1,
                                    ),
                                    context.salonTheme.surfaceStrong,
                                  ),
                                  foregroundColor: context.salonTheme.brandDark,
                                ),
                              ],
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
                ..._buildOperationalNoticeWidgets(
                  scope: 'home',
                  refreshSeed: widget.refreshSeed,
                  view: view,
                  issues: data.issues,
                  onRetry: _reload,
                ),
                const SizedBox(height: 16),
                StaggerReveal(
                  key: ValueKey('home-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 110),
                  child: HeroImagePanel(
                    imageUrl: heroImage,
                    height: compactHero ? 430 : 340,
                    imageAlignment: Alignment(
                      config.normalizedHeroImageAlignmentX,
                      config.normalizedHeroImageAlignmentY,
                    ),
                    imageScale: config.resolvedHeroImageZoom,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final compactContent =
                            constraints.maxWidth < 340 ||
                            constraints.maxHeight < 320;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: compactContent ? 10 : 12,
                                vertical: compactContent ? 5 : 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                widget.profile.salonTagline ??
                                    'Experiência do salão',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: compactContent ? 11 : 14,
                                ),
                              ),
                            ),
                            SizedBox(height: compactContent ? 12 : 0),
                            if (!compactContent) const Spacer(),
                            Text(
                              _resolveHomeHeroTitle(),
                              maxLines: compactContent ? 3 : 5,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? Theme.of(
                                              context,
                                            ).textTheme.titleLarge
                                          : Theme.of(
                                              context,
                                            ).textTheme.displaySmall)
                                      ?.copyWith(color: Colors.white),
                            ),
                            SizedBox(height: compactContent ? 6 : 10),
                            Text(
                              _resolveHomeHeroSupport(),
                              maxLines: compactContent ? 3 : 5,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? Theme.of(
                                              context,
                                            ).textTheme.bodySmall
                                          : Theme.of(
                                              context,
                                            ).textTheme.bodyMedium)
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.85,
                                        ),
                                      ),
                            ),
                            SizedBox(height: compactContent ? 12 : 18),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: context.salonTheme.brandDark,
                                padding: EdgeInsets.symmetric(
                                  horizontal: compactContent ? 14 : 18,
                                  vertical: compactContent ? 10 : 12,
                                ),
                                visualDensity: compactContent
                                    ? VisualDensity.compact
                                    : VisualDensity.standard,
                              ),
                              onPressed: () => _handlePrimaryCta(data),
                              child: Text(primaryCtaLabel),
                            ),
                            SizedBox(height: compactContent ? 6 : 12),
                            TextButton.icon(
                              onPressed: () => _handleSecondaryPrompt(data),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.white,
                                padding: EdgeInsets.zero,
                                visualDensity: compactContent
                                    ? VisualDensity.compact
                                    : VisualDensity.standard,
                              ),
                              icon: const Icon(Icons.arrow_forward_rounded),
                              label: Text(secondaryPromptLabel),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                StaggerReveal(
                  key: ValueKey('home-journey-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 150),
                  child: _HomeJourneyCard(
                    profile: widget.profile,
                    data: data,
                    onOpenExplore: () =>
                        widget.onNavigateToTab(ClientShellTabIndex.explore),
                    onOpenAppointments: () => widget.onNavigateToTab(
                      ClientShellTabIndex.appointments,
                    ),
                    onOpenBenefits: () =>
                        widget.onNavigateToTab(ClientShellTabIndex.profile),
                    onOpenFeed: () =>
                        widget.onNavigateToTab(ClientShellTabIndex.feed),
                  ),
                ),
                if (visibleCentralCampaigns.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  StaggerReveal(
                    key: ValueKey('home-campaigns-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 180),
                    child: _PublishedCampaignsCard(
                      eyebrow: 'Publicado pelo salao',
                      title: 'O que o salao quer que voce veja agora',
                      subtitle:
                          'Mensagens operacionais e comerciais publicadas direto do painel com CTA para voce agir no momento certo.',
                      campaigns: visibleCentralCampaigns
                          .take(2)
                          .toList(growable: false),
                      compact: true,
                      onCampaignPressed: (campaign) {
                        unawaited(
                          _handleCentralCampaignAction(
                            profile: widget.profile,
                            campaign: campaign,
                            onOpenNotifications: widget.onOpenNotifications,
                            onNavigateToTab: widget.onNavigateToTab,
                          ),
                        );
                      },
                    ),
                  ),
                ],
                if (showShortcuts) ...[
                  const SizedBox(height: 16),
                  StaggerReveal(
                    key: ValueKey('home-metrics-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 210),
                    child: _HomeAtAGlanceCard(
                      data: data,
                      showLoyalty: showLoyalty,
                      onOpenExplore: () =>
                          widget.onNavigateToTab(ClientShellTabIndex.explore),
                      onOpenAppointments: () => widget.onNavigateToTab(
                        ClientShellTabIndex.appointments,
                      ),
                      onOpenProfile: () =>
                          widget.onNavigateToTab(ClientShellTabIndex.profile),
                      onOpenFeed: () =>
                          widget.onNavigateToTab(ClientShellTabIndex.feed),
                    ),
                  ),
                ],
                if (salonSignals.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-radar-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 240),
                    child: _HomeRelationshipRadarCard(
                      signals: salonSignals.take(3).toList(growable: false),
                      unreadNotificationsCount: data.unreadNotificationsCount,
                      campaignsCount:
                          promotionOffers.length +
                          visibleCentralCampaigns.length,
                      activeMembershipsCount: activeMemberships.length,
                      onOpenCentral: () =>
                          widget.onNavigateToTab(ClientShellTabIndex.feed),
                      onOpenNotifications: widget.onOpenNotifications,
                      onSignalPressed: (signal) {
                        unawaited(_handleSalonSignal(signal));
                      },
                    ),
                  ),
                ],
                if (showNextBooking && nextAppointment != null) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-next-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 260),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            eyebrow: 'Agenda viva',
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
                ] else if (showNextBooking &&
                    data.vacancyAlerts.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-vacancy-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 260),
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
                if (activeMemberships.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey(
                      'home-runtime-memberships-${widget.refreshSeed}',
                    ),
                    delay: const Duration(milliseconds: 290),
                    child: _ActiveMembershipsCard(
                      eyebrow: 'Saldo ativo',
                      title: 'Seus pacotes ativos',
                      subtitle:
                          'Tudo o que já está liberado para você usar com saldo, validade e leitura clara no app.',
                      memberships: activeMemberships
                          .take(3)
                          .toList(growable: false),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('home-services-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 320),
                  child: _SectionWithHorizontalList<ServiceItem>(
                    title: 'Serviços em destaque',
                    subtitle:
                        'Escolha seu próximo cuidado com preço, duração e leitura premium.',
                    items: data.services.take(5).toList(growable: false),
                    listHeight: 340,
                    emptyTitle: 'O catálogo ainda está em preparação',
                    emptyMessage:
                        'O salão ainda não publicou serviços neste app. Puxe para atualizar ou fale com a equipe para liberar a vitrine.',
                    emptyAction: OutlinedButton(
                      onPressed: _reload,
                      child: const Text('Atualizar catálogo'),
                    ),
                    itemBuilder: (service) => _ServicePreviewCard(
                      service: service,
                      onPressed: () => widget.onOpenBooking(service),
                    ),
                  ),
                ),
                if (showProfessionals && data.teamMembers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-team-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 320),
                    child: _SectionWithHorizontalList<TeamMember>(
                      title: 'Profissionais em evidência',
                      subtitle:
                          'Especialidades e leitura rápida de quem está por trás da experiência.',
                      items: data.teamMembers.take(6).toList(growable: false),
                      itemBuilder: (member) => _TeamMemberCard(member: member),
                    ),
                  ),
                ],
                if (showPromotions && membershipOffers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-memberships-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 350),
                    child: _CommercialOfferSpotlightCard(
                      eyebrow: 'Recorrência',
                      title: 'Clubes e pacotes do salão',
                      subtitle:
                          'Planos e combos que transformam retorno em rotina, sem conversa fora do app.',
                      offers: membershipOffers.take(2).toList(growable: false),
                      footerLabel: 'Abrir benefícios e perfil',
                      onFooterPressed: () =>
                          widget.onNavigateToTab(ClientShellTabIndex.profile),
                    ),
                  ),
                ],
                if (showPromotions && promotionOffers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-offers-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 350),
                    child: _CommercialOfferSpotlightCard(
                      title: 'Campanhas e oportunidades da semana',
                      subtitle: data.vacancyAlerts.isNotEmpty
                          ? 'Campanhas rápidas e encaixes ajudam o salão a ocupar horários fortes sem parecer apelativo.'
                          : config.promotionHeadline ??
                                'Tudo o que o painel publicar aparece aqui em uma vitrine mais desejável.',
                      offers: promotionOffers.take(3).toList(growable: false),
                      compactMobile: compactMobile,
                    ),
                  ),
                ],
                if (showProducts && data.products.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-products-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 380),
                    child: _SectionWithHorizontalList<RetailProduct>(
                      title: 'Loja do salão',
                      subtitle:
                          'Vitrine com fotos, carrinho e pedido sem sair do app.',
                      listHeight: 388,
                      items: data.products.take(6).toList(growable: false),
                      itemBuilder: (product) => _ProductCard(
                        product: product,
                        profile: widget.profile,
                        cartQuantity: widget.cartQuantityForProduct(product.id),
                        onAddToCart: (quantity) =>
                            widget.onAddProductToCart(product, quantity),
                        onOpenCart: widget.onOpenStoreCart,
                      ),
                    ),
                  ),
                ],
                if (showLoyalty &&
                    (data.loyaltySummary != null ||
                        data.referralSummary != null)) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-benefits-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 400),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            eyebrow: 'Benefícios',
                            title: 'Benefícios que o salão liberou',
                            subtitle:
                                'Pontos, cashback e indicações publicados pelo painel aparecem aqui em leitura rápida.',
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
                if (showGallery && data.posts.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('home-posts-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 410),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            eyebrow: 'Vitrine do salão',
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
                            onPressed: () => widget.onNavigateToTab(
                              ClientShellTabIndex.feed,
                            ),
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

class _HomeJourneyCard extends StatelessWidget {
  const _HomeJourneyCard({
    required this.profile,
    required this.data,
    required this.onOpenExplore,
    required this.onOpenAppointments,
    required this.onOpenBenefits,
    required this.onOpenFeed,
  });

  final CustomerProfile profile;
  final HomeSnapshot data;
  final VoidCallback onOpenExplore;
  final VoidCallback onOpenAppointments;
  final VoidCallback onOpenBenefits;
  final VoidCallback onOpenFeed;

  String _resolveTitle() {
    if (data.nextAppointment != null) {
      return 'Sua próxima visita já está organizada';
    }

    if (data.vacancyAlerts.isNotEmpty) {
      return 'Uma vaga abriu na hora certa';
    }

    if (data.activeMemberships.isNotEmpty) {
      return 'Seu saldo ativo já está no app';
    }

    if (data.membershipOffers.isNotEmpty) {
      return 'Seu salão já liberou clubes e pacotes no app';
    }

    if (data.offers.isNotEmpty) {
      return 'Seu salão já está trabalhando para te trazer de volta';
    }

    if (data.loyaltySummary != null || data.referralSummary != null) {
      return 'Seu histórico já pode virar vantagem no app';
    }

    return 'Seu próximo cuidado pode começar daqui';
  }

  String _resolveSubtitle() {
    final nextAppointment = data.nextAppointment;
    if (nextAppointment != null) {
      final staffLabel = nextAppointment.staffMemberName == null
          ? ''
          : ' com ${nextAppointment.staffMemberName}';
      return '${nextAppointment.serviceName} em ${formatLongDate(nextAppointment.date)} às ${formatTime(nextAppointment.date)}$staffLabel.';
    }

    if (data.vacancyAlerts.isNotEmpty) {
      final alert = data.vacancyAlerts.first;
      return '${alert.headline} em ${formatLongDate(alert.startsAt)} às ${formatTime(alert.startsAt)}.';
    }

    if (data.activeMemberships.isNotEmpty) {
      final membership = data.activeMemberships.first;
      return '${membership.title} já está ativo com ${membership.sessionsRemaining} sessão${membership.sessionsRemaining == 1 ? '' : 'ões'} restante${membership.sessionsRemaining == 1 ? '' : 's'} até ${formatShortDate(membership.expiresAt)}.';
    }

    if (data.membershipOffers.isNotEmpty) {
      final offer = data.membershipOffers.first;
      return '${offer.title} já aparece como clube ou pacote para facilitar rotina, retorno e previsibilidade no cuidado.';
    }

    if (data.offers.isNotEmpty) {
      final offer = data.offers.first;
      return '${offer.title} já aparece no app para facilitar retorno, plano e campanha sem conversa fora do sistema.';
    }

    if (data.posts.isNotEmpty) {
      return 'Resultados reais, agenda, benefícios e suporte do salão agora ficam juntos em uma experiência mais útil.';
    }

    return 'Agenda, benefícios, inspirações e perfil do salão agora ficam juntos em uma jornada mais clara para a cliente.';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final config = profile.salonClientAppConfig;
    final nextAppointment = data.nextAppointment;
    final loyalty = data.loyaltySummary;
    final referral = data.referralSummary;
    final supportChannel = resolveSalonSupportChannel(
      config: config,
      salonWhatsappPhone: profile.salonWhatsappPhone,
    );
    final addressLabel = (config.addressLabel ?? '').trim();
    final businessSegment = (profile.salonBusinessSegment ?? '').trim();
    final ratingLabel = config.ratingValue == null
        ? null
        : config.ratingCount == null
        ? config.ratingValue!.toStringAsFixed(1)
        : '${config.ratingValue!.toStringAsFixed(1)} • ${config.ratingCount} avaliações';
    final membershipOffers = data.membershipOffers;
    final promotionOffers = data.promotionOffers;
    final activeMemberships = data.activeMemberships;
    final hasBenefitsSurface =
        loyalty != null ||
        referral != null ||
        data.offers.isNotEmpty ||
        activeMemberships.isNotEmpty;
    final hasProfileContext =
        (profile.preferences?.trim().isNotEmpty ?? false) ||
        (profile.allergies?.trim().isNotEmpty ?? false) ||
        (profile.beautyProducts?.trim().isNotEmpty ?? false);
    final hasSalonAccessSurface =
        supportChannel != null ||
        addressLabel.isNotEmpty ||
        businessSegment.isNotEmpty ||
        ratingLabel != null;
    final metrics = <Widget>[
      if (nextAppointment != null)
        MetricPill(
          label: 'Próximo horário',
          value: formatDateTime(nextAppointment.date),
        )
      else if (data.vacancyAlerts.isNotEmpty)
        MetricPill(
          label: 'Vaga aberta',
          value: formatTime(data.vacancyAlerts.first.startsAt),
          toneColor: tokens.warning,
        ),
      if (loyalty != null)
        MetricPill(
          label: 'Pontos',
          value: '${loyalty.pointsBalance}',
          toneColor: tokens.accent,
        ),
      if (referral != null)
        MetricPill(
          label: 'Indicações',
          value: '${referral.qualifiedCount}',
          toneColor: tokens.warning,
        )
      else if (activeMemberships.isNotEmpty)
        MetricPill(
          label: 'Pacotes ativos',
          value: '${activeMemberships.length}',
          toneColor: tokens.brand,
        )
      else if (membershipOffers.isNotEmpty)
        MetricPill(
          label: 'Clubes',
          value: '${membershipOffers.length}',
          toneColor: tokens.brand,
        )
      else if (promotionOffers.isNotEmpty)
        MetricPill(
          label: 'Campanhas',
          value: '${promotionOffers.length}',
          toneColor: tokens.brand,
        ),
      if (data.posts.isNotEmpty)
        MetricPill(
          label: 'Resultados',
          value: '${data.posts.length}',
          toneColor: tokens.success,
        ),
    ].take(4).toList(growable: false);

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            eyebrow: 'Sua jornada',
            title: _resolveTitle(),
            subtitle: _resolveSubtitle(),
          ),
          if (metrics.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(spacing: 12, runSpacing: 12, children: metrics),
          ],
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 540;
              final itemWidth = compact
                  ? constraints.maxWidth
                  : (constraints.maxWidth - 12) / 2;

              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  SizedBox(
                    width: itemWidth,
                    child: _HomeActionTile(
                      icon: Icons.calendar_month_rounded,
                      title: 'Reservar agora',
                      description:
                          'Catálogo, horários e profissionais em poucos toques.',
                      onPressed: onOpenExplore,
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: _HomeActionTile(
                      icon: Icons.event_available_rounded,
                      title: nextAppointment != null
                          ? 'Minha agenda'
                          : 'Ver horários',
                      description: nextAppointment != null
                          ? 'Confirmação, sinal e detalhes do próximo atendimento.'
                          : 'Acompanhe encaixes e encontre seu próximo horário.',
                      onPressed: nextAppointment != null
                          ? onOpenAppointments
                          : onOpenExplore,
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: _HomeActionTile(
                      icon: hasBenefitsSurface
                          ? Icons.workspace_premium_rounded
                          : Icons.person_rounded,
                      title: hasBenefitsSurface ? 'Benefícios' : 'Meu perfil',
                      description: hasBenefitsSurface
                          ? 'Pontos, indicações e campanhas que incentivam seu retorno.'
                          : 'Seus dados e canais do salão organizados no mesmo lugar.',
                      onPressed: onOpenBenefits,
                    ),
                  ),
                  SizedBox(
                    width: itemWidth,
                    child: _HomeActionTile(
                      icon: Icons.dynamic_feed_rounded,
                      title: 'Feed do salão',
                      description:
                          data.posts.isNotEmpty || data.notifications.isNotEmpty
                          ? 'Antes e depois, novidades e marcações do Instagram no mesmo lugar.'
                          : 'Acompanhe tudo o que o salão começar a publicar no feed.',
                      onPressed: onOpenFeed,
                    ),
                  ),
                ],
              );
            },
          ),
          if (hasProfileContext) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Color.alphaBlend(
                  tokens.brand.withValues(alpha: 0.08),
                  tokens.surfaceStrong,
                ),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: tokens.brand.withValues(alpha: 0.18)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.favorite_outline_rounded, color: tokens.brand),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Seu histórico e suas preferências já ficam guardados no app para o salão te atender com mais contexto.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (hasSalonAccessSurface) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Color.alphaBlend(
                  tokens.accent.withValues(alpha: 0.08),
                  tokens.surfaceStrong,
                ),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: tokens.accent.withValues(alpha: 0.18),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Seu salão ao alcance',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Atendimento, localização e leitura rápida da marca sem precisar sair procurando no app.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      if (supportChannel != null)
                        _HomeRelationshipPill(
                          label: 'Canal oficial',
                          value: supportChannel.actionLabel,
                        ),
                      if (addressLabel.isNotEmpty)
                        _HomeRelationshipPill(
                          label: 'Unidade',
                          value: addressLabel,
                        ),
                      if (businessSegment.isNotEmpty)
                        _HomeRelationshipPill(
                          label: 'Especialidade',
                          value: businessSegment,
                        ),
                      if (ratingLabel != null)
                        _HomeRelationshipPill(
                          label: 'Avaliação',
                          value: ratingLabel,
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextButton.icon(
                    onPressed: onOpenBenefits,
                    icon: const Icon(Icons.arrow_forward_rounded),
                    label: const Text('Abrir perfil do salão'),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HomeAtAGlanceCard extends StatelessWidget {
  const _HomeAtAGlanceCard({
    required this.data,
    required this.showLoyalty,
    required this.onOpenExplore,
    required this.onOpenAppointments,
    required this.onOpenProfile,
    required this.onOpenFeed,
  });

  final HomeSnapshot data;
  final bool showLoyalty;
  final VoidCallback onOpenExplore;
  final VoidCallback onOpenAppointments;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenFeed;

  String _resolveTitle() {
    if (data.nextAppointment != null) {
      return 'Seu momento agora';
    }

    if (data.vacancyAlerts.isNotEmpty) {
      return 'Um encaixe abriu para você';
    }

    if (data.products.isNotEmpty) {
      return 'A loja do salão já está viva no app';
    }

    if (data.posts.isNotEmpty) {
      return 'O salão já está publicando resultado real';
    }

    return 'O salão já está montando sua próxima jornada';
  }

  String _resolveSubtitle() {
    final nextAppointment = data.nextAppointment;
    if (nextAppointment != null) {
      return 'Acompanhe agenda, feed, benefícios e tudo o que ficou mais relevante para sua próxima visita.';
    }

    if (data.vacancyAlerts.isNotEmpty) {
      return 'O app já destaca a oportunidade que combina com seu ritmo para você agir sem ficar caçando informação.';
    }

    if (data.products.isNotEmpty) {
      return 'Produtos, posts, serviços e campanhas já aparecem organizados na primeira dobra para a cliente decidir mais rápido.';
    }

    if (data.posts.isNotEmpty) {
      return 'Posts, reserva e sinais do salão agora se juntam numa home mais útil e mais editorial.';
    }

    return 'Serviços, agenda, relacionamento e contexto do salão em uma leitura mais clara desde a entrada do app.';
  }

  List<_HomeGlanceMetricData> _buildMetrics(BuildContext context) {
    final tokens = context.salonTheme;
    final metrics = <_HomeGlanceMetricData>[
      if (data.nextAppointment != null)
        _HomeGlanceMetricData(
          label: 'Próximo horário',
          value: formatTime(data.nextAppointment!.date),
          detail: formatShortDate(data.nextAppointment!.date),
          tone: tokens.brand,
          icon: Icons.event_available_rounded,
        )
      else if (data.vacancyAlerts.isNotEmpty)
        _HomeGlanceMetricData(
          label: 'Encaixe',
          value: formatTime(data.vacancyAlerts.first.startsAt),
          detail: 'Vaga liberada',
          tone: tokens.warning,
          icon: Icons.flash_on_rounded,
        ),
      _HomeGlanceMetricData(
        label: 'Feed',
        value: '${data.posts.length}',
        detail: data.posts.isEmpty
            ? 'Sem posts novos'
            : 'Resultados publicados',
        tone: tokens.success,
        icon: Icons.dynamic_feed_rounded,
      ),
      _HomeGlanceMetricData(
        label: 'Loja',
        value: '${data.products.length}',
        detail: data.products.isEmpty ? 'Sem produtos' : 'Itens no app',
        tone: tokens.accent,
        icon: Icons.shopping_bag_outlined,
      ),
      if (showLoyalty && data.loyaltySummary != null)
        _HomeGlanceMetricData(
          label: 'Pontos',
          value: '${data.loyaltySummary!.pointsBalance}',
          detail: 'Saldo atual',
          tone: tokens.brand,
          icon: Icons.workspace_premium_outlined,
        )
      else
        _HomeGlanceMetricData(
          label: 'Serviços',
          value: '${data.services.length}',
          detail: data.services.isEmpty ? 'Em preparação' : 'Para reservar',
          tone: tokens.brand,
          icon: Icons.design_services_outlined,
        ),
    ];

    return metrics.take(4).toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final metrics = _buildMetrics(context);
    final actions = <_HomeQuickActionData>[
      _HomeQuickActionData(
        label: 'Reservar',
        icon: Icons.calendar_month_rounded,
        onPressed: onOpenExplore,
      ),
      _HomeQuickActionData(
        label: data.nextAppointment != null ? 'Agenda' : 'Horários',
        icon: Icons.event_note_rounded,
        onPressed: data.nextAppointment != null
            ? onOpenAppointments
            : onOpenExplore,
      ),
      _HomeQuickActionData(
        label: 'Feed',
        icon: Icons.dynamic_feed_rounded,
        onPressed: onOpenFeed,
      ),
      _HomeQuickActionData(
        label: showLoyalty ? 'Benefícios' : 'Perfil',
        icon: showLoyalty
            ? Icons.workspace_premium_rounded
            : Icons.person_rounded,
        onPressed: onOpenProfile,
      ),
    ];

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            eyebrow: 'Agora no app',
            title: _resolveTitle(),
            subtitle: _resolveSubtitle(),
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 540;
              final itemWidth = compact
                  ? constraints.maxWidth
                  : (constraints.maxWidth - 12) / 2;

              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: metrics
                    .map(
                      (metric) => SizedBox(
                        width: itemWidth,
                        child: _HomeGlanceMetricTile(metric: metric),
                      ),
                    )
                    .toList(growable: false),
              );
            },
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) =>
                  _HomeQuickActionChip(action: actions[index]),
              separatorBuilder: (context, index) => const SizedBox(width: 10),
              itemCount: actions.length,
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeGlanceMetricData {
  const _HomeGlanceMetricData({
    required this.label,
    required this.value,
    required this.detail,
    required this.tone,
    required this.icon,
  });

  final String label;
  final String value;
  final String detail;
  final Color tone;
  final IconData icon;
}

class _HomeGlanceMetricTile extends StatelessWidget {
  const _HomeGlanceMetricTile({required this.metric});

  final _HomeGlanceMetricData metric;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          metric.tone.withValues(alpha: 0.08),
          tokens.surfaceStrong,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: metric.tone.withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Color.alphaBlend(
                metric.tone.withValues(alpha: 0.16),
                tokens.surfaceStrong,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(metric.icon, color: metric.tone),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  metric.label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.textMuted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  metric.value,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: metric.tone),
                ),
                const SizedBox(height: 4),
                Text(
                  metric.detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeQuickActionData {
  const _HomeQuickActionData({
    required this.label,
    required this.icon,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
}

class _HomeQuickActionChip extends StatelessWidget {
  const _HomeQuickActionChip({required this.action});

  final _HomeQuickActionData action;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: action.onPressed,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Color.alphaBlend(
              tokens.brand.withValues(alpha: 0.1),
              tokens.surfaceStrong,
            ),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: tokens.brand.withValues(alpha: 0.18)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(action.icon, size: 18, color: tokens.brandDark),
              const SizedBox(width: 8),
              Text(
                action.label,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: tokens.brandDark),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeActionTile extends StatelessWidget {
  const _HomeActionTile({
    required this.icon,
    required this.title,
    required this.description,
    required this.onPressed,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onPressed,
        child: Ink(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: tokens.outline),
            color: Color.alphaBlend(
              Colors.white.withValues(alpha: 0.34),
              tokens.surfaceStrong,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Color.alphaBlend(
                    tokens.brand.withValues(alpha: 0.12),
                    tokens.surfaceStrong,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: tokens.brand),
              ),
              const SizedBox(height: 14),
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 6),
              Text(
                description,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Text(
                    'Abrir',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.brand,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 18,
                    color: tokens.brand,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HomeRelationshipPill extends StatelessWidget {
  const _HomeRelationshipPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Container(
      constraints: const BoxConstraints(minWidth: 120, maxWidth: 220),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          Colors.white.withValues(alpha: 0.42),
          tokens.surfaceStrong,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _HomeRelationshipRadarCard extends StatelessWidget {
  const _HomeRelationshipRadarCard({
    required this.signals,
    required this.unreadNotificationsCount,
    required this.campaignsCount,
    required this.activeMembershipsCount,
    required this.onOpenCentral,
    required this.onOpenNotifications,
    required this.onSignalPressed,
  });

  final List<_SalonSignal> signals;
  final int unreadNotificationsCount;
  final int campaignsCount;
  final int activeMembershipsCount;
  final VoidCallback onOpenCentral;
  final Future<void> Function() onOpenNotifications;
  final ValueChanged<_SalonSignal> onSignalPressed;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            eyebrow: 'Feed vivo',
            title: 'O salão aparece aqui com posts e sinais reais',
            subtitle:
                'Posts, agenda, campanhas e prova social aparecem com leitura mais viva, sem se perder em telas soltas.',
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HomeRelationshipPill(
                label: 'Avisos',
                value: unreadNotificationsCount == 0
                    ? 'Sem pendências'
                    : '$unreadNotificationsCount novo${unreadNotificationsCount == 1 ? '' : 's'}',
              ),
              _HomeRelationshipPill(
                label: 'Campanhas',
                value: campaignsCount == 0
                    ? 'Aguardando novas'
                    : '$campaignsCount ativa${campaignsCount == 1 ? '' : 's'}',
              ),
              _HomeRelationshipPill(
                label: 'Benefícios',
                value: activeMembershipsCount == 0
                    ? 'Sem saldo ativo'
                    : '$activeMembershipsCount pacote${activeMembershipsCount == 1 ? '' : 's'}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          for (final signal in signals) ...[
            _SalonSignalTile(
              signal: signal,
              compact: true,
              onPressed: () => onSignalPressed(signal),
            ),
            if (signal != signals.last) const SizedBox(height: 12),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: onOpenCentral,
                icon: const Icon(Icons.dynamic_feed_rounded),
                label: const Text('Abrir feed'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  unawaited(onOpenNotifications());
                },
                icon: const Icon(Icons.notifications_none_rounded),
                label: Text(
                  unreadNotificationsCount > 0 ? 'Abrir avisos' : 'Ver avisos',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PublishedCampaignsCard extends StatelessWidget {
  const _PublishedCampaignsCard({
    required this.title,
    required this.subtitle,
    required this.campaigns,
    required this.onCampaignPressed,
    this.eyebrow,
    this.compact = false,
  });

  final String title;
  final String subtitle;
  final List<SalonCentralCampaign> campaigns;
  final ValueChanged<SalonCentralCampaign> onCampaignPressed;
  final String? eyebrow;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(eyebrow: eyebrow, title: title, subtitle: subtitle),
          const SizedBox(height: 16),
          for (final campaign in campaigns) ...[
            _PublishedCampaignTile(
              campaign: campaign,
              compact: compact,
              onPressed: () => onCampaignPressed(campaign),
            ),
            if (campaign != campaigns.last) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _PublishedCampaignTile extends StatelessWidget {
  const _PublishedCampaignTile({
    required this.campaign,
    required this.onPressed,
    this.compact = false,
  });

  final SalonCentralCampaign campaign;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final tone = _resolveCampaignColor(context, campaign.priority);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onPressed,
        child: Ink(
          padding: EdgeInsets.all(compact ? 14 : 16),
          decoration: BoxDecoration(
            color: Color.alphaBlend(
              tone.withValues(alpha: 0.08),
              tokens.surfaceStrong,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: tone.withValues(alpha: 0.16)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  StatusPill(
                    label: campaign.resolvedEyebrow,
                    icon: Icons.campaign_rounded,
                  ),
                  StatusPill(
                    label: _formatCampaignPriorityLabel(campaign.priority),
                    icon: Icons.priority_high_rounded,
                  ),
                  if ((campaign.campaignLabel ?? '').trim().isNotEmpty)
                    StatusPill(
                      label: campaign.campaignLabel!,
                      icon: Icons.local_offer_outlined,
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                campaign.title,
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                campaign.message,
                maxLines: compact ? 3 : 4,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    _formatCampaignTargetLabel(campaign.ctaTarget),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.textMuted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: onPressed,
                    style: TextButton.styleFrom(
                      foregroundColor: tone,
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                    ),
                    icon: const Icon(Icons.arrow_forward_rounded),
                    label: Text(campaign.resolvedActionLabel),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedHeroCard extends StatelessWidget {
  const _FeedHeroCard({
    required this.salonName,
    required this.heroImage,
    required this.compact,
    required this.postsCount,
    required this.beforeAfterCount,
    required this.reelsCount,
    required this.instagramCount,
    required this.onPrimaryAction,
    required this.primaryActionLabel,
    required this.onSecondaryAction,
    required this.secondaryActionLabel,
  });

  final String salonName;
  final String? heroImage;
  final bool compact;
  final int postsCount;
  final int beforeAfterCount;
  final int reelsCount;
  final int instagramCount;
  final VoidCallback onPrimaryAction;
  final String primaryActionLabel;
  final VoidCallback onSecondaryAction;
  final String secondaryActionLabel;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final ultraCompact = compact;
    final metrics = <Widget>[
      _FeedHeroMetricPill(
        label: 'Posts',
        value: '$postsCount',
        compact: ultraCompact,
      ),
      _FeedHeroMetricPill(
        label: 'Antes e depois',
        value: '$beforeAfterCount',
        compact: ultraCompact,
      ),
      _FeedHeroMetricPill(
        label: 'Reels',
        value: '$reelsCount',
        compact: ultraCompact,
      ),
      if (!ultraCompact)
        _FeedHeroMetricPill(
          label: 'Instagram',
          value: '$instagramCount',
          compact: false,
        ),
    ];

    return Container(
      decoration: BoxDecoration(
        gradient: tokens.heroGradient,
        borderRadius: BorderRadius.circular(34),
        boxShadow: const [
          BoxShadow(
            color: Color(0x26000000),
            blurRadius: 32,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(34),
        child: Stack(
          children: [
            if (heroImage != null)
              Positioned.fill(
                child: PremiumNetworkImage(
                  imageUrl: heroImage,
                  fit: BoxFit.cover,
                ),
              ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: <Color>[
                      Colors.black.withValues(alpha: 0.16),
                      Colors.black.withValues(alpha: 0.54),
                      Colors.black.withValues(alpha: 0.78),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(ultraCompact ? 18 : 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ultraCompact ? 10 : 12,
                      vertical: ultraCompact ? 6 : 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Feed do salão',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: ultraCompact ? 12 : 14,
                      ),
                    ),
                  ),
                  SizedBox(height: ultraCompact ? 18 : 24),
                  Text(
                    '$salonName em posts, antes e depois e marcações reais',
                    maxLines: ultraCompact ? 3 : 4,
                    overflow: TextOverflow.ellipsis,
                    style:
                        (ultraCompact
                                ? Theme.of(context).textTheme.titleLarge
                                : Theme.of(context).textTheme.displaySmall)
                            ?.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'O cliente acompanha aqui o que o salão publica no app e o que chega do Instagram: resultados, transformações, vídeos curtos e prova social com cara de vitrine premium.',
                    maxLines: ultraCompact ? 4 : 5,
                    overflow: TextOverflow.ellipsis,
                    style:
                        (ultraCompact
                                ? Theme.of(context).textTheme.bodySmall
                                : Theme.of(context).textTheme.bodyMedium)
                            ?.copyWith(
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                  ),
                  SizedBox(height: ultraCompact ? 14 : 16),
                  Wrap(spacing: 10, runSpacing: 10, children: metrics),
                  SizedBox(height: ultraCompact ? 12 : 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: tokens.brandDark,
                          visualDensity: ultraCompact
                              ? VisualDensity.compact
                              : VisualDensity.standard,
                        ),
                        onPressed: onPrimaryAction,
                        child: Text(primaryActionLabel),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.white,
                          visualDensity: ultraCompact
                              ? VisualDensity.compact
                              : VisualDensity.standard,
                        ),
                        onPressed: onSecondaryAction,
                        child: Text(secondaryActionLabel),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedHeroMetricPill extends StatelessWidget {
  const _FeedHeroMetricPill({
    required this.label,
    required this.value,
    required this.compact,
  });

  final String label;
  final String value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 12 : 14,
        vertical: compact ? 10 : 12,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.8),
              fontWeight: FontWeight.w700,
              fontSize: compact ? 11 : null,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style:
                (compact
                        ? Theme.of(context).textTheme.titleMedium
                        : Theme.of(context).textTheme.titleLarge)
                    ?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _FeedHighlightsStrip extends StatelessWidget {
  const _FeedHighlightsStrip({required this.posts});

  final List<FeedPost> posts;

  @override
  Widget build(BuildContext context) {
    final highlights = posts.take(6).toList(growable: false);
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            eyebrow: 'Em alta',
            title: 'Destaques do feed',
            subtitle:
                'Uma faixa rápida para navegar pelos formatos que o salão está publicando agora.',
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 124,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: highlights.length,
              separatorBuilder: (_, _) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final post = highlights[index];
                return _FeedHighlightBubble(post: post);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedHighlightBubble extends StatelessWidget {
  const _FeedHighlightBubble({required this.post});

  final FeedPost post;

  @override
  Widget build(BuildContext context) {
    final theme = context.salonTheme;
    final coverImage = post.coverImageUrl;
    final title = switch (post.postType) {
      'before_after' => 'Antes e depois',
      'reel' => 'Reels',
      _ when post.isInstagramMention => 'Marcou o salão',
      _ when post.isInstagramPost => 'Instagram',
      _ => 'Feed do salão',
    };
    final subtitle =
        _normalizeDisplayCopy(
          post.linkedService?.name ?? post.title,
          maxLength: 22,
        ) ??
        title;
    final bubbleTone = post.isInstagramPost
        ? const Color(0xFFE05D5D)
        : theme.brand;

    return SizedBox(
      width: 92,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: <Color>[
                  bubbleTone.withValues(alpha: 0.95),
                  theme.accent.withValues(alpha: 0.9),
                ],
              ),
            ),
            child: Container(
              width: 66,
              height: 66,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Theme.of(context).scaffoldBackgroundColor,
              ),
              child: Padding(
                padding: const EdgeInsets.all(3),
                child: ClipOval(
                  child: coverImage != null
                      ? PremiumNetworkImage(
                          imageUrl: coverImage,
                          fit: BoxFit.cover,
                          placeholder: _FeedHighlightPlaceholder(
                            label: subtitle,
                            tone: bubbleTone,
                          ),
                        )
                      : _FeedHighlightPlaceholder(
                          label: subtitle,
                          tone: bubbleTone,
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _FeedHighlightPlaceholder extends StatelessWidget {
  const _FeedHighlightPlaceholder({required this.label, required this.tone});

  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            tone.withValues(alpha: 0.9),
            tone.withValues(alpha: 0.55),
          ],
        ),
      ),
      child: Center(
        child: Text(
          _safeDisplayInitial(label, fallback: 'F'),
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(color: Colors.white),
        ),
      ),
    );
  }
}

class _FeedFilterBar extends StatelessWidget {
  const _FeedFilterBar({
    required this.filters,
    required this.activeFilter,
    required this.labelBuilder,
    required this.countBuilder,
    required this.onSelected,
  });

  final Iterable<_FeedFilter> filters;
  final _FeedFilter activeFilter;
  final String Function(_FeedFilter filter) labelBuilder;
  final int Function(_FeedFilter filter) countBuilder;
  final ValueChanged<_FeedFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final filter in filters) ...[
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: FilterChip(
                label: Text('${labelBuilder(filter)} ${countBuilder(filter)}'),
                selected: filter == activeFilter,
                onSelected: (_) => onSelected(filter),
                selectedColor: context.salonTheme.brand.withValues(alpha: 0.16),
                checkmarkColor: context.salonTheme.brand,
                labelStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: filter == activeFilter
                      ? context.salonTheme.brandDark
                      : null,
                ),
                side: BorderSide(color: context.salonTheme.outline),
                visualDensity: VisualDensity.compact,
                showCheckmark: false,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SalonSignalTile extends StatelessWidget {
  const _SalonSignalTile({
    required this.signal,
    required this.onPressed,
    this.compact = false,
  });

  final _SalonSignal signal;
  final VoidCallback onPressed;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final tone = _resolveSalonSignalColor(context, signal.tone);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onPressed,
        child: Ink(
          padding: EdgeInsets.all(compact ? 14 : 16),
          decoration: BoxDecoration(
            color: Color.alphaBlend(
              tone.withValues(alpha: 0.08),
              tokens.surfaceStrong,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: tone.withValues(alpha: 0.18)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: compact ? 40 : 44,
                    height: compact ? 40 : 44,
                    decoration: BoxDecoration(
                      color: Color.alphaBlend(
                        tone.withValues(alpha: 0.16),
                        tokens.surfaceStrong,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(signal.icon, color: tone),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          signal.kicker,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: tone,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          signal.title,
                          maxLines: compact ? 2 : 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _formatSalonSignalMoment(signal.happenedAt),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                signal.body,
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
              ),
              const SizedBox(height: 10),
              TextButton.icon(
                onPressed: onPressed,
                style: TextButton.styleFrom(
                  foregroundColor: tone,
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                icon: const Icon(Icons.arrow_forward_rounded),
                label: Text(signal.actionLabel),
              ),
            ],
          ),
        ),
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
    required this.onAddProductToCart,
    required this.cartQuantityForProduct,
    required this.onOpenStoreCart,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final Future<void> Function(ServiceItem service) onOpenBooking;
  final void Function(RetailProduct product, int quantity) onAddProductToCart;
  final int Function(String productId) cartQuantityForProduct;
  final VoidCallback onOpenStoreCart;

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
    final config = widget.profile.salonClientAppConfig;

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
          final membershipOffers = data.membershipOffers;
          final promotionOffers = data.promotionOffers;
          final compactMobile = MediaQuery.sizeOf(context).width < 430;
          final prefersTabletVariant = MediaQuery.sizeOf(context).width >= 720;

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                ..._buildOperationalNoticeWidgets(
                  scope: 'explore',
                  refreshSeed: widget.refreshSeed,
                  view: view,
                  issues: data.issues,
                  onRetry: _reload,
                ),
                StaggerReveal(
                  key: ValueKey('explore-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 80),
                  child: HeroImagePanel(
                    imageUrl:
                        config.resolveGalleryCoverImageForLayout(
                          prefersTabletVariant: prefersTabletVariant,
                        ) ??
                        config.resolveHeroImageForLayout(
                          prefersTabletVariant: prefersTabletVariant,
                        ),
                    height: 240,
                    imageAlignment: Alignment(
                      config.normalizedGalleryCoverAlignmentX,
                      config.normalizedGalleryCoverAlignmentY,
                    ),
                    imageScale: config.resolvedGalleryCoverImageZoom,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          switch (config.experienceModel) {
                            SalonExperienceModel.aestheticClinic =>
                              'Protocolos com contexto',
                            SalonExperienceModel.barberHouse =>
                              'Casa, agenda e estilo',
                            SalonExperienceModel.nailGallery =>
                              'Catálogo em clima de galeria',
                            SalonExperienceModel.browsAtelier =>
                              'Design e manutenção com contexto',
                            SalonExperienceModel.beautySignature ||
                            SalonExperienceModel.auto =>
                              'Reservar com contexto',
                          },
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                        ),
                        const Spacer(),
                        Text(
                          switch (config.experienceModel) {
                            SalonExperienceModel.aestheticClinic =>
                              'Protocolos, profissionais, campanhas e produtos numa jornada clínica mais clara.',
                            SalonExperienceModel.barberHouse =>
                              'Serviços, barbeiros, campanhas e produtos da casa na mesma leitura.',
                            SalonExperienceModel.nailGallery =>
                              'Portfólio, agenda, campanhas e produtos na mesma vitrine premium.',
                            SalonExperienceModel.browsAtelier =>
                              'Serviços, especialistas e relacionamento do salão numa jornada autoral.',
                            SalonExperienceModel.beautySignature ||
                            SalonExperienceModel.auto =>
                              'Catálogo, profissionais, campanhas e produtos na mesma jornada.',
                          },
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
                        if (data.services.isEmpty)
                          EmptyStateCard(
                            title: 'A vitrine ainda não foi publicada',
                            message:
                                'Assim que o salão liberar serviços, preços e duração, tudo aparece aqui com reserva em poucos toques.',
                            action: OutlinedButton(
                              onPressed: _reload,
                              child: const Text('Atualizar vitrine'),
                            ),
                          )
                        else
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final maxWidth = constraints.maxWidth;
                              final crossAxisCount = maxWidth < 430
                                  ? 1
                                  : maxWidth < 760
                                  ? 2
                                  : 3;
                              final mainAxisExtent = crossAxisCount == 1
                                  ? 324.0
                                  : 340.0;

                              return GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                itemCount: data.services.length,
                                gridDelegate:
                                    SliverGridDelegateWithFixedCrossAxisCount(
                                      crossAxisCount: crossAxisCount,
                                      crossAxisSpacing: 12,
                                      mainAxisSpacing: 12,
                                      mainAxisExtent: mainAxisExtent,
                                    ),
                                itemBuilder: (context, index) {
                                  final service = data.services[index];
                                  return _ServiceGridCard(
                                    service: service,
                                    onPressed: () =>
                                        widget.onOpenBooking(service),
                                  );
                                },
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
                if (membershipOffers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-memberships-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 290),
                    child: _CommercialOfferSpotlightCard(
                      eyebrow: 'Recorrência',
                      title: 'Clubes e pacotes em destaque',
                      subtitle:
                          'Planos e combos que o salão montou para manter constância, conveniência e valor percebido.',
                      offers: membershipOffers.take(3).toList(growable: false),
                      compactMobile: compactMobile,
                    ),
                  ),
                ],
                if (promotionOffers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-offers-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 290),
                    child: _CommercialOfferSpotlightCard(
                      title: 'Campanhas em evidência',
                      subtitle:
                          'Ofertas rápidas para aproveitar agenda, lançamentos e ocasiões específicas do salão.',
                      offers: promotionOffers.take(3).toList(growable: false),
                      compactMobile: compactMobile,
                    ),
                  ),
                ],
                if (data.products.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('explore-products-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 360),
                    child: _SectionWithHorizontalList<RetailProduct>(
                      title: 'Vitrine para levar para casa',
                      subtitle:
                          'Catálogo visual com galeria, carrinho e pedido dentro do app.',
                      listHeight: 388,
                      items: data.products.take(8).toList(growable: false),
                      itemBuilder: (product) => _ProductCard(
                        product: product,
                        profile: widget.profile,
                        cartQuantity: widget.cartQuantityForProduct(product.id),
                        onAddToCart: (quantity) =>
                            widget.onAddProductToCart(product, quantity),
                        onOpenCart: widget.onOpenStoreCart,
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

class _AppointmentsTab extends StatefulWidget {
  const _AppointmentsTab({
    required this.repository,
    required this.profile,
    required this.refreshSeed,
    required this.onRefreshRequested,
    required this.onBrowseServices,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final int refreshSeed;
  final VoidCallback onRefreshRequested;
  final VoidCallback onBrowseServices;

  @override
  State<_AppointmentsTab> createState() => _AppointmentsTabState();
}

class _AppointmentsTabState extends State<_AppointmentsTab> {
  late Future<CachedView<AppointmentsSnapshot>> _future;
  final ImagePicker _imagePicker = ImagePicker();

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

  String _resolveDepositReceiptExtension(XFile file) {
    final source = '${file.name} ${file.path}'.toLowerCase();
    if (source.contains('.png')) {
      return 'png';
    }
    if (source.contains('.webp')) {
      return 'webp';
    }
    if (source.contains('.heic')) {
      return 'heic';
    }
    if (source.contains('.heif')) {
      return 'heif';
    }

    return 'jpg';
  }

  String _resolveDepositReceiptContentType(XFile file) {
    switch (_resolveDepositReceiptExtension(file)) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heic':
        return 'image/heic';
      case 'heif':
        return 'image/heif';
      default:
        return 'image/jpeg';
    }
  }

  Future<void> _openDepositPaymentFlow(AppointmentItem item) async {
    final freshProfile = await widget.repository.getCustomerProfile();
    if (!mounted) {
      return;
    }
    final profile = freshProfile ?? widget.profile;
    final paymentMode = profile.bookingPolicyResolvedPaymentMode;
    final isManagedPix = paymentMode == 'asaas_pix';
    final pixReference = buildPixTransactionId(item.id);
    String? pixPayload;
    var managedChargeId = item.depositPaymentProviderChargeId;
    var managedProviderStatus = item.depositPaymentProviderStatus;
    var managedProviderPayload = item.depositPaymentProviderPayload;
    var managedProviderInvoiceUrl = item.depositPaymentProviderInvoiceUrl;
    var managedProviderLastSyncedAt = item.depositPaymentProviderLastSyncedAt;
    var managedProviderError = item.depositPaymentProviderError;

    if (paymentMode == 'pix') {
      try {
        pixPayload = buildPixCopyPaste(
          pixKey: profile.bookingPolicyPixKey ?? '',
          merchantName: profile.bookingPolicyPixRecipientName ?? '',
          merchantCity: profile.bookingPolicyPixRecipientCity ?? '',
          amount: item.depositAmount,
          description: 'Sinal ${profile.salonName}',
          transactionId: pixReference,
        );
      } catch (_) {
        pixPayload = null;
      }
    }

    if (isManagedPix &&
        (!item.hasManagedDepositCharge ||
            !item.hasManagedDepositPayload ||
            !item.hasManagedDepositInvoiceUrl)) {
      try {
        final charge = await widget.repository.createManagedDepositCharge(
          appointmentId: item.id,
        );
        managedChargeId = charge.providerChargeId;
        managedProviderStatus = charge.providerStatus;
        managedProviderPayload = charge.providerPayload;
        managedProviderInvoiceUrl = charge.providerInvoiceUrl;
        managedProviderLastSyncedAt = charge.providerLastSyncedAt;
        managedProviderError = charge.providerError;
        widget.onRefreshRequested();
        unawaited(_reload());
      } catch (error) {
        managedProviderError = error.toString();
      }
    }

    if (!mounted) {
      return;
    }

    final reported = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        var isSubmitting = false;
        var isUploadingReceipt = false;
        var isRefreshingManagedPix = false;

        Future<void> copyText(String text, String message) async {
          await Clipboard.setData(ClipboardData(text: text));
          if (!mounted) {
            return;
          }
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(message)));
        }

        Future<void> openExternalCheckout() async {
          final url = profile.bookingPolicyExternalCheckoutUrl?.trim();
          if (url == null || url.isEmpty) {
            return;
          }

          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        }

        Future<void> openManagedInvoice() async {
          final url = managedProviderInvoiceUrl?.trim();
          if (url == null || url.isEmpty) {
            return;
          }

          await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        }

        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> refreshManagedPix({bool forceRefresh = false}) async {
              if (isRefreshingManagedPix ||
                  isSubmitting ||
                  isUploadingReceipt) {
                return;
              }

              setModalState(() => isRefreshingManagedPix = true);

              try {
                final charge = await widget.repository
                    .createManagedDepositCharge(
                      appointmentId: item.id,
                      forceRefresh: forceRefresh,
                    );
                managedChargeId = charge.providerChargeId;
                managedProviderStatus = charge.providerStatus;
                managedProviderPayload = charge.providerPayload;
                managedProviderInvoiceUrl = charge.providerInvoiceUrl;
                managedProviderLastSyncedAt = charge.providerLastSyncedAt;
                managedProviderError = charge.providerError;
                if (!mounted || !context.mounted) {
                  return;
                }
                widget.onRefreshRequested();
                unawaited(_reload());
                setModalState(() => isRefreshingManagedPix = false);
              } catch (error) {
                if (!mounted || !context.mounted) {
                  return;
                }
                managedProviderError = error.toString();
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(error.toString())));
                setModalState(() => isRefreshingManagedPix = false);
              }
            }

            Future<void> uploadReceipt() async {
              if (isSubmitting || isUploadingReceipt) {
                return;
              }

              setModalState(() => isUploadingReceipt = true);

              try {
                final pickedFile = await _imagePicker.pickImage(
                  source: ImageSource.gallery,
                  imageQuality: 88,
                  maxWidth: 2000,
                );

                if (pickedFile == null) {
                  setModalState(() => isUploadingReceipt = false);
                  return;
                }

                final bytes = await pickedFile.readAsBytes();
                await widget.repository.submitAppointmentDepositReceipt(
                  appointmentId: item.id,
                  receiptBytes: bytes,
                  contentType: _resolveDepositReceiptContentType(pickedFile),
                  fileExtension: _resolveDepositReceiptExtension(pickedFile),
                  paymentMethod: paymentMode,
                  paymentReference: paymentMode == 'pix'
                      ? pixReference
                      : paymentMode == 'asaas_pix'
                      ? managedChargeId
                      : null,
                );
                if (!mounted || !sheetContext.mounted) {
                  return;
                }
                Navigator.of(sheetContext).pop(true);
              } catch (error) {
                if (!mounted || !context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text(error.toString())));
                setModalState(() => isUploadingReceipt = false);
              }
            }

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
                      'Pagar sinal',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      isManagedPix
                          ? 'Reserva de ${formatCurrency(item.depositAmount)} para ${item.serviceName}. O Pix dessa cobrança é acompanhado automaticamente e o sinal atualiza sozinho quando o Asaas confirmar o pagamento.'
                          : 'Reserva de ${formatCurrency(item.depositAmount)} para ${item.serviceName}. Depois do pagamento, avise a equipe por aqui para agilizar a validação.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    StatusPill(
                      label: profile.bookingPolicyDepositPaymentLabel,
                      icon: paymentMode == 'asaas_pix'
                          ? Icons.auto_awesome_rounded
                          : paymentMode == 'pix'
                          ? Icons.qr_code_rounded
                          : paymentMode == 'external_checkout'
                          ? Icons.open_in_new_rounded
                          : Icons.payments_outlined,
                    ),
                    if (paymentMode == 'asaas_pix') ...[
                      const SizedBox(height: 16),
                      Text(
                        'O Pix foi gerado para essa reserva e o salão recebe a confirmação automaticamente quando o webhook do Asaas responder.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if ((managedProviderStatus ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          '${formatManagedDepositProviderStatusLabel(managedProviderStatus)}${managedProviderLastSyncedAt != null ? ' em ${formatDateTime(managedProviderLastSyncedAt!)}.' : '.'}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      if ((managedProviderError ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Text(
                          managedProviderError!,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: context.salonTheme.warning),
                        ),
                      ],
                      if ((managedProviderPayload ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Center(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color: context.salonTheme.outline,
                              ),
                            ),
                            child: QrImageView(
                              data: managedProviderPayload!,
                              size: 220,
                              backgroundColor: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Escaneie o QR com o app do seu banco ou use o Pix copia e cola abaixo.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Pix copia e cola',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        SelectableText(
                          managedProviderPayload!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            FilledButton.tonal(
                              onPressed: () => copyText(
                                managedProviderPayload ?? '',
                                'Pix copia e cola copiado.',
                              ),
                              child: const Text('Copiar Pix'),
                            ),
                            if ((managedProviderInvoiceUrl ?? '')
                                .trim()
                                .isNotEmpty)
                              FilledButton.tonal(
                                onPressed: openManagedInvoice,
                                child: const Text('Abrir cobrança'),
                              ),
                            FilledButton.tonal(
                              onPressed: isRefreshingManagedPix
                                  ? null
                                  : () => refreshManagedPix(forceRefresh: true),
                              child: Text(
                                isRefreshingManagedPix
                                    ? 'Atualizando Pix...'
                                    : 'Atualizar Pix',
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        const SizedBox(height: 12),
                        Text(
                          'O Pix ainda está sendo preparado. Toque abaixo para sincronizar essa cobrança agora.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        FilledButton.tonal(
                          onPressed: isRefreshingManagedPix
                              ? null
                              : () => refreshManagedPix(forceRefresh: true),
                          child: Text(
                            isRefreshingManagedPix
                                ? 'Atualizando Pix...'
                                : 'Gerar Pix agora',
                          ),
                        ),
                      ],
                    ] else if (paymentMode == 'pix') ...[
                      const SizedBox(height: 16),
                      Text(
                        'Chave Pix',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      SelectableText(
                        profile.bookingPolicyPixKey ?? '',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Favorecido: ${profile.bookingPolicyPixRecipientName ?? profile.salonName}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      Text(
                        'Cidade: ${profile.bookingPolicyPixRecipientCity ?? ''}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Referência: $pixReference',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (pixPayload != null) ...[
                        const SizedBox(height: 12),
                        Center(
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color: context.salonTheme.outline,
                              ),
                            ),
                            child: QrImageView(
                              data: pixPayload,
                              size: 220,
                              backgroundColor: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Escaneie o QR com o app do seu banco ou use o Pix copia e cola abaixo.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Pix copia e cola',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        SelectableText(
                          pixPayload,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            FilledButton.tonal(
                              onPressed: () => copyText(
                                pixPayload ?? '',
                                'Pix copia e cola copiado.',
                              ),
                              child: const Text('Copiar Pix'),
                            ),
                            FilledButton.tonal(
                              onPressed: () => copyText(
                                profile.bookingPolicyPixKey ?? '',
                                'Chave Pix copiada.',
                              ),
                              child: const Text('Copiar chave'),
                            ),
                          ],
                        ),
                      ],
                    ] else if (paymentMode == 'external_checkout') ...[
                      const SizedBox(height: 16),
                      Text(
                        'O salão configurou um checkout externo para receber esse sinal.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonal(
                        onPressed: openExternalCheckout,
                        child: const Text('Abrir checkout'),
                      ),
                    ] else ...[
                      const SizedBox(height: 16),
                      Text(
                        'A cobrança do sinal segue pela operação do salão. Use as orientações abaixo para concluir o pagamento.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: 14),
                    Text(
                      'Comprovante visual',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      item.hasDepositReceipt
                          ? 'Comprovante enviado em ${formatDateTime(item.depositReceiptUploadedAt!)}. Você pode trocar a imagem se precisar.'
                          : isManagedPix
                          ? 'Se o banco já concluiu o Pix mas a confirmação ainda não chegou, você também pode anexar um comprovante para a equipe agir manualmente.'
                          : 'Anexe uma imagem do comprovante aqui para a equipe validar esse sinal mais rápido.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: isSubmitting || isUploadingReceipt
                          ? null
                          : uploadReceipt,
                      child: Text(
                        isUploadingReceipt
                            ? 'Enviando comprovante...'
                            : item.hasDepositReceipt
                            ? 'Trocar comprovante'
                            : 'Enviar comprovante',
                      ),
                    ),
                    if ((profile.bookingPolicyPaymentInstructions ?? '')
                        .trim()
                        .isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text(
                        profile.bookingPolicyPaymentInstructions!,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (item.hasCustomerReportedDepositPayment) ...[
                      const SizedBox(height: 14),
                      Text(
                        'Pagamento já informado à equipe em ${formatDateTime(item.depositCustomerReportedPaidAt!)}.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        if (!isManagedPix)
                          FilledButton(
                            onPressed:
                                isSubmitting ||
                                    isUploadingReceipt ||
                                    item.hasCustomerReportedDepositPayment
                                ? null
                                : () async {
                                    setModalState(() => isSubmitting = true);
                                    try {
                                      await widget.repository
                                          .reportAppointmentDepositPaid(
                                            appointmentId: item.id,
                                            paymentMethod: paymentMode,
                                            paymentReference:
                                                paymentMode == 'pix'
                                                ? pixReference
                                                : null,
                                          );
                                      if (!mounted || !sheetContext.mounted) {
                                        return;
                                      }
                                      Navigator.of(sheetContext).pop(true);
                                    } catch (error) {
                                      if (!mounted || !context.mounted) {
                                        return;
                                      }
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(
                                          content: Text(error.toString()),
                                        ),
                                      );
                                      setModalState(() => isSubmitting = false);
                                    }
                                  },
                            child: Text(
                              item.hasCustomerReportedDepositPayment
                                  ? 'Pagamento informado'
                                  : isSubmitting
                                  ? 'Enviando...'
                                  : 'Ja paguei',
                            ),
                          ),
                        FilledButton.tonal(
                          onPressed: () =>
                              Navigator.of(sheetContext).pop(false),
                          child: const Text('Fechar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (reported != true || !mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Atualização enviada. A equipe vai validar o sinal.'),
      ),
    );
    widget.onRefreshRequested();
    await _reload();
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
          final nextAppointment = upcoming.isEmpty ? null : upcoming.first;
          final remainingUpcoming = upcoming.length > 1
              ? upcoming.skip(1).toList(growable: false)
              : const <AppointmentItem>[];
          final history = data.appointments
              .where((item) => !item.isUpcoming)
              .toList(growable: false);
          final compactMobile = MediaQuery.sizeOf(context).width < 430;
          final visibleHistory = compactMobile
              ? history.take(3).toList(growable: false)
              : history.take(10).toList(growable: false);

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                ..._buildOperationalNoticeWidgets(
                  scope: 'appointments',
                  refreshSeed: widget.refreshSeed,
                  view: view,
                  issues: data.issues,
                  onRetry: _reload,
                ),
                StaggerReveal(
                  key: ValueKey('appointments-summary-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 40),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          eyebrow: 'Panorama',
                          title: 'Sua jornada na agenda',
                          subtitle:
                              'O que pede atenção agora, o que já está confirmado e o que pode virar oportunidade.',
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            MetricPill(
                              label: 'Próximos horários',
                              value: '${upcoming.length}',
                            ),
                            MetricPill(
                              label: 'Histórico',
                              value: '${history.length}',
                              toneColor: context.salonTheme.accent,
                            ),
                            MetricPill(
                              label: 'Encaixes abertos',
                              value: '${data.vacancyAlerts.length}',
                              toneColor: context.salonTheme.warning,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          nextAppointment != null
                              ? 'Seu próximo compromisso já está na agenda. Se o salão pediu confirmação, resolva por aqui em poucos toques.'
                              : data.vacancyAlerts.isNotEmpty
                              ? 'Você não tem horário futuro, mas o salão liberou encaixe agora.'
                              : 'Sua agenda está livre. Quando quiser voltar, o catálogo do salão já está pronto.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
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
                        SectionHeader(
                          title: nextAppointment == null
                              ? 'Próximos horários'
                              : 'Seu próximo horário',
                          subtitle: nextAppointment == null
                              ? 'Seu calendário vivo com confirmação e cancelamento quando necessário.'
                              : 'O compromisso que está mais perto fica em destaque para você resolver tudo daqui.',
                        ),
                        const SizedBox(height: 16),
                        if (nextAppointment == null)
                          EmptyStateCard(
                            eyebrow: 'Agenda livre',
                            icon: Icons.calendar_month_rounded,
                            title: 'Nenhum horário futuro',
                            message:
                                'Assim que você reservar pelo app, seus compromissos aparecem aqui.',
                            action: OutlinedButton(
                              onPressed: widget.onBrowseServices,
                              child: const Text('Explorar catálogo'),
                            ),
                          )
                        else
                          _AppointmentCard(
                            appointment: nextAppointment,
                            onPayDeposit: nextAppointment.hasPendingDeposit
                                ? () => _openDepositPaymentFlow(nextAppointment)
                                : null,
                            onCancel: nextAppointment.canBeCancelled
                                ? () => _cancelAppointment(nextAppointment)
                                : null,
                            onConfirmPresence:
                                nextAppointment.requiresPresenceConfirmation
                                ? () => _confirmPresence(nextAppointment)
                                : null,
                          ),
                      ],
                    ),
                  ),
                ),
                if (remainingUpcoming.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey(
                      'appointments-upcoming-rest-${widget.refreshSeed}',
                    ),
                    delay: const Duration(milliseconds: 175),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            title: 'Mais na sua agenda',
                            subtitle:
                                'Os próximos compromissos ficam organizados aqui, sem competir com o principal.',
                          ),
                          const SizedBox(height: 16),
                          for (final appointment in remainingUpcoming) ...[
                            _AppointmentCard(
                              appointment: appointment,
                              onPayDeposit: appointment.hasPendingDeposit
                                  ? () => _openDepositPaymentFlow(appointment)
                                  : null,
                              onCancel: appointment.canBeCancelled
                                  ? () => _cancelAppointment(appointment)
                                  : null,
                              onConfirmPresence:
                                  appointment.requiresPresenceConfirmation
                                  ? () => _confirmPresence(appointment)
                                  : null,
                            ),
                            if (appointment != remainingUpcoming.last)
                              const SizedBox(height: 12),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('appointments-history-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 210),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          eyebrow: 'Arquivo pessoal',
                          title: 'Histórico',
                          subtitle:
                              'Visitas concluídas, canceladas e tudo o que já passou pelo salão.',
                        ),
                        const SizedBox(height: 16),
                        if (history.isEmpty)
                          const EmptyStateCard(
                            eyebrow: 'Primeira visita',
                            icon: Icons.history_toggle_off_rounded,
                            title: 'Sem histórico ainda',
                            message:
                                'Depois da primeira visita concluída, esta área vira seu arquivo de cuidado.',
                          )
                        else
                          for (final appointment in visibleHistory) ...[
                            _HistoryAppointmentTile(appointment: appointment),
                            if (appointment != visibleHistory.last)
                              const SizedBox(height: 12),
                          ],
                        if (history.length > visibleHistory.length) ...[
                          const SizedBox(height: 14),
                          Text(
                            'Mostrando ${visibleHistory.length} de ${history.length} visita${history.length == 1 ? '' : 's'} para manter a agenda leve no celular.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
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
  State<_FeedTab> createState() => _FeedTabState();
}

enum _FeedFilter { all, instagram, beforeAfter, reels, salon }

class _FeedTabState extends State<_FeedTab> {
  bool _isLoading = true;
  Object? _error;
  List<FeedPost> _posts = const [];
  CachedView<FeedSnapshot>? _snapshot;
  _FeedFilter _activeFilter = _FeedFilter.all;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant _FeedTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshSeed != widget.refreshSeed ||
        oldWidget.profile.id != widget.profile.id) {
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
        customerId: widget.profile.id,
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
          customerId: widget.profile.id,
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

  Future<void> _openExternalPost(FeedPost post) async {
    final permalink = post.externalPermalink?.trim();
    if (permalink == null || permalink.isEmpty) {
      return;
    }

    await launchUrl(Uri.parse(permalink), mode: LaunchMode.externalApplication);
  }

  bool _matchesFilter(FeedPost post, _FeedFilter filter) {
    switch (filter) {
      case _FeedFilter.all:
        return true;
      case _FeedFilter.instagram:
        return post.isInstagramPost;
      case _FeedFilter.beforeAfter:
        return post.postType == 'before_after';
      case _FeedFilter.reels:
        return post.postType == 'reel';
      case _FeedFilter.salon:
        return !post.isInstagramPost;
    }
  }

  String _filterLabel(_FeedFilter filter) {
    switch (filter) {
      case _FeedFilter.all:
        return 'Tudo';
      case _FeedFilter.instagram:
        return 'Instagram';
      case _FeedFilter.beforeAfter:
        return 'Antes e depois';
      case _FeedFilter.reels:
        return 'Reels';
      case _FeedFilter.salon:
        return 'Salão';
    }
  }

  String _emptyFilterTitle(_FeedFilter filter) {
    switch (filter) {
      case _FeedFilter.all:
        return 'O feed ainda está vazio';
      case _FeedFilter.instagram:
        return 'Nenhum post do Instagram por aqui';
      case _FeedFilter.beforeAfter:
        return 'Sem antes e depois no momento';
      case _FeedFilter.reels:
        return 'Sem vídeos curtos publicados';
      case _FeedFilter.salon:
        return 'Sem posts nativos do salão';
    }
  }

  String _emptyFilterMessage(_FeedFilter filter) {
    switch (filter) {
      case _FeedFilter.all:
        return 'Assim que o salão publicar novos conteúdos, eles aparecem aqui.';
      case _FeedFilter.instagram:
        return 'Quando o salão for marcado ou puxar conteúdos do Instagram, eles entram nesta visão.';
      case _FeedFilter.beforeAfter:
        return 'Os resultados comparativos entram aqui quando o salão publicar transformações no feed.';
      case _FeedFilter.reels:
        return 'Quando entrarem vídeos curtos do salão, este filtro ganha movimento.';
      case _FeedFilter.salon:
        return 'Os posts produzidos direto no app aparecem aqui quando o salão publicar novos materiais.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalLikes = _posts.fold<int>(0, (sum, post) => sum + post.likeCount);
    final totalComments = _posts.fold<int>(
      0,
      (sum, post) => sum + post.commentCount,
    );
    final reelsCount = _posts.where((post) => post.postType == 'reel').length;
    final beforeAfterCount = _posts
        .where((post) => post.postType == 'before_after')
        .length;
    final instagramCount = _posts.where((post) => post.isInstagramPost).length;
    final latestPost = _posts.isEmpty ? null : _posts.first;
    final visiblePosts = _posts
        .where((post) => _matchesFilter(post, _activeFilter))
        .toList(growable: false);
    final compactHero = MediaQuery.sizeOf(context).width < 430;
    final prefersTabletVariant = MediaQuery.sizeOf(context).width >= 720;
    final config = widget.profile.salonClientAppConfig;
    final heroImage =
        latestPost?.coverImageUrl ??
        config.resolveGalleryCoverImageForLayout(
          prefersTabletVariant: prefersTabletVariant,
        ) ??
        config.resolveHeroImageForLayout(
          prefersTabletVariant: prefersTabletVariant,
        );
    final primaryActionLabel = latestPost?.linkedService != null
        ? 'Reservar destaque'
        : 'Ver avisos';
    final VoidCallback primaryAction = latestPost?.linkedService != null
        ? () {
            unawaited(widget.onOpenBooking(latestPost!.linkedService!));
          }
        : () {
            unawaited(widget.onOpenNotifications());
          };
    final secondaryActionLabel = 'Explorar catálogo';
    void secondaryAction() {
      widget.onNavigateToTab(ClientShellTabIndex.explore);
    }

    final body = _isLoading
        ? const LoadingView(label: 'Sincronizando feed do salão...')
        : _error != null
        ? ErrorStateCard(message: _error.toString(), onRetry: _load)
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (_snapshot != null)
                  ..._buildOperationalNoticeWidgets(
                    scope: 'feed',
                    refreshSeed: widget.refreshSeed,
                    view: _snapshot!,
                    issues: _snapshot!.data.issues,
                    onRetry: _load,
                  ),
                StaggerReveal(
                  key: ValueKey('feed-hero-${widget.refreshSeed}'),
                  child: _FeedHeroCard(
                    salonName: widget.profile.salonName,
                    heroImage: heroImage,
                    compact: compactHero,
                    postsCount: _posts.length,
                    beforeAfterCount: beforeAfterCount,
                    reelsCount: reelsCount,
                    instagramCount: instagramCount,
                    onPrimaryAction: primaryAction,
                    primaryActionLabel: primaryActionLabel,
                    onSecondaryAction: secondaryAction,
                    secondaryActionLabel: secondaryActionLabel,
                  ),
                ),
                if (_posts.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  StaggerReveal(
                    key: ValueKey('feed-highlights-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 55),
                    child: _FeedHighlightsStrip(posts: _posts),
                  ),
                ],
                const SizedBox(height: 16),
                if (_posts.isEmpty)
                  EmptyStateCard(
                    eyebrow: 'Feed em preparação',
                    title: 'O feed do salão ainda está começando',
                    message:
                        'Quando o salão publicar fotos, antes e depois, Reels ou importar marcações do Instagram, tudo aparece aqui com cara de vitrine social.',
                    action: OutlinedButton(
                      onPressed: _load,
                      child: const Text('Atualizar feed'),
                    ),
                  )
                else ...[
                  StaggerReveal(
                    key: ValueKey('feed-posts-header-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 90),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SectionHeader(
                            eyebrow: instagramCount > 0
                                ? 'Feed social'
                                : 'Vitrine visual',
                            title: 'Feed do salão',
                            subtitle: instagramCount > 0
                                ? 'Antes e depois, posts do salão e marcações do Instagram aparecem juntos numa linha editorial viva.'
                                : 'Resultados reais do salão para inspirar, construir confiança e puxar reservas.',
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              MetricPill(
                                label: 'Posts',
                                value: '${_posts.length}',
                              ),
                              MetricPill(
                                label: 'Curtidas',
                                value: '$totalLikes',
                                toneColor: const Color(0xFFD75D7A),
                              ),
                              MetricPill(
                                label: 'Comentários',
                                value: '$totalComments',
                                toneColor: context.salonTheme.accent,
                              ),
                              MetricPill(
                                label: 'Instagram',
                                value: '$instagramCount',
                                toneColor: const Color(0xFFE05D5D),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          _FeedFilterBar(
                            filters: _FeedFilter.values,
                            activeFilter: _activeFilter,
                            labelBuilder: _filterLabel,
                            countBuilder: (filter) => _posts
                                .where((post) => _matchesFilter(post, filter))
                                .length,
                            onSelected: (filter) {
                              setState(() {
                                _activeFilter = filter;
                              });
                            },
                          ),
                          const SizedBox(height: 12),
                          Text(
                            visiblePosts.length == _posts.length
                                ? 'Mostrando ${_posts.length} posts no ritmo do salão.'
                                : 'Mostrando ${visiblePosts.length} de ${_posts.length} posts neste filtro.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (visiblePosts.isEmpty)
                    EmptyStateCard(
                      eyebrow: _filterLabel(_activeFilter),
                      title: _emptyFilterTitle(_activeFilter),
                      message: _emptyFilterMessage(_activeFilter),
                      action: OutlinedButton(
                        onPressed: () {
                          setState(() {
                            _activeFilter = _FeedFilter.all;
                          });
                        },
                        child: const Text('Ver tudo'),
                      ),
                    )
                  else
                    for (
                      var index = 0;
                      index < visiblePosts.length;
                      index++
                    ) ...[
                      Builder(
                        builder: (context) {
                          final post = visiblePosts[index];
                          return StaggerReveal(
                            key: ValueKey(
                              'feed-post-${widget.refreshSeed}-${post.id}',
                            ),
                            delay: Duration(milliseconds: 130 + (index * 45)),
                            child: _FeedPostCard(
                              salonName: widget.profile.salonName,
                              salonLogoUrl: widget.profile.salonLogoUrl,
                              post: post,
                              onLike: () => _toggleLike(post),
                              onComment: () => _openComments(post),
                              onBook: post.linkedService == null
                                  ? null
                                  : () => widget.onOpenBooking(
                                      post.linkedService!,
                                    ),
                              onOpenExternal: post.hasExternalPermalink
                                  ? () => _openExternalPost(post)
                                  : null,
                            ),
                          );
                        },
                      ),
                      if (index != visiblePosts.length - 1)
                        const SizedBox(height: 16),
                    ],
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
  final AppAnalyticsService _analytics = AppAnalyticsService.instance;

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

  SalonSupportChannel? _buildSupportChannel() {
    final resolved = resolveSalonSupportChannel(
      config: widget.profile.salonClientAppConfig,
      salonWhatsappPhone: widget.profile.salonWhatsappPhone,
    );

    if (resolved == null) {
      return null;
    }

    if (resolved.kind != SalonSupportChannelKind.email) {
      return resolved;
    }

    final uri = Uri.parse(resolved.url);
    return SalonSupportChannel(
      kind: resolved.kind,
      url: uri
          .replace(
            queryParameters: <String, String>{
              'subject': 'Suporte app cliente - ${widget.profile.salonName}',
            },
          )
          .toString(),
      actionLabel: resolved.actionLabel,
      summaryLabel: resolved.summaryLabel,
    );
  }

  IconData _supportChannelIcon(SalonSupportChannelKind kind) {
    switch (kind) {
      case SalonSupportChannelKind.whatsapp:
        return Icons.chat_bubble_outline_rounded;
      case SalonSupportChannelKind.email:
        return Icons.mail_outline_rounded;
      case SalonSupportChannelKind.managedUrl:
        return Icons.support_agent_rounded;
    }
  }

  String _supportChannelDescription(SalonSupportChannel channel) {
    switch (channel.kind) {
      case SalonSupportChannelKind.whatsapp:
        return formatPhoneNumber(widget.profile.salonWhatsappPhone) ??
            'WhatsApp oficial do salão';
      case SalonSupportChannelKind.email:
        return channel.summaryLabel;
      case SalonSupportChannelKind.managedUrl:
        return channel.summaryLabel;
    }
  }

  String _consentStatusLabel(CustomerProfile profile) {
    switch (profile.consentStatus) {
      case 'pending':
        return 'Pendente';
      case 'signed':
        return 'Assinado';
      default:
        return 'Livre';
    }
  }

  String _consentStatusDescription(CustomerProfile profile) {
    switch (profile.consentStatus) {
      case 'pending':
        return 'O salão pediu um aceite rápido para usar o prontuário com mais segurança.';
      case 'signed':
        final signedAt = profile.consentSignedAt;
        return signedAt == null
            ? 'Seu consentimento de atendimento já está salvo no app.'
            : 'Aceite registrado em ${formatDateTime(signedAt)} com histórico salvo no app.';
      default:
        return 'Este salão não exige termo adicional para o prontuário no momento.';
    }
  }

  Future<void> _acceptOperationalConsent() async {
    try {
      await widget.repository.acceptOperationalConsent();
      final refreshed = await widget.repository.getCustomerProfile();
      if (!mounted) {
        return;
      }

      if (refreshed != null) {
        widget.onProfileChanged(refreshed);
      }

      await _reload();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Consentimento salvo com sucesso no seu perfil.'),
        ),
      );
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _openOperationalConsent() async {
    final supportChannel = _buildSupportChannel();
    final profile = widget.profile;
    await _analytics.logTrustDocumentOpened(
      documentName: 'operational_consent',
    );

    if (!mounted) {
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => TrustDocumentScreen(
          eyebrow: 'Autorização de atendimento',
          title: 'Consentimento de prontuário',
          subtitle:
              'Um aceite rápido para o salão registrar contexto técnico e atender com mais segurança, continuidade e personalização.',
          primaryAction: profile.hasPendingOperationalConsent
              ? _acceptOperationalConsent
              : supportChannel == null
              ? null
              : () => _openExternal(supportChannel.url),
          primaryActionLabel: profile.hasPendingOperationalConsent
              ? 'Assinar agora'
              : supportChannel?.actionLabel,
          primaryActionIcon: profile.hasPendingOperationalConsent
              ? Icons.verified_user_rounded
              : Icons.support_agent_rounded,
          sections: [
            TrustDocumentSection(
              title: 'O que pode entrar no prontuário',
              body:
                  '${widget.profile.salonName} pode registrar preferências, alergias, produtos usados, objetivo do atendimento, contraindicações e observações técnicas importantes para manter consistência e segurança.',
            ),
            TrustDocumentSection(
              title: 'Para que isso serve',
              body:
                  'Essas informações ajudam o salão a repetir o que funciona, evitar riscos operacionais e conduzir próximas visitas com mais contexto em cabelo, unhas, sobrancelhas e estética em geral.',
            ),
            TrustDocumentSection(
              title: 'Como o aceite funciona',
              body: profile.hasSignedOperationalConsent
                  ? 'Seu consentimento já está salvo no app e pode ser revisado sempre que você quiser. Quando houver atualização importante, o salão pode pedir um novo aceite.'
                  : 'Ao assinar, o app registra a data e a versão do termo para deixar seu histórico mais claro e confiável para você e para o salão.',
            ),
            TrustDocumentSection(
              title: 'Revisão e suporte',
              body: supportChannel == null
                  ? 'Se quiser revisar, corrigir ou pedir remoção de alguma informação, você ainda pode falar com o salão assim que ele publicar um canal oficial aqui.'
                  : 'Se quiser revisar, corrigir ou pedir remoção de alguma informação, use o canal oficial de suporte do salão direto por este app.',
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openPrivacyPolicy() async {
    final config = widget.profile.salonClientAppConfig;
    await _analytics.logTrustDocumentOpened(documentName: 'privacy_policy');
    if ((config.privacyPolicyUrl ?? '').trim().isNotEmpty) {
      await _openExternal(config.privacyPolicyUrl);
      return;
    }

    final supportChannel = _buildSupportChannel();
    if (!mounted) {
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => TrustDocumentScreen(
          eyebrow: 'Privacidade e LGPD',
          title: 'Política de privacidade',
          subtitle:
              'Uma leitura simples para a cliente entender quais dados entram no app, por que eles existem e como pedir suporte.',
          primaryAction: supportChannel == null
              ? null
              : () => _openExternal(supportChannel.url),
          primaryActionLabel: supportChannel?.actionLabel,
          sections: [
            TrustDocumentSection(
              title: 'Quais dados entram no app',
              body:
                  '${widget.profile.salonName} pode visualizar seu nome, contato, preferências, alergias, histórico de agendamentos e interações necessárias para o atendimento.',
            ),
            TrustDocumentSection(
              title: 'Como esses dados são usados',
              body:
                  'Os dados ajudam a abrir sua conta, carregar agenda, personalizar o atendimento, confirmar presença, entregar notificações e manter a relação com o salão mais organizada.',
            ),
            TrustDocumentSection(
              title: 'Com quem o dado é compartilhado',
              body:
                  'O conteúdo é tratado entre a operação do salão e a plataforma Salon Fun para viabilizar autenticação, agenda, comunicação e suporte técnico do app.',
            ),
            TrustDocumentSection(
              title: 'Seus controles',
              body:
                  'Você pode atualizar seu perfil no app e solicitar revisão, correção ou remoção de dados pelo canal de suporte. O e-mail principal desta conta é ${widget.repository.currentUser?.email ?? 'o e-mail usado no login'}.',
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openTermsOfUse() async {
    final config = widget.profile.salonClientAppConfig;
    await _analytics.logTrustDocumentOpened(documentName: 'terms_of_use');
    if ((config.termsOfUseUrl ?? '').trim().isNotEmpty) {
      await _openExternal(config.termsOfUseUrl);
      return;
    }

    final supportChannel = _buildSupportChannel();
    if (!mounted) {
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => TrustDocumentScreen(
          eyebrow: 'Uso da plataforma',
          title: 'Termos de uso',
          subtitle:
              'As regras práticas que ajudam a conta do cliente, as reservas e a comunicação do salão a funcionarem sem atrito.',
          primaryAction: supportChannel == null
              ? null
              : () => _openExternal(supportChannel.url),
          primaryActionLabel: supportChannel?.actionLabel,
          sections: [
            TrustDocumentSection(
              title: 'Conta e acesso',
              body:
                  'A conta deve usar informações verdadeiras e um login válido. Você é responsável por manter o acesso protegido no aparelho e usar o app apenas para sua própria jornada com o salão.',
            ),
            TrustDocumentSection(
              title: 'Reservas, confirmações e cancelamentos',
              body:
                  'Horários, confirmações de presença, cancelamentos e encaixes dependem das regras operacionais publicadas por ${widget.profile.salonName} e podem mudar conforme disponibilidade real.',
            ),
            TrustDocumentSection(
              title: 'Conteúdo, ofertas e notificações',
              body:
                  'O feed, as campanhas e os avisos servem para informar, inspirar e ajudar na reserva. Promoções, clubes, pacotes e benefícios seguem disponibilidade e regras definidas pelo salão.',
            ),
            TrustDocumentSection(
              title: 'Suporte e continuidade',
              body:
                  'Sempre que algo não parecer certo, use o canal de suporte do salão ou da plataforma para revisão. O objetivo do app é manter uma experiência premium, segura e clara para a cliente.',
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openSupport() async {
    final supportChannel = _buildSupportChannel();
    if (supportChannel == null) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('O salão ainda não publicou um canal de suporte aqui.'),
        ),
      );
      return;
    }

    await _analytics.logTrustDocumentOpened(documentName: 'support_channel');
    await _openExternal(supportChannel.url);
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.profile.salonClientAppConfig;
    final supportChannel = _buildSupportChannel();

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
          final prefersTabletVariant = MediaQuery.sizeOf(context).width >= 720;
          final activeBenefitsCount = [
            if (data.memberships.isNotEmpty) 'memberships',
            if (data.loyaltySummary?.hasVisibleContent ?? false) 'loyalty',
            if (data.referralSummary?.hasVisibleContent ?? false) 'referral',
          ].length;
          final recentStoreOrders = data.storeOrders
              .take(6)
              .toList(growable: false);
          final consentLabel = _consentStatusLabel(widget.profile);
          final consentToneColor = switch (widget.profile.consentStatus) {
            'pending' => context.salonTheme.warning,
            'signed' => context.salonTheme.success,
            _ => context.salonTheme.textMuted,
          };

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.only(bottom: 120),
              children: [
                ..._buildOperationalNoticeWidgets(
                  scope: 'profile',
                  refreshSeed: widget.refreshSeed,
                  view: view,
                  issues: data.issues,
                  onRetry: _reload,
                ),
                StaggerReveal(
                  key: ValueKey('profile-hero-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 80),
                  child: HeroImagePanel(
                    imageUrl:
                        config.resolveProfileCoverImageForLayout(
                          prefersTabletVariant: prefersTabletVariant,
                        ) ??
                        config.resolveHeroImageForLayout(
                          prefersTabletVariant: prefersTabletVariant,
                        ),
                    height: 300,
                    imageAlignment: Alignment(
                      config.normalizedProfileCoverAlignmentX,
                      config.normalizedProfileCoverAlignmentY,
                    ),
                    imageScale: config.resolvedProfileCoverImageZoom,
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
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            MetricPill(
                              label: 'Avisos',
                              value: '${data.unreadNotificationsCount}',
                              toneColor: context.salonTheme.warning,
                            ),
                            MetricPill(
                              label: 'Benefícios',
                              value: '$activeBenefitsCount',
                              toneColor: context.salonTheme.accent,
                            ),
                            MetricPill(
                              label: 'Canal',
                              value: supportChannel == null
                                  ? 'Pendente'
                                  : 'Ativo',
                              toneColor: supportChannel == null
                                  ? context.salonTheme.warning
                                  : context.salonTheme.success,
                            ),
                            MetricPill(
                              label: 'Consentimento',
                              value: consentLabel,
                              toneColor: consentToneColor,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _InfoRow(label: 'Nome', value: widget.profile.name),
                        _InfoRow(
                          label: 'Telefone',
                          value:
                              formatPhoneNumber(widget.profile.phone) ??
                              'Ainda não informado',
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
                          title: 'Seu canal com o salão',
                          subtitle:
                              'Um caminho principal para falar com a equipe, ver localização e acompanhar avisos sem ruído.',
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (supportChannel != null)
                              FilledButton.icon(
                                onPressed: _openSupport,
                                icon: Icon(
                                  _supportChannelIcon(supportChannel.kind),
                                ),
                                label: Text(supportChannel.actionLabel),
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
                        if (supportChannel != null ||
                            (config.addressLabel ?? '').trim().isNotEmpty ||
                            config.ratingValue != null) ...[
                          const SizedBox(height: 16),
                          if (supportChannel != null)
                            _InfoRow(
                              label: 'Canal oficial',
                              value: _supportChannelDescription(supportChannel),
                            ),
                          if ((config.addressLabel ?? '').trim().isNotEmpty)
                            _InfoRow(
                              label: 'Unidade',
                              value: config.addressLabel!,
                            ),
                          if (config.ratingValue != null)
                            _InfoRow(
                              label: 'Avaliação média',
                              value: config.ratingCount == null
                                  ? config.ratingValue!.toStringAsFixed(1)
                                  : '${config.ratingValue!.toStringAsFixed(1)} • ${config.ratingCount} avaliações',
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  key: ValueKey('profile-trust-${widget.refreshSeed}'),
                  delay: const Duration(milliseconds: 255),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionHeader(
                          title: 'Confiança e suporte',
                          subtitle:
                              'Tudo o que ajuda a cliente a sentir segurança: documentos claros, canal de suporte e leitura objetiva da experiência.',
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton.icon(
                              onPressed: _openPrivacyPolicy,
                              icon: const Icon(Icons.shield_outlined),
                              label: const Text('Privacidade'),
                            ),
                            OutlinedButton.icon(
                              onPressed: _openTermsOfUse,
                              icon: const Icon(Icons.description_outlined),
                              label: const Text('Termos'),
                            ),
                            OutlinedButton.icon(
                              onPressed: _openOperationalConsent,
                              icon: Icon(
                                widget.profile.hasPendingOperationalConsent
                                    ? Icons.gpp_maybe_outlined
                                    : Icons.verified_user_outlined,
                              ),
                              label: Text(
                                widget.profile.hasPendingOperationalConsent
                                    ? 'Consentimento pendente'
                                    : 'Consentimento',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: context.salonTheme.surfaceStrong,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: context.salonTheme.outline,
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                widget.profile.hasPendingOperationalConsent
                                    ? Icons.gpp_maybe_outlined
                                    : widget.profile.hasSignedOperationalConsent
                                    ? Icons.verified_rounded
                                    : Icons.shield_moon_outlined,
                                color: consentToneColor,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Prontuário e autorização',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _consentStatusDescription(widget.profile),
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                    if (widget.profile.consentSignedAt != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 8),
                                        child: Text(
                                          'Versão ${widget.profile.consentVersion ?? 'ativa'} • ${formatDateTime(widget.profile.consentSignedAt!)}',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.bodySmall,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: context.salonTheme.surfaceStrong,
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: context.salonTheme.outline,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.verified_user_outlined,
                                color: context.salonTheme.brand,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Conta e confiança do app',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      supportChannel == null
                                          ? 'Os documentos nativos do app já estão ativos, mesmo antes de o salão publicar um canal oficial.'
                                          : 'Os documentos nativos do app estão ativos e o salão já publicou um canal oficial de suporte.',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Conta principal: ${widget.repository.currentUser?.email ?? 'não identificada'}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Este espaço deixa o app mais confiável mesmo quando o salão ainda está configurando políticas externas no painel.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
                if (data.loyaltySummary != null ||
                    data.referralSummary != null ||
                    data.memberships.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('profile-memberships-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 290),
                    child: _ActiveMembershipsCard(
                      eyebrow: 'Recorrência',
                      title: 'Pacotes e saldo ativo',
                      subtitle:
                          'Clubes e pacotes que já estão valendo para você, com sessões restantes e prazo de uso.',
                      memberships: data.memberships,
                    ),
                  ),
                ],
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
                if (recentStoreOrders.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  StaggerReveal(
                    key: ValueKey('profile-store-orders-${widget.refreshSeed}'),
                    delay: const Duration(milliseconds: 325),
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            eyebrow: 'Loja virtual',
                            title: 'Pedidos da loja',
                            subtitle:
                                'Acompanhe os itens, o valor e cada virada de status sem sair do app.',
                          ),
                          const SizedBox(height: 16),
                          for (final order in recentStoreOrders) ...[
                            _StoreOrderProfileTile(order: order),
                            if (order != recentStoreOrders.last)
                              const SizedBox(height: 12),
                          ],
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
    this.listHeight = 230,
    this.emptyTitle,
    this.emptyMessage,
    this.emptyAction,
  });

  final String title;
  final String subtitle;
  final List<T> items;
  final Widget Function(T item) itemBuilder;
  final double listHeight;
  final String? emptyTitle;
  final String? emptyMessage;
  final Widget? emptyAction;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(title: title, subtitle: subtitle),
          const SizedBox(height: 16),
          if (items.isEmpty)
            EmptyStateCard(
              title: emptyTitle ?? 'Ainda não há itens nesta seção',
              message:
                  emptyMessage ??
                  'Assim que o salão publicar esta parte da experiência, ela aparece aqui.',
              action: emptyAction,
            )
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final maxWidth = constraints.maxWidth;
                final compact = maxWidth < 430;
                final mobileWidth = maxWidth * 0.8;
                final itemWidth = compact
                    ? mobileWidth < 240
                          ? 240.0
                          : mobileWidth > 280
                          ? 280.0
                          : mobileWidth
                    : 220.0;

                return SizedBox(
                  height: listHeight,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemBuilder: (context, index) => SizedBox(
                      width: itemWidth,
                      child: itemBuilder(items[index]),
                    ),
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemCount: items.length,
                  ),
                );
              },
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
          _ServiceMedia(service: service, height: 122, showCategoryChip: true),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ServiceIdentityBlock(
                    service: service,
                    titleStyle: Theme.of(context).textTheme.titleLarge,
                    descriptionMaxLines: 2,
                  ),
                  const Spacer(),
                  _ServiceValueRow(service: service),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: onPressed,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(double.infinity, 44),
                    ),
                    child: const Text('Quero reservar'),
                  ),
                ],
              ),
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
          _ServiceMedia(service: service, height: 132, showCategoryChip: true),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ServiceIdentityBlock(
                    service: service,
                    titleStyle: Theme.of(context).textTheme.titleMedium,
                    descriptionMaxLines: 2,
                  ),
                  const Spacer(),
                  _ServiceValueRow(service: service),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: onPressed,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(double.infinity, 42),
                    ),
                    child: const Text('Ver horários'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceMedia extends StatelessWidget {
  const _ServiceMedia({
    required this.service,
    required this.height,
    this.showCategoryChip = false,
  });

  final ServiceItem service;
  final double height;
  final bool showCategoryChip;

  @override
  Widget build(BuildContext context) {
    Widget buildPlaceholder() {
      return DecoratedBox(
        decoration: BoxDecoration(gradient: context.salonTheme.heroGradient),
        child: Center(
          child: Text(
            _safeDisplayInitial(service.name, fallback: 'S'),
            style: Theme.of(
              context,
            ).textTheme.displayMedium?.copyWith(color: Colors.white),
          ),
        ),
      );
    }

    return SizedBox(
      height: height,
      width: double.infinity,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: Stack(
          fit: StackFit.expand,
          children: [
            PremiumNetworkImage(
              imageUrl: service.imageUrl,
              fit: BoxFit.cover,
              placeholder: buildPlaceholder(),
            ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.04),
                      Colors.black.withValues(alpha: 0.36),
                    ],
                  ),
                ),
              ),
            ),
            if (showCategoryChip && (service.category ?? '').trim().isNotEmpty)
              Positioned(
                left: 12,
                top: 12,
                child: _ContextChip(
                  label: service.category!,
                  backgroundColor: Colors.white.withValues(alpha: 0.18),
                  foregroundColor: Colors.white,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ServiceIdentityBlock extends StatelessWidget {
  const _ServiceIdentityBlock({
    required this.service,
    required this.titleStyle,
    this.descriptionMaxLines = 2,
  });

  final ServiceItem service;
  final TextStyle? titleStyle;
  final int descriptionMaxLines;

  @override
  Widget build(BuildContext context) {
    final title = _normalizeDisplayLabel(
      service.name,
      fallback: 'Servico do salao',
      maxLength: 90,
    );
    final description = _normalizeDisplayCopy(
      service.description,
      maxLength: 180,
    );
    final String supportLine = (description ?? '').isNotEmpty
        ? description!
        : 'Leitura rápida para reservar sem sair do ritmo do salão.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: titleStyle,
        ),
        const SizedBox(height: 8),
        Text(
          supportLine,
          maxLines: descriptionMaxLines,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _ServiceValueRow extends StatelessWidget {
  const _ServiceValueRow({required this.service});

  final ServiceItem service;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _ContextChip(
          label: formatCurrency(service.price),
          backgroundColor: context.salonTheme.brand.withValues(alpha: 0.12),
          foregroundColor: context.salonTheme.brandDark,
        ),
        _ContextChip(
          label: '${service.duration} min',
          backgroundColor: context.salonTheme.surface,
          foregroundColor: context.salonTheme.brandDark,
        ),
      ],
    );
  }
}

class _ContextChip extends StatelessWidget {
  const _ContextChip({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: foregroundColor,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _TeamMemberCard extends StatelessWidget {
  const _TeamMemberCard({required this.member});

  final TeamMember member;

  @override
  Widget build(BuildContext context) {
    final memberName = _normalizeDisplayLabel(
      member.name,
      fallback: 'Profissional do salao',
      maxLength: 70,
    );
    final specialty = _normalizeDisplayLabel(
      member.primarySpecialty,
      fallback: 'Profissional do salao',
      maxLength: 80,
    );

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: context.salonTheme.brand.withValues(alpha: 0.14),
            child: Text(
              _safeDisplayInitial(member.name, fallback: 'P'),
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(color: context.salonTheme.brand),
            ),
          ),
          const SizedBox(height: 16),
          Text(memberName, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(specialty, style: Theme.of(context).textTheme.bodySmall),
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

class _ActiveMembershipsCard extends StatelessWidget {
  const _ActiveMembershipsCard({
    required this.title,
    required this.subtitle,
    required this.memberships,
    this.eyebrow,
  });

  final String title;
  final String subtitle;
  final List<CustomerMembershipPackage> memberships;
  final String? eyebrow;

  String _statusLabel(CustomerMembershipPackage membership) {
    if (membership.isCompleted) {
      return 'Concluído';
    }

    if (membership.isExpired) {
      return 'Expirado';
    }

    if (membership.status == 'cancelled') {
      return 'Cancelado';
    }

    return 'Ativo';
  }

  Color _statusTone(
    BuildContext context,
    CustomerMembershipPackage membership,
  ) {
    if (membership.isCompleted) {
      return context.salonTheme.success;
    }

    if (membership.isExpired) {
      return context.salonTheme.warning;
    }

    if (membership.status == 'cancelled') {
      return context.salonTheme.textMuted;
    }

    return context.salonTheme.brand;
  }

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(eyebrow: eyebrow, title: title, subtitle: subtitle),
          const SizedBox(height: 16),
          for (final membership in memberships) ...[
            Builder(
              builder: (context) {
                final tone = _statusTone(context, membership);

                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Color.alphaBlend(
                      tone.withValues(alpha: 0.08),
                      Theme.of(context).cardColor,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: tone.withValues(alpha: 0.16)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _ContextChip(
                            label: _statusLabel(membership),
                            backgroundColor: tone.withValues(alpha: 0.14),
                            foregroundColor: tone,
                          ),
                          const Spacer(),
                          Text(
                            '${membership.sessionsRemaining}/${membership.sessionsIncluded}',
                            style: Theme.of(
                              context,
                            ).textTheme.titleMedium?.copyWith(color: tone),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        membership.title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        membership.serviceName,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          MetricPill(
                            label: 'Restantes',
                            value:
                                '${membership.sessionsRemaining} sessão${membership.sessionsRemaining == 1 ? '' : 'ões'}',
                            toneColor: tone,
                          ),
                          MetricPill(
                            label: 'Validade',
                            value: formatShortDate(membership.expiresAt),
                            toneColor: context.salonTheme.accent,
                          ),
                          if (membership.price != null)
                            MetricPill(
                              label: 'Pacote',
                              value: formatCurrency(membership.price!),
                              toneColor: context.salonTheme.success,
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Ativo desde ${formatShortDate(membership.startedAt)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if ((membership.notes ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          membership.notes!,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
            if (membership != memberships.last) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

class _StoreOrderProfileTile extends StatelessWidget {
  const _StoreOrderProfileTile({required this.order});

  final CustomerStoreOrder order;

  @override
  Widget build(BuildContext context) {
    final tone = _resolveStoreOrderTone(context, order);
    final firstItem = order.items.isEmpty ? null : order.items.first;
    final additionalItems = order.totalItems - (firstItem?.quantity ?? 0);
    final itemNames = order.items
        .map((item) => item.productName)
        .where((name) => name.trim().isNotEmpty)
        .take(3)
        .toList(growable: false);

    Widget buildPlaceholder() {
      return DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [tone.withValues(alpha: 0.22), tone.withValues(alpha: 0.1)],
          ),
        ),
        child: Center(
          child: Text(
            '${order.orderNumber}',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: tone),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          tone.withValues(alpha: 0.08),
          Theme.of(context).cardColor,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: PremiumNetworkImage(
                  imageUrl: firstItem?.imageUrl,
                  width: 78,
                  height: 78,
                  fit: BoxFit.cover,
                  placeholder: buildPlaceholder(),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Pedido #${order.orderNumber}',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        _ContextChip(
                          label: _formatStoreOrderStatusLabel(order),
                          backgroundColor: tone.withValues(alpha: 0.14),
                          foregroundColor: tone,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      itemNames.isEmpty
                          ? 'Seu pedido já entrou no fluxo da loja.'
                          : itemNames.join(' • '),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (additionalItems > 0) ...[
                      const SizedBox(height: 4),
                      Text(
                        '+$additionalItems item${additionalItems == 1 ? '' : 's'} no pedido',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: tone),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              MetricPill(
                label: 'Total',
                value: formatCurrency(order.subtotalAmount),
                toneColor: tone,
              ),
              MetricPill(
                label: 'Itens',
                value: '${order.totalItems}',
                toneColor: context.salonTheme.accent,
              ),
              MetricPill(
                label: 'Atualizado',
                value: formatShortDate(order.mostRelevantMoment),
                toneColor: context.salonTheme.success,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _buildStoreOrderStatusSupportCopy(order),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _CommercialOfferSpotlightCard extends StatelessWidget {
  const _CommercialOfferSpotlightCard({
    required this.title,
    required this.subtitle,
    required this.offers,
    this.eyebrow,
    this.footerLabel,
    this.onFooterPressed,
    this.compactMobile = false,
  });

  final String title;
  final String subtitle;
  final List<OfferItem> offers;
  final String? eyebrow;
  final String? footerLabel;
  final VoidCallback? onFooterPressed;
  final bool compactMobile;

  @override
  Widget build(BuildContext context) {
    final visibleOffers = compactMobile
        ? offers.take(2).toList(growable: false)
        : offers;
    final hiddenOffersCount = offers.length - visibleOffers.length;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(eyebrow: eyebrow, title: title, subtitle: subtitle),
          const SizedBox(height: 16),
          for (final offer in visibleOffers) ...[
            _OfferTile(offer: offer),
            if (offer != visibleOffers.last) const SizedBox(height: 12),
          ],
          if (hiddenOffersCount > 0) ...[
            const SizedBox(height: 14),
            Text(
              'Mais $hiddenOffersCount oferta${hiddenOffersCount == 1 ? '' : 's'} ativa${hiddenOffersCount == 1 ? '' : 's'} aparecem conforme você rola a jornada do salão.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (footerLabel != null && onFooterPressed != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: onFooterPressed,
              child: Text(footerLabel!),
            ),
          ],
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
    final normalizedTitle = _normalizeDisplayLabel(
      offer.title,
      fallback: 'Oferta do salao',
      maxLength: 100,
    );
    final description = _normalizeDisplayCopy(
      offer.description,
      maxLength: 220,
    );
    final highlightText = _normalizeDisplayCopy(
      offer.highlightText,
      maxLength: 140,
    );

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
            offer.commercialLabel,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tone,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            formatOfferLifecycle(offer.startsOn, offer.endsOn),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tone.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 6),
          Text(
            normalizedTitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (description != null) ...[
            const SizedBox(height: 6),
            Text(
              description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (highlightText != null) ...[
            const SizedBox(height: 8),
            Text(
              highlightText,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
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

class _StoreCartBar extends StatelessWidget {
  const _StoreCartBar({
    required this.totalItems,
    required this.subtotal,
    required this.busy,
    required this.onPressed,
  });

  final int totalItems;
  final double subtotal;
  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend(
              tokens.brand.withValues(alpha: 0.16),
              tokens.surfaceStrong,
            ),
            Color.alphaBlend(
              tokens.accent.withValues(alpha: 0.12),
              tokens.surfaceStrong,
            ),
          ],
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: tokens.outline.withValues(alpha: 0.9)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x16000000),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.68),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(Icons.shopping_bag_outlined, color: tokens.brandDark),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Carrinho da loja',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$totalItems item${totalItems == 1 ? '' : 's'} • ${formatCurrency(subtotal)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            FilledButton(
              onPressed: busy ? null : onPressed,
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 46),
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
              ),
              child: busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Fechar pedido'),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoreCartSheet extends StatefulWidget {
  const _StoreCartSheet({required this.profile, required this.initialItems});

  final CustomerProfile profile;
  final List<_StoreCartEntry> initialItems;

  @override
  State<_StoreCartSheet> createState() => _StoreCartSheetState();
}

class _StoreCartSheetState extends State<_StoreCartSheet> {
  late final TextEditingController _notesController;
  late final Map<String, _StoreCartEntry> _entries;

  List<_StoreCartEntry> get _items => _entries.values.toList(growable: false);

  int get _totalItems =>
      _items.fold<int>(0, (total, item) => total + item.quantity);

  double get _subtotal =>
      _items.fold<double>(0, (total, item) => total + item.subtotal);

  bool get _canSubmit => _items.isNotEmpty;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController();
    _entries = <String, _StoreCartEntry>{
      for (final entry in widget.initialItems) entry.product.id: entry,
    };
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _setQuantity(_StoreCartEntry entry, int nextQuantity) {
    final safeQuantity = nextQuantity.clamp(
      1,
      _resolveProductOrderLimit(entry.product),
    );

    setState(() {
      _entries[entry.product.id] = entry.copyWith(quantity: safeQuantity);
    });
  }

  void _removeEntry(_StoreCartEntry entry) {
    setState(() {
      _entries.remove(entry.product.id);
    });
  }

  void _submit() {
    final cleanedNotes = _notesController.text.trim();
    Navigator.of(context).pop(
      _StoreCartCheckoutRequest(
        items: _items,
        notes: cleanedNotes.isEmpty ? null : cleanedNotes,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return FractionallySizedBox(
      heightFactor: 0.92,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(34)),
        child: Material(
          color: Theme.of(context).scaffoldBackgroundColor,
          child: Column(
            children: [
              const SizedBox(height: 14),
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: tokens.outline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Loja de ${widget.profile.salonName}',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Revise quantidades, deixe uma observação e envie o pedido sem sair do app.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _items.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                        child: EmptyStateCard(
                          title: 'Seu carrinho ficou vazio',
                          message:
                              'Adicione produtos da vitrine para montar um pedido para o salão.',
                          action: OutlinedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: const Text('Voltar para a loja'),
                          ),
                        ),
                      )
                    : SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Color.alphaBlend(
                                  tokens.brand.withValues(alpha: 0.08),
                                  tokens.surfaceStrong,
                                ),
                                borderRadius: BorderRadius.circular(24),
                                border: Border.all(
                                  color: tokens.outline.withValues(alpha: 0.9),
                                ),
                              ),
                              child: Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  MetricPill(
                                    label: 'Itens',
                                    value: '$_totalItems',
                                    toneColor: tokens.brand,
                                  ),
                                  MetricPill(
                                    label: 'Subtotal',
                                    value: formatCurrency(_subtotal),
                                    toneColor: tokens.accent,
                                  ),
                                  MetricPill(
                                    label: 'Pedido',
                                    value: 'No app',
                                    toneColor: tokens.success,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 18),
                            for (final entry in _items) ...[
                              _StoreCartLineTile(
                                entry: entry,
                                onIncrement:
                                    entry.quantity <
                                        _resolveProductOrderLimit(entry.product)
                                    ? () => _setQuantity(
                                        entry,
                                        entry.quantity + 1,
                                      )
                                    : null,
                                onDecrement: entry.quantity > 1
                                    ? () => _setQuantity(
                                        entry,
                                        entry.quantity - 1,
                                      )
                                    : null,
                                onRemove: () => _removeEntry(entry),
                              ),
                              if (entry != _items.last)
                                const SizedBox(height: 12),
                            ],
                            const SizedBox(height: 20),
                            Text(
                              'Observações para o salão',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _notesController,
                              minLines: 3,
                              maxLines: 4,
                              maxLength: 500,
                              decoration: const InputDecoration(
                                hintText:
                                    'Ex.: separar para retirada, enviar pela mesma pessoa do último pedido...',
                              ),
                            ),
                          ],
                        ),
                      ),
              ),
              Container(
                padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 16),
                decoration: BoxDecoration(
                  color: Color.alphaBlend(
                    Colors.white.withValues(
                      alpha: tokens.isDarkShell ? 0.04 : 0.82,
                    ),
                    tokens.surfaceStrong,
                  ),
                  border: Border(
                    top: BorderSide(
                      color: tokens.outline.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Resumo final',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        Text(
                          formatCurrency(_subtotal),
                          style: Theme.of(
                            context,
                          ).textTheme.titleLarge?.copyWith(color: tokens.brand),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'O estoque é reservado automaticamente quando o pedido entra para o salão.',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _canSubmit ? _submit : null,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(54),
                        ),
                        child: const Text('Enviar pedido da loja'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StoreCartLineTile extends StatelessWidget {
  const _StoreCartLineTile({
    required this.entry,
    this.onIncrement,
    this.onDecrement,
    this.onRemove,
  });

  final _StoreCartEntry entry;
  final VoidCallback? onIncrement;
  final VoidCallback? onDecrement;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final product = entry.product;

    Widget buildPlaceholder() {
      return DecoratedBox(
        decoration: BoxDecoration(gradient: tokens.heroGradient),
        child: Center(
          child: Icon(
            Icons.shopping_bag_rounded,
            color: Colors.white.withValues(alpha: 0.92),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tokens.outline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: PremiumNetworkImage(
              imageUrl: product.coverImageUrl,
              width: 78,
              height: 78,
              fit: BoxFit.cover,
              placeholder: buildPlaceholder(),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _normalizeDisplayLabel(
                    product.name,
                    fallback: 'Produto do salão',
                    maxLength: 84,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if ((product.brand ?? '').trim().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    product.brand!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        formatCurrency(entry.subtotal),
                        style: Theme.of(
                          context,
                        ).textTheme.titleMedium?.copyWith(color: tokens.brand),
                      ),
                    ),
                    TextButton(
                      onPressed: onRemove,
                      child: const Text('Remover'),
                    ),
                  ],
                ),
                Row(
                  children: [
                    IconButton(
                      onPressed: onDecrement,
                      style: IconButton.styleFrom(
                        backgroundColor: Color.alphaBlend(
                          tokens.brand.withValues(alpha: 0.08),
                          tokens.surfaceStrong,
                        ),
                      ),
                      icon: const Icon(Icons.remove_rounded),
                    ),
                    Container(
                      constraints: const BoxConstraints(minWidth: 86),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Column(
                        children: [
                          Text(
                            '${entry.quantity} ${product.unit}',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Até ${_resolveProductOrderLimit(product)}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: onIncrement,
                      style: IconButton.styleFrom(
                        backgroundColor: Color.alphaBlend(
                          tokens.brand.withValues(alpha: 0.08),
                          tokens.surfaceStrong,
                        ),
                      ),
                      icon: const Icon(Icons.add_rounded),
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

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.profile,
    required this.cartQuantity,
    required this.onAddToCart,
    required this.onOpenCart,
  });

  final RetailProduct product;
  final CustomerProfile profile;
  final int cartQuantity;
  final ValueChanged<int> onAddToCart;
  final VoidCallback onOpenCart;

  bool _hasUsableRemoteImage(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || !uri.hasScheme) {
      return false;
    }

    return uri.scheme == 'http' || uri.scheme == 'https';
  }

  Future<void> _openStoreSheet(BuildContext context) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ProductStoreSheet(
        product: product,
        profile: profile,
        cartQuantity: cartQuantity,
        onAddToCart: onAddToCart,
        onOpenCart: onOpenCart,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final canPurchase = _canCheckoutRetailProduct(product);
    final description =
        _normalizeDisplayCopy(product.description, maxLength: 110) ??
        'Toque para abrir a galeria, ver detalhes e colocar o produto no carrinho do salão.';
    final priceLabel = product.retailPrice == null || product.retailPrice == 0
        ? 'Preço em ajuste'
        : formatCurrency(product.retailPrice!);
    final stockLabel = canPurchase
        ? 'Disponível agora: ${_formatProductStockLabel(product)}'
        : product.currentStock <= 0
        ? 'Sem estoque para compra agora'
        : 'Produto visível, mas ainda sem preço de checkout';
    final purchaseCapLabel = canPurchase
        ? _resolveProductOrderLimit(product) == 1
              ? '1 por pedido'
              : 'Até ${_resolveProductOrderLimit(product)} por pedido'
        : 'Ver detalhes';
    final galleryCount = product.imageUrls.where(_hasUsableRemoteImage).length;
    final ctaLabel = cartQuantity > 0
        ? '$cartQuantity no carrinho'
        : canPurchase
        ? 'Adicionar'
        : 'Ver produto';

    Widget buildMediaPlaceholder() {
      return DecoratedBox(
        decoration: BoxDecoration(gradient: context.salonTheme.heroGradient),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.shopping_bag_rounded,
                color: Colors.white.withValues(alpha: 0.94),
                size: 34,
              ),
              const SizedBox(height: 12),
              Text(
                _safeDisplayInitial(product.name, fallback: 'L'),
                style: Theme.of(
                  context,
                ).textTheme.displayMedium?.copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox.expand(
      child: GestureDetector(
        onTap: () => _openStoreSheet(context),
        child: PremiumCard(
          padding: EdgeInsets.zero,
          radius: 30,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                height: 196,
                width: double.infinity,
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(30),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      PremiumNetworkImage(
                        imageUrl: product.coverImageUrl,
                        fit: BoxFit.cover,
                        placeholder: buildMediaPlaceholder(),
                      ),
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black.withValues(alpha: 0.04),
                                Colors.black.withValues(alpha: 0.46),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 14,
                        top: 14,
                        child: _ContextChip(
                          label: product.brand ?? 'Loja do salão',
                          backgroundColor: Colors.white.withValues(alpha: 0.2),
                          foregroundColor: Colors.white,
                        ),
                      ),
                      Positioned(
                        right: 14,
                        top: 14,
                        child: _ContextChip(
                          label: canPurchase ? 'Pronta entrega' : 'Vitrine',
                          backgroundColor: Colors.black.withValues(alpha: 0.34),
                          foregroundColor: Colors.white,
                        ),
                      ),
                      if (cartQuantity > 0)
                        Positioned(
                          left: 14,
                          bottom: 14,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.42),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              'Carrinho: $cartQuantity',
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(color: Colors.white),
                            ),
                          ),
                        ),
                      Positioned(
                        right: 14,
                        bottom: 14,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Text(
                            priceLabel,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: context.salonTheme.brandDark,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _normalizeDisplayLabel(
                          product.name,
                          fallback: 'Produto do salão',
                          maxLength: 72,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _ContextChip(
                            label: purchaseCapLabel,
                            backgroundColor: Color.alphaBlend(
                              context.salonTheme.brand.withValues(alpha: 0.12),
                              context.salonTheme.surfaceStrong,
                            ),
                            foregroundColor: context.salonTheme.brandDark,
                          ),
                          _ContextChip(
                            label: galleryCount > 0
                                ? '$galleryCount foto${galleryCount == 1 ? '' : 's'}'
                                : 'Sem galeria',
                            backgroundColor: Color.alphaBlend(
                              context.salonTheme.accent.withValues(alpha: 0.14),
                              context.salonTheme.surfaceStrong,
                            ),
                            foregroundColor: context.salonTheme.brandDark,
                          ),
                        ],
                      ),
                      const Spacer(),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  priceLabel,
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(
                                        color: context.salonTheme.brand,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  stockLabel,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 11,
                            ),
                            decoration: BoxDecoration(
                              color: Color.alphaBlend(
                                context.salonTheme.brand.withValues(
                                  alpha: cartQuantity > 0 ? 0.18 : 0.12,
                                ),
                                context.salonTheme.surfaceStrong,
                              ),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: context.salonTheme.brand.withValues(
                                  alpha: 0.2,
                                ),
                              ),
                            ),
                            child: Text(
                              ctaLabel,
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    color: context.salonTheme.brandDark,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductStoreSheet extends StatefulWidget {
  const _ProductStoreSheet({
    required this.product,
    required this.profile,
    required this.cartQuantity,
    required this.onAddToCart,
    required this.onOpenCart,
  });

  final RetailProduct product;
  final CustomerProfile profile;
  final int cartQuantity;
  final ValueChanged<int> onAddToCart;
  final VoidCallback onOpenCart;

  @override
  State<_ProductStoreSheet> createState() => _ProductStoreSheetState();
}

class _ProductStoreSheetState extends State<_ProductStoreSheet> {
  late final PageController _pageController;
  late int _quantity;
  int _currentImageIndex = 0;

  List<String> get _galleryImages => widget.product.imageUrls
      .where(_hasUsableRemoteImage)
      .toList(growable: false);

  bool get _canPurchase => _canCheckoutRetailProduct(widget.product);

  int get _orderLimit => _resolveProductOrderLimit(widget.product);

  int get _remainingCapacity {
    final remaining = _orderLimit - widget.cartQuantity;
    return remaining < 0 ? 0 : remaining;
  }

  int get _sheetMaxQuantity => _remainingCapacity < 1 ? 1 : _remainingCapacity;

  bool _hasUsableRemoteImage(String value) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || !uri.hasScheme) {
      return false;
    }

    return uri.scheme == 'http' || uri.scheme == 'https';
  }

  String get _primaryActionLabel {
    if (!_canPurchase) {
      return 'Produto indisponível';
    }
    if (_remainingCapacity < 1) {
      return 'Limite já no carrinho';
    }

    return 'Adicionar ao carrinho';
  }

  String get _supportSummaryLabel {
    if (!_canPurchase) {
      return widget.product.currentStock <= 0
          ? 'O salão deixou este produto visível, mas sem estoque para compra agora.'
          : 'Assim que o salão definir um valor de checkout, a compra libera no app.';
    }
    if (_remainingCapacity < 1) {
      return 'Você já atingiu o limite permitido para este produto no pedido atual.';
    }
    if (widget.cartQuantity > 0) {
      return 'Seu carrinho já tem ${widget.cartQuantity} ${widget.product.unit} deste item.';
    }

    return 'Os itens entram no carrinho e o salão recebe o pedido completo dentro do app.';
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _quantity = 1;
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _addToCart() {
    if (!_canPurchase || _remainingCapacity < 1) {
      return;
    }

    widget.onAddToCart(_quantity);
    Navigator.of(context).pop();
  }

  void _openCart() {
    Navigator.of(context).pop();
    unawaited(
      Future<void>.delayed(const Duration(milliseconds: 180), () async {
        widget.onOpenCart();
      }),
    );
  }

  void _setQuantity(int nextValue) {
    setState(() {
      final clamped = nextValue.clamp(1, _sheetMaxQuantity);
      _quantity = clamped;
    });
  }

  Future<void> _goToGalleryPage(int index) {
    setState(() {
      _currentImageIndex = index;
    });

    return _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final product = widget.product;
    final galleryImages = _galleryImages;
    final description =
        _normalizeDisplayCopy(product.description, maxLength: 560) ??
        'Produto publicado pelo salão com galeria visual, estoque e pedido nativo pelo app.';
    final subtotalLabel = product.retailPrice == null
        ? 'Aguardando preço'
        : formatCurrency(product.retailPrice! * _quantity);
    final availabilityLabel = _canPurchase
        ? _formatProductStockLabel(product)
        : product.currentStock <= 0
        ? 'Sem estoque para compra agora'
        : 'Preço de checkout ainda não publicado';
    final stockSupportCopy = _canPurchase
        ? 'O app usa estoque e limite por pedido para o carrinho já sair pronto para o salão.'
        : 'Você ainda pode acompanhar a vitrine e voltar quando o salão liberar este item para compra.';
    final bottomInset = MediaQuery.of(context).padding.bottom;

    Widget buildPlaceholder() {
      return DecoratedBox(
        decoration: BoxDecoration(gradient: tokens.heroGradient),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.shopping_bag_rounded,
                size: 38,
                color: Colors.white.withValues(alpha: 0.94),
              ),
              const SizedBox(height: 12),
              Text(
                _safeDisplayInitial(product.name, fallback: 'L'),
                style: Theme.of(
                  context,
                ).textTheme.displayMedium?.copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      );
    }

    return FractionallySizedBox(
      heightFactor: 0.94,
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(34)),
        child: Material(
          color: Theme.of(context).scaffoldBackgroundColor,
          child: Column(
            children: [
              const SizedBox(height: 14),
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: tokens.outline,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 14),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        height: 360,
                        width: double.infinity,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(32),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              PageView.builder(
                                controller: _pageController,
                                itemCount: galleryImages.isEmpty
                                    ? 1
                                    : galleryImages.length,
                                onPageChanged: (page) {
                                  setState(() {
                                    _currentImageIndex = page;
                                  });
                                },
                                itemBuilder: (context, index) {
                                  final imageUrl = galleryImages.isEmpty
                                      ? null
                                      : galleryImages[index];
                                  return Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      PremiumNetworkImage(
                                        imageUrl: imageUrl,
                                        fit: BoxFit.cover,
                                        placeholder: buildPlaceholder(),
                                      ),
                                      Positioned.fill(
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              begin: Alignment.topCenter,
                                              end: Alignment.bottomCenter,
                                              colors: [
                                                Colors.black.withValues(
                                                  alpha: 0.04,
                                                ),
                                                Colors.black.withValues(
                                                  alpha: 0.46,
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
                              Positioned(
                                left: 16,
                                top: 16,
                                child: _ContextChip(
                                  label: product.brand ?? 'Loja do salão',
                                  backgroundColor: Colors.white.withValues(
                                    alpha: 0.18,
                                  ),
                                  foregroundColor: Colors.white,
                                ),
                              ),
                              Positioned(
                                right: 16,
                                top: 16,
                                child: _ContextChip(
                                  label: _canPurchase
                                      ? 'Checkout ativo'
                                      : 'Vitrine',
                                  backgroundColor: Colors.black.withValues(
                                    alpha: 0.34,
                                  ),
                                  foregroundColor: Colors.white,
                                ),
                              ),
                              Positioned(
                                left: 16,
                                right: 16,
                                bottom: 16,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    if (galleryImages.length > 1)
                                      Expanded(
                                        child: Row(
                                          children: List<Widget>.generate(
                                            galleryImages.length,
                                            (index) => Container(
                                              width: 8,
                                              height: 8,
                                              margin: EdgeInsets.only(
                                                right:
                                                    index ==
                                                        galleryImages.length - 1
                                                    ? 0
                                                    : 6,
                                              ),
                                              decoration: BoxDecoration(
                                                shape: BoxShape.circle,
                                                color:
                                                    _currentImageIndex == index
                                                    ? Colors.white
                                                    : Colors.white.withValues(
                                                        alpha: 0.34,
                                                      ),
                                              ),
                                            ),
                                          ),
                                        ),
                                      )
                                    else
                                      const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 10,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.92,
                                        ),
                                        borderRadius: BorderRadius.circular(18),
                                      ),
                                      child: Text(
                                        product.retailPrice == null
                                            ? 'Preço em ajuste'
                                            : formatCurrency(
                                                product.retailPrice!,
                                              ),
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                              color: tokens.brandDark,
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (galleryImages.length > 1) ...[
                        const SizedBox(height: 14),
                        SizedBox(
                          height: 72,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemBuilder: (context, index) {
                              final selected = _currentImageIndex == index;
                              return GestureDetector(
                                onTap: () => _goToGalleryPage(index),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 180),
                                  width: 72,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(
                                      color: selected
                                          ? tokens.brand
                                          : tokens.outline,
                                      width: selected ? 2 : 1,
                                    ),
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(17),
                                    child: PremiumNetworkImage(
                                      imageUrl: galleryImages[index],
                                      fit: BoxFit.cover,
                                      placeholder: buildPlaceholder(),
                                    ),
                                  ),
                                ),
                              );
                            },
                            separatorBuilder: (context, index) =>
                                const SizedBox(width: 10),
                            itemCount: galleryImages.length,
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      Text(
                        _normalizeDisplayLabel(
                          product.name,
                          fallback: 'Produto do salão',
                          maxLength: 120,
                        ),
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 20),
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          _ProductMetricCard(
                            label: 'Preço',
                            value: product.retailPrice == null
                                ? 'Aguardando valor'
                                : formatCurrency(product.retailPrice!),
                          ),
                          _ProductMetricCard(
                            label: 'Disponível',
                            value: availabilityLabel,
                          ),
                          _ProductMetricCard(
                            label: 'No pedido',
                            value: _orderLimit == 1
                                ? '1 item'
                                : 'Até $_orderLimit',
                          ),
                        ],
                      ),
                      if (widget.cartQuantity > 0) ...[
                        const SizedBox(height: 18),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Color.alphaBlend(
                              tokens.brand.withValues(alpha: 0.08),
                              tokens.surfaceStrong,
                            ),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: tokens.brand.withValues(alpha: 0.18),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.shopping_cart_checkout_rounded,
                                color: tokens.brandDark,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'Seu carrinho já tem ${widget.cartQuantity} ${product.unit} deste item.',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Color.alphaBlend(
                            tokens.accent.withValues(alpha: 0.08),
                            tokens.surfaceStrong,
                          ),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(
                            color: tokens.accent.withValues(alpha: 0.18),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              _canPurchase
                                  ? Icons.inventory_2_outlined
                                  : Icons.schedule_rounded,
                              color: tokens.brandDark,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                stockSupportCopy,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Container(
                padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 16),
                decoration: BoxDecoration(
                  color: Color.alphaBlend(
                    Colors.white.withValues(
                      alpha: tokens.isDarkShell ? 0.02 : 0.78,
                    ),
                    tokens.surfaceStrong,
                  ),
                  border: Border(
                    top: BorderSide(
                      color: tokens.outline.withValues(alpha: 0.8),
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: _ProductQuantityStepper(
                            quantity: _quantity,
                            maxQuantity: _sheetMaxQuantity,
                            unit: product.unit,
                            onDecrement: _quantity > 1
                                ? () => _setQuantity(_quantity - 1)
                                : null,
                            onIncrement: _quantity < _sheetMaxQuantity
                                ? () => _setQuantity(_quantity + 1)
                                : null,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'Resumo',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              subtotalLabel,
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(color: tokens.brand),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _canPurchase && _remainingCapacity > 0
                            ? _addToCart
                            : null,
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(54),
                        ),
                        child: Text(_primaryActionLabel),
                      ),
                    ),
                    if (widget.cartQuantity > 0) ...[
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _openCart,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                          ),
                          child: const Text('Ver carrinho'),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      _supportSummaryLabel,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProductMetricCard extends StatelessWidget {
  const _ProductMetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Container(
      constraints: const BoxConstraints(minWidth: 132),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          tokens.brand.withValues(alpha: 0.08),
          tokens.surfaceStrong,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tokens.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
          ),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _ProductQuantityStepper extends StatelessWidget {
  const _ProductQuantityStepper({
    required this.quantity,
    required this.maxQuantity,
    required this.unit,
    this.onDecrement,
    this.onIncrement,
  });

  final int quantity;
  final int maxQuantity;
  final String unit;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quantidade', style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: tokens.outline),
            color: tokens.surfaceStrong,
          ),
          child: Row(
            children: [
              IconButton(
                onPressed: onDecrement,
                style: IconButton.styleFrom(
                  backgroundColor: Color.alphaBlend(
                    tokens.brand.withValues(alpha: 0.08),
                    tokens.surfaceStrong,
                  ),
                ),
                icon: const Icon(Icons.remove_rounded),
              ),
              Expanded(
                child: Column(
                  children: [
                    Text(
                      '$quantity $unit',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      maxQuantity == 1
                          ? 'Limite de 1 por pedido'
                          : 'Até $maxQuantity por pedido',
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onIncrement,
                style: IconButton.styleFrom(
                  backgroundColor: Color.alphaBlend(
                    tokens.brand.withValues(alpha: 0.08),
                    tokens.surfaceStrong,
                  ),
                ),
                icon: const Icon(Icons.add_rounded),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FeedPreviewTile extends StatelessWidget {
  const _FeedPreviewTile({required this.post});

  final FeedPost post;

  IconData _previewIconFor(String postType) {
    switch (postType) {
      case 'before_after':
        return Icons.compare_rounded;
      case 'reel':
        return Icons.play_circle_outline_rounded;
      default:
        return Icons.photo_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final previewTitle = _normalizeDisplayLabel(
      post.title,
      fallback: 'Resultado real publicado pelo salao',
      maxLength: 90,
    );
    final previewCaption =
        _normalizeFeedCaption(post, maxLength: 180) ??
        'Resultado real compartilhado pelo salao.';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: PremiumNetworkImage(
                imageUrl: post.coverImageUrl,
                width: 88,
                height: 88,
                fit: BoxFit.cover,
                placeholder: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: context.salonTheme.heroGradient,
                  ),
                  child: Center(
                    child: Icon(
                      _previewIconFor(post.postType),
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 8,
              bottom: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.46),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  feedPostFormatLabel(post.postType),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: Colors.white),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                previewTitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                previewCaption,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 6),
              Text(
                formatRelativeFreshness(post.createdAt),
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
    this.onPayDeposit,
  });

  final AppointmentItem appointment;
  final VoidCallback? onCancel;
  final VoidCallback? onConfirmPresence;
  final VoidCallback? onPayDeposit;

  @override
  Widget build(BuildContext context) {
    final tone = switch (appointment.status) {
      'completed' => context.salonTheme.success,
      'cancelled' => const Color(0xFFB86060),
      'confirmed' => context.salonTheme.brand,
      _ => context.salonTheme.warning,
    };
    final statusLabel = switch (appointment.status) {
      'completed' => 'Concluído',
      'cancelled' => 'Cancelado',
      'confirmed' => 'Confirmado',
      'pending' => 'Pendente',
      _ => appointment.status,
    };
    final depositLabel = !appointment.hasDepositProtection
        ? null
        : appointment.hasReceivedDeposit
        ? appointment.depositPaidAt == null
              ? 'Sinal confirmado para esta reserva.'
              : 'Sinal confirmado em ${formatDateTime(appointment.depositPaidAt!)}'
        : appointment.depositStatus == 'waived'
        ? 'O salão dispensou o sinal desta reserva.'
        : appointment.depositStatus == 'refunded'
        ? 'O sinal desta reserva foi estornado.'
        : 'Sinal pendente de ${formatCurrency(appointment.depositAmount)}.';
    final protectionLabel = appointment.customerPresenceConfirmedAt != null
        ? null
        : appointment.customerConfirmationRequestedAt != null
        ? 'Confirme sua presença para manter este horário.'
        : appointment.protectionConfirmationRequired
        ? 'Se necessário, o salão vai pedir sua confirmação ${appointment.protectionConfirmationLeadMinutes} min antes.'
        : null;
    final pendingDepositAutomationLabel = appointment.hasPendingDeposit
        ? appointment.protectionAutoCancelPendingDeposit
              ? 'Se o sinal continuar pendente, a reserva pode ser liberada ${appointment.protectionAutoCancelLeadMinutes} min antes do horário.'
              : appointment.protectionDepositReminderLeadHours > 0
              ? 'Se o sinal seguir pendente, o app volta a lembrar ${appointment.protectionDepositReminderLeadHours}h antes.'
              : null
        : null;
    final managedDepositProviderLabel =
        appointment.usesManagedDepositProvider &&
            (appointment.depositPaymentProviderStatus ?? '').trim().isNotEmpty
        ? '${formatManagedDepositProviderStatusLabel(appointment.depositPaymentProviderStatus)}${appointment.depositPaymentProviderLastSyncedAt != null ? ' em ${formatDateTime(appointment.depositPaymentProviderLastSyncedAt!)}.' : '.'}'
        : null;
    final reportedDepositLabel = appointment.hasCustomerReportedDepositPayment
        ? appointment.depositCustomerReportedPaidVia == 'pix'
              ? 'Você avisou a equipe que já pagou o Pix em ${formatDateTime(appointment.depositCustomerReportedPaidAt!)}.'
              : appointment.depositCustomerReportedPaidVia == 'asaas_pix'
              ? 'Você avisou a equipe que o Pix automatico ja saiu da sua conta em ${formatDateTime(appointment.depositCustomerReportedPaidAt!)}.'
              : appointment.depositCustomerReportedPaidVia ==
                    'external_checkout'
              ? 'Você avisou a equipe que concluiu o checkout em ${formatDateTime(appointment.depositCustomerReportedPaidAt!)}.'
              : 'Você avisou a equipe que concluiu o pagamento em ${formatDateTime(appointment.depositCustomerReportedPaidAt!)}.'
        : null;
    final cancellationReason = _normalizeDisplayCopy(
      appointment.cancellationReason,
      maxLength: 180,
    );
    final depositNotes = _normalizeDisplayCopy(
      appointment.depositNotes,
      maxLength: 220,
    );
    final depositReference = _normalizeDisplayCopy(
      appointment.depositCustomerReportedReference,
      maxLength: 120,
    );
    final cancelledBy = _normalizeDisplayCopy(
      appointment.cancelledBy,
      maxLength: 80,
    );

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
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tone,
                    fontWeight: FontWeight.w700,
                  ),
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
          if (appointment.customerPresenceConfirmedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Presença confirmada em ${formatDateTime(appointment.customerPresenceConfirmedAt!)}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ] else if (appointment.customerConfirmationRequestedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'O salão pediu sua confirmação em ${formatDateTime(appointment.customerConfirmationRequestedAt!)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (cancellationReason != null) ...[
            const SizedBox(height: 8),
            Text(
              'Motivo: $cancellationReason',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (depositLabel != null) ...[
            const SizedBox(height: 8),
            Text(
              depositLabel,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
          if (pendingDepositAutomationLabel != null) ...[
            const SizedBox(height: 4),
            Text(
              pendingDepositAutomationLabel,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (managedDepositProviderLabel != null) ...[
            const SizedBox(height: 4),
            Text(
              managedDepositProviderLabel,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (reportedDepositLabel != null) ...[
            const SizedBox(height: 4),
            Text(
              reportedDepositLabel,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (appointment.hasDepositReceipt) ...[
            const SizedBox(height: 4),
            Text(
              'Comprovante enviado em ${formatDateTime(appointment.depositReceiptUploadedAt!)}.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (depositReference != null) ...[
            const SizedBox(height: 4),
            Text(
              'Referência enviada: $depositReference',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (protectionLabel != null) ...[
            const SizedBox(height: 4),
            Text(protectionLabel, style: Theme.of(context).textTheme.bodySmall),
          ],
          if (appointment.bookingPolicyAcknowledgedAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Politica aceita no app em ${formatDateTime(appointment.bookingPolicyAcknowledgedAt!)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (depositNotes != null) ...[
            const SizedBox(height: 4),
            Text(
              depositNotes,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (cancelledBy != null) ...[
            const SizedBox(height: 4),
            Text(
              'Cancelado por $cancelledBy',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (appointment.completedAt != null) ...[
            const SizedBox(height: 8),
            Text(
              'Atendimento concluído em ${formatDateTime(appointment.completedAt!)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (onCancel != null ||
              onConfirmPresence != null ||
              onPayDeposit != null) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (onPayDeposit != null)
                  FilledButton.tonal(
                    onPressed: onPayDeposit,
                    child: Text(
                      appointment.usesManagedDepositProvider
                          ? appointment.hasManagedDepositCharge
                                ? 'Ver Pix'
                                : 'Gerar Pix'
                          : appointment.hasCustomerReportedDepositPayment ||
                                appointment.hasDepositReceipt
                          ? 'Ver sinal'
                          : 'Pagar sinal',
                    ),
                  ),
                if (onConfirmPresence != null)
                  FilledButton(
                    onPressed: onConfirmPresence,
                    child: const Text('Confirmar presença'),
                  ),
                if (onCancel != null)
                  FilledButton.tonal(
                    onPressed: onCancel,
                    child: const Text('Cancelar horário'),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _HistoryAppointmentTile extends StatelessWidget {
  const _HistoryAppointmentTile({required this.appointment});

  final AppointmentItem appointment;

  @override
  Widget build(BuildContext context) {
    final tone = switch (appointment.status) {
      'completed' => context.salonTheme.success,
      'cancelled' => const Color(0xFFB86060),
      'confirmed' => context.salonTheme.brand,
      _ => context.salonTheme.warning,
    };
    final statusLabel = switch (appointment.status) {
      'completed' => 'Concluído',
      'cancelled' => 'Cancelado',
      'confirmed' => 'Confirmado',
      'pending' => 'Pendente',
      _ => appointment.status,
    };
    final serviceName = _normalizeDisplayLabel(
      appointment.serviceName,
      fallback: 'Servico do salao',
      maxLength: 90,
    );
    final supportLabel = _normalizeDisplayCopy(
      appointment.cancellationReason ??
          appointment.depositNotes ??
          appointment.staffMemberName,
      maxLength: 110,
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
        color: Color.alphaBlend(
          tone.withValues(alpha: 0.05),
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
                  serviceName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  statusLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tone,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${formatLongDate(appointment.date)} • ${formatTime(appointment.date)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (supportLabel != null) ...[
            const SizedBox(height: 6),
            Text(
              supportLabel,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _FeedPostCard extends StatelessWidget {
  const _FeedPostCard({
    required this.salonName,
    required this.salonLogoUrl,
    required this.post,
    required this.onLike,
    required this.onComment,
    this.onBook,
    this.onOpenExternal,
  });

  final String salonName;
  final String? salonLogoUrl;
  final FeedPost post;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback? onBook;
  final VoidCallback? onOpenExternal;

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final hasVisualMedia = post.hasUsableCoverImage || post.hasUsableVideo;
    final mediaHeight = hasVisualMedia
        ? screenWidth < 380
              ? 272.0
              : screenWidth < 460
              ? 324.0
              : 388.0
        : screenWidth < 380
        ? 148.0
        : 172.0;
    final linkedService = post.linkedService;
    final normalizedCaption = _normalizeFeedCaption(post, maxLength: 128);
    final normalizedTitle =
        _normalizeDisplayCopy(post.title, maxLength: 86) ?? post.title;
    final normalizedAuthorUsername = _normalizeDisplayCopy(
      post.externalAuthorUsername,
      maxLength: 40,
    );
    final authorLabel = post.isInstagramPost && normalizedAuthorUsername != null
        ? normalizedAuthorUsername.startsWith('@')
              ? normalizedAuthorUsername
              : '@$normalizedAuthorUsername'
        : salonName;
    final authorInitial = _safeDisplayInitial(
      (normalizedAuthorUsername ?? salonName).replaceFirst('@', ''),
      fallback: 'S',
    );
    final identityImageUrl = post.isInstagramPost
        ? post.coverImageUrl
        : salonLogoUrl;
    final metaLine = _buildFeedPostMetaLine(post);
    final serviceSummary = linkedService == null
        ? null
        : '${formatCurrency(linkedService.price)} • ${linkedService.duration} min';
    final identityRow = Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _FeedIdentityAvatar(
          imageUrl: identityImageUrl,
          fallbackInitial: authorInitial,
          highlightInstagram: post.isInstagramPost,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                authorLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                metaLine,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );

    return PremiumCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            child: SizedBox(
              width: double.infinity,
              height: mediaHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  hasVisualMedia
                      ? FeedPostMedia(post: post)
                      : DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: context.salonTheme.heroGradient,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: const Icon(
                                    Icons.photo_library_outlined,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Text(
                                    'Post sem capa válida. O feed continua funcional enquanto a mídia do salão é sincronizada.',
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(color: Colors.white),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: <Color>[
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.08),
                            Colors.black.withValues(alpha: 0.34),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (post.isInstagramPost)
                    Positioned(
                      top: 14,
                      right: 14,
                      child: _FeedMediaContextPill(
                        icon: Icons.camera_alt_outlined,
                        label: 'Instagram',
                      ),
                    ),
                  if (linkedService != null)
                    Positioned(
                      left: 16,
                      right: 16,
                      bottom: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.34),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.16),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.14),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(
                                Icons.spa_outlined,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    linkedService.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(color: Colors.white),
                                  ),
                                  if (serviceSummary != null)
                                    Text(
                                      serviceSummary,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: Colors.white.withValues(
                                              alpha: 0.82,
                                            ),
                                          ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: onOpenExternal,
                    borderRadius: BorderRadius.circular(20),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 2,
                        vertical: 2,
                      ),
                      child: identityRow,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _FeedContextPill(
                      label: feedPostFormatLabel(post.postType),
                      toneColor: context.salonTheme.brand,
                    ),
                    if (post.isInstagramPost)
                      const _FeedContextPill(
                        label: 'Instagram',
                        toneColor: Color(0xFFE05D5D),
                      ),
                    if ((post.staffMemberName ?? '').trim().isNotEmpty)
                      _FeedContextPill(
                        label: 'com ${post.staffMemberName}',
                        toneColor: context.salonTheme.textMuted,
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  normalizedTitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (normalizedCaption != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    normalizedCaption,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _FeedActionChip(
                      icon: post.likedByMe
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      label: '${post.likeCount}',
                      onPressed: onLike,
                      toneColor: post.likedByMe
                          ? const Color(0xFFD75D7A)
                          : context.salonTheme.textMuted,
                    ),
                    _FeedActionChip(
                      icon: Icons.chat_bubble_outline_rounded,
                      label: '${post.commentCount}',
                      onPressed: onComment,
                      toneColor: context.salonTheme.brand,
                    ),
                    if (onBook != null)
                      FilledButton.tonal(
                        onPressed: onBook,
                        child: const Text('Reservar este cuidado'),
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

class _FeedIdentityAvatar extends StatelessWidget {
  const _FeedIdentityAvatar({
    required this.fallbackInitial,
    this.imageUrl,
    this.highlightInstagram = false,
  });

  final String fallbackInitial;
  final String? imageUrl;
  final bool highlightInstagram;

  @override
  Widget build(BuildContext context) {
    final hasImage = (imageUrl ?? '').trim().isNotEmpty;

    return Container(
      width: 52,
      height: 52,
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: highlightInstagram
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: <Color>[
                  Color(0xFFF48A59),
                  Color(0xFFE05D5D),
                  Color(0xFFC46DCE),
                ],
              )
            : null,
        color: highlightInstagram ? null : context.salonTheme.outline,
      ),
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipOval(
              child: hasImage
                  ? PremiumNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      placeholder: _FeedIdentityAvatarPlaceholder(
                        fallbackInitial: fallbackInitial,
                      ),
                    )
                  : _FeedIdentityAvatarPlaceholder(
                      fallbackInitial: fallbackInitial,
                    ),
            ),
          ),
          if (highlightInstagram)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFE05D5D),
                  border: Border.all(
                    color: Theme.of(context).cardColor,
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.camera_alt_outlined,
                  size: 9,
                  color: Colors.white,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FeedIdentityAvatarPlaceholder extends StatelessWidget {
  const _FeedIdentityAvatarPlaceholder({required this.fallbackInitial});

  final String fallbackInitial;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          context.salonTheme.brand.withValues(alpha: 0.18),
          context.salonTheme.surfaceStrong,
        ),
      ),
      child: Center(
        child: Text(
          fallbackInitial,
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(color: context.salonTheme.brandDark),
        ),
      ),
    );
  }
}

class _FeedContextPill extends StatelessWidget {
  const _FeedContextPill({required this.label, required this.toneColor});

  final String label;
  final Color toneColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: toneColor.withValues(alpha: 0.10),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: toneColor,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _FeedMediaContextPill extends StatelessWidget {
  const _FeedMediaContextPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedActionChip extends StatelessWidget {
  const _FeedActionChip({
    required this.icon,
    required this.label,
    required this.onPressed,
    required this.toneColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final Color toneColor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: toneColor.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: toneColor),
            const SizedBox(width: 8),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: toneColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
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
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: context.salonTheme.surfaceStrong,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: context.salonTheme.outline,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      comment.customerName,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                  ),
                                  Text(
                                    formatRelativeFreshness(comment.createdAt),
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                comment.body,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
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
    final tierHighlights = <String>[
      if ((summary.currentTierLabel ?? '').trim().isNotEmpty)
        'Nível ${summary.currentTierLabel}',
      if (summary.rankPosition != null) 'Ranking #${summary.rankPosition}',
    ];
    final tierPreview = summary.tiers.take(3).toList(growable: false);

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
          if ((summary.programTitle ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              summary.programTitle!,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              MetricPill(
                label: 'Pontos',
                value: '${summary.pointsBalance}',
                toneColor: context.salonTheme.accent,
              ),
              MetricPill(
                label: 'Cashback',
                value: formatCurrency(summary.cashbackBalance),
                toneColor: context.salonTheme.brand,
              ),
              MetricPill(
                label: 'Visitas',
                value: '${summary.completedVisits}',
                toneColor: context.salonTheme.success,
              ),
            ],
          ),
          if ((summary.programDescription ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              summary.programDescription!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (tierHighlights.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              tierHighlights.join(' • '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.45),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.workspace_premium_rounded,
                  color: context.salonTheme.accent,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    summary.nextTierLabel == null
                        ? 'Você já está acumulando histórico e benefícios ativos no salão.'
                        : 'Faltam ${summary.visitsToNextTier} visita(s) para chegar em ${summary.nextTierLabel}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${summary.completedVisits} visitas concluídas • ${summary.totalPointsEarned} pontos emitidos',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (summary.totalCashbackEarned > 0 ||
              summary.rankedCustomers > 0 ||
              (summary.vipRewardServiceName ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              [
                if (summary.totalCashbackEarned > 0)
                  '${formatCurrency(summary.totalCashbackEarned)} em cashback histórico',
                if (summary.rankedCustomers > 0)
                  '${summary.rankedCustomers} cliente(s) no ranking',
                if ((summary.vipRewardServiceName ?? '').trim().isNotEmpty)
                  'Brinde VIP: ${summary.vipRewardServiceName}',
              ].join(' • '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (summary.lastRewardAt != null) ...[
            const SizedBox(height: 6),
            Text(
              'Última recompensa registrada em ${formatDateTime(summary.lastRewardAt!)}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (tierPreview.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tier in tierPreview)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: tier.label == summary.currentTierLabel
                          ? context.salonTheme.accent.withValues(alpha: 0.14)
                          : Colors.white.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: tier.label == summary.currentTierLabel
                            ? context.salonTheme.accent.withValues(alpha: 0.32)
                            : Colors.transparent,
                      ),
                    ),
                    child: Text(
                      '${tier.label} • ${tier.minVisits}+ visitas • ${tier.discountPercent.toStringAsFixed(tier.discountPercent.truncateToDouble() == tier.discountPercent ? 0 : 1)}% OFF${tier.isVip ? ' • VIP' : ''}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
              ],
            ),
          ],
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
    final statusLine = summary.hasActiveProgram
        ? '${summary.qualifiedCount} indicação(ões) qualificadas • ${summary.pendingCount} aguardando validação'
        : 'O programa de indicação ainda não está ativo para sua conta.';
    final rewardLine = summary.availableRewardsCount > 0
        ? '${summary.availableRewardsCount} recompensa(s) disponível(is) agora.'
        : summary.nextRewardRemaining > 0
        ? 'Faltam ${summary.nextRewardRemaining} indicação(ões) para liberar a próxima recompensa.'
        : 'Convide alguém com seu código para começar a acumular recompensas.';
    final cycleLine = summary.requiredQualifiedReferrals > 0
        ? '${summary.currentCycleProgress}/${summary.requiredQualifiedReferrals} no ciclo atual'
        : null;
    final latestUnlock = summary.rewardUnlocks.isEmpty
        ? null
        : summary.rewardUnlocks.first;
    final recentReferral = summary.referrals.isEmpty
        ? null
        : summary.referrals.first;

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
          if ((summary.programTitle ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              summary.programTitle!,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ],
          const SizedBox(height: 12),
          if (summary.referralCode.isEmpty)
            Text(
              'Seu código ainda não foi gerado.',
              style: Theme.of(context).textTheme.bodyMedium,
            )
          else
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      'Código ${summary.referralCode}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                OutlinedButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: summary.referralCode),
                    );
                    if (!context.mounted) {
                      return;
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Código de indicação copiado.'),
                      ),
                    );
                  },
                  icon: const Icon(Icons.copy_rounded),
                  label: const Text('Copiar'),
                ),
              ],
            ),
          if ((summary.programDescription ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              summary.programDescription!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              MetricPill(
                label: 'Qualificadas',
                value: '${summary.qualifiedCount}',
                toneColor: context.salonTheme.success,
              ),
              MetricPill(
                label: 'Pendentes',
                value: '${summary.pendingCount}',
                toneColor: context.salonTheme.warning,
              ),
              MetricPill(
                label: 'Recompensas',
                value: '${summary.availableRewardsCount}',
                toneColor: context.salonTheme.brand,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(statusLine, style: Theme.of(context).textTheme.bodySmall),
          if (cycleLine != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.45),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.local_fire_department_rounded,
                    color: context.salonTheme.warning,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      cycleLine,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          Text(rewardLine, style: Theme.of(context).textTheme.bodySmall),
          if ((summary.rewardForReferrer ?? '').trim().isNotEmpty ||
              (summary.rewardForInvited ?? '').trim().isNotEmpty ||
              (summary.rewardServiceName ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              [
                if ((summary.rewardForReferrer ?? '').trim().isNotEmpty)
                  'Para você: ${summary.rewardForReferrer}',
                if ((summary.rewardForInvited ?? '').trim().isNotEmpty)
                  'Para convidadas: ${summary.rewardForInvited}',
                if ((summary.rewardServiceName ?? '').trim().isNotEmpty)
                  'Serviço liberado: ${summary.rewardServiceName}',
              ].join(' • '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (summary.unlockedRewardsCount > 0 ||
              latestUnlock != null ||
              recentReferral != null) ...[
            const SizedBox(height: 8),
            Text(
              [
                if (summary.unlockedRewardsCount > 0)
                  '${summary.unlockedRewardsCount} recompensa(s) já liberada(s)',
                if (latestUnlock != null)
                  latestUnlock.redeemedAt == null
                      ? 'Última liberação em ${formatDateTime(latestUnlock.unlockedAt)}'
                      : 'Último resgate em ${formatDateTime(latestUnlock.redeemedAt!)}',
                if (recentReferral != null)
                  recentReferral.status == 'qualified'
                      ? '${recentReferral.customerName} já validou a indicação'
                      : '${recentReferral.customerName} ainda está em validação',
              ].join(' • '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
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

List<Widget> _buildOperationalNoticeWidgets<T>({
  required String scope,
  required int refreshSeed,
  required CachedView<T> view,
  required List<OperationalIssue> issues,
  required Future<void> Function() onRetry,
}) {
  final widgets = <Widget>[];

  if (view.isFromCache) {
    widgets.add(
      StaggerReveal(
        key: ValueKey('$scope-status-$refreshSeed'),
        child: Align(
          alignment: Alignment.centerLeft,
          child: StatusPill(label: _cacheStatusLabel(view)),
        ),
      ),
    );
  }

  if (view.isFromCache && (view.fallbackReason ?? '').trim().isNotEmpty) {
    if (widgets.isNotEmpty) {
      widgets.add(const SizedBox(height: 12));
    }
    widgets.add(
      StaggerReveal(
        key: ValueKey('$scope-fallback-$refreshSeed'),
        delay: const Duration(milliseconds: 40),
        child: OperationalNoticeCard(
          title: 'Exibindo a última versão salva',
          message: _friendlyFallbackMessage(view.fallbackReason),
          action: OutlinedButton(
            onPressed: onRetry,
            child: const Text('Tentar sincronizar de novo'),
          ),
          icon: Icons.cloud_off_rounded,
        ),
      ),
    );
  }

  if (issues.isNotEmpty) {
    if (widgets.isNotEmpty) {
      widgets.add(const SizedBox(height: 12));
    }
    widgets.add(
      StaggerReveal(
        key: ValueKey('$scope-issues-$refreshSeed'),
        delay: const Duration(milliseconds: 80),
        child: OperationalNoticeCard(
          title: 'Alguns dados não chegaram do painel',
          message: formatOperationalIssues(issues),
          action: OutlinedButton(
            onPressed: onRetry,
            child: const Text('Atualizar agora'),
          ),
        ),
      ),
    );
  }

  if (widgets.isNotEmpty) {
    widgets.add(const SizedBox(height: 16));
  }

  return widgets;
}

String _friendlyFallbackMessage(String? fallbackReason) {
  final reason = fallbackReason?.toLowerCase() ?? '';
  if (reason.contains('failed host lookup') ||
      reason.contains('socketexception') ||
      reason.contains('clientexception')) {
    return 'O app não conseguiu falar com a internet ou com o servidor do salão agora. Mantivemos a última versão salva para você não perder contexto.';
  }
  if (reason.contains('timeout')) {
    return 'A sincronização demorou mais do que o esperado. Mantivemos a última versão salva enquanto tentamos novamente.';
  }
  if (reason.contains('postgrestexception')) {
    return 'O painel do salão não respondeu como esperado nesta atualização. Mantivemos a última versão salva até a sincronização voltar ao normal.';
  }
  return 'Não foi possível sincronizar esta área agora. Mantivemos a última versão salva para a experiência não parecer vazia.';
}
