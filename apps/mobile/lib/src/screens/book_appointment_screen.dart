import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/empty_state.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/soft_card.dart';

class BookAppointmentResult {
  const BookAppointmentResult({
    required this.message,
    this.canOpenWhatsApp = false,
    this.canOpenWallet = false,
  });

  final String message;
  final bool canOpenWhatsApp;
  final bool canOpenWallet;
}

class BookAppointmentScreen extends StatefulWidget {
  const BookAppointmentScreen({
    super.key,
    required this.repository,
    required this.service,
    required this.profile,
    this.initialLoyaltySummary,
    this.activeOffers = const [],
    this.initialDay,
    this.initialSlot,
    this.initialStaffMemberId,
    this.entryMessage,
  });

  final SalonRepository repository;
  final ServiceItem service;
  final CustomerProfile profile;
  final CustomerLoyaltySummary? initialLoyaltySummary;
  final List<SalonOfferItem> activeOffers;
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
  DayAvailability? _currentAvailability;
  DateTime? _selectedSlot;
  String? _selectedStaffMemberId;
  Set<String> _favoriteStaffMemberIds = <String>{};
  final Set<String> _busyFavoriteStaffMemberIds = <String>{};
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _selectedDay = _normalizeDay(widget.initialDay ?? DateTime.now());
    _selectedSlot = widget.initialSlot;
    _selectedStaffMemberId = widget.initialStaffMemberId;
    _availabilityFuture = _loadAvailability(_selectedDay);
    unawaited(_loadFavoriteStaffMemberIds());
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

