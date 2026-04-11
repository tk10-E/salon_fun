import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';
import 'booking_repository.dart';

class AgendaPage extends StatefulWidget {
  const AgendaPage({
    super.key,
    required this.bookingRepository,
    required this.notificationsController,
    required this.session,
  });

  final BookingRepository bookingRepository;
  final CustomerNotificationsController notificationsController;
  final AppSession session;

  @override
  State<AgendaPage> createState() => _AgendaPageState();
}

class _AgendaPageState extends State<AgendaPage> {
  bool _loading = true;
  List<ServiceOption> _services = const [];
  List<CustomerAppointment> _appointments = const [];
  ServiceOption? _selectedService;
  DayAvailability? _availability;
  DateTime _selectedDay = DateUtils.dateOnly(DateTime.now());
  late int _lastAgendaRevision;

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
    setState(() => _loading = true);
    final services = await widget.bookingRepository.fetchServices();
    final appointments = await widget.bookingRepository.fetchAppointments();
    final selected = services.isEmpty
        ? null
        : (_selectedService ?? services.first);
    final availability = selected == null
        ? null
        : await widget.bookingRepository.fetchDayAvailability(
            serviceId: selected.id,
            day: _selectedDay,
          );

    if (!mounted) {
      return;
    }

    setState(() {
      _services = services;
      _appointments = appointments;
      _selectedService = selected;
      _availability = availability;
      _loading = false;
    });
  }

  Future<void> _changeService(ServiceOption service) async {
    setState(() {
      _selectedService = service;
      _loading = true;
    });

    final availability = await widget.bookingRepository.fetchDayAvailability(
      serviceId: service.id,
      day: _selectedDay,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      _availability = availability;
      _loading = false;
    });
  }

  Future<void> _changeDay(DateTime day) async {
    if (_selectedService == null) {
      return;
    }

    setState(() {
      _selectedDay = day;
      _loading = true;
    });

    final availability = await widget.bookingRepository.fetchDayAvailability(
      serviceId: _selectedService!.id,
      day: day,
    );

    if (!mounted) {
      return;
    }

    setState(() {
      _availability = availability;
      _loading = false;
    });
  }

  Future<void> _confirmBooking(AppointmentSlot slot) async {
    final service = _selectedService;
    if (service == null) {
      return;
    }

    bool isSubmitting = false;
    final created = await showModalBottomSheet<CustomerAppointment>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Confirmar horário',
                    subtitle: 'O app valida a disponibilidade em tempo real.',
                  ),
                  const SizedBox(height: 18),
                  _AgendaInfoTile(
                    label: 'Serviço',
                    value: service.name,
                    support:
                        '${service.durationMinutes} min • ${formatCurrency(service.price)}',
                  ),
                  const SizedBox(height: 10),
                  _AgendaInfoTile(
                    label: 'Data',
                    value: formatFullDate(slot.startAt),
                    support:
                        '${formatTime(slot.startAt)} até ${formatTime(slot.endsAt)}',
                  ),
                  const SizedBox(height: 10),
                  _AgendaInfoTile(
                    label: 'Profissional',
                    value: slot.staffMemberName,
                    support: 'Agenda encaixada no melhor slot livre.',
                  ),
                  const SizedBox(height: 18),
                  AsyncButton(
                    label: 'Fechar agendamento',
                    isBusy: isSubmitting,
                    icon: Icons.check_circle_rounded,
                    onPressed: () async {
                      setModalState(() => isSubmitting = true);
                      try {
                        final appointment = await widget.bookingRepository
                            .createAppointment(service: service, slot: slot);
                        if (!context.mounted) {
                          return;
                        }
                        Navigator.of(context).pop(appointment);
                      } catch (error) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$error'.replaceFirst('Exception: ', ''),
                            ),
                          ),
                        );
                        setModalState(() => isSubmitting = false);
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (created == null || !mounted) {
      return;
    }

    await _bootstrap();
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          created.bookingPolicySnapshot?.isNotEmpty == true
              ? 'Agendamento confirmado. Regras e sinal já foram aplicados.'
              : 'Agendamento confirmado com sucesso.',
        ),
      ),
    );

    if (!mounted || created.bookingPolicySnapshot == null) {
      return;
    }

    await _showDepositExperience(created);
  }

  Future<void> _cancelAppointment(CustomerAppointment appointment) async {
    final controller = TextEditingController();
    bool submitting = false;

    final didCancel = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Cancelar horário',
                    subtitle:
                        'Explique em uma frase para liberar a agenda com clareza.',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: controller,
                    minLines: 3,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Motivo',
                      hintText: 'Ex.: tive um imprevisto no trabalho',
                    ),
                  ),
                  const SizedBox(height: 16),
                  AsyncButton(
                    label: 'Cancelar agendamento',
                    isBusy: submitting,
                    icon: Icons.event_busy_rounded,
                    onPressed: () async {
                      if (controller.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Informe um motivo para cancelar.'),
                          ),
                        );
                        return;
                      }

                      setModalState(() => submitting = true);
                      try {
                        await widget.bookingRepository.cancelAppointment(
                          appointmentId: appointment.id,
                          reason: controller.text,
                        );
                        if (!context.mounted) {
                          return;
                        }
                        Navigator.of(context).pop(true);
                      } catch (error) {
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '$error'.replaceFirst('Exception: ', ''),
                            ),
                          ),
                        );
                        setModalState(() => submitting = false);
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    controller.dispose();

    if (didCancel != true || !mounted) {
      return;
    }

    await _bootstrap();
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Agendamento cancelado.')));
  }

  Future<void> _showDepositExperience(CustomerAppointment appointment) async {
    final preview = widget.session.landingData?.preview;
    final paymentMode = preview?.bookingPaymentMode ?? 'manual';
    final instructions = _buildDepositInstructions(preview, appointment);
    final canPayNow =
        appointment.depositAmount > 0 &&
        paymentMode != 'manual' &&
        paymentMode.trim().isNotEmpty;
    final effectiveStatus = appointment.depositReportedPaidAt != null
        ? 'reported_paid'
        : appointment.depositStatus;

    AppointmentDepositCharge? managedCharge;
    bool loadingManagedCharge = false;
    bool reportingPaid = false;
    bool autoPreparedManagedCharge = false;
    final referenceController = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> createManagedCharge({
              bool forceRefresh = false,
            }) async {
              setModalState(() => loadingManagedCharge = true);
              try {
                final charge = await widget.bookingRepository
                    .createManagedDepositCharge(
                      appointmentId: appointment.id,
                      forceRefresh: forceRefresh,
                    );
                if (!context.mounted) {
                  return;
                }
                setModalState(() => managedCharge = charge);
                await _bootstrap();
              } catch (error) {
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$error'.replaceFirst('Exception: ', '')),
                  ),
                );
              } finally {
                if (context.mounted) {
                  setModalState(() => loadingManagedCharge = false);
                }
              }
            }

            if (!autoPreparedManagedCharge &&
                paymentMode == 'asaas_pix' &&
                canPayNow &&
                managedCharge == null &&
                !loadingManagedCharge) {
              autoPreparedManagedCharge = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!context.mounted) {
                  return;
                }
                createManagedCharge();
              });
            }

            Future<void> markManualPayment(String method) async {
              setModalState(() => reportingPaid = true);
              try {
                await widget.bookingRepository.reportDepositPaid(
                  appointmentId: appointment.id,
                  paymentMethod: method,
                  paymentReference: referenceController.text,
                );
                if (!context.mounted) {
                  return;
                }
                await _bootstrap();
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Pagamento informado para o salão.'),
                  ),
                );
                Navigator.of(context).pop();
              } catch (error) {
                if (!context.mounted) {
                  return;
                }
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('$error'.replaceFirst('Exception: ', '')),
                  ),
                );
              } finally {
                if (context.mounted) {
                  setModalState(() => reportingPaid = false);
                }
              }
            }

            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SectionTitle(
                      title: appointment.depositAmount > 0
                          ? 'Pague o sinal agora'
                          : 'Regras da reserva',
                      subtitle: appointment.depositAmount > 0
                          ? 'Seu horário já foi criado. Falta concluir o sinal para segurar a vaga.'
                          : 'Tudo alinhado logo após a confirmação.',
                    ),
                    const SizedBox(height: 16),
                    SalonPanel(
                      child: Text(
                        appointment.bookingPolicySnapshot ?? '',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    if (appointment.depositAmount > 0) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Pill(
                            label:
                                'Sinal ${formatCurrency(appointment.depositAmount)}',
                            icon: Icons.payments_rounded,
                            backgroundColor: AppTheme.accent.withValues(
                              alpha: 0.18,
                            ),
                            foregroundColor: AppTheme.ink,
                          ),
                          Pill(
                            label: _depositStatusLabel(
                              managedCharge?.depositStatus ?? effectiveStatus,
                            ),
                            icon: Icons.verified_rounded,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (instructions != null)
                        SalonPanel(
                          accent: AppTheme.secondary.withValues(alpha: 0.12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Como pagar',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                instructions,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      if (paymentMode == 'pix' &&
                          preview?.bookingPixKey?.trim().isNotEmpty ==
                              true) ...[
                        const SizedBox(height: 14),
                        _AgendaInfoTile(
                          label: 'Chave Pix',
                          value: preview!.bookingPixKey!,
                          support:
                              '${preview.bookingPixRecipientName ?? 'Favorecido'} • ${preview.bookingPixRecipientCity ?? 'Cidade não informada'}',
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: referenceController,
                          decoration: const InputDecoration(
                            labelText: 'Comprovante ou observação',
                            hintText: 'Ex.: nome da conta pagadora',
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            AsyncButton(
                              label: 'Copiar chave Pix',
                              isBusy: false,
                              icon: Icons.copy_rounded,
                              onPressed: () async {
                                await Clipboard.setData(
                                  ClipboardData(text: preview.bookingPixKey!),
                                );
                                if (!context.mounted) {
                                  return;
                                }
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Chave Pix copiada.'),
                                  ),
                                );
                              },
                            ),
                            AsyncButton(
                              label: 'Já paguei',
                              isBusy: reportingPaid,
                              icon: Icons.check_circle_rounded,
                              onPressed: () => markManualPayment('pix'),
                            ),
                          ],
                        ),
                      ],
                      if (paymentMode == 'external_checkout' &&
                          preview?.bookingExternalCheckoutUrl
                                  ?.trim()
                                  .isNotEmpty ==
                              true) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: referenceController,
                          decoration: const InputDecoration(
                            labelText: 'Referência do pagamento',
                            hintText: 'Ex.: código do checkout',
                          ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            AsyncButton(
                              label: 'Abrir checkout',
                              isBusy: false,
                              icon: Icons.open_in_new_rounded,
                              onPressed: () async {
                                final uri = Uri.tryParse(
                                  preview!.bookingExternalCheckoutUrl!,
                                );
                                if (uri == null) {
                                  return;
                                }
                                await launchUrl(
                                  uri,
                                  mode: LaunchMode.externalApplication,
                                );
                              },
                            ),
                            AsyncButton(
                              label: 'Já concluí pagamento',
                              isBusy: reportingPaid,
                              icon: Icons.check_circle_rounded,
                              onPressed: () =>
                                  markManualPayment('external_checkout'),
                            ),
                          ],
                        ),
                      ],
                      if (paymentMode == 'asaas_pix') ...[
                        const SizedBox(height: 14),
                        if (managedCharge?.providerPayload?.trim().isNotEmpty ==
                            true)
                          _AgendaInfoTile(
                            label: 'Pix copia e cola',
                            value: managedCharge!.providerPayload!,
                            support: managedCharge?.providerStatus == null
                                ? 'Cobrança gerada.'
                                : 'Status atual: ${managedCharge?.providerStatus}',
                          ),
                        if (managedCharge?.providerError?.trim().isNotEmpty ==
                            true) ...[
                          const SizedBox(height: 10),
                          Text(
                            managedCharge!.providerError!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            AsyncButton(
                              label: managedCharge == null
                                  ? 'Gerar Pix agora'
                                  : 'Atualizar Pix',
                              isBusy: loadingManagedCharge,
                              icon: Icons.qr_code_rounded,
                              onPressed: () => createManagedCharge(
                                forceRefresh: managedCharge != null,
                              ),
                            ),
                            if (managedCharge?.providerPayload
                                    ?.trim()
                                    .isNotEmpty ==
                                true)
                              AsyncButton(
                                label: 'Copiar código Pix',
                                isBusy: false,
                                icon: Icons.copy_rounded,
                                onPressed: () async {
                                  await Clipboard.setData(
                                    ClipboardData(
                                      text: managedCharge!.providerPayload!,
                                    ),
                                  );
                                  if (!context.mounted) {
                                    return;
                                  }
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Código Pix copiado com sucesso.',
                                      ),
                                    ),
                                  );
                                },
                              ),
                            if (managedCharge?.providerInvoiceUrl
                                    ?.trim()
                                    .isNotEmpty ==
                                true)
                              AsyncButton(
                                label: 'Abrir cobrança',
                                isBusy: false,
                                icon: Icons.open_in_new_rounded,
                                onPressed: () async {
                                  final uri = Uri.tryParse(
                                    managedCharge!.providerInvoiceUrl!,
                                  );
                                  if (uri == null) {
                                    return;
                                  }
                                  await launchUrl(
                                    uri,
                                    mode: LaunchMode.externalApplication,
                                  );
                                },
                              ),
                          ],
                        ),
                      ],
                      if (!canPayNow && paymentMode == 'manual') ...[
                        const SizedBox(height: 14),
                        Text(
                          'O salão vai orientar a confirmação manual desse sinal.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      if (appointment.depositReportedPaidAt != null) ...[
                        const SizedBox(height: 14),
                        SalonPanel(
                          accent: AppTheme.primary.withValues(alpha: 0.12),
                          child: Text(
                            appointment.depositReportedPaidVia
                                        ?.trim()
                                        .isNotEmpty ==
                                    true
                                ? 'Pagamento já informado via ${appointment.depositReportedPaidVia}. O salão vai validar e confirmar a reserva.'
                                : 'Pagamento já informado ao salão. Falta apenas a validação final da reserva.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    referenceController.dispose();
  }

  Future<void> _openDepositPayment(CustomerAppointment appointment) async {
    await _showDepositExperience(appointment);
  }

  String? _buildDepositInstructions(
    SalonPreview? preview,
    CustomerAppointment appointment,
  ) {
    final base = preview?.bookingPaymentInstructions?.trim();
    if (base != null && base.isNotEmpty) {
      return base;
    }
    if (appointment.depositAmount <= 0) {
      return null;
    }
    return switch (preview?.bookingPaymentMode) {
      'pix' =>
        'Copie a chave Pix do salão, conclua o pagamento e marque como pago logo abaixo.',
      'external_checkout' =>
        'Abra o checkout do salão, conclua o pagamento e volte para finalizar a confirmação.',
      'asaas_pix' =>
        'Gere o Pix do sinal agora. Assim que o pagamento entrar, o status atualiza para o salão.',
      _ => 'O salão vai orientar a melhor forma de confirmar seu sinal.',
    };
  }

  String _depositStatusLabel(String status) {
    return switch (status) {
      'received' => 'Sinal recebido',
      'pending' => 'Sinal pendente',
      'reported_paid' => 'Pagamento informado',
      _ => 'Status do sinal',
    };
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(
      preview?.brandColor,
      fallback: AppTheme.secondary,
    );
    final now = DateTime.now();
    final upcoming =
        _appointments
            .where((item) => item.date.isAfter(now))
            .where((item) => item.status != 'cancelled')
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final nextAppointment = upcoming.isEmpty ? null : upcoming.first;
    final chipsDays = List<DateTime>.generate(
      10,
      (index) => DateUtils.dateOnly(now.add(Duration(days: index))),
    );
    final availableSlots = List<AppointmentSlot>.from(
      _availability?.availableSlots ?? const <AppointmentSlot>[],
    )..sort((a, b) => a.startAt.compareTo(b.startAt));
    final staffMembers = List<StaffAvailability>.from(
      _availability?.staffMembers ?? const <StaffAvailability>[],
    );
    final selectedDayAppointments =
        _appointments
            .where((item) => DateUtils.isSameDay(item.date, _selectedDay))
            .where((item) => item.status != 'cancelled')
            .toList()
          ..sort((a, b) => a.date.compareTo(b.date));
    final availableStaffCount = staffMembers
        .where((staff) => staff.status == 'available')
        .length;
    final nextSlot = availableSlots.isEmpty ? null : availableSlots.first;
    final selectedService = _selectedService;
    final plannedRevenue = selectedDayAppointments.fold<double>(
      0,
      (sum, appointment) => sum + (appointment.servicePrice ?? 0),
    );
    final depositCount = _appointments
        .where((appointment) => appointment.depositAmount > 0)
        .where((appointment) => appointment.status != 'cancelled')
        .length;

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
                            value: '${availableSlots.length}',
                            support: nextSlot == null
                                ? 'Sem vaga por enquanto'
                                : 'Primeiro às ${formatTime(nextSlot.startAt)}',
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
                                : '${staffMembers.length} profissionais avaliados',
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
                const SectionTitle(
                  title: 'Escolha o serviço',
                  subtitle: 'Tudo organizado para reservar sem atrito.',
                ),
                const SizedBox(height: 14),
                if (_services.isEmpty && !_loading)
                  const EmptyStateCard(
                    title: 'Sem serviços disponíveis',
                    message:
                        'Assim que o salão ativar a agenda, os serviços aparecem aqui.',
                    icon: Icons.spa_outlined,
                  )
                else
                  SizedBox(
                    height: 176,
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
                      'Os melhores encaixes já aparecem no recorte selecionado.',
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 96,
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
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 42),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (selectedService == null)
                  const EmptyStateCard(
                    title: 'Sem serviço selecionado',
                    message:
                        'Escolha um serviço para liberar a grade com equipe, horários e confirmação.',
                    icon: Icons.calendar_view_day_rounded,
                  )
                else ...[
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
                              value: nextSlot == null
                                  ? 'Sem horário'
                                  : formatTime(nextSlot.startAt),
                              support: nextSlot == null
                                  ? 'Nenhuma vaga neste recorte'
                                  : 'Com ${nextSlot.staffMemberName}',
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
                                  : 'Fluxo real de reserva, confirmação e cancelamento.',
                              tone: AppTheme.accent,
                            ),
                          ],
                        ),
                        if (staffMembers.isNotEmpty) ...[
                          const SizedBox(height: 20),
                          const SectionTitle(
                            title: 'Equipe em destaque',
                            subtitle:
                                'Veja quem está livre, ocupado ou fora da escala.',
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 178,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: staffMembers.length,
                              separatorBuilder: (context, index) =>
                                  const SizedBox(width: 12),
                              itemBuilder: (context, index) {
                                return _StaffAvailabilityCard(
                                  staff: staffMembers[index],
                                  accent: accent,
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
                    subtitle: availableSlots.isEmpty
                        ? 'Troque o serviço ou o dia para encontrar outro encaixe.'
                        : 'Escolha um card e feche sua reserva com confirmação imediata.',
                  ),
                  const SizedBox(height: 14),
                  if (availableSlots.isEmpty)
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
                        itemCount: availableSlots.length,
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 240,
                              mainAxisSpacing: 12,
                              crossAxisSpacing: 12,
                              mainAxisExtent: 188,
                            ),
                        itemBuilder: (context, index) {
                          final slot = availableSlots[index];
                          return _AgendaSlotCard(
                            slot: slot,
                            accent: accent,
                            onTap: () => _confirmBooking(slot),
                          );
                        },
                      ),
                    ),
                ],
                const SizedBox(height: 20),
                SectionTitle(
                  title: 'Sua agenda no salão',
                  subtitle: _appointments.isEmpty
                      ? 'Reserve o primeiro horário e ele aparece aqui na hora.'
                      : 'Próximos horários, histórico e sinais alinhados em uma única visão.',
                ),
                const SizedBox(height: 14),
                if (_appointments.isEmpty)
                  const EmptyStateCard(
                    title: 'Sua agenda ainda está vazia',
                    message:
                        'Reserve o primeiro horário e ele aparece aqui na hora.',
                    icon: Icons.calendar_today_rounded,
                  )
                else
                  ..._appointments.map(
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
                        onCancel:
                            appointment.date.isAfter(now) &&
                                appointment.status != 'cancelled' &&
                                appointment.status != 'completed'
                            ? () => _cancelAppointment(appointment)
                            : null,
                      ),
                    ),
                  ),
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
        width: 236,
        padding: const EdgeInsets.all(16),
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
            Row(
              children: [
                _AgendaArtwork(
                  imageUrl: service.imageUrl,
                  size: 58,
                  accent: selected ? accent : AppTheme.primary,
                  icon: Icons.spa_rounded,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        service.name,
                        style: Theme.of(context).textTheme.titleMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        service.description?.trim().isNotEmpty == true
                            ? service.description!.trim()
                            : 'Reserva com confirmação imediata.',
                        style: Theme.of(context).textTheme.bodySmall,
                        maxLines: 2,
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
            Row(
              children: [
                Pill(
                  label: '${service.durationMinutes} min',
                  icon: Icons.schedule_rounded,
                  backgroundColor: AppTheme.secondary.withValues(alpha: 0.08),
                ),
                const Spacer(),
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
        width: 92,
        padding: const EdgeInsets.all(14),
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
          children: [
            Text(
              _relativeDayLabel(day),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected ? Colors.white : AppTheme.mutedInk,
              ),
            ),
            const Spacer(),
            Text(
              formatShortDate(day),
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: selected ? Colors.white : AppTheme.ink,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              formatWeekdayShort(day),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: selected
                    ? Colors.white.withValues(alpha: 0.84)
                    : AppTheme.mutedInk,
              ),
            ),
          ],
        ),
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
  const _StaffAvailabilityCard({required this.staff, required this.accent});

  final StaffAvailability staff;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final tone = switch (staff.status) {
      'available' => accent,
      'off' => AppTheme.mutedInk,
      _ => AppTheme.accent,
    };

    return SizedBox(
      width: 228,
      child: SalonPanel(
        padding: const EdgeInsets.all(16),
        accent: tone,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _AgendaArtwork(
                  size: 54,
                  accent: tone,
                  icon: Icons.person_rounded,
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
              ],
            ),
            const SizedBox(height: 14),
            Pill(
              label: _staffStatusLabel(staff.status),
              icon: _staffStatusIcon(staff.status),
              backgroundColor: tone.withValues(alpha: 0.14),
              foregroundColor: tone == AppTheme.accent ? AppTheme.ink : tone,
            ),
            const SizedBox(height: 12),
            Text(
              staff.statusDetail,
              style: Theme.of(context).textTheme.bodySmall,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const Spacer(),
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
    );
  }
}

class _AgendaSlotCard extends StatelessWidget {
  const _AgendaSlotCard({
    required this.slot,
    required this.accent,
    required this.onTap,
  });

  final AppointmentSlot slot;
  final Color accent;
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
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Icon(Icons.flash_on_rounded, color: accent, size: 21),
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
              maxLines: 2,
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
                      'Reservar agora',
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
    required this.onCancel,
  });

  final CustomerAppointment appointment;
  final Color accent;
  final bool highlight;
  final VoidCallback? onPay;
  final VoidCallback? onCancel;

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
                      const SizedBox(height: 4),
                      Text(
                        'Com ${appointment.staffName}',
                        style: Theme.of(context).textTheme.bodySmall,
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
              if (appointment.presenceConfirmedAt != null)
                Pill(
                  label:
                      'Presença às ${formatTime(appointment.presenceConfirmedAt!)}',
                  icon: Icons.verified_user_rounded,
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
                  foregroundColor: AppTheme.primary,
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
          if (onPay != null) ...[
            const SizedBox(height: 14),
            AsyncButton(
              label: 'Pagar sinal agora',
              isBusy: false,
              icon: Icons.payments_rounded,
              onPressed: onPay,
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
                  const SizedBox(height: 4),
                  Text(
                    'Com ${appointment.staffName}',
                    style: Theme.of(context).textTheme.bodySmall,
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
    this.imageUrl,
  });

  final double size;
  final Color accent;
  final IconData icon;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: SizedBox(
        width: size,
        height: size,
        child: imageUrl?.trim().isNotEmpty == true
            ? Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return _FallbackArtwork(accent: accent, icon: icon);
                },
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) {
                    return child;
                  }
                  return _FallbackArtwork(accent: accent, icon: icon);
                },
              )
            : _FallbackArtwork(accent: accent, icon: icon),
      ),
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
    case 'off':
      return Icons.pause_circle_rounded;
    default:
      return Icons.timelapse_rounded;
  }
}
