import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/empty_state.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/soft_card.dart';

class BookAppointmentScreen extends StatefulWidget {
  const BookAppointmentScreen({
    super.key,
    required this.repository,
    required this.service,
    required this.profile,
    this.initialDay,
    this.initialSlot,
    this.initialStaffMemberId,
    this.entryMessage,
  });

  final SalonRepository repository;
  final ServiceItem service;
  final CustomerProfile profile;
  final DateTime? initialDay;
  final DateTime? initialSlot;
  final String? initialStaffMemberId;
  final String? entryMessage;

  @override
  State<BookAppointmentScreen> createState() => _BookAppointmentScreenState();
}

class _BookAppointmentScreenState extends State<BookAppointmentScreen> {
  late DateTime _selectedDay;
  late Future<DayAvailability> _availabilityFuture;
  DateTime? _selectedSlot;
  String? _selectedStaffMemberId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selectedDay = _normalizeDay(widget.initialDay ?? DateTime.now());
    _selectedSlot = widget.initialSlot;
    _selectedStaffMemberId = widget.initialStaffMemberId;
    _availabilityFuture = _loadAvailability(_selectedDay);
  }

  DateTime _normalizeDay(DateTime date) {
    return DateTime(date.year, date.month, date.day);
  }

  Future<DayAvailability> _loadAvailability(DateTime day) {
    return widget.repository.getDayAvailability(
      serviceId: widget.service.id,
      day: day,
    );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDay.isBefore(now) ? now : _selectedDay,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 60)),
    );

    if (picked == null) {
      return;
    }

    setState(() {
      _selectedDay = _normalizeDay(picked);
      _selectedSlot = null;
      _availabilityFuture = _loadAvailability(_selectedDay);
    });
  }

  List<AvailableSlot> _visibleSlots(DayAvailability availability) {
    final selectedStaff = _selectedStaffMember(availability);

    if (selectedStaff != null) {
      return availability.availableSlots
          .where((slot) => slot.staffMemberId == selectedStaff.id)
          .toList();
    }

    final uniqueSlots = <String, AvailableSlot>{};
    for (final slot in availability.availableSlots) {
      uniqueSlots.putIfAbsent(slot.startAt.toIso8601String(), () => slot);
    }

    return uniqueSlots.values.toList()
      ..sort((left, right) => left.startAt.compareTo(right.startAt));
  }

  StaffMemberItem? _selectedStaffMember(DayAvailability availability) {
    final selectedId = _selectedStaffMemberId;
    if (selectedId == null) {
      return null;
    }

    for (final staffMember in availability.staffMembers) {
      if (staffMember.id == selectedId) {
        return staffMember;
      }
    }

    return null;
  }

  String _describeAvailability(DayAvailability availability) {
    if (!availability.isOpen) {
      return 'Salão fechado nesta data. Escolha outro dia para continuar.';
    }

    final opensAt = availability.opensAtLabel;
    final closesAt = availability.closesAtLabel;
    final scheduleLabel = opensAt != null && closesAt != null
        ? 'Atendimento entre $opensAt e $closesAt.'
        : 'Horário de atendimento configurado pelo salão.';

    if (availability.availableSlots.isEmpty) {
      return '$scheduleLabel Não há horários livres dentro dessa janela hoje.';
    }

    final selectedStaff = _selectedStaffMember(availability);
    if (selectedStaff != null) {
      final nextAvailableLabel = selectedStaff.nextAvailableAt != null
          ? ' Próximo horário livre: ${DateFormat('HH:mm').format(selectedStaff.nextAvailableAt!)}.'
          : '';
      return '$scheduleLabel Exibindo apenas os horários de ${selectedStaff.name}.${selectedStaff.statusDetail != null ? " ${selectedStaff.statusDetail}" : ""}$nextAvailableLabel';
    }

    return '$scheduleLabel Intervalos de ${availability.slotStepMinutes} minutos.';
  }

  String _staffPrimaryStatus(StaffMemberItem staffMember) {
    if (!staffMember.isOpen) {
      return 'Não atende nesta data';
    }

    if (staffMember.availableSlotsCount > 0) {
      final count = staffMember.availableSlotsCount;
      return '$count ${count == 1 ? 'horário livre' : 'horários livres'}';
    }

    if (staffMember.hasBlockedRanges) {
      return 'Com pausas ou bloqueios';
    }

    return 'Sem horários livres';
  }

  String _staffSecondaryStatus(StaffMemberItem staffMember) {
    final hoursLabel = staffMember.opensAtLabel != null &&
            staffMember.closesAtLabel != null
        ? 'Atende de ${staffMember.opensAtLabel} às ${staffMember.closesAtLabel}'
        : null;

    if (!staffMember.isOpen) {
      return staffMember.statusDetail ?? 'Esse profissional não atende nessa data.';
    }

    if (staffMember.availableSlotsCount > 0) {
      if (staffMember.nextAvailableAt != null) {
        return '${hoursLabel ?? 'Agenda aberta'} • próximo livre ${DateFormat('HH:mm').format(staffMember.nextAvailableAt!)}';
      }

      return hoursLabel ?? 'Agenda aberta nesta data';
    }

    if (staffMember.hasBlockedRanges) {
      return hoursLabel == null
          ? 'A agenda desse profissional tem pausas marcadas nesta data.'
          : '$hoursLabel • com pausas marcadas';
    }

    return hoursLabel ?? 'Sem disponibilidade nesta data';
  }

  String _selectedStaffEmptyTitle(StaffMemberItem staffMember) {
    if (!staffMember.isOpen) {
      return '${staffMember.name} não atende nessa data';
    }

    if (staffMember.hasBlockedRanges) {
      return '${staffMember.name} esta sem agenda livre nessa data';
    }

    return 'Esse profissional não tem horários livres nessa data';
  }

  String _selectedStaffEmptyMessage(StaffMemberItem staffMember) {
    if (!staffMember.isOpen) {
      return 'Escolha outro dia ou selecione outro profissional para continuar.';
    }

    if (staffMember.hasBlockedRanges) {
      return 'As pausas e bloqueios desse profissional já foram aplicados nos horários exibidos. Escolha outro profissional ou outra data.';
    }

    return 'Troque o profissional ou escolha outra data para encontrar um novo horário.';
  }

  String _humanizeAppointmentError(String raw) {
    if (raw.contains('salon_closed_on_selected_day')) {
      return 'O salão não atende nesta data.';
    }
    if (raw.contains('outside_business_hours')) {
      return 'Esse horário fica fora do atendimento do salão.';
    }
    if (raw.contains('slot_step_mismatch')) {
      return 'Escolha um dos horários sugeridos pelo salão.';
    }
    if (raw.contains('past_time_not_allowed')) {
      return 'Escolha um horário futuro para continuar.';
    }
    if (raw.contains('time_slot_unavailable')) {
      return 'Horário indisponível. Escolha outro horário.';
    }
    if (raw.contains('customer_not_linked')) {
      return 'Entre novamente com o código do salão para continuar.';
    }
    if (raw.contains('staff_member_not_available_for_service')) {
      return 'Esse profissional não atende esse serviço agora.';
    }

    return 'Não foi possível criar o agendamento.';
  }

  Future<void> _saveAppointment() async {
    final selectedSlot = _selectedSlot;
    if (selectedSlot == null) {
      return;
    }

    setState(() => _saving = true);

    try {
      await widget.repository.createAppointment(
        serviceId: widget.service.id,
        startAt: selectedSlot,
        preferredStaffMemberId: _selectedStaffMemberId,
      );

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(true);
    } on PostgrestException catch (error) {
      _showMessage(_humanizeAppointmentError(error.message));
    } catch (_) {
      _showMessage('Não foi possível criar o agendamento.');
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm');
    final branding = SalonBranding.fromName(
      widget.profile.salonName,
      overrideHexColor: widget.profile.salonBrandColor,
    );
    final serviceVisual = resolveServiceCategoryVisual(
      category: widget.service.category,
      name: widget.service.name,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Agendar com ${widget.profile.salonName}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: AppBackdrop(
        child: FutureBuilder<DayAvailability>(
          future: _availabilityFuture,
          builder: (context, snapshot) {
            final availability = snapshot.data;
            final availableSlots = availability == null
                ? const <AvailableSlot>[]
                : _visibleSlots(availability);
            final selectedStaff = availability == null
                ? null
                : _selectedStaffMember(availability);

            if (_selectedSlot != null &&
                !availableSlots.any((slot) => slot.startAt == _selectedSlot)) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted) {
                  return;
                }

                setState(() {
                  _selectedSlot = null;
                });
              });
            }

            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                SoftCard(
                  padding: const EdgeInsets.all(22),
                  gradient: LinearGradient(
                    colors: [branding.surface, branding.soft],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderColor: branding.outline,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (widget.service.imageUrl?.trim().isNotEmpty == true) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: AspectRatio(
                            aspectRatio: 16 / 8,
                            child: Image.network(
                              widget.service.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) => Container(
                                color: branding.surface,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                      ],
                      Row(
                        children: [
                          SalonBrandMark(
                            salonName: widget.profile.salonName,
                            logoUrl: widget.profile.salonLogoUrl,
                            branding: branding,
                            size: 54,
                            borderRadius: 18,
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.profile.salonName,
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.profile.salonTagline?.trim().isNotEmpty ==
                                          true
                                      ? widget.profile.salonTagline!
                                      : 'Reserva alinhada com a agenda real do profissional.',
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(color: const Color(0xFF5F4334)),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        widget.service.name,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      if (widget.service.category?.trim().isNotEmpty == true) ...[
                        const SizedBox(height: 8),
                        Text(
                          widget.service.category!,
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: branding.deep.withValues(alpha: 0.74),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Text(
                        '${widget.service.duration} min • ${currency.format(widget.service.price)}',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: branding.deep,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        widget.service.description?.trim().isNotEmpty == true
                            ? widget.service.description!
                            : serviceVisual.fallbackDescription,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: branding.deep.withValues(alpha: 0.86),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if ((widget.entryMessage ?? '').trim().isNotEmpty) ...[
                  SoftCard(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.auto_awesome_rounded,
                          color: branding.deep,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Encaixe sugerido pelo salão',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 6),
                              Text(
                                widget.entryMessage!,
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                ],
                SoftCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Escolha a data',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Data selecionada: ${dateFormat.format(_selectedDay)}',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      if (availability != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _describeAvailability(availability),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      const SizedBox(height: 16),
                      OutlinedButton.icon(
                        onPressed: _pickDate,
                        icon: const Icon(Icons.calendar_today_outlined),
                        label: Text('Alterar data'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if (availability != null &&
                    availability.staffMembers.isNotEmpty)
                  SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Profissional',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          selectedStaff == null
                              ? 'Mostrando horários de qualquer profissional disponível.'
                              : 'Filtrando a agenda de ${selectedStaff.name} com base nos horários e pausas desse profissional.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _StaffSelectionCard(
                              title: 'Qualquer profissional',
                              subtitle:
                                  'Mostra todos os horários validados pela agenda do salão.',
                              statusLabel: '${availableSlots.length} ${availableSlots.length == 1 ? 'horário visível' : 'horários visíveis'}',
                              selected: selectedStaff == null,
                              onTap: () {
                                setState(() {
                                  _selectedStaffMemberId = null;
                                  _selectedSlot = null;
                                });
                              },
                            ),
                            ...availability.staffMembers.map(
                              (staffMember) => _StaffSelectionCard(
                                title: staffMember.name,
                                subtitle: _staffSecondaryStatus(staffMember),
                                detail: staffMember.role,
                                statusLabel: _staffPrimaryStatus(staffMember),
                                selected: selectedStaff?.id == staffMember.id,
                                onTap: () {
                                  setState(() {
                                    _selectedStaffMemberId = staffMember.id;
                                    _selectedSlot = null;
                                  });
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                if (availability != null &&
                    availability.staffMembers.isNotEmpty)
                  const SizedBox(height: 18),
                if (selectedStaff != null && selectedStaff.blockedRanges.isNotEmpty)
                  SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Pausas de ${selectedStaff.name}',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Esses períodos já foram retirados da agenda exibida abaixo.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 14),
                        Column(
                          children: selectedStaff.blockedRanges
                              .map(
                                (blockedRange) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(
                                        Icons.block_flipped,
                                        size: 18,
                                        color: Color(0xFF8E441F),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '${timeFormat.format(blockedRange.startsAt)} às ${timeFormat.format(blockedRange.endsAt)}',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .titleMedium,
                                            ),
                                            if ((blockedRange.reason ?? '')
                                                .trim()
                                                .isNotEmpty)
                                              Text(
                                                blockedRange.reason!,
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .bodyMedium,
                                              ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ),
                  ),
                if (selectedStaff != null && selectedStaff.blockedRanges.isNotEmpty)
                  const SizedBox(height: 18),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SoftCard(
                    child: Padding(
                      padding: EdgeInsets.all(8),
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(20),
                          child: CircularProgressIndicator(),
                        ),
                      ),
                    ),
                  )
                else if (snapshot.hasError)
                  EmptyState(
                    icon: Icons.calendar_month_rounded,
                    eyebrow: 'Agenda indisponível',
                    title: 'Não foi possível buscar os horários agora',
                    message:
                        'Atualize a data ou tente novamente em alguns instantes para carregar a agenda do salão.',
                    actionLabel: 'Tentar novamente',
                    onAction: () {
                      setState(() {
                        _availabilityFuture = _loadAvailability(_selectedDay);
                      });
                    },
                  )
                else if (availability != null && !availability.isOpen)
                  const EmptyState(
                    eyebrow: 'Salão fechado',
                    title: 'Não há atendimento nesta data',
                    message:
                        'Escolha outro dia para ver os horários disponíveis.',
                  )
                else if (availableSlots.isEmpty)
                  EmptyState(
                    eyebrow: selectedStaff == null
                        ? 'Agenda cheia'
                        : !selectedStaff.isOpen
                        ? 'Fora da agenda'
                        : selectedStaff.hasBlockedRanges
                        ? 'Agenda com pausas'
                        : 'Sem agenda para esse profissional',
                    title: selectedStaff == null
                        ? 'Nenhum horário livre nesta data'
                        : _selectedStaffEmptyTitle(selectedStaff),
                    message: selectedStaff == null
                        ? 'O salão atende nesse dia, mas os horários já foram ocupados. Escolha outra data.'
                        : _selectedStaffEmptyMessage(selectedStaff),
                  )
                else
                  SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Horários disponíveis',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          selectedStaff == null
                              ? 'Selecione um horário validado pela agenda do salão.'
                              : 'Selecione um horário livre com ${selectedStaff.name}.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 18),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: availableSlots
                              .map(
                                (slot) => ChoiceChip(
                                  label: Text(timeFormat.format(slot.startAt)),
                                  selected: _selectedSlot == slot.startAt,
                                  onSelected: (_) => setState(
                                    () => _selectedSlot = slot.startAt,
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FilledButton(
          onPressed: _selectedSlot == null || _saving ? null : _saveAppointment,
          child: _saving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Confirmar agendamento'),
        ),
      ),
    );
  }
}

class _StaffSelectionCard extends StatelessWidget {
  const _StaffSelectionCard({
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.selected,
    required this.onTap,
    this.detail,
  });

  final String title;
  final String subtitle;
  final String statusLabel;
  final bool selected;
  final VoidCallback onTap;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 240,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFFFF5EC) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected ? const Color(0xFFC56B43) : const Color(0xFFE3D5C7),
              width: selected ? 1.6 : 1,
            ),
            boxShadow: selected
                ? const [
                    BoxShadow(
                      color: Color(0x14C56B43),
                      blurRadius: 18,
                      offset: Offset(0, 10),
                    ),
                  ]
                : const [],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              if ((detail ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  detail!,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              const SizedBox(height: 10),
              Text(
                statusLabel,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF8E441F),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