  Future<void> _loadFavoriteStaffMemberIds() async {
    try {
      final ids = await widget.repository.getFavoriteStaffMemberIds();
      if (!mounted) {
        return;
      }

      setState(() => _favoriteStaffMemberIds = ids);
    } catch (_) {
      // Keep the booking flow available even if favorites fail to load.
    }
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

  AvailableSlot? _resolvedSelectedSlot(DayAvailability? availability) {
    final selectedSlot = _selectedSlot;
    if (selectedSlot == null || availability == null) {
      return null;
    }

    for (final slot in _visibleSlots(availability)) {
      if (slot.startAt == selectedSlot) {
        return slot;
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
      return '$scheduleLabel Não há horários livres dentro dessa janela hoje. Escolha outra data para encontrar um novo encaixe.';
    }

    final selectedStaff = _selectedStaffMember(availability);
    if (selectedStaff != null) {
      final nextAvailableLabel = selectedStaff.nextAvailableAt != null
          ? ' Próximo horário livre: ${DateFormat('HH:mm').format(selectedStaff.nextAvailableAt!)}.'
          : '';
      return '$scheduleLabel Exibindo apenas os horários de ${selectedStaff.name}.${selectedStaff.statusDetail != null ? " ${selectedStaff.statusDetail}" : ""}$nextAvailableLabel';
    }

    return '$scheduleLabel Escolha o melhor horário e confirme sua reserva direto pelo app. Intervalos de ${availability.slotStepMinutes} minutos.';
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
    final hoursLabel =
        staffMember.opensAtLabel != null && staffMember.closesAtLabel != null
        ? 'Atende de ${staffMember.opensAtLabel} às ${staffMember.closesAtLabel}'
        : null;

    if (!staffMember.isOpen) {
      return staffMember.statusDetail ??
          'Esse profissional não atende nessa data.';
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

  List<StaffMemberItem> _sortedStaffMembers(DayAvailability availability) {
    final staffMembers = [...availability.staffMembers];
    staffMembers.sort((left, right) {
      final leftFavorite = _favoriteStaffMemberIds.contains(left.id);
      final rightFavorite = _favoriteStaffMemberIds.contains(right.id);
      if (leftFavorite != rightFavorite) {
        return leftFavorite ? -1 : 1;
      }

      if (left.availableSlotsCount != right.availableSlotsCount) {
        return right.availableSlotsCount.compareTo(left.availableSlotsCount);
      }

      return left.name.compareTo(right.name);
    });
    return staffMembers;
  }

  Future<void> _toggleFavoriteStaffMember(StaffMemberItem staffMember) async {
    if (_busyFavoriteStaffMemberIds.contains(staffMember.id)) {
      return;
    }

    final isFavorite = _favoriteStaffMemberIds.contains(staffMember.id);

    setState(() => _busyFavoriteStaffMemberIds.add(staffMember.id));

    try {
      await widget.repository.toggleFavoriteStaffMember(
        staffMemberId: staffMember.id,
        isFavorite: !isFavorite,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        final updated = {..._favoriteStaffMemberIds};
        if (isFavorite) {
          updated.remove(staffMember.id);
        } else {
          updated.add(staffMember.id);
        }
        _favoriteStaffMemberIds = updated;
      });

      _showMessage(
        isFavorite
            ? '${staffMember.name} saiu dos seus profissionais salvos.'
            : '${staffMember.name} foi salvo para facilitar seus próximos agendamentos.',
      );
    } on PostgrestException catch (error) {
      final raw = error.message.toLowerCase();
      final message = raw.contains('customer_favorite_staff_members')
          ? 'Os profissionais salvos ainda não estão disponíveis agora.'
          : 'Não foi possível atualizar seus profissionais salvos agora.';
      _showMessage(message);
    } catch (_) {
      _showMessage(
        'Não foi possível atualizar seus profissionais salvos agora.',
      );
    } finally {
      if (mounted) {
        setState(() => _busyFavoriteStaffMemberIds.remove(staffMember.id));
      }
    }
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

  bool get _canOpenWhatsApp {
    final digits = widget.profile.salonWhatsappPhone?.replaceAll(
      RegExp(r'\D'),
      '',
    );
    return digits != null && digits.length >= 10;
  }

  bool get _shouldHighlightWallet {
    final loyaltySummary = widget.initialLoyaltySummary;
    return loyaltySummary?.program?.isActive == true ||
        loyaltySummary?.hasVisibleContent == true;
  }

  String? get _benefitMessage {
    if (_shouldHighlightWallet) {
      return 'Depois da visita, seus benefícios aparecem na carteira do app.';
    }

    if (widget.activeOffers.any((offer) => offer.isMembership)) {
      return 'O salão também está com planos e pacotes ativos para manter sua rotina.';
    }

    if (widget.activeOffers.isNotEmpty) {
      return 'O salão está com benefícios ativos para a sua próxima visita.';
    }

    return null;
  }

  String _selectedStaffLabel(DayAvailability? availability) {
    final resolvedSlot = _resolvedSelectedSlot(availability);
    final resolvedStaffName = resolvedSlot?.staffMemberName.trim();
    if (resolvedStaffName != null && resolvedStaffName.isNotEmpty) {
      return resolvedStaffName;
    }

    final selectedStaffName = availability == null
        ? null
        : _selectedStaffMember(availability)?.name.trim();
    if (selectedStaffName != null && selectedStaffName.isNotEmpty) {
      return selectedStaffName;
    }

    return 'Qualquer profissional disponível';
  }

  String _buildSuccessMessage(
    DateTime selectedSlot,
    DayAvailability? availability,
  ) {
    final dateLabel = DateFormat('dd/MM').format(selectedSlot);
    final timeLabel = DateFormat('HH:mm').format(selectedSlot);
    final staffLabel = _selectedStaffLabel(availability);
    final hasSpecificStaff = staffLabel != 'Qualquer profissional disponível';
    final summary =
        'Reserva confirmada para $dateLabel às $timeLabel${hasSpecificStaff ? ' com $staffLabel' : ''}.';

    if (_shouldHighlightWallet) {
      return '$summary Seus benefícios aparecem na carteira após a visita.';
    }

    final benefitMessage = _benefitMessage;
    if (benefitMessage != null) {
      return '$summary $benefitMessage';
    }

    if (_canOpenWhatsApp) {
      return '$summary Se precisar alinhar algo, fale com o salão no WhatsApp.';
    }

    return '$summary Acompanhe tudo no histórico do app.';
  }

  Future<void> _openWhatsAppForBooking() async {
    final selectedSlot = _selectedSlot;
    final whatsappDigits = widget.profile.salonWhatsappPhone?.replaceAll(
      RegExp(r'\D'),
      '',
    );

    if (selectedSlot == null ||
        whatsappDigits == null ||
        whatsappDigits.length < 10) {
      _showMessage(
        'O WhatsApp de ${widget.profile.salonName} ainda não foi configurado no app.',
      );
      return;
    }

    final dateLabel = DateFormat('dd/MM').format(selectedSlot);
    final timeLabel = DateFormat('HH:mm').format(selectedSlot);
    final message = Uri.encodeComponent(
      'Olá, reservei ${widget.service.name} para $dateLabel às $timeLabel pelo app e queria alinhar alguns detalhes.',
    );
    final uri = Uri.parse('https://wa.me/$whatsappDigits?text=$message');
    final launched = await launchUrl(uri, mode: LaunchMode.platformDefault);

    if (!launched && mounted) {
      _showMessage(
        'Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.',
      );
    }
  }

  Future<void> _saveAppointment() async {
    final selectedSlot = _selectedSlot;
    if (selectedSlot == null) {
      return;
    }

    final resolvedSlot = _resolvedSelectedSlot(_currentAvailability);

    setState(() => _saving = true);

    try {
      await widget.repository.createAppointment(
        serviceId: widget.service.id,
        startAt: selectedSlot,
        preferredStaffMemberId:
            resolvedSlot?.staffMemberId ?? _selectedStaffMemberId,
      );

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(
        BookAppointmentResult(
          message: _buildSuccessMessage(selectedSlot, _currentAvailability),
          canOpenWhatsApp: _canOpenWhatsApp,
          canOpenWallet: _shouldHighlightWallet,
        ),
      );
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
        branding: branding,
        child: FutureBuilder<DayAvailability>(
          future: _availabilityFuture,
          builder: (context, snapshot) {
            final availability = snapshot.data;
            _currentAvailability = availability;
            final availableSlots = availability == null
                ? const <AvailableSlot>[]
                : _visibleSlots(availability);
            final selectedStaff = availability == null
                ? null
                : _selectedStaffMember(availability);
            final selectedSlot = _selectedSlot;
            final benefitMessage = _benefitMessage;

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

            if (_selectedSlot == null && availableSlots.length == 1) {
              final onlySlot = availableSlots.first;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!mounted || _selectedSlot != null) {
                  return;
                }

                setState(() {
                  _selectedSlot = onlySlot.startAt;
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
                      if (widget.service.imageUrl?.trim().isNotEmpty ==
                          true) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(22),
                          child: AspectRatio(
                            aspectRatio: 16 / 8,
                            child: Image.network(
                              widget.service.imageUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  Container(color: branding.surface),
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
                                  widget.profile.salonTagline
                                              ?.trim()
                                              .isNotEmpty ==
                                          true
                                      ? widget.profile.salonTagline!
                                      : 'Reserva alinhada com a agenda real do profissional.',
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(
                                        color: const Color(0xFF5F4334),
                                      ),
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
                      if (widget.service.category?.trim().isNotEmpty ==
                          true) ...[
                        const SizedBox(height: 8),
                        Text(
                          widget.service.category!,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
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
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          if (widget.service.category?.trim().isNotEmpty == true)
                            _HeroInfoChip(
                              icon: serviceVisual.icon,
                              label: widget.service.category!,
                              branding: branding,
                            ),
                          _HeroInfoChip(
                            icon: Icons.schedule_rounded,
                            label: '${widget.service.duration} min',
                            branding: branding,
                          ),
                          _HeroInfoChip(
                            icon: Icons.sell_rounded,
                            label: currency.format(widget.service.price),
                            branding: branding,
                          ),
                        ],
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
                        Icon(Icons.auto_awesome_rounded, color: branding.deep),
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
                        if (_favoriteStaffMemberIds.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Seus profissionais salvos aparecem primeiro para você decidir mais rápido.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: const Color(0xFF8E441F),
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _StaffSelectionCard(
                              title: 'Qualquer profissional',
                              subtitle:
                                  'Mostra todos os horários validados pela agenda do salão.',
                              statusLabel:
                                  '${availableSlots.length} ${availableSlots.length == 1 ? 'horário visível' : 'horários visíveis'}',
                              selected: selectedStaff == null,
                              isFavorite: false,
                              favoriteBusy: false,
                              onToggleFavorite: () {},
                              onTap: () {
                                setState(() {
                                  _selectedStaffMemberId = null;
                                  _selectedSlot = null;
                                });
                              },
                            ),
                            ..._sortedStaffMembers(availability).map(
                              (staffMember) => _StaffSelectionCard(
                                title: staffMember.name,
                                subtitle: _staffSecondaryStatus(staffMember),
                                detail: staffMember.role,
                                statusLabel: _staffPrimaryStatus(staffMember),
                                selected: selectedStaff?.id == staffMember.id,
                                isFavorite: _favoriteStaffMemberIds.contains(
                                  staffMember.id,
                                ),
                                favoriteBusy: _busyFavoriteStaffMemberIds
                                    .contains(staffMember.id),
                                onToggleFavorite: () {
                                  unawaited(
                                    _toggleFavoriteStaffMember(staffMember),
                                  );
                                },
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
                if (selectedStaff != null &&
                    selectedStaff.blockedRanges.isNotEmpty)
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
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
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
                                              style: Theme.of(
                                                context,
                                              ).textTheme.titleMedium,
                                            ),
                                            if ((blockedRange.reason ?? '')
                                                .trim()
                                                .isNotEmpty)
                                              Text(
                                                blockedRange.reason!,
                                                style: Theme.of(
                                                  context,
                                                ).textTheme.bodyMedium,
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
                if (selectedStaff != null &&
                    selectedStaff.blockedRanges.isNotEmpty)
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
                              ? 'Escolha o horário que fizer mais sentido para você e confirme a reserva no app.'
                              : 'Selecione um horário livre com ${selectedStaff.name} para confirmar sem trocar de profissional.',
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
                if (selectedSlot != null && availability != null) ...[
                  const SizedBox(height: 18),
                  SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Resumo antes de confirmar',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Seu horário entra no histórico do app assim que a reserva for confirmada e já deixa a próxima visita mais fácil de repetir.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _SummaryPill(
                              icon: Icons.event_rounded,
                              label: 'Data',
                              value: dateFormat.format(selectedSlot),
                              branding: branding,
                            ),
                            _SummaryPill(
                              icon: Icons.schedule_rounded,
                              label: 'Horário',
                              value: timeFormat.format(selectedSlot),
                              branding: branding,
                            ),
                            _SummaryPill(
                              icon: Icons.person_rounded,
                              label: 'Profissional',
                              value: _selectedStaffLabel(availability),
                              branding: branding,
                            ),
                          ],
                        ),
                        if (benefitMessage != null) ...[
                          const SizedBox(height: 16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.loyalty_rounded,
                                size: 18,
                                color: branding.deep,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  benefitMessage,
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (_canOpenWhatsApp) ...[
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 18,
                                color: branding.deep,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Se quiser alinhar algo antes da visita, fale com o salão pelo WhatsApp.',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          OutlinedButton.icon(
                            onPressed: _openWhatsAppForBooking,
                            icon: const Icon(Icons.open_in_new_rounded),
                            label: const Text('Falar com o salão'),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
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

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({
    required this.icon,
    required this.label,
    required this.value,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final String value;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: branding.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: branding.deep),
          const SizedBox(height: 10),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep.withValues(alpha: 0.92),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroInfoChip extends StatelessWidget {
  const _HeroInfoChip({
    required this.icon,
    required this.label,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
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
    required this.isFavorite,
    required this.favoriteBusy,
    required this.onToggleFavorite,
    this.detail,
  });

  final String title;
  final String subtitle;
  final String statusLabel;
  final bool selected;
  final VoidCallback onTap;
  final bool isFavorite;
  final bool favoriteBusy;
  final VoidCallback onToggleFavorite;
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
              color: selected
                  ? const Color(0xFFC56B43)
                  : const Color(0xFFE3D5C7),
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
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: favoriteBusy ? null : onToggleFavorite,
                    tooltip: isFavorite
                        ? 'Remover dos salvos'
                        : 'Salvar profissional',
                    visualDensity: VisualDensity.compact,
                    icon: favoriteBusy
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            isFavorite
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                            size: 18,
                            color: isFavorite
                                ? const Color(0xFFC56B43)
                                : const Color(0xFF8E441F),
                          ),
                  ),
                ],
              ),
              if ((detail ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(detail!, style: Theme.of(context).textTheme.bodySmall),
              ],
              if (isFavorite) ...[
                const SizedBox(height: 6),
                Text(
                  'Profissional salvo para seus próximos agendamentos.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF8E441F),
                    fontWeight: FontWeight.w700,
                  ),
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
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ),
    );
  }
}
