import 'dart:async';

import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../widgets/premium_ui.dart';

class BookingScreen extends StatefulWidget {
  const BookingScreen({
    super.key,
    required this.repository,
    required this.profile,
    required this.service,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final ServiceItem service;

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  late DateTime _selectedDay;
  late Future<CachedView<DayAvailability>> _availabilityFuture;
  AvailableSlot? _selectedSlot;
  bool _bookingPolicyAccepted = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _selectedDay = DateTime.now();
    _availabilityFuture = _loadAvailability();
    unawaited(_warmUpcomingAvailability());
  }

  Future<CachedView<DayAvailability>> _loadAvailability() {
    return widget.repository.loadDayAvailability(
      serviceId: widget.service.id,
      day: _selectedDay,
    );
  }

  Future<void> _warmUpcomingAvailability() {
    final days = List<DateTime>.generate(
      4,
      (index) => _selectedDay.add(Duration(days: index)),
    );

    return widget.repository.warmDayAvailabilityCache(
      serviceId: widget.service.id,
      days: days,
    );
  }

  void _changeDay(DateTime day) {
    setState(() {
      _selectedDay = day;
      _selectedSlot = null;
      _availabilityFuture = _loadAvailability();
    });

    unawaited(_warmUpcomingAvailability());
  }

  Future<void> _submit() async {
    final selectedSlot = _selectedSlot;
    if (selectedSlot == null) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final appointmentId = await widget.repository.createAppointment(
        serviceId: widget.service.id,
        startAt: selectedSlot.startAt,
        preferredStaffMemberId: selectedSlot.staffMemberId,
        bookingPolicyVersion:
            _bookingPolicyAccepted &&
                widget.profile.requiresBookingPolicyAcknowledgement
            ? widget.profile.bookingPolicyVersion
            : null,
      );
      if (!mounted) {
        return;
      }
      var successMessage = widget.profile.bookingPolicyHasRequiredDeposit
          ? 'Horario solicitado com sucesso. O salao vai acompanhar o sinal dessa reserva.'
          : 'Horario reservado com sucesso.';

      if (widget.profile.bookingPolicyUsesManagedPix) {
        try {
          await widget.repository.createManagedDepositCharge(
            appointmentId: appointmentId,
          );
          successMessage =
              'Horario solicitado com sucesso. O Pix do sinal ja foi preparado na sua agenda.';
        } catch (_) {
          successMessage =
              'Horario solicitado com sucesso. O Pix do sinal ainda nao ficou pronto; abra a agenda e toque em Pagar sinal para tentar novamente.';
        }
      }

      if (!mounted) {
        return;
      }
      final messenger = ScaffoldMessenger.of(context);
      final navigator = Navigator.of(context);
      messenger.showSnackBar(SnackBar(content: Text(successMessage)));
      navigator.pop(true);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final nextDays = List<DateTime>.generate(
      8,
      (index) => DateTime.now().add(Duration(days: index)),
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Reservar horário'),
      ),
      body: PremiumBackground(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FutureBuilder<CachedView<DayAvailability>>(
          future: _availabilityFuture,
          builder: (context, snapshot) {
            final child = switch (snapshot.connectionState) {
              ConnectionState.waiting || ConnectionState.active =>
                const LoadingView(label: 'Buscando horários do salão...'),
              _ when snapshot.hasError => ErrorStateCard(
                message: snapshot.error.toString(),
                onRetry: () => _changeDay(_selectedDay),
              ),
              _ => _BookingBody(
                service: widget.service,
                profile: widget.profile,
                selectedDay: _selectedDay,
                nextDays: nextDays,
                availabilityView: snapshot.data!,
                selectedSlot: _selectedSlot,
                bookingPolicyAccepted: _bookingPolicyAccepted,
                isSubmitting: _isSubmitting,
                onDaySelected: _changeDay,
                onBookingPolicyAcceptedChanged: (value) {
                  setState(() => _bookingPolicyAccepted = value);
                },
                onSlotSelected: (slot) {
                  setState(() => _selectedSlot = slot);
                },
                onSubmit: _submit,
              ),
            };

            return child;
          },
        ),
      ),
    );
  }
}

