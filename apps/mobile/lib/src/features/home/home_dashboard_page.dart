import 'dart:async';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_brand_hero.dart';
import '../../core/widgets/salon_ui.dart';
import '../auth/session_controller.dart';
import '../notifications/customer_notifications_controller.dart';
import '../profile/loyalty_page.dart';
import '../shared/app_models.dart';
import '../shared/membership_offer_state.dart';

class HomeDashboardPage extends StatefulWidget {
  const HomeDashboardPage({
    super.key,
    required this.bootstrap,
    required this.sessionController,
    required this.notificationsController,
    required this.onNavigate,
    this.onOpenOfferBooking,
  });

  final AppBootstrap bootstrap;
  final SessionController sessionController;
  final CustomerNotificationsController notificationsController;
  final ValueChanged<int> onNavigate;
  final ValueChanged<SalonOfferHighlight>? onOpenOfferBooking;

  @override
  State<HomeDashboardPage> createState() => _HomeDashboardPageState();
}

class _HomeDashboardPageState extends State<HomeDashboardPage> {
  bool _loading = true;
  LoyaltySummary? _loyalty;
  ReferralSummary? _referral;
  List<CustomerAppointment> _appointments = const [];
  List<StoreOrder> _orders = const [];
  BirthdayHomeExperience? _birthdayExperience;
  CustomerMembershipOverview _membershipOverview =
      const CustomerMembershipOverview.empty();
  bool _membershipActionBusy = false;
  late int _lastHomeRevision;
  Future<void>? _loadInFlight;
  Timer? _birthdayExpiryTimer;
  bool _queuedReload = false;

  @override
  void initState() {
    super.initState();
    _lastHomeRevision = widget.notificationsController.homeRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _scheduleLoad();
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
    _birthdayExpiryTimer?.cancel();
    widget.notificationsController.removeListener(_handleSyncChange);
    super.dispose();
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.homeRevision;
    if (_lastHomeRevision == revision) {
      return;
    }

    _lastHomeRevision = revision;
    _scheduleLoad();
  }

  void _scheduleLoad() {
    final inFlight = _loadInFlight;
    if (inFlight != null) {
      _queuedReload = true;
      return;
    }

    final future = _load();
    _loadInFlight = future;
    unawaited(
      future.whenComplete(() {
        if (identical(_loadInFlight, future)) {
          _loadInFlight = null;
        }
        if (_queuedReload && mounted) {
          _queuedReload = false;
          _scheduleLoad();
        }
      }),
    );
  }

  Future<void> _load() async {
    final currentSession = widget.sessionController.session;
    if (currentSession == null) {
      return;
    }

    // Keep the current shell responsive while the branded landing refreshes.
    unawaited(widget.sessionController.refreshLandingDataIfNeeded());

    final loyaltyFallback = _loyalty;
    final referralFallback = _referral;
    final appointmentsFallback = _appointments;
    final ordersFallback = _orders;
    final birthdayFallback = _birthdayExperience;
    final membershipFallback = _membershipOverview;

    final results = await Future.wait<dynamic>([
      _safeLoad(
        widget.bootstrap.profileRepository.fetchLoyaltySummary,
        loyaltyFallback,
      ),
      _safeLoad(
        widget.bootstrap.profileRepository.fetchReferralSummary,
        referralFallback,
      ),
      _safeLoad(
        widget.bootstrap.bookingRepository.fetchAppointments,
        appointmentsFallback,
      ),
      _safeLoad(widget.bootstrap.storeRepository.fetchOrders, ordersFallback),
      _safeLoad(
        widget.bootstrap.profileRepository.fetchBirthdayHomeExperience,
        birthdayFallback,
      ),
      _safeLoad(
        () => widget.bootstrap.profileRepository.fetchMembershipOverview(
          customerId: currentSession.customer.id,
        ),
        membershipFallback,
      ),
    ]);

    if (!mounted) {
      return;
    }

    final birthdayExperience = _activeBirthdayExperience(
      results[4] as BirthdayHomeExperience?,
      DateTime.now(),
    );

    setState(() {
      _loyalty = results[0] as LoyaltySummary?;
      _referral = results[1] as ReferralSummary?;
      _appointments = results[2] as List<CustomerAppointment>;
      _orders = results[3] as List<StoreOrder>;
      _birthdayExperience = birthdayExperience;
      _membershipOverview = results[5] as CustomerMembershipOverview;
      _loading = false;
    });
    _scheduleBirthdayExpiry(birthdayExperience);
  }

  Future<T> _safeLoad<T>(Future<T> Function() loader, T fallback) async {
    try {
      return await loader();
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _openLoyaltyPage() async {
    final session = widget.sessionController.session;
    if (session == null || _loyalty?.program?.isActive != true) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => LoyaltyPage(
          bootstrap: widget.bootstrap,
          notificationsController: widget.notificationsController,
          session: session,
          customer: session.customer,
          initialSummary: _loyalty,
        ),
      ),
    );
  }

  BirthdayHomeExperience? _activeBirthdayExperience(
    BirthdayHomeExperience? experience,
    DateTime now,
  ) {
    if (experience == null) {
      return null;
    }

    final expiresAt = experience.expiresAt;
    if (expiresAt != null && !expiresAt.isAfter(now)) {
      return null;
    }

    return experience;
  }

  void _scheduleBirthdayExpiry(BirthdayHomeExperience? experience) {
    _birthdayExpiryTimer?.cancel();
    _birthdayExpiryTimer = null;

    final activeExperience = _activeBirthdayExperience(
      experience,
      DateTime.now(),
    );
    if (activeExperience == null) {
      return;
    }

    final now = DateTime.now();
    final expiresAt = activeExperience.expiresAt ?? _nextLocalMidnight(now);
    final delay = expiresAt.difference(now);
    if (delay <= Duration.zero) {
      setState(() => _birthdayExperience = null);
      return;
    }

    _birthdayExpiryTimer = Timer(delay, () {
      if (!mounted) {
        return;
      }

      setState(() => _birthdayExperience = null);
      _scheduleLoad();
    });
  }

  DateTime _nextLocalMidnight(DateTime now) {
    return DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
  }

