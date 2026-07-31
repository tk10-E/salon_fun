part of 'agenda_page.dart';

class _AgendaStructuredViewData {
  const _AgendaStructuredViewData({
    required this.preview,
    required this.accent,
    required this.now,
    required this.selectedDay,
    required this.selectedService,
    required this.focusedOffer,
    required this.loading,
    required this.servicesLoadFailed,
    required this.loadErrorMessage,
    required this.services,
    required this.availability,
    required this.activeAppointments,
    required this.historyAppointments,
    required this.nextAppointment,
    required this.reschedulingAppointment,
    required this.chipsDays,
    required this.staffMembers,
    required this.focusedStaffMember,
    required this.bookableSlots,
    required this.selectedDayAppointments,
    required this.sameDayActiveAppointment,
    required this.sameDayBlockMessage,
    required this.availableStaffCount,
    required this.nextSlot,
    required this.plannedRevenue,
    required this.depositCount,
    required this.pendingFirstSlotMemberships,
  });

  factory _AgendaStructuredViewData.fromState(_AgendaPageState state) {
    final preview = state.widget.session.landingData?.preview;
    final accent = parseHexColor(
      preview?.brandColor,
      fallback: AppTheme.secondary,
    );
    final now = DateTime.now();
    final activeAppointments =
        state._appointments
            .where((item) => !state._isHistoryAppointment(item, now))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final historyAppointments =
        state._appointments
            .where((item) => state._isHistoryAppointment(item, now))
            .toList()
          ..sort((a, b) => b.date.compareTo(a.date));
    final upcoming =
        activeAppointments.where((item) => item.date.isAfter(now)).toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final nextAppointment = upcoming.isEmpty ? null : upcoming.first;
    final reschedulingAppointment = state._reschedulingAppointment();
    final chipsStartDay =
        reschedulingAppointment != null &&
            DateUtils.dateOnly(
              state._selectedDay,
            ).isAfter(DateUtils.dateOnly(now).add(const Duration(days: 9)))
        ? DateUtils.dateOnly(state._selectedDay)
        : DateUtils.dateOnly(now);
    final chipsDays = List<DateTime>.generate(
      10,
      (index) => DateUtils.dateOnly(chipsStartDay.add(Duration(days: index))),
    );
    final lockedStaffMemberId =
        reschedulingAppointment?.isMembershipPlanAppointment == true
        ? reschedulingAppointment?.staffMemberId?.trim()
        : null;
    final staffMembers =
        List<StaffAvailability>.from(
              state._availability?.staffMembers ?? const <StaffAvailability>[],
            )
            .where((staff) {
              if (lockedStaffMemberId == null || lockedStaffMemberId.isEmpty) {
                return true;
              }

              return staff.id == lockedStaffMemberId;
            })
            .toList(growable: false);
    final enabledStaffIds = staffMembers.map((staff) => staff.id).toSet();
    final availableSlots =
        List<AppointmentSlot>.from(
              state._availability?.availableSlots ?? const <AppointmentSlot>[],
            )
            .where((slot) => enabledStaffIds.contains(slot.staffMemberId))
            .toList()
          ..sort((a, b) => a.startAt.compareTo(b.startAt));
    final focusedStaffMember = state._resolveFocusedStaffMember(staffMembers);
    final serviceScopedSlots = focusedStaffMember == null
        ? availableSlots
        : availableSlots
              .where((slot) => slot.staffMemberId == focusedStaffMember.id)
              .toList();
    final selectedDayAppointments =
        activeAppointments
            .where((item) => DateUtils.isSameDay(item.date, state._selectedDay))
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final sameDayActiveAppointment = state._activeAppointmentOnDay(
      activeAppointments,
      state._selectedDay,
      now,
      ignoreAppointmentId: reschedulingAppointment?.id,
    );
    final bookableSlots = sameDayActiveAppointment == null
        ? serviceScopedSlots
        : const <AppointmentSlot>[];
    final availableStaffCount = staffMembers
        .where((staff) => staff.status == 'available')
        .length;
    final nextSlot = bookableSlots.isEmpty ? null : bookableSlots.first;
    final plannedRevenue = selectedDayAppointments.fold<double>(
      0,
      (sum, appointment) => appointment.isMembershipPlanAppointment
          ? sum
          : sum + (appointment.servicePrice ?? 0),
    );
    final depositCount = activeAppointments
        .where((appointment) => appointment.depositAmount > 0)
        .length;
    final pendingFirstSlotMemberships = state
        ._pendingFirstSlotMembershipPlans();

    return _AgendaStructuredViewData(
      preview: preview,
      accent: accent,
      now: now,
      selectedDay: state._selectedDay,
      selectedService: state._selectedService,
      focusedOffer: state.widget.focusedOffer,
      loading: state._loading,
      servicesLoadFailed: state._servicesLoadFailed,
      loadErrorMessage: state._loadErrorMessage,
      services: state._services,
      availability: state._availability,
      activeAppointments: activeAppointments,
      historyAppointments: historyAppointments,
      nextAppointment: nextAppointment,
      reschedulingAppointment: reschedulingAppointment,
      chipsDays: chipsDays,
      staffMembers: staffMembers,
      focusedStaffMember: focusedStaffMember,
      bookableSlots: bookableSlots,
      selectedDayAppointments: selectedDayAppointments,
      sameDayActiveAppointment: sameDayActiveAppointment,
      sameDayBlockMessage: sameDayActiveAppointment == null
          ? null
          : state._sameDayBookingBlockMessage(sameDayActiveAppointment),
      availableStaffCount: availableStaffCount,
      nextSlot: nextSlot,
      plannedRevenue: plannedRevenue,
      depositCount: depositCount,
      pendingFirstSlotMemberships: pendingFirstSlotMemberships,
    );
  }

