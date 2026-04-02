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
      await widget.repository.createAppointment(
        serviceId: widget.service.id,
        startAt: selectedSlot.startAt,
        preferredStaffMemberId: selectedSlot.staffMemberId,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Horário reservado com sucesso.')),
      );
      Navigator.of(context).pop(true);
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
                selectedDay: _selectedDay,
                nextDays: nextDays,
                availabilityView: snapshot.data!,
                selectedSlot: _selectedSlot,
                isSubmitting: _isSubmitting,
                onDaySelected: _changeDay,
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
    required this.selectedDay,
    required this.nextDays,
    required this.availabilityView,
    required this.selectedSlot,
    required this.isSubmitting,
    required this.onDaySelected,
    required this.onSlotSelected,
    required this.onSubmit,
  });

  final ServiceItem service;
  final DateTime selectedDay;
  final List<DateTime> nextDays;
  final CachedView<DayAvailability> availabilityView;
  final AvailableSlot? selectedSlot;
  final bool isSubmitting;
  final ValueChanged<DateTime> onDaySelected;
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
          onPressed: selectedSlot == null || isSubmitting || isOfflineSnapshot
              ? null
              : onSubmit,
          child: Text(
            isSubmitting
                ? 'Reservando...'
                : isOfflineSnapshot
                ? 'Conecte-se para reservar'
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
