import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../profile/profile_repository.dart';
import '../shared/app_models.dart';
import 'booking_repository.dart';

part 'agenda_page_flows.dart';
part 'agenda_page_sections.dart';

const List<String> _appointmentPaymentPreferenceValues = [
  'pix',
  'cash',
  'debit_card',
  'credit_card',
  'to_be_defined',
];

bool _isFinalAppointmentStatusValue(String status) {
  final normalized = status.trim().toLowerCase();
  return normalized == 'cancelled' ||
      normalized == 'completed' ||
      normalized == 'no_show';
}

DateTime _appointmentCompletionUnlockAt(CustomerAppointment appointment) {
  return appointment.date.add(const Duration(minutes: 3));
}

bool _canCustomerCompleteAppointment(
  CustomerAppointment appointment,
  DateTime now,
) {
  final status = appointment.status.trim().toLowerCase();
  if (status != 'pending' && status != 'confirmed') {
    return false;
  }

  return !now.isBefore(_appointmentCompletionUnlockAt(appointment));
}

String? _appointmentCompletionHint(
  CustomerAppointment appointment,
  DateTime now,
) {
  final status = appointment.status.trim().toLowerCase();
  if (status != 'pending' && status != 'confirmed') {
    return null;
  }

  final releaseAt = _appointmentCompletionUnlockAt(appointment);
  if (!now.isBefore(releaseAt)) {
    return null;
  }

  return 'A conclusao libera 3 minutos apos o horario marcado, a partir de ${formatTime(releaseAt)}.';
}

class AgendaPage extends StatefulWidget {
  const AgendaPage({
    super.key,
    required this.bookingRepository,
    this.profileRepository,
    this.focusedOffer,
    this.focusedOfferRevision = 0,
    required this.notificationsController,
    required this.session,
  });

  final BookingRepository bookingRepository;
  final ProfileRepository? profileRepository;
  final SalonOfferHighlight? focusedOffer;
  final int focusedOfferRevision;
  final CustomerNotificationsController notificationsController;
  final AppSession session;

  @override
  State<AgendaPage> createState() => _AgendaPageState();
}

class _AgendaPageState extends State<AgendaPage> {
  bool _loading = true;
  bool _servicesLoadFailed = false;
  List<ServiceOption> _services = const [];
  List<CustomerAppointment> _appointments = const [];
  List<CustomerMembershipPlan> _membershipPlans = const [];
  final Set<String> _locallyScheduledMembershipPlanIds = <String>{};
  final Set<String> _locallyRequestedMembershipOfferIds = <String>{};
  ServiceOption? _selectedService;
  String? _selectedStaffMemberId;
  String? _reschedulingAppointmentId;
  DayAvailability? _availability;
  final Map<String, DayAvailability?> _availabilityCache =
      <String, DayAvailability?>{};
  String? _loadErrorMessage;
  DateTime _selectedDay = DateUtils.dateOnly(DateTime.now());
  late int _lastAgendaRevision;
  int _lastAppliedFocusedOfferRevision = 0;
  int _loadRequestId = 0;

  @override
  void initState() {
    super.initState();
    _lastAgendaRevision = widget.notificationsController.agendaRevision;
    widget.notificationsController.addListener(_handleSyncChange);
    _bootstrap();
  }