  final SalonPreview? preview;
  final Color accent;
  final DateTime now;
  final DateTime selectedDay;
  final ServiceOption? selectedService;
  final SalonOfferHighlight? focusedOffer;
  final bool loading;
  final bool servicesLoadFailed;
  final String? loadErrorMessage;
  final List<ServiceOption> services;
  final DayAvailability? availability;
  final List<CustomerAppointment> activeAppointments;
  final List<CustomerAppointment> historyAppointments;
  final CustomerAppointment? nextAppointment;
  final CustomerAppointment? reschedulingAppointment;
  final List<DateTime> chipsDays;
  final List<StaffAvailability> staffMembers;
  final StaffAvailability? focusedStaffMember;
  final List<AppointmentSlot> bookableSlots;
  final List<CustomerAppointment> selectedDayAppointments;
  final CustomerAppointment? sameDayActiveAppointment;
  final String? sameDayBlockMessage;
  final int availableStaffCount;
  final AppointmentSlot? nextSlot;
  final double plannedRevenue;
  final int depositCount;
  final List<CustomerMembershipPlan> pendingFirstSlotMemberships;
}

extension _AgendaPageStateSections on _AgendaPageState {
  Widget _buildStructuredAgendaPage() {
    final data = _AgendaStructuredViewData.fromState(this);

    return Scaffold(
      body: AppGradientBackground(
        accentColor: data.accent,
        backgroundImageUrl: data.preview?.heroImageUrl,
        bannerStyle: data.preview?.bannerStyle,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _bootstrap,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
              children: [
                _AgendaHeroSection(
                  accent: data.accent,
                  selectedDay: data.selectedDay,
                  selectedService: data.selectedService,
                  nextAppointment: data.nextAppointment,
                  bookableSlotsCount: data.bookableSlots.length,
                  sameDayActiveAppointment: data.sameDayActiveAppointment,
                  nextSlot: data.nextSlot,
                  focusedStaffMember: data.focusedStaffMember,
                  depositCount: data.depositCount,
                  availableStaffCount: data.availableStaffCount,
                  staffMembersCount: data.staffMembers.length,
                ),
                const SizedBox(height: 20),
                if (data.pendingFirstSlotMemberships.isNotEmpty) ...[
                  _AgendaMembershipPlanActivationSection(
                    accent: data.accent,
                    memberships: data.pendingFirstSlotMemberships,
                    selectedService: data.selectedService,
                    onFocusMembershipPlan: _focusMembershipPlan,
                  ),
                  const SizedBox(height: 20),
                ],
                if (data.focusedOffer != null) ...[
                  _AgendaOfferContextCard(
                    offer: data.focusedOffer!,
                    selectedService: data.selectedService,
                  ),
                  const SizedBox(height: 20),
                ],
                _AgendaServiceSelectionSection(
                  services: data.services,
                  loading: data.loading,
                  servicesLoadFailed: data.servicesLoadFailed,
                  selectedService: data.selectedService,
                  accent: data.accent,
                  onChangeService: _changeService,
                ),
                const SizedBox(height: 20),
                _AgendaDaySelectionSection(
                  chipsDays: data.chipsDays,
                  selectedDay: data.selectedDay,
                  accent: data.accent,
                  onChangeDay: _changeDay,
                ),
                const SizedBox(height: 20),
                if (data.loadErrorMessage != null) ...[
                  _AgendaLoadErrorSection(
                    message: data.loadErrorMessage!,
                    loading: data.loading,
                    onRetry: _bootstrap,
                  ),
                  const SizedBox(height: 20),
                ],
                _AgendaAvailabilitySection(
                  loading: data.loading,
                  services: data.services,
                  servicesLoadFailed: data.servicesLoadFailed,
                  selectedService: data.selectedService,
                  availability: data.availability,
                  accent: data.accent,
                  staffMembers: data.staffMembers,
                  selectedDayAppointments: data.selectedDayAppointments,
                  plannedRevenue: data.plannedRevenue,
                  reschedulingAppointment: data.reschedulingAppointment,
                  sameDayActiveAppointment: data.sameDayActiveAppointment,
                  sameDayBlockMessage: data.sameDayBlockMessage,
                  nextSlot: data.nextSlot,
                  focusedStaffMember: data.focusedStaffMember,
                  bookableSlots: data.bookableSlots,
                  onSelectStaffMember: _selectStaffMember,
                  onConfirmBooking: _confirmBooking,
                  onCancelRescheduling: _cancelReschedulingMode,
                ),
                const SizedBox(height: 20),
                _AgendaAppointmentsSection(
                  activeAppointments: data.activeAppointments,
                  nextAppointment: data.nextAppointment,
                  accent: data.accent,
                  now: data.now,
                  onOpenDepositPayment: _openDepositPayment,
                  onCancelAppointment: _cancelAppointment,
                  onCompleteAppointment: _completeAppointment,
                  onRescheduleAppointment: _startReschedulingAppointment,
                ),
                if (data.historyAppointments.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  _AgendaHistorySection(
                    historyAppointments: data.historyAppointments,
                    accent: data.accent,
                    now: data.now,
                    onClearAppointmentHistory: _clearAppointmentHistory,
                    onCompleteAppointment: _completeAppointment,
                    onReviewAppointment: _reviewAppointment,
                    onArchiveAppointment: _archiveAppointment,
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

class _AgendaMembershipPlanActivationSection extends StatelessWidget {
  const _AgendaMembershipPlanActivationSection({
    required this.accent,
    required this.memberships,
    required this.selectedService,
    required this.onFocusMembershipPlan,
  });

  final Color accent;
  final List<CustomerMembershipPlan> memberships;
  final ServiceOption? selectedService;
  final ValueChanged<CustomerMembershipPlan> onFocusMembershipPlan;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(
            title: 'Plano ativo pronto para travar a serie',
            subtitle:
                'Escolha so um dia e horario-base. O app distribui automaticamente as proximas semanas no mesmo dia, horario e profissional da area.',
            trailing: Pill(
              label:
                  '${memberships.length} plano${memberships.length == 1 ? '' : 's'}',
              backgroundColor: accent.withValues(alpha: 0.12),
              foregroundColor: accent,
              icon: Icons.workspace_premium_rounded,
            ),
          ),
          const SizedBox(height: 16),
          ...memberships.map((membership) {
            final serviceIsSelected =
                selectedService?.id == membership.serviceId?.trim();
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
                  color: Colors.white.withValues(alpha: 0.74),
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
                              '${membership.sessionsRemaining} sessoes livres',
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
                      'Servico fixo: $serviceName. Ao confirmar um unico horario, o app reserva automaticamente as sessoes seguintes no mesmo dia, horario e profissional.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 14),
                    if (serviceIsSelected)
                      Pill(
                        label:
                            'Servico ja focado abaixo. Agora escolha o dia e o horario-base da serie.',
                        icon: Icons.check_circle_rounded,
                        backgroundColor: AppTheme.secondary.withValues(
                          alpha: 0.14,
                        ),
                        foregroundColor: AppTheme.secondary,
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          key: ValueKey(
                            'agenda-pending-membership-${membership.id}',
                          ),
                          onPressed: () => onFocusMembershipPlan(membership),
                          icon: const Icon(Icons.event_available_rounded),
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

class _AgendaHeroSection extends StatelessWidget {
  const _AgendaHeroSection({
    required this.accent,
    required this.selectedDay,
    required this.selectedService,
    required this.nextAppointment,
    required this.bookableSlotsCount,
    required this.sameDayActiveAppointment,
    required this.nextSlot,
    required this.focusedStaffMember,
    required this.depositCount,
    required this.availableStaffCount,
    required this.staffMembersCount,
  });

  final Color accent;
  final DateTime selectedDay;
  final ServiceOption? selectedService;
  final CustomerAppointment? nextAppointment;
  final int bookableSlotsCount;
  final CustomerAppointment? sameDayActiveAppointment;
  final AppointmentSlot? nextSlot;
  final StaffAvailability? focusedStaffMember;
  final int depositCount;
  final int availableStaffCount;
  final int staffMembersCount;

  @override
  Widget build(BuildContext context) {
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
                label: 'Agenda premium',
                icon: Icons.auto_awesome_rounded,
                backgroundColor: accent.withValues(alpha: 0.12),
                foregroundColor: accent,
              ),
              Pill(
                label: _relativeDayLabel(selectedDay),
                icon: Icons.today_rounded,
              ),
              if (selectedService != null)
                Pill(
                  label:
                      '${selectedService!.durationMinutes} min • ${formatCurrency(selectedService!.price)}',
                  icon: Icons.spa_rounded,
                  backgroundColor: AppTheme.accent.withValues(alpha: 0.2),
                  foregroundColor: AppTheme.ink,
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Reserva rapida, leitura clara e encaixe certeiro.',
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 10),
          Text(
            selectedService == null
                ? 'Assim que o salao liberar servicos, a agenda aparece aqui com horarios reais.'
                : 'Escolha o melhor horario para ${selectedService!.name.toLowerCase()} e feche o toque em poucos segundos.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          _AgendaMetricGrid(
            children: [
              _AgendaMetricCard(
                icon: Icons.event_available_rounded,
                label: 'Proximo horario',
                value: nextAppointment == null
                    ? 'Livre'
                    : formatShortDate(nextAppointment!.date),
                support: nextAppointment == null
                    ? 'Sem reserva futura'
                    : formatTime(nextAppointment!.date),
                tone: accent,
              ),
              _AgendaMetricCard(
                icon: Icons.bolt_rounded,
                label: 'Encaixes do dia',
                value: '$bookableSlotsCount',
                support: sameDayActiveAppointment != null
                    ? 'Bloqueado pela sua reserva de hoje'
                    : nextSlot == null
                    ? 'Sem vaga por enquanto'
                    : focusedStaffMember == null
                    ? 'Primeiro as ${formatTime(nextSlot!.startAt)}'
                    : '${focusedStaffMember!.name} as ${formatTime(nextSlot!.startAt)}',
                tone: AppTheme.primary,
              ),
              _AgendaMetricCard(
                icon: Icons.payments_rounded,
                label: 'Sinais ativos',
                value: '$depositCount',
                support: depositCount == 0
                    ? 'Sem exigencia agora'
                    : 'Reservas com protecao',
                tone: AppTheme.accent,
              ),
              _AgendaMetricCard(
                icon: Icons.people_alt_rounded,
                label: 'Equipe pronta',
                value: '$availableStaffCount',
                support: staffMembersCount == 0
                    ? 'Ainda sem escala'
                    : focusedStaffMember == null
                    ? '$staffMembersCount profissionais habilitados para esse servico'
                    : 'Horarios filtrados em ${focusedStaffMember!.name}',
                tone: AppTheme.secondary,
              ),
            ],
          ),
          if (nextAppointment != null) ...[
            const SizedBox(height: 20),
            _HighlightedAgendaCard(
              appointment: nextAppointment!,
              accent: accent,
            ),
          ],
        ],
      ),
    );
  }
}

class _AgendaServiceSelectionSection extends StatelessWidget {
  const _AgendaServiceSelectionSection({
    required this.services,
    required this.loading,
    required this.servicesLoadFailed,
    required this.selectedService,
    required this.accent,
    required this.onChangeService,
  });

  final List<ServiceOption> services;
  final bool loading;
  final bool servicesLoadFailed;
  final ServiceOption? selectedService;
  final Color accent;
  final ValueChanged<ServiceOption> onChangeService;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle(
          title: 'Escolha o servico',
          subtitle: 'Tudo organizado para reservar sem atrito.',
        ),
        const SizedBox(height: 14),
        if (services.isEmpty && !loading && !servicesLoadFailed)
          const EmptyStateCard(
            title: 'Sem servicos disponiveis',
            message:
                'Assim que o salao ativar a agenda, os servicos aparecem aqui.',
            icon: Icons.spa_outlined,
          )
        else if (services.isNotEmpty)
          SizedBox(
            height: 258,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: services.length,
              separatorBuilder: (context, index) => const SizedBox(width: 12),
              itemBuilder: (context, index) {
                final service = services[index];
                return _ServicePickerCard(
                  service: service,
                  selected: service.id == selectedService?.id,
                  accent: accent,
                  onTap: () => onChangeService(service),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _AgendaDaySelectionSection extends StatelessWidget {
  const _AgendaDaySelectionSection({
    required this.chipsDays,
    required this.selectedDay,
    required this.accent,
    required this.onChangeDay,
  });

  final List<DateTime> chipsDays;
  final DateTime selectedDay;
  final Color accent;
  final ValueChanged<DateTime> onChangeDay;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle(
          title: 'Escolha o dia',
          subtitle: 'Os encaixes abaixo ja respeitam o servico escolhido.',
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 136,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: chipsDays.length,
            separatorBuilder: (context, index) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final day = chipsDays[index];
              return _DayPickerCard(
                day: day,
                selected: DateUtils.isSameDay(day, selectedDay),
                accent: accent,
                onTap: () => onChangeDay(day),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _AgendaLoadErrorSection extends StatelessWidget {
  const _AgendaLoadErrorSection({
    required this.message,
    required this.loading,
    required this.onRetry,
  });

  final String message;
  final bool loading;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SalonPanel(
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
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: loading ? null : onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Tentar novamente'),
          ),
        ],
      ),
    );
  }
}

class _AgendaAvailabilitySection extends StatelessWidget {
  const _AgendaAvailabilitySection({
    required this.loading,
    required this.services,
    required this.servicesLoadFailed,
    required this.selectedService,
    required this.availability,
    required this.accent,
    required this.staffMembers,
    required this.selectedDayAppointments,
    required this.plannedRevenue,
    required this.reschedulingAppointment,
    required this.sameDayActiveAppointment,
    required this.sameDayBlockMessage,
    required this.nextSlot,
    required this.focusedStaffMember,
    required this.bookableSlots,
    required this.onSelectStaffMember,
    required this.onConfirmBooking,
    required this.onCancelRescheduling,
  });

  final bool loading;
  final List<ServiceOption> services;
  final bool servicesLoadFailed;
  final ServiceOption? selectedService;
  final DayAvailability? availability;
  final Color accent;
  final List<StaffAvailability> staffMembers;
  final List<CustomerAppointment> selectedDayAppointments;
  final double plannedRevenue;
  final CustomerAppointment? reschedulingAppointment;
  final CustomerAppointment? sameDayActiveAppointment;
  final String? sameDayBlockMessage;
  final AppointmentSlot? nextSlot;
  final StaffAvailability? focusedStaffMember;
  final List<AppointmentSlot> bookableSlots;
  final ValueChanged<StaffAvailability> onSelectStaffMember;
  final Future<void> Function(AppointmentSlot slot) onConfirmBooking;
  final VoidCallback onCancelRescheduling;

  @override
  Widget build(BuildContext context) {
    final membershipPlanCount = selectedDayAppointments
        .where((appointment) => appointment.isMembershipPlanAppointment)
        .length;

    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 42),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (selectedService == null) {
      if (services.isNotEmpty && !servicesLoadFailed) {
        return const EmptyStateCard(
          title: 'Sem servico selecionado',
          message:
              'Escolha um servico para liberar a grade com equipe e horarios disponiveis na hora.',
          icon: Icons.calendar_view_day_rounded,
        );
      }

      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (reschedulingAppointment != null) ...[
          SalonPanel(
            accent: accent,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionTitle(
                  title: 'Remarcando horario',
                  subtitle: reschedulingAppointment!.isMembershipPlanAppointment
                      ? 'Mantenha o mesmo servico e o mesmo profissional. Agora escolha so o novo encaixe.'
                      : 'Mantenha o mesmo servico. Agora escolha o novo dia, horario ou profissional disponivel.',
                  trailing: TextButton(
                    onPressed: onCancelRescheduling,
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '${reschedulingAppointment!.serviceName} • ${formatFullDate(reschedulingAppointment!.date)} às ${formatTime(reschedulingAppointment!.date)}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
        SalonPanel(
          accent: availability?.isOpen == true ? accent : AppTheme.accent,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SectionTitle(
                title: 'Leitura do dia',
                subtitle: availability?.isOpen == true
                    ? 'A agenda esta aberta e pronta para encaixes em tempo real.'
                    : 'O salao nao atende nesta data.',
              ),
              const SizedBox(height: 16),
              _AgendaMetricGrid(
                children: [
                  _AgendaMetricCard(
                    icon: Icons.schedule_rounded,
                    label: 'Funcionamento',
                    value:
                        availability?.opensAt != null &&
                            availability?.closesAt != null
                        ? '${formatTime(availability!.opensAt!)} - ${formatTime(availability!.closesAt!)}'
                        : 'Fechado',
                    support: availability?.isOpen == true
                        ? 'Step de ${availability?.slotStepMinutes ?? 0} min'
                        : 'Troque o dia para abrir a grade',
                    tone: accent,
                  ),
                  _AgendaMetricCard(
                    icon: Icons.event_repeat_rounded,
                    label: 'Sua agenda do dia',
                    value: '${selectedDayAppointments.length}',
                    support: selectedDayAppointments.isEmpty
                        ? 'Nenhum horario reservado'
                        : plannedRevenue > 0
                        ? 'Valor previsto ${formatCurrency(plannedRevenue)}'
                        : membershipPlanCount > 0
                        ? '$membershipPlanCount horario(s) cobertos por plano'
                        : 'Agenda pronta para o dia',
                    tone: AppTheme.primary,
                  ),
                  _AgendaMetricCard(
                    icon: Icons.person_search_rounded,
                    label: 'Proximo encaixe',
                    value: sameDayActiveAppointment != null
                        ? 'Travado'
                        : nextSlot == null
                        ? 'Sem horario'
                        : formatTime(nextSlot!.startAt),
                    support: sameDayActiveAppointment != null
                        ? 'Voce ja possui um horario ativo neste dia'
                        : nextSlot == null
                        ? 'Nenhuma vaga neste recorte'
                        : focusedStaffMember == null
                        ? 'Com ${nextSlot!.staffMemberName}'
                        : 'Somente ${focusedStaffMember!.name}',
                    tone: AppTheme.secondary,
                  ),
                  _AgendaMetricCard(
                    icon: Icons.verified_rounded,
                    label: 'Status da experiencia',
                    value: availability?.isOpen == true
                        ? 'Agenda ativa'
                        : 'Dia fechado',
                    support:
                        selectedService!.description?.trim().isNotEmpty == true
                        ? selectedService!.description!.trim()
                        : 'Somente profissionais habilitados para este servico aparecem aqui.',
                    tone: AppTheme.accent,
                  ),
                ],
              ),
              if (staffMembers.isNotEmpty) ...[
                const SizedBox(height: 20),
                const SectionTitle(
                  title: 'Equipe em destaque',
                  subtitle:
                      'Toque em um profissional para ver so os horarios dele dentro do servico escolhido.',
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
                            focusedStaffMember?.id == staffMembers[index].id,
                        onTap: () => onSelectStaffMember(staffMembers[index]),
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
          title: 'Melhores horarios',
          subtitle: reschedulingAppointment != null
              ? reschedulingAppointment!.isMembershipPlanAppointment
                    ? 'A grade abaixo mostra apenas os encaixes validos para o mesmo profissional do plano.'
                    : 'Esses horarios mantem o mesmo servico e atualizam o seu atendimento atual.'
              : sameDayActiveAppointment != null
              ? 'Depois desse atendimento, a proxima reserva precisa ficar para outro dia.'
              : bookableSlots.isEmpty
              ? 'Troque o servico ou o dia para encontrar outro encaixe.'
              : focusedStaffMember == null
              ? 'Esses horarios ja pertencem ao servico escolhido e a equipe habilitada.'
              : 'A grade abaixo mostra somente os horarios de ${focusedStaffMember!.name} para ${selectedService!.name.toLowerCase()}.',
        ),
        const SizedBox(height: 14),
        if (sameDayActiveAppointment != null)
          EmptyStateCard(
            title: 'Voce ja reservou este dia',
            message:
                sameDayBlockMessage ??
                'Escolha outro dia ou fale com o salao para remarcar.',
            icon: Icons.lock_clock_rounded,
          )
        else if (bookableSlots.isEmpty)
          const EmptyStateCard(
            title: 'Sem encaixe livre agora',
            message: 'Troque a data ou o servico para encontrar outro horario.',
            icon: Icons.event_busy_rounded,
          )
        else
          SalonPanel(
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: bookableSlots.length,
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
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
                  ctaLabel: reschedulingAppointment == null
                      ? 'Reservar agora'
                      : 'Remarcar para este horario',
                  onTap: () => onConfirmBooking(slot),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _AgendaAppointmentsSection extends StatelessWidget {
  const _AgendaAppointmentsSection({
    required this.activeAppointments,
    required this.nextAppointment,
    required this.accent,
    required this.now,
    required this.onOpenDepositPayment,
    required this.onCancelAppointment,
    required this.onCompleteAppointment,
    required this.onRescheduleAppointment,
  });

  final List<CustomerAppointment> activeAppointments;
  final CustomerAppointment? nextAppointment;
  final Color accent;
  final DateTime now;
  final Future<void> Function(CustomerAppointment appointment)
  onOpenDepositPayment;
  final Future<void> Function(CustomerAppointment appointment)
  onCancelAppointment;
  final Future<void> Function(CustomerAppointment appointment)
  onCompleteAppointment;
  final Future<void> Function(CustomerAppointment appointment)
  onRescheduleAppointment;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: 'Sua agenda no salao',
          subtitle: activeAppointments.isEmpty
              ? 'Reserve o primeiro horario e ele aparece aqui na hora.'
              : 'Proximos horarios e sinais ficam aqui, sem misturar com o historico.',
        ),
        const SizedBox(height: 14),
        if (activeAppointments.isEmpty)
          const EmptyStateCard(
            title: 'Sem agendamento ativo',
            message:
                'Os horarios encerrados ou cancelados ficam no historico abaixo.',
            icon: Icons.calendar_today_rounded,
          )
        else
          ...activeAppointments.map(
            (appointment) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _AppointmentHistoryCard(
                appointment: appointment,
                accent: accent,
                highlight: nextAppointment?.id == appointment.id,
                onPay:
                    appointment.depositAmount > 0 &&
                        appointment.depositStatus != 'received' &&
                        appointment.depositReportedPaidAt == null
                    ? () => onOpenDepositPayment(appointment)
                    : null,
                onReschedule: appointment.date.isAfter(now)
                    ? () => onRescheduleAppointment(appointment)
                    : null,
                onCancel: appointment.date.isAfter(now)
                    ? () => onCancelAppointment(appointment)
                    : null,
                onComplete: _canCustomerCompleteAppointment(appointment, now)
                    ? () => onCompleteAppointment(appointment)
                    : null,
                completionHint: _appointmentCompletionHint(appointment, now),
                onReview: null,
                onArchive: null,
              ),
            ),
          ),
      ],
    );
  }
}

class _AgendaHistorySection extends StatelessWidget {
  const _AgendaHistorySection({
    required this.historyAppointments,
    required this.accent,
    required this.now,
    required this.onClearAppointmentHistory,
    required this.onCompleteAppointment,
    required this.onReviewAppointment,
    required this.onArchiveAppointment,
  });

  final List<CustomerAppointment> historyAppointments;
  final Color accent;
  final DateTime now;
  final Future<void> Function(List<CustomerAppointment> historyAppointments)
  onClearAppointmentHistory;
  final Future<void> Function(CustomerAppointment appointment)
  onCompleteAppointment;
  final Future<void> Function(CustomerAppointment appointment)
  onReviewAppointment;
  final Future<void> Function(CustomerAppointment appointment)
  onArchiveAppointment;

  @override
  Widget build(BuildContext context) {
    final clearableHistoryAppointments = historyAppointments
        .where(
          (appointment) => _isFinalAppointmentStatusValue(appointment.status),
        )
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: 'Historico',
          subtitle:
              'Atendimentos encerrados, cancelados e horarios passados aguardando sua confirmacao final ficam aqui.',
          trailing: clearableHistoryAppointments.isEmpty
              ? null
              : TextButton.icon(
                  onPressed: () =>
                      onClearAppointmentHistory(clearableHistoryAppointments),
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
              onComplete: _canCustomerCompleteAppointment(appointment, now)
                  ? () => onCompleteAppointment(appointment)
                  : null,
              completionHint: _appointmentCompletionHint(appointment, now),
              onReview: appointment.status == 'completed'
                  ? () => onReviewAppointment(appointment)
                  : null,
              onArchive: _isFinalAppointmentStatusValue(appointment.status)
                  ? () => onArchiveAppointment(appointment)
                  : null,
            ),
          ),
        ),
      ],
    );
  }
}