class _BookingBody extends StatelessWidget {
  const _BookingBody({
    required this.service,
    required this.profile,
    required this.selectedDay,
    required this.nextDays,
    required this.availabilityView,
    required this.selectedSlot,
    required this.bookingPolicyAccepted,
    required this.isSubmitting,
    required this.onDaySelected,
    required this.onBookingPolicyAcceptedChanged,
    required this.onSlotSelected,
    required this.onSubmit,
  });

  final ServiceItem service;
  final CustomerProfile profile;
  final DateTime selectedDay;
  final List<DateTime> nextDays;
  final CachedView<DayAvailability> availabilityView;
  final AvailableSlot? selectedSlot;
  final bool bookingPolicyAccepted;
  final bool isSubmitting;
  final ValueChanged<DateTime> onDaySelected;
  final ValueChanged<bool> onBookingPolicyAcceptedChanged;
  final ValueChanged<AvailableSlot> onSlotSelected;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final availability = availabilityView.data;
    final isOfflineSnapshot = availabilityView.isFromCache;

    return ListView(
      children: [
        StaggerReveal(
          child: HeroImagePanel(
            imageUrl: service.imageUrl,
            height: 250,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.category ?? 'Reserva premium',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
                  ),
                ),
                const Spacer(),
                Text(
                  service.name,
                  style: Theme.of(
                    context,
                  ).textTheme.displaySmall?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 10),
                Text(
                  '${formatCurrency(service.price)} • ${service.duration} min',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: Colors.white),
                ),
              ],
            ),
          ),
        ),
        if (isOfflineSnapshot) ...[
          const SizedBox(height: 16),
          StaggerReveal(
            delay: const Duration(milliseconds: 80),
            child: Align(
              alignment: Alignment.centerLeft,
              child: StatusPill(
                label: _bookingCacheStatusLabel(availabilityView),
                icon: Icons.cloud_off_rounded,
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        StaggerReveal(
          delay: const Duration(milliseconds: 120),
          child: PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SectionHeader(
                  title: 'Escolha o dia',
                  subtitle: 'O app já mostra os próximos encaixes válidos.',
                ),
                const SizedBox(height: 16),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final day in nextDays)
                        Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: ChoiceChip(
                            selected:
                                formatShortDate(day) ==
                                formatShortDate(selectedDay),
                            label: Text(formatMediumDate(day)),
                            onSelected: (_) => onDaySelected(day),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (profile.hasBookingPolicy) ...[
          StaggerReveal(
            delay: const Duration(milliseconds: 150),
            child: PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionHeader(
                    title: profile.bookingPolicyTitle ?? 'Reserva protegida',
                    subtitle:
                        'A reserva ja nasce com regra clara para o cliente e para a equipe.',
                  ),
                  const SizedBox(height: 14),
                  Text(
                    (profile.bookingPolicySummary ?? '').trim().isNotEmpty
                        ? profile.bookingPolicySummary!
                        : 'O salao definiu uma politica de reserva para proteger horarios disputados e reduzir no-show.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      StatusPill(
                        label:
                            'Cancelamento sem atrito ate ${profile.bookingPolicyCancellationWindowHours}h antes',
                        icon: Icons.schedule_rounded,
                      ),
                      StatusPill(
                        label: profile.bookingPolicyHasRequiredDeposit
                            ? 'Sinal de ${formatCurrency(profile.bookingPolicyDepositAmount)} via ${profile.bookingPolicyDepositPaymentLabel}'
                            : 'Sem sinal obrigatorio',
                        icon: profile.bookingPolicyHasRequiredDeposit
                            ? Icons.payments_outlined
                            : Icons.verified_user_outlined,
                      ),
                      StatusPill(
                        label: profile.bookingPolicyConfirmationRequired
                            ? 'Confirmacao ${profile.bookingPolicyConfirmationLeadMinutes} min antes'
                            : 'Sem confirmacao automatica',
                        icon: Icons.mark_email_unread_outlined,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    profile.bookingPolicyAutoCancelUnconfirmed
                        ? 'Sem resposta, a vaga pode ser liberada ${profile.bookingPolicyAutoCancelLeadMinutes} min antes do horario.'
                        : 'O salao acompanha a confirmacao sem cancelar automaticamente por isso.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (profile.bookingPolicyHasRequiredDeposit) ...[
                    const SizedBox(height: 8),
                    Text(
                      profile.bookingPolicyUsesManagedPix
                          ? 'Depois da reserva, o app prepara um QR Pix automatico dessa cobrança e atualiza o sinal sozinho quando o pagamento entrar.'
                          : profile.bookingPolicyUsesPix
                          ? 'O app libera QR Pix, copia e cola e envio de comprovante na agenda para você pagar o sinal e avisar a equipe.'
                          : profile.bookingPolicyUsesExternalCheckout
                          ? 'Depois da reserva, o app abre o checkout externo configurado pelo salão para quitar o sinal.'
                          : 'A equipe informa manualmente como receber o sinal desta reserva.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      profile.bookingPolicyAutoCancelPendingDeposit
                          ? 'Se o sinal continuar pendente, a reserva pode ser cancelada automaticamente perto do horario.'
                          : 'Se o sinal seguir pendente, o app lembra novamente ${profile.bookingPolicyDepositReminderLeadHours}h antes.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if ((profile.bookingPolicyPaymentInstructions ?? '')
                      .trim()
                      .isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Text(
                      profile.bookingPolicyPaymentInstructions!,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if (profile.requiresBookingPolicyAcknowledgement) ...[
                    const SizedBox(height: 14),
                    CheckboxListTile(
                      value: bookingPolicyAccepted,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      onChanged: (value) =>
                          onBookingPolicyAcceptedChanged(value ?? false),
                      title: const Text('Li e aceito a politica desta reserva'),
                      subtitle: const Text(
                        'Isso registra no horario a regra vigente no momento da reserva.',
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
        StaggerReveal(
          delay: const Duration(milliseconds: 180),
          child: PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionHeader(
                  title: 'Horários disponíveis',
                  subtitle: availability.isOpen
                      ? availability.availableSlots.isEmpty
                            ? 'O salão abre neste dia, mas ainda não há encaixe compatível para este serviço.'
                            : 'Os horários abaixo já respeitam a agenda e os bloqueios do salão.'
                      : 'O salão não abre neste dia para este serviço.',
                ),
                const SizedBox(height: 16),
                if (isOfflineSnapshot)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(
                      'Você está vendo a última grade salva neste aparelho. Reconecte para confirmar a reserva.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                if (!availability.isOpen)
                  const EmptyStateCard(
                    title: 'Dia fechado',
                    message: 'Tente outro dia para visualizar horários ativos.',
                  )
                else if (availability.availableSlots.isEmpty)
                  const EmptyStateCard(
                    title: 'Sem encaixe neste momento',
                    message:
                        'O app não encontrou um horário livre para este serviço nesta data.',
                  )
                else
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final slot in availability.availableSlots)
                        ChoiceChip(
                          selected: selectedSlot?.startAt == slot.startAt,
                          label: Text(
                            '${formatTime(slot.startAt)} • ${slot.staffMemberName}',
                          ),
                          onSelected: (_) => onSlotSelected(slot),
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed:
              selectedSlot == null ||
                  isSubmitting ||
                  isOfflineSnapshot ||
                  (profile.requiresBookingPolicyAcknowledgement &&
                      !bookingPolicyAccepted)
              ? null
              : onSubmit,
          child: Text(
            isSubmitting
                ? 'Reservando...'
                : isOfflineSnapshot
                ? 'Conecte-se para reservar'
                : profile.requiresBookingPolicyAcknowledgement &&
                      !bookingPolicyAccepted
                ? 'Aceite a politica para reservar'
                : selectedSlot == null
                ? 'Selecione um horário'
                : 'Reservar ${formatTime(selectedSlot!.startAt)}',
          ),
        ),
      ],
    );
  }
}

String _bookingCacheStatusLabel(CachedView<DayAvailability> view) {
  final freshness = view.cachedAt == null
      ? null
      : formatRelativeFreshness(view.cachedAt!);
  if (freshness == null) {
    return 'Modo offline na agenda';
  }

  return 'Agenda offline • atualizada $freshness';
}