  @override
  void didUpdateWidget(covariant AgendaPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleSyncChange);
      _lastAgendaRevision = widget.notificationsController.agendaRevision;
      widget.notificationsController.addListener(_handleSyncChange);
    }

    if (oldWidget.focusedOfferRevision != widget.focusedOfferRevision) {
      _bootstrap();
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleSyncChange);
    super.dispose();
  }

  void _handleSyncChange() {
    final revision = widget.notificationsController.agendaRevision;
    if (_lastAgendaRevision == revision || _loading) {
      return;
    }

    _lastAgendaRevision = revision;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final loadRequestId = ++_loadRequestId;
    setState(() {
      _loading = true;
      _servicesLoadFailed = false;
      _loadErrorMessage = null;
    });
    _availabilityCache.clear();

    var services = _services;
    var appointments = _appointments;
    var membershipPlans = _membershipPlans;
    DayAvailability? availability = _availability;
    final loadErrors = <String>[];
    var servicesLoadFailed = false;
    final servicesFuture = widget.bookingRepository.fetchServices();
    final appointmentsFuture = widget.bookingRepository.fetchAppointments();
    final membershipPlansFuture = widget.bookingRepository.fetchMembershipPlans(
      customerId: widget.session.customer.id,
    );

    try {
      services = await servicesFuture;
    } catch (error) {
      servicesLoadFailed = true;
      loadErrors.add(
        _formatAgendaError(
          error,
          fallback: 'Nao foi possivel carregar os servicos da agenda.',
        ),
      );
    }

    try {
      appointments = await appointmentsFuture;
    } catch (error) {
      loadErrors.add(
        _formatAgendaError(
          error,
          fallback: 'Nao foi possivel carregar os seus agendamentos.',
        ),
      );
    }

    try {
      membershipPlans = await membershipPlansFuture;
    } catch (_) {
      membershipPlans = const <CustomerMembershipPlan>[];
    }

    final shouldApplyFocusedOffer =
        widget.focusedOfferRevision > 0 &&
        widget.focusedOfferRevision != _lastAppliedFocusedOfferRevision;
    final focusedServiceId = widget.focusedOffer?.bookingServiceId?.trim();
    final selected = _resolveSelectedService(
      services,
      shouldApplyFocusedOffer: shouldApplyFocusedOffer,
      focusedServiceId: focusedServiceId,
    );

    if (selected == null) {
      availability = null;
    } else {
      try {
        availability = await _getDayAvailability(
          serviceId: selected.id,
          day: _selectedDay,
        );
      } catch (error) {
        availability = null;
        loadErrors.add(
          _formatAgendaError(
            error,
            fallback: 'Nao foi possivel carregar os horarios deste dia.',
          ),
        );
      }
    }

    if (!mounted || loadRequestId != _loadRequestId) {
      return;
    }

    final liveMembershipIds = membershipPlans
        .map((membership) => membership.id.trim())
        .where((membershipId) => membershipId.isNotEmpty)
        .toSet();
    final nextNow = DateTime.now();
    final resolvedReschedulingAppointmentId =
        _reschedulingAppointmentId != null &&
            appointments.any(
              (appointment) =>
                  appointment.id == _reschedulingAppointmentId &&
                  !_isHistoryAppointment(appointment, nextNow),
            )
        ? _reschedulingAppointmentId
        : null;

    setState(() {
      _locallyScheduledMembershipPlanIds.retainWhere(
        (membershipId) => liveMembershipIds.contains(membershipId),
      );
      _services = services;
      _appointments = appointments;
      _membershipPlans = membershipPlans;
      _selectedService = selected;
      _availability = availability;
      _loading = false;
      _servicesLoadFailed = servicesLoadFailed;
      _loadErrorMessage = loadErrors.isEmpty ? null : loadErrors.first;
      _reschedulingAppointmentId = resolvedReschedulingAppointmentId;
      if (shouldApplyFocusedOffer) {
        _lastAppliedFocusedOfferRevision = widget.focusedOfferRevision;
      }
    });
  }

  Future<void> _changeService(ServiceOption service) async {
    final reschedulingAppointment = _reschedulingAppointment();
    if (reschedulingAppointment != null &&
        reschedulingAppointment.serviceId?.trim().isNotEmpty == true &&
        reschedulingAppointment.serviceId != service.id) {
      _showLoadError(
        'A remarcacao precisa manter o mesmo servico. Troque apenas o dia ou horario.',
      );
      return;
    }

    if (_selectedService?.id == service.id && _availability != null) {
      return;
    }

    final loadRequestId = ++_loadRequestId;
    setState(() {
      _selectedService = service;
      _selectedStaffMemberId = null;
      _loading = true;
      _loadErrorMessage = null;
    });

    try {
      final availability = await _getDayAvailability(
        serviceId: service.id,
        day: _selectedDay,
      );

      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      setState(() {
        _availability = availability;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      final message = _formatAgendaError(
        error,
        fallback: 'Nao foi possivel carregar os horarios deste servico.',
      );
      setState(() {
        _availability = null;
        _loading = false;
        _loadErrorMessage = message;
      });
      _showLoadError(message);
    }
  }

  Future<void> _changeDay(DateTime day) async {
    if (_selectedService == null) {
      return;
    }

    if (DateUtils.isSameDay(_selectedDay, day) && _availability != null) {
      return;
    }

    final loadRequestId = ++_loadRequestId;
    setState(() {
      _selectedDay = day;
      _loading = true;
      _loadErrorMessage = null;
    });

    try {
      final availability = await _getDayAvailability(
        serviceId: _selectedService!.id,
        day: day,
      );

      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      setState(() {
        _availability = availability;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      final message = _formatAgendaError(
        error,
        fallback: 'Nao foi possivel carregar os horarios deste dia.',
      );
      setState(() {
        _availability = null;
        _loading = false;
        _loadErrorMessage = message;
      });
      _showLoadError(message);
    }
  }

  String _availabilityCacheKey({
    required String serviceId,
    required DateTime day,
  }) {
    final normalizedDay = DateUtils.dateOnly(day);
    final month = normalizedDay.month.toString().padLeft(2, '0');
    final dayOfMonth = normalizedDay.day.toString().padLeft(2, '0');
    return '$serviceId|${normalizedDay.year}-$month-$dayOfMonth';
  }

  Future<DayAvailability?> _getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final cacheKey = _availabilityCacheKey(serviceId: serviceId, day: day);
    if (_availabilityCache.containsKey(cacheKey)) {
      return _availabilityCache[cacheKey];
    }

    final availability = await widget.bookingRepository.fetchDayAvailability(
      serviceId: serviceId,
      day: day,
    );
    _availabilityCache[cacheKey] = availability;
    return availability;
  }

  ServiceOption? _resolveSelectedService(
    List<ServiceOption> services, {
    required bool shouldApplyFocusedOffer,
    required String? focusedServiceId,
  }) {
    if (services.isEmpty) {
      return null;
    }

    if (shouldApplyFocusedOffer &&
        focusedServiceId != null &&
        focusedServiceId.isNotEmpty) {
      for (final service in services) {
        if (service.id == focusedServiceId) {
          return service;
        }
      }
    }

    final selectedServiceId = _selectedService?.id;
    if (selectedServiceId != null && selectedServiceId.isNotEmpty) {
      for (final service in services) {
        if (service.id == selectedServiceId) {
          return service;
        }
      }
    }

    return services.first;
  }

  CustomerAppointment? _reschedulingAppointment() {
    final appointmentId = _reschedulingAppointmentId?.trim();
    if (appointmentId == null || appointmentId.isEmpty) {
      return null;
    }

    for (final appointment in _appointments) {
      if (appointment.id == appointmentId) {
        return appointment;
      }
    }

    return null;
  }

  Future<void> _startReschedulingAppointment(
    CustomerAppointment appointment,
  ) async {
    final serviceId = appointment.serviceId?.trim();
    if (serviceId == null || serviceId.isEmpty) {
      _showLoadError(
        'Esse horario ainda nao possui o servico operacional completo para remarcacao.',
      );
      return;
    }

    ServiceOption? matchedService;
    for (final service in _services) {
      if (service.id == serviceId) {
        matchedService = service;
        break;
      }
    }

    if (matchedService == null) {
      _showLoadError(
        'Esse servico nao esta disponivel no app para remarcar agora.',
      );
      return;
    }

    final targetDay = DateUtils.dateOnly(appointment.date);
    final loadRequestId = ++_loadRequestId;
    setState(() {
      _reschedulingAppointmentId = appointment.id;
      _selectedService = matchedService;
      _selectedStaffMemberId = appointment.staffMemberId;
      _selectedDay = targetDay;
      _loading = true;
      _loadErrorMessage = null;
    });

    try {
      final availability = await _getDayAvailability(
        serviceId: matchedService.id,
        day: targetDay,
      );

      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      setState(() {
        _availability = availability;
        _loading = false;
      });
      _showLoadError(
        appointment.isMembershipPlanAppointment
            ? 'Remarcacao do plano pronta. Escolha outro horario com o mesmo profissional.'
            : 'Remarcacao pronta. Escolha o novo horario na grade abaixo.',
      );
    } catch (error) {
      if (!mounted || loadRequestId != _loadRequestId) {
        return;
      }

      final message = _formatAgendaError(
        error,
        fallback: 'Nao foi possivel abrir a grade para remarcar agora.',
      );
      setState(() {
        _availability = null;
        _loading = false;
        _loadErrorMessage = message;
      });
      _showLoadError(message);
    }
  }

  void _cancelReschedulingMode() {
    final reschedulingAppointment = _reschedulingAppointment();
    _commitAgendaState(() {
      _reschedulingAppointmentId = null;
      if (reschedulingAppointment?.isMembershipPlanAppointment == true) {
        _selectedStaffMemberId = null;
      }
    });
  }

  String _formatAgendaError(Object error, {required String fallback}) {
    final message = '$error'.replaceFirst('Exception: ', '').trim();
    if (message.isEmpty) {
      return fallback;
    }
    if (_isAppointmentNotFoundError(error)) {
      return 'Esse item antigo não existe mais no salão e foi removido do app.';
    }
    return message;
  }

  bool _isAppointmentNotFoundError(Object error) {
    return '$error'.toLowerCase().contains('appointment_not_found');
  }

  void _commitAgendaState(VoidCallback mutation) {
    setState(mutation);
  }

  int _activeReservedCountForMembership(String membershipId) {
    if (membershipId.trim().isEmpty) {
      return 0;
    }

    final now = DateTime.now();
    final reservedCount = _appointments.where((appointment) {
      return appointment.membershipPlanId == membershipId &&
          appointment.membershipPlanReservationStatus == 'scheduled' &&
          !_isHistoryAppointment(appointment, now);
    }).length;
    if (reservedCount > 0) {
      return reservedCount;
    }

    return _locallyScheduledMembershipPlanIds.contains(membershipId) ? 1 : 0;
  }

  int _reservableSessionsRemaining(CustomerMembershipPlan membership) {
    final remaining =
        membership.sessionsRemaining -
        _activeReservedCountForMembership(membership.id);
    return remaining <= 0 ? 0 : remaining;
  }

  List<CustomerMembershipPlan> _pendingFirstSlotMembershipPlans() {
    final now = DateTime.now();
    final pending =
        _membershipPlans
            .where((membership) {
              if (membership.status != 'active' ||
                  !membership.isActiveOn(now)) {
                return false;
              }

              if (_activeReservedCountForMembership(membership.id) > 0) {
                return false;
              }

              return _reservableSessionsRemaining(membership) > 0;
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

  String? _focusedMembershipPlanIdFromOffer() {
    final offer = widget.focusedOffer;
    if (offer == null || offer.kind != 'membership') {
      return null;
    }

    const prefix = 'membership-plan:';
    final rawId = offer.id.trim();
    if (!rawId.startsWith(prefix)) {
      return null;
    }

    final membershipId = rawId.substring(prefix.length).trim();
    return membershipId.isEmpty ? null : membershipId;
  }

  SalonOfferHighlight? _focusedMembershipRequestOffer() {
    final offer = widget.focusedOffer;
    if (offer == null || offer.kind != 'membership') {
      return null;
    }

    return offer.actionKind == membershipRequestSchedulingActionKind
        ? offer
        : null;
  }

  CustomerMembershipPlan? _focusedPendingMembershipForService(
    ServiceOption service,
    DateTime slotDay,
  ) {
    final focusedMembershipId = _focusedMembershipPlanIdFromOffer();
    if (focusedMembershipId == null) {
      return null;
    }

    for (final membership in _pendingFirstSlotMembershipPlans()) {
      if (membership.id != focusedMembershipId) {
        continue;
      }

      if (membership.serviceId != service.id) {
        continue;
      }

      if (!membership.isActiveOn(slotDay)) {
        continue;
      }

      if (_reservableSessionsRemaining(membership) <= 0) {
        continue;
      }

      return membership;
    }

    return null;
  }

  Future<void> _focusMembershipPlan(CustomerMembershipPlan membership) async {
    final serviceId = membership.serviceId?.trim();
    if (serviceId == null || serviceId.isEmpty) {
      return;
    }

    for (final service in _services) {
      if (service.id == serviceId) {
        await _changeService(service);
        return;
      }
    }

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text(
            'Esse servico do plano ainda nao esta disponivel para reservar no app.',
          ),
        ),
      );
  }

  CustomerMembershipPlan? _eligibleMembershipForService(
    ServiceOption service,
    DateTime slotDay,
  ) {
    final candidates =
        _membershipPlans
            .where(
              (membership) =>
                  membership.serviceId == service.id &&
                  membership.isActiveOn(slotDay) &&
                  _reservableSessionsRemaining(membership) > 0,
            )
            .toList(growable: false)
          ..sort((left, right) => left.expiresAt.compareTo(right.expiresAt));

    if (candidates.isEmpty) {
      return null;
    }

    return candidates.first;
  }

  @override
  Widget build(BuildContext context) {
    // Keep the structured path active while the legacy inline layout is retired.
    if (context.mounted) {
      return _buildStructuredAgendaPage();
    }

    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(
      preview?.brandColor,
      fallback: AppTheme.secondary,
    );
    final now = DateTime.now();
    final activeAppointments =
        _appointments
            .where((item) => !_isHistoryAppointment(item, now))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final historyAppointments =
        _appointments.where((item) => _isHistoryAppointment(item, now)).toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final upcoming =
        activeAppointments.where((item) => item.date.isAfter(now)).toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final nextAppointment = upcoming.isEmpty ? null : upcoming.first;
    final chipsDays = List<DateTime>.generate(
      10,
      (index) => DateUtils.dateOnly(now.add(Duration(days: index))),
    );
    final staffMembers = List<StaffAvailability>.from(
      _availability?.staffMembers ?? const <StaffAvailability>[],
    );
    final enabledStaffIds = staffMembers.map((staff) => staff.id).toSet();
    final availableSlots =
        List<AppointmentSlot>.from(
              _availability?.availableSlots ?? const <AppointmentSlot>[],
            )
            .where((slot) => enabledStaffIds.contains(slot.staffMemberId))
            .toList()
          ..sort((a, b) => a.startAt.compareTo(b.startAt));
    final focusedStaffMember = _resolveFocusedStaffMember(staffMembers);
    final serviceScopedSlots = focusedStaffMember == null
        ? availableSlots
        : availableSlots
              .where((slot) => slot.staffMemberId == focusedStaffMember.id)
              .toList();
    final selectedDayAppointments =
        activeAppointments
            .where((item) => DateUtils.isSameDay(item.date, _selectedDay))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final sameDayActiveAppointment = _activeAppointmentOnDay(
      activeAppointments,
      _selectedDay,
      now,
    );
    final bookableSlots = sameDayActiveAppointment == null
        ? serviceScopedSlots
        : const <AppointmentSlot>[];
    final availableStaffCount = staffMembers
        .where((staff) => staff.status == 'available')
        .length;
    final nextSlot = bookableSlots.isEmpty ? null : bookableSlots.first;
    final selectedService = _selectedService;
    final focusedOffer = widget.focusedOffer;
    final plannedRevenue = selectedDayAppointments.fold<double>(
      0,
      (sum, appointment) => appointment.isMembershipPlanAppointment
          ? sum
          : sum + (appointment.servicePrice ?? 0),
    );
    final depositCount = activeAppointments
        .where((appointment) => appointment.depositAmount > 0)
        .length;
    final clearableHistoryAppointments = historyAppointments
        .where(
          (appointment) => _isFinalAppointmentStatusValue(appointment.status),
        )
        .toList(growable: false);

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl: preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _bootstrap,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                SalonPanel(
                  accent: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Pill(
                            label: 'Agenda premium',
                            icon: Icons.auto_awesome_rounded,
                            backgroundColor: accent.withValues(alpha: 0.12),
                            foregroundColor: accent,
                          ),
                          Pill(
                            label: _relativeDayLabel(_selectedDay),
                            icon: Icons.today_rounded,
                          ),
                          if (selectedService != null)
                            Pill(
                              label:
                                  '${selectedService.durationMinutes} min • ${formatCurrency(selectedService.price)}',
                              icon: Icons.spa_rounded,
                              backgroundColor: AppTheme.accent.withValues(
                                alpha: 0.2,
                              ),
                              foregroundColor: AppTheme.ink,
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Reserva rápida, leitura clara e encaixe certeiro.',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        selectedService == null
                            ? 'Assim que o salão liberar serviços, a agenda aparece aqui com horários reais.'
                            : 'Escolha o melhor horário para ${selectedService.name.toLowerCase()} e feche o toque em poucos segundos.',
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(height: 20),
                      _AgendaMetricGrid(
                        children: [
                          _AgendaMetricCard(
                            icon: Icons.event_available_rounded,
                            label: 'Próximo horário',
                            value: nextAppointment == null
                                ? 'Livre'
                                : formatShortDate(nextAppointment.date),
                            support: nextAppointment == null
                                ? 'Sem reserva futura'
                                : formatTime(nextAppointment.date),
                            tone: accent,
                          ),
                          _AgendaMetricCard(
                            icon: Icons.bolt_rounded,
                            label: 'Encaixes do dia',
                            value: '${bookableSlots.length}',
                            support: sameDayActiveAppointment != null
                                ? 'Bloqueado pela sua reserva de hoje'
                                : nextSlot == null
                                ? 'Sem vaga por enquanto'
                                : focusedStaffMember == null
                                ? 'Primeiro às ${formatTime(nextSlot.startAt)}'
                                : '${focusedStaffMember.name} às ${formatTime(nextSlot.startAt)}',
                            tone: AppTheme.primary,
                          ),
                          _AgendaMetricCard(
                            icon: Icons.payments_rounded,
                            label: 'Sinais ativos',
                            value: '$depositCount',
                            support: depositCount == 0
                                ? 'Sem exigência agora'
                                : 'Reservas com proteção',
                            tone: AppTheme.accent,
                          ),
                          _AgendaMetricCard(
                            icon: Icons.people_alt_rounded,
                            label: 'Equipe pronta',
                            value: '$availableStaffCount',
                            support: staffMembers.isEmpty
                                ? 'Ainda sem escala'
                                : focusedStaffMember == null
                                ? '${staffMembers.length} profissionais habilitados para esse serviço'
                                : 'Horários filtrados em ${focusedStaffMember.name}',
                            tone: AppTheme.secondary,
                          ),
                        ],
                      ),
                      if (nextAppointment != null) ...[
                        const SizedBox(height: 20),
                        _HighlightedAgendaCard(
                          appointment: nextAppointment,
                          accent: accent,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (focusedOffer != null) ...[
                  _AgendaOfferContextCard(
                    offer: focusedOffer,
                    selectedService: selectedService,
                  ),
                  const SizedBox(height: 20),
                ],
                const SectionTitle(
                  title: 'Escolha o serviço',
                  subtitle: 'Tudo organizado para reservar sem atrito.',
                ),
                const SizedBox(height: 14),
                if (_services.isEmpty && !_loading && !_servicesLoadFailed)
                  const EmptyStateCard(
                    title: 'Sem serviços disponíveis',
                    message:
                        'Assim que o salão ativar a agenda, os serviços aparecem aqui.',
                    icon: Icons.spa_outlined,
                  )
                else if (_services.isNotEmpty)
                  SizedBox(
                    height: 258,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _services.length,
                      separatorBuilder: (context, index) =>
                          const SizedBox(width: 12),
                      itemBuilder: (context, index) {
                        final service = _services[index];
                        return _ServicePickerCard(
                          service: service,
                          selected: service.id == selectedService?.id,
                          accent: accent,
                          onTap: () => _changeService(service),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: 20),
                const SectionTitle(
                  title: 'Escolha o dia',
                  subtitle:
                      'Os encaixes abaixo já respeitam o serviço escolhido.',
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 136,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: chipsDays.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final day = chipsDays[index];
                      return _DayPickerCard(
                        day: day,
                        selected: DateUtils.isSameDay(day, _selectedDay),
                        accent: accent,
                        onTap: () => _changeDay(day),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),
                if (_loadErrorMessage != null) ...[
                  SalonPanel(
                    accent: AppTheme.accent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionTitle(
                          title: 'A agenda travou neste recorte',
                          subtitle:
                              'A tela continua aberta para voce tentar de novo sem perder o contexto.',
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _loadErrorMessage!,
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 14),
                        OutlinedButton.icon(
                          onPressed: _loading ? null : _bootstrap,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Tentar novamente'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 42),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (selectedService == null) ...[
                  if (_services.isNotEmpty && !_servicesLoadFailed)
                    const EmptyStateCard(
                      title: 'Sem serviço selecionado',
                      message:
                          'Escolha um serviço para liberar a grade com equipe e horários disponíveis na hora.',
                      icon: Icons.calendar_view_day_rounded,
                    ),
                ] else ...[
                  SalonPanel(
                    accent: _availability?.isOpen == true
                        ? accent
                        : AppTheme.accent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SectionTitle(
                          title: 'Leitura do dia',
                          subtitle: _availability?.isOpen == true
                              ? 'A agenda está aberta e pronta para encaixes em tempo real.'
                              : 'O salão não atende nesta data.',
                        ),
                        const SizedBox(height: 16),
                        _AgendaMetricGrid(
                          children: [
                            _AgendaMetricCard(
                              icon: Icons.schedule_rounded,
                              label: 'Funcionamento',
                              value:
                                  _availability?.opensAt != null &&
                                      _availability?.closesAt != null
                                  ? '${formatTime(_availability!.opensAt!)} - ${formatTime(_availability!.closesAt!)}'
                                  : 'Fechado',
                              support: _availability?.isOpen == true
                                  ? 'Step de ${_availability?.slotStepMinutes ?? 0} min'
                                  : 'Troque o dia para abrir a grade',
                              tone: accent,
                            ),
                            _AgendaMetricCard(
                              icon: Icons.event_repeat_rounded,
                              label: 'Sua agenda do dia',
                              value: '${selectedDayAppointments.length}',
                              support: selectedDayAppointments.isEmpty
                                  ? 'Nenhum horário reservado'
                                  : 'Valor previsto ${formatCurrency(plannedRevenue)}',
                              tone: AppTheme.primary,
                            ),
                            _AgendaMetricCard(
                              icon: Icons.person_search_rounded,
                              label: 'Próximo encaixe',
                              value: sameDayActiveAppointment != null
                                  ? 'Travado'
                                  : nextSlot == null
                                  ? 'Sem horário'
                                  : formatTime(nextSlot.startAt),
                              support: sameDayActiveAppointment != null
                                  ? 'Você já possui um horário ativo neste dia'
                                  : nextSlot == null
                                  ? 'Nenhuma vaga neste recorte'
                                  : focusedStaffMember == null
                                  ? 'Com ${nextSlot.staffMemberName}'
                                  : 'Somente ${focusedStaffMember.name}',
                              tone: AppTheme.secondary,
                            ),
                            _AgendaMetricCard(
                              icon: Icons.verified_rounded,
                              label: 'Status da experiência',
                              value: _availability?.isOpen == true
                                  ? 'Agenda ativa'
                                  : 'Dia fechado',
                              support:
                                  selectedService.description
                                          ?.trim()
                                          .isNotEmpty ==
                                      true
                                  ? selectedService.description!.trim()
                                  : 'Somente profissionais habilitados para este serviço aparecem aqui.',
                              tone: AppTheme.accent,
                            ),
                          ],
                        ),
                        if (staffMembers.isNotEmpty) ...[
                          const SizedBox(height: 20),
                          const SectionTitle(
                            title: 'Equipe em destaque',
                            subtitle:
                                'Toque em um profissional para ver só os horários dele dentro do serviço escolhido.',
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 256,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: staffMembers.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (context, index) {
                                return _StaffAvailabilityCard(
                                  staff: staffMembers[index],
                                  accent: accent,
                                  selected:
                                      focusedStaffMember?.id ==
                                      staffMembers[index].id,
                                  onTap: () =>
                                      _selectStaffMember(staffMembers[index]),
                                );
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  SectionTitle(
                    title: 'Melhores horários',
                    subtitle: sameDayActiveAppointment != null
                        ? 'Depois desse atendimento, a próxima reserva precisa ficar para outro dia.'
                        : bookableSlots.isEmpty
                        ? 'Troque o serviço ou o dia para encontrar outro encaixe.'
                        : focusedStaffMember == null
                        ? 'Esses horários já pertencem ao serviço escolhido e à equipe habilitada.'
                        : 'A grade abaixo mostra somente os horários de ${focusedStaffMember.name} para ${selectedService.name.toLowerCase()}.',
                  ),
                  const SizedBox(height: 14),
                  if (sameDayActiveAppointment != null)
                    EmptyStateCard(
                      title: 'Você já reservou este dia',
                      message: _sameDayBookingBlockMessage(
                        sameDayActiveAppointment,
                      ),
                      icon: Icons.lock_clock_rounded,
                    )
                  else if (bookableSlots.isEmpty)
                    const EmptyStateCard(
                      title: 'Sem encaixe livre agora',
                      message:
                          'Troque a data ou o serviço para encontrar outro horário.',
                      icon: Icons.event_busy_rounded,
                    )
                  else
                    SalonPanel(
                      child: GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: bookableSlots.length,
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 240,
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 12,
                              mainAxisExtent: 188,
                            ),
                        itemBuilder: (context, index) {
                          final slot = bookableSlots[index];
                          return _AgendaSlotCard(
                            slot: slot,
                            accent: accent,
                            ctaLabel: 'Reservar agora',
                            onTap: () => _confirmBooking(slot),
                          );
                        },
                      ),
                    ),
                ],
                const SizedBox(height: 20),
                SectionTitle(
                  title: 'Sua agenda no salão',
                  subtitle: activeAppointments.isEmpty
                      ? 'Reserve o primeiro horário e ele aparece aqui na hora.'
                      : 'Próximos horários e sinais ficam aqui, sem misturar com o histórico.',
                ),
                const SizedBox(height: 14),
                if (activeAppointments.isEmpty)
                  const EmptyStateCard(
                    title: 'Sem agendamento ativo',
                    message:
                        'Os horários encerrados ou cancelados ficam no histórico abaixo.',
                    icon: Icons.calendar_today_rounded,
                  )
                else
                  ...activeAppointments.map(
                    (appointment) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _AppointmentHistoryCard(
                        appointment: appointment,
                        accent: accent,
                        highlight:
                            nextAppointment != null &&
                            appointment.id == nextAppointment.id,
                        onPay:
                            appointment.depositAmount > 0 &&
                                appointment.depositStatus != 'received' &&
                                appointment.depositReportedPaidAt == null
                            ? () => _openDepositPayment(appointment)
                            : null,
                        onReschedule:
                            appointment.date.isAfter(now) &&
                                !_isHistoryAppointment(appointment, now)
                            ? () => _startReschedulingAppointment(appointment)
                            : null,
                        onCancel:
                            appointment.date.isAfter(now) &&
                                !_isHistoryAppointment(appointment, now)
                            ? () => _cancelAppointment(appointment)
                            : null,
                        onComplete:
                            _canCustomerCompleteAppointment(appointment, now)
                            ? () => _completeAppointment(appointment)
                            : null,
                        completionHint: _appointmentCompletionHint(
                          appointment,
                          now,
                        ),
                        onReview: null,
                        onArchive: null,
                      ),
                    ),
                  ),
                if (historyAppointments.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  SectionTitle(
                    title: 'Histórico',
                    subtitle:
                        'Atendimentos encerrados, cancelados e horários passados aguardando sua confirmação final ficam aqui.',
                    trailing: clearableHistoryAppointments.isEmpty
                        ? null
                        : TextButton.icon(
                            onPressed: () => _clearAppointmentHistory(
                              clearableHistoryAppointments,
                            ),
                            icon: const Icon(Icons.delete_sweep_rounded),
                            label: const Text('Limpar'),
                          ),
                  ),
                  const SizedBox(height: 14),
                  ...historyAppointments.map(
                    (appointment) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _AppointmentHistoryCard(
                        appointment: appointment,
                        accent: accent,
                        highlight: false,
                        onPay: null,
                        onReschedule: null,
                        onCancel: null,
                        onComplete:
                            _canCustomerCompleteAppointment(appointment, now)
                            ? () => _completeAppointment(appointment)
                            : null,
                        completionHint: _appointmentCompletionHint(
                          appointment,
                          now,
                        ),
                        onReview: appointment.status == 'completed'
                            ? () => _reviewAppointment(appointment)
                            : null,
                        onArchive:
                            _isFinalAppointmentStatusValue(appointment.status)
                            ? () => _archiveAppointment(appointment)
                            : null,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ServicePickerCard extends StatelessWidget {
  const _ServicePickerCard({
    required this.service,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final ServiceOption service;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(26),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 264,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? accent.withValues(alpha: 0.12) : Colors.white,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(
            color: selected ? accent : AppTheme.line,
            width: selected ? 1.4 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: selected ? 0.07 : 0.04),
              blurRadius: selected ? 22 : 16,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ServicePreviewImage(
              imageUrl: service.imageUrl,
              accent: selected ? accent : AppTheme.primary,
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service.name,
                        style: Theme.of(context).textTheme.titleMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        service.description?.trim().isNotEmpty == true
                            ? service.description!.trim()
                            : 'Entra direto na agenda ao escolher o horário.',
                        style: Theme.of(context).textTheme.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (selected)
                  Icon(Icons.check_circle_rounded, color: accent, size: 22),
              ],
            ),
            const Spacer(),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Pill(
                  label: '${service.durationMinutes} min',
                  icon: Icons.schedule_rounded,
                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.08),
                ),
                Text(
                  formatCurrency(service.price),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ServicePreviewImage extends StatelessWidget {
  const _ServicePreviewImage({required this.imageUrl, required this.accent});

  final String? imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: double.infinity,
        height: 112,
        child: imageUrl?.trim().isNotEmpty == true
            ? SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                alignment: Alignment.center,
                error: _ServicePreviewFallback(accent: accent),
                placeholder: _ServicePreviewFallback(accent: accent),
              )
            : _ServicePreviewFallback(accent: accent),
      ),
    );
  }
}

class _ServicePreviewFallback extends StatelessWidget {
  const _ServicePreviewFallback({required this.accent});

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
      child: Center(child: Icon(Icons.spa_rounded, color: accent, size: 30)),
    );
  }
}

class _DayPickerCard extends StatelessWidget {
  const _DayPickerCard({
    required this.day,
    required this.selected,
    required this.accent,
    required this.onTap,
  });

  final DateTime day;
  final bool selected;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 100,
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: selected ? accent : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: selected ? accent : AppTheme.line,
            width: selected ? 1.4 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: selected ? 0.08 : 0.03),
              blurRadius: 16,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _relativeDayLabel(day),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected ? Colors.white : AppTheme.mutedInk,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              formatShortDate(day),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: selected ? Colors.white : AppTheme.ink,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              formatWeekdayShort(day),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected
                    ? Colors.white.withValues(alpha: 0.84)
                    : AppTheme.mutedInk,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

class _AgendaOfferContextCard extends StatelessWidget {
  const _AgendaOfferContextCard({
    required this.offer,
    required this.selectedService,
  });

  final SalonOfferHighlight offer;
  final ServiceOption? selectedService;

  @override
  Widget build(BuildContext context) {
    final linkedServiceName =
        offer.bookingServiceName?.trim().isNotEmpty == true
        ? offer.bookingServiceName!.trim()
        : selectedService?.name;
    final isMembershipRequestSchedule =
        offer.actionKind == membershipRequestSchedulingActionKind;
    final subtitle = isMembershipRequestSchedule
        ? linkedServiceName == null
              ? 'Voce esta pedindo ${offer.title} com um horario preferido. Esse horario so vira serie fixa depois que o salao aprovar o plano e confirmar o pagamento no painel.'
              : 'Voce esta pedindo ${offer.title} com $linkedServiceName ja focado. Escolha o dia e o horario preferidos para o sistema tentar ativar a serie automaticamente quando o salao aprovar e confirmar o pagamento.'
        : linkedServiceName == null
        ? 'Voce veio da oferta ${offer.title}. Escolha o servico e feche o horario enquanto essa campanha estiver no ar.'
        : 'Voce veio da oferta ${offer.title}. A agenda ja puxou $linkedServiceName para transformar essa campanha em horario confirmado.';

    return SalonPanel(
      accent: AppTheme.primary.withValues(alpha: 0.12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: isMembershipRequestSchedule
                    ? 'Pedido com horario'
                    : 'Oferta aplicada',
                icon: isMembershipRequestSchedule
                    ? Icons.event_repeat_rounded
                    : Icons.local_offer_rounded,
                backgroundColor: AppTheme.primary.withValues(alpha: 0.14),
                foregroundColor: AppTheme.primary,
              ),
              Pill(label: offer.kindLabel),
              if (offer.priceLabel?.trim().isNotEmpty == true)
                Pill(label: offer.priceLabel!),
            ],
          ),
          const SizedBox(height: 12),
          Text(offer.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _AgendaMetricGrid extends StatelessWidget {
  const _AgendaMetricGrid({required this.children});

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

class _AgendaMetricCard extends StatelessWidget {
  const _AgendaMetricCard({
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

class _StaffAvailabilityCard extends StatelessWidget {
  const _StaffAvailabilityCard({
    required this.staff,
    required this.accent,
    required this.selected,
    required this.onTap,
  });

  final StaffAvailability staff;
  final Color accent;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tone = switch (staff.status) {
      'available' => accent,
      'serving' => AppTheme.primary,
      'off' => AppTheme.mutedInk,
      _ => AppTheme.accent,
    };

    return SizedBox(
      width: 228,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.panelRadius),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.panelRadius),
            border: Border.all(
              color: selected ? tone : Colors.transparent,
              width: selected ? 2 : 0,
            ),
          ),
          child: SalonPanel(
            padding: const EdgeInsets.all(16),
            accent: selected ? tone : tone.withValues(alpha: 0.08),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _AgendaArtwork(
                      imageUrl: staff.imageUrl,
                      size: 54,
                      accent: tone,
                      icon: Icons.person_rounded,
                      imageAlignment: kSalonPortraitAvatarAlignment,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            staff.name,
                            style: Theme.of(context).textTheme.titleMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (staff.role?.trim().isNotEmpty == true) ...[
                            const SizedBox(height: 4),
                            Text(
                              staff.role!,
                              style: Theme.of(context).textTheme.bodySmall,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (selected)
                      Icon(Icons.check_circle_rounded, color: tone, size: 22),
                  ],
                ),
                const SizedBox(height: 14),
                Pill(
                  label: _staffStatusLabel(staff.status),
                  icon: _staffStatusIcon(staff.status),
                  backgroundColor: tone.withValues(alpha: 0.14),
                  foregroundColor: tone == AppTheme.accent
                      ? AppTheme.ink
                      : tone,
                ),
                const SizedBox(height: 12),
                Text(
                  staff.statusDetail,
                  style: Theme.of(context).textTheme.bodySmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 12),
                Text(
                  '${staff.availableSlotsCount} encaixes livres',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (staff.nextAvailableAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Próximo às ${formatTime(staff.nextAvailableAt!)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AgendaSlotCard extends StatelessWidget {
  const _AgendaSlotCard({
    required this.slot,
    required this.accent,
    this.ctaLabel = 'Reservar agora',
    required this.onTap,
  });

  final AppointmentSlot slot;
  final Color accent;
  final String ctaLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppTheme.line),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 14,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _AgendaArtwork(
                  imageUrl: slot.staffMemberImageUrl,
                  size: 42,
                  accent: accent,
                  icon: Icons.person_rounded,
                  imageAlignment: kSalonPortraitAvatarAlignment,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    formatTime(slot.startAt),
                    textAlign: TextAlign.right,
                    style: theme.textTheme.titleLarge,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              slot.staffMemberName,
              style: theme.textTheme.titleMedium,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              '${formatTime(slot.startAt)} até ${formatTime(slot.endsAt)}',
              style: theme.textTheme.bodySmall,
            ),
            const Spacer(),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accent.withValues(alpha: 0.16)),
              ),
              child: Row(
                children: [
                  Icon(Icons.touch_app_rounded, color: accent, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      ctaLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: accent,
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
    );
  }
}

class _AppointmentHistoryCard extends StatelessWidget {
  const _AppointmentHistoryCard({
    required this.appointment,
    required this.accent,
    required this.highlight,
    required this.onPay,
    required this.onReschedule,
    required this.onCancel,
    required this.onComplete,
    required this.completionHint,
    required this.onReview,
    required this.onArchive,
  });

  final CustomerAppointment appointment;
  final Color accent;
  final bool highlight;
  final VoidCallback? onPay;
  final VoidCallback? onReschedule;
  final VoidCallback? onCancel;
  final VoidCallback? onComplete;
  final String? completionHint;
  final VoidCallback? onReview;
  final VoidCallback? onArchive;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      accent: highlight ? accent : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _AgendaArtwork(
                imageUrl: appointment.serviceImageUrl,
                size: 64,
                accent: accent,
                icon: Icons.content_cut_rounded,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
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
                      _AgendaProfessionalSignature(
                        name: appointment.staffName!,
                        role: appointment.staffRole,
                        imageUrl: appointment.staffImageUrl,
                        accent: accent,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Pill(label: appointmentStatusLabel(appointment.status)),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (appointment.servicePrice != null)
                Pill(
                  label: formatCurrency(appointment.servicePrice!),
                  icon: Icons.sell_rounded,
                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.08),
                ),
              if (appointment.serviceDuration != null)
                Pill(
                  label: '${appointment.serviceDuration} min',
                  icon: Icons.schedule_rounded,
                ),
              if (appointment.depositAmount > 0)
                Pill(
                  label: 'Sinal ${formatCurrency(appointment.depositAmount)}',
                  icon: Icons.payments_rounded,
                  backgroundColor: AppTheme.accent.withValues(alpha: 0.2),
                  foregroundColor: AppTheme.ink,
                ),
              if (appointment.depositReportedPaidAt != null)
                Pill(
                  label:
                      'Pagamento informado${appointment.depositReportedPaidVia?.trim().isNotEmpty == true ? ' • ${appointment.depositReportedPaidVia}' : ''}',
                  icon: Icons.receipt_long_rounded,
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
                  foregroundColor: AppTheme.primary,
                ),
              if (appointment.isMembershipPlanAppointment)
                Pill(
                  label:
                      appointment.membershipPlanTitle?.trim().isNotEmpty == true
                      ? 'Plano • ${appointment.membershipPlanTitle}'
                      : 'Coberto pelo plano',
                  icon: Icons.workspace_premium_rounded,
                  backgroundColor: accent.withValues(alpha: 0.14),
                  foregroundColor: accent,
                ),
              if (!appointment.isMembershipPlanAppointment &&
                  appointment.paymentPreference?.trim().isNotEmpty == true)
                Pill(
                  label:
                      'Forma prevista • ${appointmentPaymentPreferenceLabel(appointment.paymentPreference!)}',
                  icon: Icons.wallet_rounded,
                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.12),
                  foregroundColor: AppTheme.secondary,
                ),
              if (appointment.isMembershipPlanAppointment &&
                  appointment.membershipSessionIndex != null &&
                  appointment.membershipSessionsIncluded != null)
                Pill(
                  label:
                      'Sessao ${appointment.membershipSessionIndex}/${appointment.membershipSessionsIncluded}',
                  icon: Icons.repeat_rounded,
                  backgroundColor: AppTheme.panel,
                ),
              if (appointment.presenceConfirmedAt != null)
                Pill(
                  label:
                      'Presença às ${formatTime(appointment.presenceConfirmedAt!)}',
                  icon: Icons.verified_user_rounded,
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
                  foregroundColor: AppTheme.primary,
                ),
              if (appointment.reviewRating != null)
                Pill(
                  label: '${appointment.reviewRating}/5 no app',
                  icon: Icons.star_rounded,
                  backgroundColor: accent.withValues(alpha: 0.14),
                  foregroundColor: accent,
                ),
            ],
          ),
          if (appointment.bookingPolicySnapshot?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.line),
              ),
              child: Text(
                appointment.bookingPolicySnapshot!,
                style: Theme.of(context).textTheme.bodySmall,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
          if (appointment.reviewComment?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: accent.withValues(alpha: 0.14)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Avaliação enviada no app',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    appointment.reviewComment!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (appointment.reviewCreatedAt != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Enviada em ${formatFullDate(appointment.reviewCreatedAt!)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (onPay != null) ...[
            const SizedBox(height: 14),
            AsyncButton(
              label: 'Pagar sinal agora',
              isBusy: false,
              icon: Icons.payments_rounded,
              onPressed: onPay,
            ),
          ],
          if (onReschedule != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onReschedule,
              icon: const Icon(Icons.update_rounded),
              label: const Text('Remarcar horario'),
            ),
          ],
          if (onCancel != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onCancel,
              icon: const Icon(Icons.event_busy_rounded),
              label: const Text('Cancelar horário'),
            ),
          ],
          if (completionHint?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.line),
              ),
              child: Text(
                completionHint!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
          if (onComplete != null) ...[
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onComplete,
              icon: const Icon(Icons.verified_rounded),
              label: const Text('Concluir atendimento'),
            ),
          ],
          if (onReview != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onReview,
              icon: const Icon(Icons.star_rate_rounded),
              label: Text(
                appointment.reviewRating == null
                    ? 'Avaliar atendimento'
                    : 'Editar avaliação',
              ),
            ),
          ],
          if (onArchive != null) ...[
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onArchive,
              icon: const Icon(Icons.delete_outline_rounded),
              label: const Text('Remover do app'),
            ),
          ],
        ],
      ),
    );
  }
}

class _HighlightedAgendaCard extends StatelessWidget {
  const _HighlightedAgendaCard({
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
          _AgendaArtwork(
            imageUrl: appointment.serviceImageUrl,
            size: 68,
            accent: accent,
            icon: Icons.calendar_month_rounded,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Seu próximo toque',
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
                  _AgendaProfessionalSignature(
                    name: appointment.staffName!,
                    role: appointment.staffRole,
                    imageUrl: appointment.staffImageUrl,
                    accent: accent,
                  ),
                ],
                if (appointment.isMembershipPlanAppointment) ...[
                  const SizedBox(height: 10),
                  Pill(
                    label:
                        appointment.membershipPlanTitle?.trim().isNotEmpty ==
                            true
                        ? appointment.membershipPlanTitle!
                        : 'Plano mensal do app',
                    icon: Icons.workspace_premium_rounded,
                    backgroundColor: accent.withValues(alpha: 0.14),
                    foregroundColor: accent,
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

class _AgendaArtwork extends StatelessWidget {
  const _AgendaArtwork({
    required this.size,
    required this.accent,
    required this.icon,
    this.imageAlignment = Alignment.center,
    this.imageUrl,
  });

  final double size;
  final Color accent;
  final IconData icon;
  final Alignment imageAlignment;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl?.trim().isNotEmpty == true
            ? SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                alignment: imageAlignment,
                error: _FallbackArtwork(accent: accent, icon: icon),
                placeholder: _FallbackArtwork(accent: accent, icon: icon),
              )
            : _FallbackArtwork(accent: accent, icon: icon),
      ),
    );
  }
}

class _AgendaProfessionalSignature extends StatelessWidget {
  const _AgendaProfessionalSignature({
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
        _AgendaArtwork(
          imageUrl: imageUrl,
          size: 34,
          accent: accent,
          icon: Icons.person_rounded,
          imageAlignment: kSalonPortraitAvatarAlignment,
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

class _FallbackArtwork extends StatelessWidget {
  const _FallbackArtwork({required this.accent, required this.icon});

  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.2), AppTheme.panel],
        ),
      ),
      child: Center(child: Icon(icon, color: accent, size: 26)),
    );
  }
}

class _AgendaInfoTile extends StatelessWidget {
  const _AgendaInfoTile({
    required this.label,
    required this.value,
    required this.support,
  });

  final String label;
  final String value;
  final String support;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(support, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

String _relativeDayLabel(DateTime day) {
  final today = DateUtils.dateOnly(DateTime.now());
  final target = DateUtils.dateOnly(day);
  final difference = target.difference(today).inDays;

  switch (difference) {
    case 0:
      return 'Hoje';
    case 1:
      return 'Amanhã';
    default:
      return formatWeekdayShort(day);
  }
}

String _staffStatusLabel(String status) {
  switch (status) {
    case 'available':
      return 'Livre agora';
    case 'serving':
      return 'Em atendimento';
    case 'off':
      return 'Fora da escala';
    default:
      return 'Agenda cheia';
  }
}

IconData _staffStatusIcon(String status) {
  switch (status) {
    case 'available':
      return Icons.check_circle_rounded;
    case 'serving':
      return Icons.content_cut_rounded;
    case 'off':
      return Icons.pause_circle_rounded;
    default:
      return Icons.timelapse_rounded;
  }
}