  Future<bool> _requestMembershipPlan(
    SalonOfferHighlight offer, {
    String? notes,
  }) async {
    if (_membershipActionBusy) {
      return false;
    }

    setState(() => _membershipActionBusy = true);
    try {
      final request = await widget.bootstrap.profileRepository
          .requestMembershipPlan(offerId: offer.id, notes: notes);
      if (!mounted) {
        return false;
      }

      setState(() {
        _membershipOverview = CustomerMembershipOverview(
          memberships: _membershipOverview.memberships,
          pendingRequests: [
            request,
            for (final current in _membershipOverview.pendingRequests)
              if (current.offerId != request.offerId &&
                  current.id != request.id)
                current,
          ],
        );
      });

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(
              'Pedido de ${offer.title} enviado. O salao aprova e depois confirma o pagamento para liberar no app.',
            ),
          ),
        );
      _scheduleLoad();
      return true;
    } catch (error) {
      if (!mounted) {
        return false;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('$error'.replaceFirst('Exception: ', ''))),
        );
      return false;
    } finally {
      if (mounted) {
        setState(() => _membershipActionBusy = false);
      }
    }
  }

  Future<void> _openMembershipRequestFlow(SalonOfferHighlight offer) async {
    if (_membershipActionBusy) {
      return;
    }

    final notesController = TextEditingController();
    bool submitting = false;
    bool submitted = false;

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> submit() async {
              setModalState(() => submitting = true);
              final success = await _requestMembershipPlan(
                offer,
                notes: notesController.text,
              );
              if (!context.mounted || !success) {
                if (context.mounted) {
                  setModalState(() => submitting = false);
                }
                return;
              }
              submitted = true;
              Navigator.of(context).pop();
            }

            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                salonBottomActionInset(context),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionTitle(
                      title: 'Pedir plano ao salão',
                      subtitle:
                          'Seu pedido chega no painel para o salão aprovar e liberar só depois da confirmação de pagamento.',
                    ),
                    const SizedBox(height: 16),
                    _OfferRequestSummaryCard(offer: offer),
                    const SizedBox(height: 14),
                    TextField(
                      controller: notesController,
                      minLines: 3,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Observação para o salão',
                        hintText:
                            'Ex.: quero usar esse plano para manter meus horários fixos.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    AsyncButton(
                      label: 'Enviar pedido ao salão',
                      isBusy: submitting,
                      icon: Icons.send_rounded,
                      onPressed: submit,
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    notesController.dispose();

    if (!submitted || !mounted) {
      return;
    }
  }

  void _openPromotionOffer(SalonOfferHighlight offer) {
    if (widget.onOpenOfferBooking != null) {
      widget.onOpenOfferBooking!(offer);
      return;
    }

    widget.onNavigate(1);
  }

  Future<void> _openMembershipStatusSheet(
    SalonOfferHighlight offer,
    MembershipOfferState state,
  ) async {
    final accent = AppTheme.spec(context).primaryColor;
    final plan = state.activePlan ?? state.scheduledPlan;
    final includedLabel = _membershipOfferIncludedLabel(offer, plan);
    final cycleLabel = plan == null ? null : _membershipPlanCycleLabel(plan);
    final periodLabel = plan == null ? null : _membershipPlanPeriodLabel(plan);
    final nextStepLabel = switch (state.actionKind) {
      MembershipOfferActionKind.pendingApproval =>
        'O salao ainda precisa aprovar o pedido no painel antes de seguir para a liberacao.',
      MembershipOfferActionKind.awaitingPayment =>
        'O pedido ja foi aprovado. Agora o salao precisa marcar o pagamento para ativar o plano no app.',
      MembershipOfferActionKind.scheduled =>
        'Quando a data de inicio chegar, a agenda libera o uso sem precisar pedir de novo.',
      MembershipOfferActionKind.active =>
        'Abra a Agenda para reservar um horario e o salao baixa a sessao depois do atendimento.',
      MembershipOfferActionKind.renewalDue =>
        'Seu plano segue ativo e a renovacao ja pode ser pedida pelo app.',
      MembershipOfferActionKind.subscribe =>
        'Escolha agora um horario preferido no app. O salao aprova, confirma o pagamento e o sistema tenta fixar a serie automaticamente.',
    };

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            8,
            20,
            salonBottomActionInset(context),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionTitle(
                  title: _membershipStatusSheetTitle(state),
                  subtitle: _membershipStatusSheetSubtitle(state),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Pill(
                      label: offer.kindLabel,
                      icon: Icons.workspace_premium_rounded,
                      backgroundColor: accent.withValues(alpha: 0.12),
                      foregroundColor: accent,
                    ),
                    ..._membershipOfferStatePills(
                      context,
                      accent: accent,
                      state: state,
                    ),
                    if (offer.priceLabel?.trim().isNotEmpty == true)
                      Pill(
                        label: offer.priceLabel!,
                        icon: Icons.sell_rounded,
                        backgroundColor: AppTheme.accent.withValues(
                          alpha: 0.16,
                        ),
                        foregroundColor: AppTheme.ink,
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.panel.withValues(alpha: 0.97),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: AppTheme.line),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        offer.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _membershipOfferDetailText(offer, state),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 14),
                      _MembershipStatusLine(
                        icon: Icons.flag_rounded,
                        label: 'Situacao',
                        value: _membershipOfferStateLabel(state),
                      ),
                      if (periodLabel != null) ...[
                        const SizedBox(height: 10),
                        _MembershipStatusLine(
                          icon: Icons.calendar_month_rounded,
                          label: 'Periodo',
                          value: periodLabel,
                        ),
                      ],
                      if (includedLabel != null) ...[
                        const SizedBox(height: 10),
                        _MembershipStatusLine(
                          icon: Icons.content_cut_rounded,
                          label: 'Inclui',
                          value: includedLabel,
                        ),
                      ],
                      if (plan != null) ...[
                        const SizedBox(height: 10),
                        _MembershipStatusLine(
                          icon: Icons.confirmation_num_rounded,
                          label: state.activePlan != null
                              ? 'Saldo de sessoes'
                              : 'Sessoes previstas',
                          value: state.activePlan != null
                              ? _membershipSessionsRemainingLabel(
                                  state.activePlan!,
                                )
                              : _membershipSessionsIncludedLabel(plan),
                        ),
                      ],
                      if (cycleLabel != null) ...[
                        const SizedBox(height: 10),
                        _MembershipStatusLine(
                          icon: Icons.timelapse_rounded,
                          label: 'Ciclo',
                          value: cycleLabel,
                        ),
                      ],
                      const SizedBox(height: 10),
                      _MembershipStatusLine(
                        icon: Icons.auto_awesome_rounded,
                        label: 'Proximo passo',
                        value: nextStepLabel,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: AsyncButton(
                    label: state.isActive ? 'Ir para agenda' : 'Entendi',
                    isBusy: false,
                    icon: state.isActive
                        ? Icons.calendar_month_rounded
                        : Icons.check_rounded,
                    onPressed: () {
                      Navigator.of(context).pop();
                      if (state.isActive) {
                        widget.onNavigate(1);
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleMembershipOfferAction(
    SalonOfferHighlight offer,
    MembershipOfferState? state,
  ) async {
    if (state?.actionKind == MembershipOfferActionKind.subscribe) {
      final openOfferBooking = widget.onOpenOfferBooking;
      if (openOfferBooking != null) {
        openOfferBooking(_buildMembershipRequestSchedulerOffer(offer));
        return;
      }

      widget.onNavigate(1);
      return;
    }

    if (state?.allowsRequest == true) {
      await _openMembershipRequestFlow(offer);
      return;
    }

    if (_isPendingFirstSlotMembershipPlan(state?.activePlan, DateTime.now())) {
      _openMembershipPlanScheduler(state!.activePlan!);
      return;
    }

    if (state != null) {
      await _openMembershipStatusSheet(offer, state);
    }
  }

  void _openCampaignTarget(SalonCampaign campaign) {
    final target = campaign.ctaTarget?.trim().toLowerCase();
    switch (target) {
      case 'appointments':
        widget.onNavigate(1);
        return;
      case 'feed':
        widget.onNavigate(3);
        return;
      case 'profile':
        widget.onNavigate(4);
        return;
      case 'notifications':
        widget.onNavigate(4);
        return;
      case 'support':
        widget.onNavigate(4);
        return;
      case 'explore':
      default:
        widget.onNavigate(2);
        return;
    }
  }

  List<SalonCampaign> _resolveVisibleCampaigns(
    List<SalonCampaign> campaigns, {
    required DateTime now,
    required bool hasUpcomingAppointment,
    required bool hasActiveBenefits,
  }) {
    return campaigns
        .where((campaign) {
          if (!_isCampaignLiveAt(campaign, now)) {
            return false;
          }

          switch (campaign.audience.trim().toLowerCase()) {
            case 'with_upcoming_appointment':
              return hasUpcomingAppointment;
            case 'without_upcoming_appointment':
              return !hasUpcomingAppointment;
            case 'with_active_benefits':
              return hasActiveBenefits;
            case 'without_active_benefits':
              return !hasActiveBenefits;
            case 'all':
            default:
              return true;
          }
        })
        .toList(growable: false);
  }

  bool _hasActiveBenefitsAt(DateTime now) {
    final loyalty = _loyalty;
    final referral = _referral;

    if (loyalty != null &&
        (loyalty.pointsBalance > 0 || loyalty.cashbackBalance > 0)) {
      return true;
    }

    if (referral != null && referral.availableRewardsCount > 0) {
      return true;
    }

    return _membershipOverview.memberships.any(
      (membership) => membership.isActiveOn(now),
    );
  }

  List<CustomerMembershipPlan> _pendingFirstSlotMembershipPlans(DateTime now) {
    final pending =
        _membershipOverview.memberships
            .where((membership) {
              if (membership.status != 'active' ||
                  !membership.isActiveOn(now)) {
                return false;
              }

              final reservedCount = _appointments.where((appointment) {
                return appointment.membershipPlanId == membership.id &&
                    appointment.membershipPlanReservationStatus ==
                        'scheduled' &&
                    appointment.status != 'cancelled' &&
                    appointment.date.isAfter(now);
              }).length;

              return membership.sessionsRemaining > 0 && reservedCount == 0;
            })
            .toList(growable: false)
          ..sort((left, right) {
            final expirationOrder = left.expiresAt.compareTo(right.expiresAt);
            if (expirationOrder != 0) {
              return expirationOrder;
            }

            return left.title.toLowerCase().compareTo(
              right.title.toLowerCase(),
            );
          });

    return pending;
  }

  bool _isPendingFirstSlotMembershipPlan(
    CustomerMembershipPlan? membership,
    DateTime now,
  ) {
    if (membership == null) {
      return false;
    }

    return _pendingFirstSlotMembershipPlans(
      now,
    ).any((candidate) => candidate.id == membership.id);
  }

  SalonOfferHighlight _buildMembershipPlanSchedulerOffer(
    CustomerMembershipPlan membership,
  ) {
    final serviceName = sentenceOrFallback(
      membership.serviceName,
      'Servico do plano',
    );

    return SalonOfferHighlight(
      id: 'membership-plan:${membership.id}',
      kind: 'membership',
      title: membership.title,
      description:
          'Escolha somente um dia e horario para $serviceName. O app trava automaticamente as proximas sessoes no mesmo ritmo com o profissional dessa area.',
      highlightText: 'Serie fixa do plano',
      imageUrl: null,
      bookingServiceId: membership.serviceId,
      bookingServiceName: membership.serviceName,
      actionKind: 'schedule_membership_plan',
      kindLabel: 'Plano ativo',
      priceLabel: null,
      lifecycleLabel: 'Serie fixa',
    );
  }

  SalonOfferHighlight _buildMembershipRequestSchedulerOffer(
    SalonOfferHighlight offer,
  ) {
    final serviceName = sentenceOrFallback(
      offer.bookingServiceName,
      'o servico do plano',
    );

    return SalonOfferHighlight(
      id: offer.id,
      kind: offer.kind,
      title: offer.title,
      description:
          'Escolha agora um dia e horario preferidos para $serviceName. O salao aprova, confirma o pagamento e o sistema tenta travar a serie automaticamente sem voce repetir esse passo.',
      highlightText: offer.highlightText,
      imageUrl: offer.imageUrl,
      bookingServiceId: offer.bookingServiceId,
      bookingServiceName: offer.bookingServiceName,
      actionKind: membershipRequestSchedulingActionKind,
      kindLabel: offer.kindLabel,
      priceLabel: offer.priceLabel,
      lifecycleLabel: offer.lifecycleLabel,
    );
  }

  void _openMembershipPlanScheduler(CustomerMembershipPlan membership) {
    final openOfferBooking = widget.onOpenOfferBooking;
    if (openOfferBooking != null) {
      openOfferBooking(_buildMembershipPlanSchedulerOffer(membership));
      return;
    }

    widget.onNavigate(1);
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.sessionController.session!;
    final landing = session.landingData;
    final preview = landing?.preview;
    final salonDisplayName = _homeHeroSalonName(preview);
    final customerDisplayName = session.customer.name.trim();
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
    final recentReviews =
        landing?.recentReviews ?? const <SalonReviewHighlight>[];
    final featuredServices =
        landing?.featuredServices ?? const <SalonServiceHighlight>[];
    final activeOffers = landing?.activeOffers ?? const <SalonOfferHighlight>[];
    final highlightedService = featuredServices.isEmpty
        ? null
        : featuredServices.first;
    final highlightedPost = recentPosts.isEmpty ? null : recentPosts.first;
    final highlightedPromotionOffer = _firstOfferByKind(
      activeOffers,
      'promotion',
    );
    final highlightedMembershipOffer = _firstOfferByKind(
      activeOffers,
      'membership',
    );
    final promotionFallbackImageUrl = _resolveOfferShowcaseImageUrl(
      preferredImageUrl: highlightedPromotionOffer?.imageUrl,
      serviceImageUrl: highlightedService?.imageUrl,
      galleryImageUrl: highlightedPost?.imageUrl,
      heroImageUrl: preview?.heroImageUrl,
    );
    final membershipFallbackImageUrl = _resolveOfferShowcaseImageUrl(
      preferredImageUrl: highlightedMembershipOffer?.imageUrl,
      serviceImageUrl: highlightedService?.imageUrl,
      galleryImageUrl: highlightedPost?.imageUrl,
      heroImageUrl: preview?.heroImageUrl,
    );
    final membershipOfferState = highlightedMembershipOffer == null
        ? null
        : MembershipOfferState.resolve(
            offerId: highlightedMembershipOffer.id,
            overview: _membershipOverview,
          );
    final pendingFirstSlotMemberships = _pendingFirstSlotMembershipPlans(now);
    final highlightedPendingMembership =
        membershipOfferState != null &&
            _isPendingFirstSlotMembershipPlan(
              membershipOfferState.activePlan,
              now,
            )
        ? membershipOfferState.activePlan
        : null;
    final highlightedMembershipDetailText = highlightedMembershipOffer == null
        ? null
        : highlightedPendingMembership != null
        ? 'Seu plano ja esta ativo. Escolha so um dia e horario para ${sentenceOrFallback(highlightedPendingMembership.serviceName, 'o servico do plano')} e o app distribui automaticamente a serie no calendario, sempre marcada como plano.'
        : _membershipOfferDetailText(
            highlightedMembershipOffer,
            membershipOfferState,
          );
    final highlightedMembershipCtaLabel = highlightedPendingMembership != null
        ? 'Escolher horario fixo'
        : _membershipOfferActionLabel(membershipOfferState);
    final highlightedMembershipCtaIcon = highlightedPendingMembership != null
        ? Icons.event_repeat_rounded
        : _membershipOfferActionIcon(membershipOfferState);
    final hasConfirmedActivePlan = _membershipOverview.memberships.any(
      (membership) =>
          membership.status == 'active' && membership.isActiveOn(now),
    );
    final hasActiveBenefits = _hasActiveBenefitsAt(now);
    final campaigns = _resolveVisibleCampaigns(
      landing?.centralCampaigns ?? const <SalonCampaign>[],
      now: now,
      hasUpcomingAppointment: nextAppointment != null,
      hasActiveBenefits: hasActiveBenefits,
    );
    final birthdayExperience = _activeBirthdayExperience(
      _birthdayExperience,
      now,
    );
    final featuredOfferIds = <String>{
      if (highlightedPromotionOffer != null) highlightedPromotionOffer.id,
      if (highlightedMembershipOffer != null) highlightedMembershipOffer.id,
    };
    final remainingOffers = activeOffers
        .where((offer) => !featuredOfferIds.contains(offer.id))
        .toList(growable: false);
    final feedPulseCount =
        landing?.stats.recentPostsCount ?? recentPosts.length;
    final offersCount =
        landing?.stats.activeOffersCount ?? landing?.activeOffers.length ?? 0;
    final servicesCount =
        landing?.stats.servicesCount ?? featuredServices.length;
    final visibleHomeModules = preview?.visibleHomeModules ?? const <String>[];
    final homeEmphasis = preview?.homeEmphasis?.trim().toLowerCase();
    final logoUrl = _normalizedImageUrl(preview?.logoUrl);
    final customerProfileImageUrl = _normalizedImageUrl(
      session.customer.profileImageUrl,
    );
    final heroProfileImageUrl = customerProfileImageUrl ?? logoUrl;

    bool showModule(String module) {
      return visibleHomeModules.isEmpty || visibleHomeModules.contains(module);
    }

    final hasActiveLoyaltyProgram = _loyalty?.program?.isActive == true;
    final showLoyaltyModule = showModule('loyalty') && hasActiveLoyaltyProgram;

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
      if (showLoyaltyModule)
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
      if (showLoyaltyModule)
        _MomentumCard(
          icon: Icons.workspace_premium_rounded,
          title: _loyalty?.currentTierName ?? 'Programa ativo',
          subtitle: '${_loyalty?.completedVisits ?? 0} visitas concluídas',
          support: _loyalty?.nextTierName == null
              ? 'Você já está no nível atual'
              : 'Faltam ${_loyalty?.visitsToNextTier ?? 0} visitas para ${_loyalty?.nextTierName}',
          tone: AppTheme.primary,
        ),
      if (showLoyaltyModule)
        _MomentumCard(
          icon: Icons.payments_rounded,
          title: formatCurrency(_loyalty?.cashbackBalance ?? 0),
          subtitle: 'Cashback disponível',
          support: 'Use seu saldo em serviços e compras.',
          tone: AppTheme.accent,
        ),
      if (showLoyaltyModule)
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
                  height: 300,
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
                          onTap: () => _openCampaignTarget(campaign),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (showModule('promotions') && highlightedPromotionOffer != null)
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
                  offer: highlightedPromotionOffer,
                  accent: accent,
                  fallbackImageUrl: promotionFallbackImageUrl,
                  detailText: _promotionOfferDetailText(
                    highlightedPromotionOffer,
                  ),
                  ctaLabel: _promotionOfferActionLabel(
                    highlightedPromotionOffer,
                    preview?.primaryCtaLabel,
                  ),
                  ctaIcon: Icons.calendar_month_rounded,
                  onTap: () => _openPromotionOffer(highlightedPromotionOffer),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (showModule('promotions') && highlightedMembershipOffer != null)
            (
              key: 'benefits',
              position: 2,
              children: [
                const SectionTitle(
                  title: 'Plano do salão',
                  subtitle:
                      'Veja aceite, saldo, periodo do plano e o proximo passo sem sair da home.',
                ),
                const SizedBox(height: 14),
                _OfferFeatureCard(
                  offer: highlightedMembershipOffer,
                  accent: accent,
                  fallbackImageUrl: membershipFallbackImageUrl,
                  headerPills: _membershipOfferStatePills(
                    context,
                    accent: accent,
                    state: membershipOfferState,
                  ),
                  detailText: highlightedMembershipDetailText,
                  ctaLabel: highlightedMembershipCtaLabel,
                  ctaIcon: highlightedMembershipCtaIcon,
                  isCtaBusy: _membershipActionBusy,
                  onTap: highlightedPendingMembership != null
                      ? () => _openMembershipPlanScheduler(
                          highlightedPendingMembership,
                        )
                      : () => _handleMembershipOfferAction(
                          highlightedMembershipOffer,
                          membershipOfferState,
                        ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (pendingFirstSlotMemberships.isNotEmpty)
            (
              key: 'benefits',
              position: 3,
              children: [
                _HomePendingMembershipSeriesCard(
                  memberships: pendingFirstSlotMemberships,
                  accent: accent,
                  onOpenMembershipPlan: _openMembershipPlanScheduler,
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (showModule('promotions') && remainingOffers.isNotEmpty)
            (
              key: 'benefits',
              position: 4,
              children: [
                SectionTitle(
                  title: 'Mais ofertas do salão',
                  subtitle:
                      '${remainingOffers.length} oportunidade${remainingOffers.length == 1 ? '' : 's'} ativa${remainingOffers.length == 1 ? '' : 's'} além dos destaques principais.',
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 332,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: remainingOffers.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final offer = remainingOffers[index];
                      final membershipState = offer.kind == 'membership'
                          ? MembershipOfferState.resolve(
                              offerId: offer.id,
                              overview: _membershipOverview,
                            )
                          : null;
                      final ctaLabel = offer.kind == 'membership'
                          ? _membershipOfferActionLabel(membershipState)
                          : _promotionOfferActionLabel(
                              offer,
                              preview?.primaryCtaLabel,
                            );
                      final ctaIcon = offer.kind == 'membership'
                          ? _membershipOfferActionIcon(membershipState)
                          : Icons.calendar_month_rounded;
                      final onTap = offer.kind == 'membership'
                          ? () => _handleMembershipOfferAction(
                              offer,
                              membershipState,
                            )
                          : () => _openPromotionOffer(offer);

                      return SizedBox(
                        width: 260,
                        child: _OfferQuickCard(
                          offer: offer,
                          accent: accent,
                          ctaLabel: ctaLabel,
                          ctaIcon: ctaIcon,
                          onTap: onTap,
                          detailText: offer.kind == 'membership'
                              ? _membershipOfferDetailText(
                                  offer,
                                  membershipState,
                                )
                              : _promotionOfferDetailText(offer),
                          headerPills: offer.kind == 'membership'
                              ? _membershipOfferStatePills(
                                  context,
                                  accent: accent,
                                  state: membershipState,
                                )
                              : const <Widget>[],
                          isCtaBusy:
                              offer.kind == 'membership' &&
                              _membershipActionBusy,
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (showLoyaltyModule)
            (
              key: 'benefits',
              position: 4,
              children: [
                const SectionTitle(
                  title: 'Clube de fidelidade',
                  subtitle:
                      'Quando o salão ativar o programa, a home mostra sua carteira e deixa a área completa a um toque.',
                ),
                const SizedBox(height: 14),
                _HomeLoyaltyFeatureCard(
                  summary: _loyalty!,
                  accent: accent,
                  onOpen: _openLoyaltyPage,
                ),
                const SizedBox(height: 20),
              ],
            ),
          if (momentumCards.isNotEmpty)
            (
              key: 'benefits',
              position: 5,
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
          if (recentReviews.isNotEmpty)
            (
              key: 'reviews',
              position: 6,
              children: [
                const SizedBox(height: 20),
                SectionTitle(
                  title: 'Avaliacoes do salao',
                  subtitle:
                      'Clientes desse salao veem aqui as avaliacoes reais enviadas no app.',
                  trailing:
                      preview?.ratingValue != null &&
                          (preview?.ratingCount ?? 0) > 0
                      ? Pill(
                          label:
                              '${preview!.ratingValue!.toStringAsFixed(1)}/5 - ${preview.ratingCount} aval.',
                          icon: Icons.star_rounded,
                          backgroundColor: accent.withValues(alpha: 0.12),
                          foregroundColor: accent,
                        )
                      : null,
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 246,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: recentReviews.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 12),
                    itemBuilder: (context, index) => SizedBox(
                      width: 292,
                      child: _SalonReviewShowcaseCard(
                        review: recentReviews[index],
                        accent: accent,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          if (showModule('shortcuts') && highlightedService != null)
            (
              key: 'services',
              position: 5,
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
              position: 6,
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
                    fallbackAvatarUrl: preview?.logoUrl,
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
                if (heroProfileImageUrl != null ||
                    customerDisplayName.isNotEmpty) ...[
                  _HomeSalonLogoOrb(
                    imageUrl: heroProfileImageUrl,
                    fallbackName: customerDisplayName,
                    accent: accent,
                  ),
                  const SizedBox(height: 18),
                ],
                SalonBrandHero(
                  preview: preview,
                  accent: accent,
                  greeting: 'Olá, ${firstName(session.customer.name)}',
                  showSegmentPill: false,
                  showJoinCodePill: false,
                  showSupportLine: false,
                  title: 'Sua experiência no salão, organizada em um só lugar',
                  description:
                      'Acompanhe agenda, benefícios, loja e novidades com clareza, segurança e o padrão definido pelo salão.',
                  topContent: salonDisplayName != null
                      ? _HomeSalonIdentityBanner(
                          name: salonDisplayName,
                          accent: accent,
                        )
                      : null,
                  extraPills: [
                    if (hasConfirmedActivePlan)
                      Pill(
                        key: const ValueKey('home-active-plan-verified-pill'),
                        label: 'Plano ativo',
                        icon: Icons.verified_rounded,
                        backgroundColor: const Color(
                          0xFF0EA5E9,
                        ).withValues(alpha: 0.14),
                        foregroundColor: const Color(0xFF0EA5E9),
                      ),
                    if (customerDisplayName.isNotEmpty)
                      Pill(
                        key: const ValueKey('home-customer-name-pill'),
                        label: customerDisplayName,
                        icon: Icons.person_rounded,
                        backgroundColor: Colors.white.withValues(alpha: 0.82),
                        foregroundColor: AppTheme.ink,
                      ),
                  ],
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
                if (!_loading && birthdayExperience != null) ...[
                  _BirthdayExperienceCard(
                    experience: birthdayExperience,
                    accent: accent,
                  ),
                  const SizedBox(height: 20),
                ],
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

class _HomeSalonIdentityBanner extends StatelessWidget {
  const _HomeSalonIdentityBanner({required this.name, required this.accent});

  final String name;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      key: const ValueKey('home-salon-name-banner'),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accent.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Icon(Icons.storefront_rounded, color: accent, size: 24),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Salão conectado',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: accent.withValues(alpha: 0.9),
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: AppTheme.ink,
                      fontWeight: FontWeight.w900,
                      height: 1.02,
                    ),
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

class _SalonReviewShowcaseCard extends StatelessWidget {
  const _SalonReviewShowcaseCard({required this.review, required this.accent});

  final SalonReviewHighlight review;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final normalizedComment = review.comment?.trim();
    final supportLabel = [
      if (review.serviceName?.trim().isNotEmpty == true) review.serviceName!,
      if (review.staffName?.trim().isNotEmpty == true)
        'com ${review.staffName!}',
    ].join(' - ');
    final showProfessionalSignature =
        supportLabel.isNotEmpty ||
        review.staffImageUrl?.trim().isNotEmpty == true;

    return SalonPanel(
      accent: accent,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: '${review.rating}/5 no app',
                icon: Icons.star_rounded,
                backgroundColor: accent.withValues(alpha: 0.14),
                foregroundColor: accent,
              ),
              Pill(
                label: formatFullDate(review.createdAt),
                icon: Icons.schedule_rounded,
              ),
            ],
          ),
          if (showProfessionalSignature) ...[
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _SalonReviewProfessionalAvatar(
                  imageUrl: review.staffImageUrl,
                  accent: accent,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    supportLabel.isNotEmpty
                        ? supportLabel
                        : 'Profissional do salao',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: accent.withValues(alpha: 0.92),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Text(
            normalizedComment?.isNotEmpty == true
                ? normalizedComment!
                : 'Cliente avaliou esse atendimento diretamente pelo app do salao.',
            maxLines: 5,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.titleMedium?.copyWith(
              color: AppTheme.ink,
              fontWeight: FontWeight.w800,
              height: 1.25,
            ),
          ),
          const Spacer(),
          Text(
            'Avaliacao real compartilhada com clientes do mesmo salao.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _SalonReviewProfessionalAvatar extends StatelessWidget {
  const _SalonReviewProfessionalAvatar({
    required this.imageUrl,
    required this.accent,
  });

  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 40,
        height: 40,
        child: imageUrl?.trim().isNotEmpty == true
            ? SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                alignment: kSalonPortraitAvatarAlignment,
                error: _SalonReviewProfessionalAvatarFallback(accent: accent),
                placeholder: _SalonReviewProfessionalAvatarFallback(
                  accent: accent,
                ),
              )
            : _SalonReviewProfessionalAvatarFallback(accent: accent),
      ),
    );
  }
}

class _SalonReviewProfessionalAvatarFallback extends StatelessWidget {
  const _SalonReviewProfessionalAvatarFallback({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.16), AppTheme.panel],
        ),
      ),
      child: Center(child: Icon(Icons.person_rounded, color: accent, size: 20)),
    );
  }
}

class _BirthdayExperienceCard extends StatelessWidget {
  const _BirthdayExperienceCard({
    required this.experience,
    required this.accent,
  });

  final BirthdayHomeExperience experience;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(
            title: 'Seu aniversario no salao',
            subtitle:
                'Essa homenagem aparece so para voce hoje, com a mensagem publicada pelo salao.',
            trailing: Pill(
              label: 'Hoje',
              icon: Icons.cake_rounded,
              backgroundColor: AppTheme.accent.withValues(alpha: 0.18),
              foregroundColor: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: formatNumericDate(experience.birthDate),
                icon: Icons.calendar_today_rounded,
                backgroundColor: accent.withValues(alpha: 0.12),
                foregroundColor: accent,
              ),
              Pill(
                label: experience.hasVideo
                    ? 'Video do salao'
                    : experience.hasImage
                    ? 'Foto do salao'
                    : 'Mensagem especial',
                icon: experience.hasVideo
                    ? Icons.play_circle_outline_rounded
                    : Icons.auto_awesome_rounded,
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (experience.hasVideo) ...[
            _BirthdayVideoPreview(
              videoUrl: experience.videoUrl!,
              accent: accent,
            ),
            const SizedBox(height: 16),
          ] else if (experience.hasImage) ...[
            NetworkCardImage(
              imageUrl: experience.imageUrl,
              height: 240,
              borderRadius: 28,
            ),
            const SizedBox(height: 16),
          ],
          Text(
            experience.title,
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 10),
          Text(
            'Feliz aniversario, ${firstName(experience.customerName)}.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            experience.message,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 12),
          Text(
            '${experience.salonName} deixou essa homenagem pronta para o seu dia.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _BirthdayVideoPreview extends StatefulWidget {
  const _BirthdayVideoPreview({required this.videoUrl, required this.accent});

  final String videoUrl;
  final Color accent;

  @override
  State<_BirthdayVideoPreview> createState() => _BirthdayVideoPreviewState();
}

class _BirthdayVideoPreviewState extends State<_BirthdayVideoPreview> {
  VideoPlayerController? _controller;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  @override
  void didUpdateWidget(covariant _BirthdayVideoPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _disposeController();
      _failed = false;
      _initialize();
    }
  }

  Future<void> _initialize() async {
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(widget.videoUrl),
    );
    _controller = controller;

    try {
      await controller.initialize();
      await controller.setLooping(true);
      await controller.setVolume(0);
      if (!mounted || !identical(_controller, controller)) {
        await controller.dispose();
        return;
      }
      setState(() {});
    } catch (_) {
      if (!mounted || !identical(_controller, controller)) {
        await controller.dispose();
        return;
      }
      _failed = true;
      setState(() {});
    }
  }

  Future<void> _togglePlayback() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return;
    }

    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      await controller.play();
    }

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _disposeController() async {
    final controller = _controller;
    _controller = null;
    if (controller != null) {
      await controller.dispose();
    }
  }

  @override
  void dispose() {
    _disposeController();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    return GestureDetector(
      onTap: _togglePlayback,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppTheme.panel,
            border: Border.all(color: AppTheme.line),
          ),
          child: AspectRatio(
            aspectRatio: controller?.value.isInitialized == true
                ? controller!.value.aspectRatio
                : 4 / 5,
            child: controller?.value.isInitialized == true
                ? Stack(
                    fit: StackFit.expand,
                    children: [
                      VideoPlayer(controller!),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.06),
                              Colors.black.withValues(alpha: 0.32),
                            ],
                          ),
                        ),
                      ),
                      Center(
                        child: Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            controller.value.isPlaying
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: widget.accent,
                            size: 38,
                          ),
                        ),
                      ),
                    ],
                  )
                : _failed
                ? Center(
                    child: Text(
                      'Video indisponivel',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  )
                : const Center(
                    child: CircularProgressIndicator(strokeWidth: 2.6),
                  ),
          ),
        ),
      ),
    );
  }
}

class _HomeSalonLogoOrb extends StatelessWidget {
  const _HomeSalonLogoOrb({
    required this.accent,
    required this.fallbackName,
    this.imageUrl,
  });

  final String? imageUrl;
  final String fallbackName;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final initials = _buildInitials(fallbackName);

    Widget fallbackAvatar() {
      return DecoratedBox(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          shape: BoxShape.circle,
        ),
        child: Center(
          child: Text(
            initials,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppTheme.ink,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      );
    }

    return Align(
      alignment: Alignment.topCenter,
      child: Container(
        key: const ValueKey('home-salon-logo-orb'),
        width: 94,
        height: 94,
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: spec.panelColor.withValues(alpha: 0.98),
          border: Border.all(color: accent.withValues(alpha: 0.22), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Colors.white, accent.withValues(alpha: 0.08)],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: ClipOval(
              child: imageUrl?.trim().isNotEmpty == true
                  ? SalonNetworkImage(
                      imageUrl: imageUrl!,
                      fit: BoxFit.cover,
                      error: fallbackAvatar(),
                    )
                  : fallbackAvatar(),
            ),
          ),
        ),
      ),
    );
  }
}

class _HomePendingMembershipSeriesCard extends StatelessWidget {
  const _HomePendingMembershipSeriesCard({
    required this.memberships,
    required this.accent,
    required this.onOpenMembershipPlan,
  });

  final List<CustomerMembershipPlan> memberships;
  final Color accent;
  final ValueChanged<CustomerMembershipPlan> onOpenMembershipPlan;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(
            title: 'Plano ativo pronto para reservar a serie',
            subtitle:
                'Escolha so um dia e horario-base. O app distribui automaticamente as proximas semanas com o profissional da area.',
            trailing: Pill(
              label:
                  '${memberships.length} plano${memberships.length == 1 ? '' : 's'}',
              icon: Icons.notifications_active_rounded,
              backgroundColor: accent.withValues(alpha: 0.12),
              foregroundColor: accent,
            ),
          ),
          const SizedBox(height: 16),
          ...memberships.map((membership) {
            final serviceName = sentenceOrFallback(
              membership.serviceName,
              'Servico do plano',
            );
            return Padding(
              padding: EdgeInsets.only(
                bottom: identical(membership, memberships.last) ? 0 : 12,
              ),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.76),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: accent.withValues(alpha: 0.14)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Pill(
                          label:
                              '${membership.sessionsRemaining} sessoes restantes',
                          icon: Icons.repeat_rounded,
                          backgroundColor: accent.withValues(alpha: 0.12),
                          foregroundColor: accent,
                        ),
                        Pill(
                          label:
                              'Valido ate ${formatNumericDate(membership.expiresAt)}',
                          icon: Icons.event_available_rounded,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      membership.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Servico do plano: $serviceName. Assim que voce confirmar um horario-base, o app reserva automaticamente as sessoes seguintes no mesmo dia, horario e profissional.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        key: ValueKey(
                          'home-open-membership-plan-${membership.id}',
                        ),
                        onPressed: () => onOpenMembershipPlan(membership),
                        icon: const Icon(Icons.event_repeat_rounded),
                        label: Text('Escolher horario fixo de $serviceName'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
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
    this.fallbackImageUrl,
    this.headerPills = const <Widget>[],
    this.detailText,
    this.ctaIcon = Icons.auto_awesome_rounded,
    this.isCtaBusy = false,
  });

  final SalonOfferHighlight offer;
  final Color accent;
  final String? fallbackImageUrl;
  final List<Widget> headerPills;
  final String? detailText;
  final String? ctaLabel;
  final IconData ctaIcon;
  final bool isCtaBusy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final offerImageUrl =
        _normalizedImageUrl(offer.imageUrl) ??
        _normalizedImageUrl(fallbackImageUrl);
    return SalonPanel(
      padding: const EdgeInsets.all(18),
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (offerImageUrl != null) ...[
            NetworkCardImage(
              imageUrl: offerImageUrl,
              height: 180,
              borderRadius: 22,
            ),
            const SizedBox(height: 14),
          ],
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
              ...headerPills,
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
          if (detailText?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 10),
            Text(detailText!, style: Theme.of(context).textTheme.bodySmall),
          ],
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
            child: AsyncButton(
              label: sentenceOrFallback(ctaLabel, 'Agendar'),
              isBusy: isCtaBusy,
              onPressed: onTap,
              icon: ctaIcon,
            ),
          ),
        ],
      ),
    );
  }
}

class _OfferQuickCard extends StatelessWidget {
  const _OfferQuickCard({
    required this.offer,
    required this.accent,
    required this.ctaLabel,
    required this.ctaIcon,
    required this.onTap,
    this.detailText,
    this.headerPills = const <Widget>[],
    this.isCtaBusy = false,
  });

  final SalonOfferHighlight offer;
  final Color accent;
  final String? detailText;
  final List<Widget> headerPills;
  final String? ctaLabel;
  final IconData ctaIcon;
  final bool isCtaBusy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final offerImageUrl = _normalizedImageUrl(offer.imageUrl);
    return SalonPanel(
      accent: accent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 332),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (offerImageUrl != null) ...[
              NetworkCardImage(
                imageUrl: offerImageUrl,
                height: 108,
                borderRadius: 18,
              ),
              const SizedBox(height: 12),
            ],
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
                ...headerPills,
              ],
            ),
            const SizedBox(height: 12),
            Text(
              offer.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              detailText?.trim().isNotEmpty == true
                  ? detailText!
                  : sentenceOrFallback(
                      offer.description,
                      'Oferta pronta para virar ação no app do cliente.',
                    ),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const Spacer(),
            if (offer.priceLabel?.trim().isNotEmpty == true) ...[
              Text(
                offer.priceLabel!,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 10),
            ],
            SizedBox(
              width: double.infinity,
              child: AsyncButton(
                label: sentenceOrFallback(ctaLabel, 'Abrir'),
                isBusy: isCtaBusy,
                onPressed: onTap,
                icon: ctaIcon,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

bool _isCampaignLiveAt(SalonCampaign campaign, DateTime now) {
  if (!campaign.isActive) {
    return false;
  }

  final startsAt = _tryParseCampaignDateTime(campaign.startsAt);
  if (startsAt != null && startsAt.isAfter(now)) {
    return false;
  }

  final endsAt = _tryParseCampaignDateTime(campaign.endsAt);
  if (endsAt != null && endsAt.isBefore(now)) {
    return false;
  }

  return true;
}

DateTime? _tryParseCampaignDateTime(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  return DateTime.tryParse(normalized);
}

String? _normalizedImageUrl(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  return normalized;
}

SalonOfferHighlight? _firstOfferByKind(
  List<SalonOfferHighlight> offers,
  String kind,
) {
  for (final offer in offers) {
    if (offer.kind == kind) {
      return offer;
    }
  }

  return null;
}

String? _resolveOfferShowcaseImageUrl({
  required String? preferredImageUrl,
  required String? serviceImageUrl,
  required String? galleryImageUrl,
  required String? heroImageUrl,
}) {
  return _normalizedImageUrl(preferredImageUrl) ??
      _normalizedImageUrl(serviceImageUrl) ??
      _normalizedImageUrl(galleryImageUrl) ??
      _normalizedImageUrl(heroImageUrl);
}

String _promotionOfferActionLabel(
  SalonOfferHighlight offer,
  String? fallbackLabel,
) {
  final linkedServiceName = offer.bookingServiceName?.trim();
  if (linkedServiceName != null && linkedServiceName.isNotEmpty) {
    return 'Agendar ${linkedServiceName.toLowerCase()}';
  }

  return sentenceOrFallback(fallbackLabel, 'Abrir agenda');
}

String _promotionOfferDetailText(SalonOfferHighlight offer) {
  final linkedServiceName = offer.bookingServiceName?.trim();
  if (linkedServiceName != null && linkedServiceName.isNotEmpty) {
    return 'Essa oferta leva voce direto para a agenda com $linkedServiceName ja selecionado.';
  }

  return 'Ao tocar, a agenda abre para voce transformar essa oferta em horario confirmado.';
}

String? _membershipPlanCycleLabel(CustomerMembershipPlan plan) {
  final validityDays = plan.validityDays;
  if (validityDays == null || validityDays <= 0) {
    return null;
  }

  if (validityDays >= 365 && validityDays <= 366) {
    return '1 ano';
  }

  if (validityDays > 366 && validityDays % 365 == 0) {
    final years = validityDays ~/ 365;
    return '$years anos';
  }

  if (validityDays >= 28 && validityDays <= 31) {
    return '1 mes';
  }

  if (validityDays > 31 && validityDays % 30 == 0) {
    final months = validityDays ~/ 30;
    return months == 1 ? '1 mes' : '$months meses';
  }

  if (validityDays == 1) {
    return '1 dia';
  }

  return '$validityDays dias';
}

String _membershipPlanPeriodLabel(
  CustomerMembershipPlan plan, {
  bool compact = false,
}) {
  final start = plan.startedAt;
  final endLabel = compact
      ? formatShortDate(plan.expiresAt)
      : formatNumericDate(plan.expiresAt);
  if (start == null) {
    return 'Ate $endLabel';
  }

  final startLabel = compact
      ? formatShortDate(start)
      : formatNumericDate(start);
  return '$startLabel a $endLabel';
}

String? _membershipOfferIncludedLabel(
  SalonOfferHighlight offer,
  CustomerMembershipPlan? plan,
) {
  final serviceName = plan?.serviceName?.trim();
  if (serviceName != null && serviceName.isNotEmpty) {
    return serviceName;
  }

  final highlight = offer.highlightText?.trim();
  if (highlight != null && highlight.isNotEmpty) {
    return highlight;
  }

  final bookingService = offer.bookingServiceName?.trim();
  if (bookingService != null && bookingService.isNotEmpty) {
    return bookingService;
  }

  return null;
}

String _membershipSessionsRemainingLabel(CustomerMembershipPlan plan) {
  final remaining = plan.sessionsRemaining;
  return remaining == 1 ? '1 sessao restante' : '$remaining sessoes restantes';
}

String _membershipSessionsIncludedLabel(CustomerMembershipPlan plan) {
  return plan.sessionsIncluded == 1
      ? '1 sessao incluida'
      : '${plan.sessionsIncluded} sessoes incluidas';
}

String? _homeHeroSalonName(SalonPreview? preview) {
  final name = preview?.appDisplayName?.trim();
  if (name != null && name.isNotEmpty) {
    return name;
  }

  final fallbackName = preview?.name.trim();
  if (fallbackName != null && fallbackName.isNotEmpty) {
    return fallbackName;
  }

  return null;
}

List<Widget> _membershipOfferStatePills(
  BuildContext context, {
  required Color accent,
  required MembershipOfferState? state,
}) {
  if (state == null) {
    return const <Widget>[];
  }

  final theme = Theme.of(context);
  final infoPills = <Widget>[];

  if (state.activePlan != null) {
    infoPills.add(
      Pill(
        label: 'Plano ativo',
        icon: Icons.verified_rounded,
        backgroundColor: AppTheme.secondary.withValues(alpha: 0.16),
        foregroundColor: AppTheme.secondary,
      ),
    );
    if (state.actionKind == MembershipOfferActionKind.renewalDue) {
      infoPills.add(
        Pill(
          label: 'Renovacao aberta',
          icon: Icons.refresh_rounded,
          backgroundColor: AppTheme.accent.withValues(alpha: 0.18),
          foregroundColor: theme.colorScheme.onSurface,
        ),
      );
    }
    if (_membershipPlanCycleLabel(state.activePlan!) != null) {
      infoPills.add(
        Pill(
          label: '${_membershipPlanCycleLabel(state.activePlan!)!} ativo',
          icon: Icons.timelapse_rounded,
        ),
      );
    }
    infoPills.add(
      Pill(
        label: _membershipSessionsRemainingLabel(state.activePlan!),
        icon: Icons.confirmation_num_rounded,
      ),
    );
    infoPills.add(
      Pill(
        label: _membershipPlanPeriodLabel(state.activePlan!, compact: true),
        icon: Icons.calendar_month_rounded,
      ),
    );
    if (state.activePlan!.serviceName?.trim().isNotEmpty == true) {
      infoPills.add(
        Pill(
          label: state.activePlan!.serviceName!,
          icon: Icons.content_cut_rounded,
        ),
      );
    }
    if (state.expiryCountdownLabel != null) {
      infoPills.add(
        Pill(label: state.expiryCountdownLabel!, icon: Icons.schedule_rounded),
      );
    }
    return infoPills;
  }

  if (state.scheduledPlan != null) {
    infoPills.add(
      Pill(
        label: 'Ativacao agendada',
        icon: Icons.event_available_rounded,
        backgroundColor: AppTheme.secondary.withValues(alpha: 0.14),
        foregroundColor: AppTheme.secondary,
      ),
    );
    if (_membershipPlanCycleLabel(state.scheduledPlan!) != null) {
      infoPills.add(
        Pill(
          label:
              '${_membershipPlanCycleLabel(state.scheduledPlan!)!} programado',
          icon: Icons.timelapse_rounded,
        ),
      );
    }
    infoPills.add(
      Pill(
        label: _membershipSessionsIncludedLabel(state.scheduledPlan!),
        icon: Icons.confirmation_num_rounded,
      ),
    );
    infoPills.add(
      Pill(
        label: _membershipPlanPeriodLabel(state.scheduledPlan!, compact: true),
        icon: Icons.calendar_month_rounded,
      ),
    );
    return infoPills;
  }

  infoPills.add(
    Pill(
      label: switch (state.actionKind) {
        MembershipOfferActionKind.pendingApproval => 'Aguardando aprovacao',
        MembershipOfferActionKind.awaitingPayment => 'Pagamento pendente',
        MembershipOfferActionKind.scheduled => 'Ativacao agendada',
        MembershipOfferActionKind.renewalDue => 'Renovacao aberta',
        MembershipOfferActionKind.active => 'Plano ativo',
        MembershipOfferActionKind.subscribe => 'Pronto para assinar',
      },
      icon: switch (state.actionKind) {
        MembershipOfferActionKind.pendingApproval =>
          Icons.hourglass_top_rounded,
        MembershipOfferActionKind.awaitingPayment => Icons.payments_rounded,
        MembershipOfferActionKind.scheduled => Icons.event_available_rounded,
        MembershipOfferActionKind.renewalDue => Icons.refresh_rounded,
        MembershipOfferActionKind.active => Icons.verified_rounded,
        MembershipOfferActionKind.subscribe => Icons.workspace_premium_rounded,
      },
      backgroundColor: switch (state.actionKind) {
        MembershipOfferActionKind.pendingApproval =>
          AppTheme.secondary.withValues(alpha: 0.14),
        MembershipOfferActionKind.awaitingPayment => AppTheme.accent.withValues(
          alpha: 0.18,
        ),
        MembershipOfferActionKind.scheduled => AppTheme.secondary.withValues(
          alpha: 0.14,
        ),
        MembershipOfferActionKind.renewalDue => AppTheme.accent.withValues(
          alpha: 0.18,
        ),
        MembershipOfferActionKind.active => AppTheme.primary.withValues(
          alpha: 0.14,
        ),
        MembershipOfferActionKind.subscribe => accent.withValues(alpha: 0.1),
      },
      foregroundColor: switch (state.actionKind) {
        MembershipOfferActionKind.pendingApproval => AppTheme.secondary,
        MembershipOfferActionKind.awaitingPayment =>
          theme.colorScheme.onSurface,
        MembershipOfferActionKind.scheduled => AppTheme.secondary,
        MembershipOfferActionKind.renewalDue => theme.colorScheme.onSurface,
        MembershipOfferActionKind.active => AppTheme.primary,
        MembershipOfferActionKind.subscribe => accent,
      },
    ),
  );

  if (state.request != null) {
    final requestStatusLabel = state.request!.isAwaitingPayment
        ? 'Pagamento pendente'
        : 'Aguardando aprovacao';
    infoPills.add(
      Pill(
        label: requestStatusLabel,
        icon: state.request!.isAwaitingPayment
            ? Icons.payments_rounded
            : Icons.send_rounded,
      ),
    );
    infoPills.add(
      Pill(
        label: 'Pedido ${formatNumericDate(state.request!.requestedAt)}',
        icon: Icons.event_note_rounded,
      ),
    );
    if (state.request!.isAwaitingPayment &&
        state.request!.approvedStartsOn != null) {
      infoPills.add(
        Pill(
          label:
              'Inicio ${formatNumericDate(state.request!.approvedStartsOn!)}',
          icon: Icons.calendar_month_rounded,
        ),
      );
    }
  }

  return infoPills;
}

String _membershipOfferDetailText(
  SalonOfferHighlight offer,
  MembershipOfferState? state,
) {
  if (state == null) {
    return 'Escolha um horário preferido no app e acompanhe a liberação depois que o salão aprovar e confirmar o pagamento no painel.';
  }

  if (state.request != null) {
    final includedLabel = _membershipOfferIncludedLabel(
      offer,
      state.activePlan,
    );
    final includedText = includedLabel == null ? '' : ' Inclui $includedLabel.';
    final preferredStartAt = state.request!.preferredStartAt;
    final preferredStaffName = state.request!.preferredStaffMemberName?.trim();
    final preferredText = preferredStartAt == null
        ? ''
        : ' Horario pedido: ${formatFullDate(preferredStartAt)} as ${formatTime(preferredStartAt)}${preferredStaffName?.isNotEmpty == true ? ' com $preferredStaffName' : ''}.';
    if (state.request!.isAwaitingPayment) {
      final approvedAt = state.request!.decidedAt;
      final approvedStartsOn = state.request!.approvedStartsOn;
      final approvedText = approvedAt == null
          ? 'Pedido aprovado pelo salao.'
          : 'Pedido aprovado em ${formatCompactDateTime(approvedAt)}.';
      final startText = approvedStartsOn == null
          ? ''
          : ' Inicio programado: ${formatNumericDate(approvedStartsOn)}.';
      return '$approvedText$startText$preferredText Agora o salao so precisa marcar o pagamento para ativar no app.$includedText';
    }
    return 'Pedido enviado em ${formatNumericDate(state.request!.requestedAt)}.$preferredText O salao precisa aprovar no painel. Depois disso, o pagamento ainda precisa ser confirmado para ativar no app.$includedText';
  }

  if (state.scheduledPlan != null) {
    final plan = state.scheduledPlan!;
    final sessionsLabel = _membershipSessionsIncludedLabel(plan);
    final cycleLabel = _membershipPlanCycleLabel(plan);
    final cycleText = cycleLabel != null ? ' Ciclo de $cycleLabel.' : '';
    final includedLabel = _membershipOfferIncludedLabel(offer, plan);
    final includedText = includedLabel == null ? '' : ' Inclui $includedLabel.';
    return 'Seu plano ja foi aprovado e comeca em ${_membershipPlanPeriodLabel(plan)} com $sessionsLabel.$cycleText$includedText Quando a data chegar, a agenda libera o uso automaticamente.';
  }

  if (state.activePlan != null) {
    final activePlan = state.activePlan!;
    final sessionsLabel = _membershipSessionsRemainingLabel(activePlan);
    final cycleLabel = _membershipPlanCycleLabel(activePlan);
    final expiryLabel = state.expiryCountdownLabel;
    final renewalLabel =
        state.actionKind == MembershipOfferActionKind.renewalDue
        ? ' A renovacao ja esta liberada no app.'
        : '';
    final cycleText = cycleLabel != null ? ' Ciclo de $cycleLabel.' : '';
    final expiryText = expiryLabel != null ? ' $expiryLabel.' : '';
    final includedLabel = _membershipOfferIncludedLabel(offer, activePlan);
    final includedText = includedLabel == null ? '' : ' Inclui $includedLabel.';
    return 'Seu plano esta ativo de ${_membershipPlanPeriodLabel(activePlan)} com $sessionsLabel.$cycleText$expiryText$includedText Para usar, abra a Agenda e escolha um horario dentro desse periodo.$renewalLabel';
  }

  return 'Escolha um horário preferido no app e acompanhe a liberação depois que o salão aprovar e confirmar o pagamento no painel.';
}

String _membershipOfferActionLabel(MembershipOfferState? state) {
  return switch (state?.actionKind) {
    MembershipOfferActionKind.pendingApproval => 'Ver status do pedido',
    MembershipOfferActionKind.awaitingPayment => 'Ver liberacao do plano',
    MembershipOfferActionKind.scheduled => 'Ver ativacao do plano',
    MembershipOfferActionKind.active => 'Ver detalhes do plano',
    MembershipOfferActionKind.renewalDue => 'Renovar plano',
    _ => 'Ativar e escolher horario',
  };
}

IconData _membershipOfferActionIcon(MembershipOfferState? state) {
  return switch (state?.actionKind) {
    MembershipOfferActionKind.pendingApproval => Icons.visibility_rounded,
    MembershipOfferActionKind.awaitingPayment => Icons.payments_rounded,
    MembershipOfferActionKind.scheduled => Icons.visibility_rounded,
    MembershipOfferActionKind.active => Icons.visibility_rounded,
    MembershipOfferActionKind.renewalDue => Icons.refresh_rounded,
    _ => Icons.event_available_rounded,
  };
}

String _membershipOfferStateLabel(MembershipOfferState state) {
  return switch (state.actionKind) {
    MembershipOfferActionKind.pendingApproval => 'Pedido aguardando aprovacao',
    MembershipOfferActionKind.awaitingPayment =>
      'Plano aprovado aguardando pagamento',
    MembershipOfferActionKind.scheduled => 'Ativacao agendada',
    MembershipOfferActionKind.active => 'Plano ativo',
    MembershipOfferActionKind.renewalDue => 'Plano ativo com renovacao aberta',
    MembershipOfferActionKind.subscribe => 'Disponivel para assinatura',
  };
}

String _membershipStatusSheetTitle(MembershipOfferState state) {
  return switch (state.actionKind) {
    MembershipOfferActionKind.pendingApproval => 'Seu pedido esta em analise',
    MembershipOfferActionKind.awaitingPayment =>
      'Seu plano esta aguardando pagamento',
    MembershipOfferActionKind.scheduled => 'Seu plano ja esta programado',
    MembershipOfferActionKind.active => 'Seu plano esta ativo',
    MembershipOfferActionKind.renewalDue =>
      'Seu plano esta ativo e pode renovar',
    MembershipOfferActionKind.subscribe => 'Plano pronto para assinatura',
  };
}

String _membershipStatusSheetSubtitle(MembershipOfferState state) {
  return switch (state.actionKind) {
    MembershipOfferActionKind.pendingApproval =>
      'Acompanhe a aprovacao do salao e o que ainda falta para o plano entrar no app.',
    MembershipOfferActionKind.awaitingPayment =>
      'O salao ja aprovou o pedido. Falta somente confirmar o pagamento para ativar.',
    MembershipOfferActionKind.scheduled =>
      'Confira a data de inicio, o periodo e o que vai liberar na sua rotina.',
    MembershipOfferActionKind.active =>
      'Veja validade, saldo de sessoes e como usar seu plano sem perder o periodo.',
    MembershipOfferActionKind.renewalDue =>
      'Seu periodo segue valendo e a renovacao ja pode ser pedida pelo app.',
    MembershipOfferActionKind.subscribe =>
      'Confira como o pedido funciona antes de enviar para o salao.',
  };
}

class _OfferRequestSummaryCard extends StatelessWidget {
  const _OfferRequestSummaryCard({required this.offer});

  final SalonOfferHighlight offer;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      accent: AppTheme.primary.withValues(alpha: 0.12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(label: offer.kindLabel),
              Pill(label: offer.lifecycleLabel),
              if (offer.priceLabel?.trim().isNotEmpty == true)
                Pill(label: offer.priceLabel!),
            ],
          ),
          const SizedBox(height: 12),
          Text(offer.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            sentenceOrFallback(
              offer.description,
              'O salão recebe esse pedido no painel, aprova a solicitação e só libera o plano no app depois de marcar o pagamento.',
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _MembershipStatusLine extends StatelessWidget {
  const _MembershipStatusLine({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ToneIconBadge(icon: icon, tone: AppTheme.secondary, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 4),
              Text(value, style: Theme.of(context).textTheme.titleSmall),
            ],
          ),
        ),
      ],
    );
  }
}

class _HomeLoyaltyFeatureCard extends StatelessWidget {
  const _HomeLoyaltyFeatureCard({
    required this.summary,
    required this.accent,
    required this.onOpen,
  });

  final LoyaltySummary summary;
  final Color accent;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final program = summary.program;
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);

    return SalonPanel(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: summary.currentTierName ?? 'Base',
                icon: Icons.workspace_premium_rounded,
                backgroundColor: accent.withValues(alpha: 0.12),
                foregroundColor: accent,
              ),
              Pill(
                label: 'Ao vivo',
                icon: Icons.verified_rounded,
                backgroundColor: spec.secondaryColor.withValues(alpha: 0.16),
                foregroundColor: spec.secondaryColor,
              ),
              if (program?.vipRewardServiceName?.trim().isNotEmpty == true)
                Pill(
                  label: 'VIP libera ${program!.vipRewardServiceName!}',
                  icon: Icons.card_giftcard_rounded,
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            program?.title ?? 'Clube de fidelidade',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            sentenceOrFallback(
              program?.description,
              'Acompanhe pontos, cashback, níveis e o histórico real das visitas concluídas.',
            ),
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          _HomeMetricGrid(
            children: [
              _HomeMetricCard(
                icon: Icons.stars_rounded,
                label: 'Pontos ativos',
                value: '${summary.pointsBalance}',
                support: 'Total ganho: ${summary.totalPointsEarned}',
                tone: accent,
              ),
              _HomeMetricCard(
                icon: Icons.payments_rounded,
                label: 'Cashback',
                value: formatCurrency(summary.cashbackBalance),
                support: summary.nextTierName == null
                    ? 'Seu nível atual já está liberado.'
                    : 'Faltam ${summary.visitsToNextTier} visitas para ${summary.nextTierName}.',
                tone: AppTheme.secondary,
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onOpen,
              icon: const Icon(Icons.open_in_new_rounded),
              label: const Text('Abrir fidelidade completa'),
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

String _buildInitials(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) {
    return 'CL';
  }
  if (parts.length == 1) {
    final word = parts.first;
    return word.substring(0, word.length >= 2 ? 2 : 1).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
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
                    imageUrl: post.authorAvatarUrl?.trim(),
                    fallbackImageUrl: fallbackAvatarUrl?.trim(),
                    sourceLabel: post.sourceLabel,
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

class _PreviewAuthorAvatar extends StatefulWidget {
  const _PreviewAuthorAvatar({
    required this.imageUrl,
    required this.fallbackImageUrl,
    required this.sourceLabel,
    required this.accent,
  });

  final String? imageUrl;
  final String? fallbackImageUrl;
  final String? sourceLabel;
  final Color accent;

  @override
  State<_PreviewAuthorAvatar> createState() => _PreviewAuthorAvatarState();
}

class _PreviewAuthorAvatarState extends State<_PreviewAuthorAvatar> {
  List<String> _avatarCandidates = const <String>[];
  int _activeAvatarIndex = 0;

  @override
  void initState() {
    super.initState();
    _syncAvatarCandidates();
  }

  @override
  void didUpdateWidget(covariant _PreviewAuthorAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.imageUrl != widget.imageUrl ||
        oldWidget.fallbackImageUrl != widget.fallbackImageUrl ||
        oldWidget.sourceLabel != widget.sourceLabel) {
      _syncAvatarCandidates();
    }
  }

  void _syncAvatarCandidates() {
    _avatarCandidates = previewAvatarCandidatesForHomeFeed(
      imageUrl: widget.imageUrl,
      fallbackImageUrl: widget.fallbackImageUrl,
      sourceLabel: widget.sourceLabel,
    );
    _activeAvatarIndex = 0;
  }

  void _tryNextAvatarCandidate() {
    if (_activeAvatarIndex >= _avatarCandidates.length - 1) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() => _activeAvatarIndex += 1);
    });
  }

  Widget _buildFallbackAvatar() {
    return Container(
      key: const ValueKey('home-feed-preview-avatar-fallback'),
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: widget.accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      alignment: Alignment.center,
      child: Icon(Icons.cut_rounded, color: widget.accent, size: 16),
    );
  }

  @override
  Widget build(BuildContext context) {
    final avatarUrl = _activeAvatarIndex < _avatarCandidates.length
        ? _avatarCandidates[_activeAvatarIndex]
        : null;
    if (avatarUrl == null || avatarUrl.isEmpty) {
      return _buildFallbackAvatar();
    }

    return ClipOval(
      child: SalonNetworkImage(
        key: ValueKey('home-feed-preview-avatar-$avatarUrl'),
        imageUrl: avatarUrl,
        fit: BoxFit.cover,
        onError: _tryNextAvatarCandidate,
        error: _buildFallbackAvatar(),
      ),
    );
  }
}

List<String> previewAvatarCandidatesForHomeFeed({
  String? imageUrl,
  String? fallbackImageUrl,
  String? sourceLabel,
}) {
  final normalizedSourceLabel = sourceLabel?.trim().toLowerCase() ?? '';
  final isSalonInstagramSource = normalizedSourceLabel.startsWith('instagram');
  final orderedCandidates = isSalonInstagramSource
      ? [fallbackImageUrl, imageUrl]
      : [imageUrl, fallbackImageUrl];
  return <String>{
    for (final candidate in orderedCandidates)
      if (candidate?.trim().isNotEmpty == true) candidate!.trim(),
  }.toList(growable: false);
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
        constraints: const BoxConstraints(minHeight: 300),
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
            Text(
              campaign.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Expanded(
              child: Text(
                campaign.message,
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
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
                  const SizedBox(height: 10),
                  _HighlightedAppointmentProfessional(
                    name: appointment.staffName!,
                    role: appointment.staffRole,
                    imageUrl: appointment.staffImageUrl,
                    accent: accent,
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

class _HighlightedAppointmentProfessional extends StatelessWidget {
  const _HighlightedAppointmentProfessional({
    required this.name,
    required this.accent,
    this.role,
    this.imageUrl,
  });

  final String name;
  final String? role;
  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            width: 34,
            height: 34,
            child: imageUrl?.trim().isNotEmpty == true
                ? SalonNetworkImage(
                    imageUrl: imageUrl!,
                    fit: BoxFit.cover,
                    alignment: kSalonPortraitAvatarAlignment,
                    error: _HighlightedAppointmentProfessionalFallback(
                      accent: accent,
                    ),
                    placeholder: _HighlightedAppointmentProfessionalFallback(
                      accent: accent,
                    ),
                  )
                : _HighlightedAppointmentProfessionalFallback(accent: accent),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Com $name',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (role?.trim().isNotEmpty == true)
                Text(
                  role!,
                  style: theme.textTheme.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HighlightedAppointmentProfessionalFallback extends StatelessWidget {
  const _HighlightedAppointmentProfessionalFallback({required this.accent});

  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.18), AppTheme.panel],
        ),
      ),
      child: Center(child: Icon(Icons.person_rounded, color: accent, size: 20)),
    );
  }
}
