part of 'agenda_page.dart';

extension _AgendaPageStateFlows on _AgendaPageState {
  void _removeAppointmentsFromState(Set<String> appointmentIds) {
    if (appointmentIds.isEmpty) {
      return;
    }

    _commitAgendaState(() {
      _appointments = _appointments
          .where((appointment) => !appointmentIds.contains(appointment.id))
          .toList(growable: false);
    });
  }

  void _showLoadError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  CustomerAppointment? _activeAppointmentOnDay(
    List<CustomerAppointment> appointments,
    DateTime day,
    DateTime now, {
    String? ignoreAppointmentId,
  }) {
    for (final appointment in appointments) {
      if (ignoreAppointmentId != null &&
          appointment.id == ignoreAppointmentId) {
        continue;
      }

      if (_isHistoryAppointment(appointment, now)) {
        continue;
      }

      if (DateUtils.isSameDay(appointment.date, day)) {
        return appointment;
      }
    }

    return null;
  }

  String _sameDayBookingBlockMessage(CustomerAppointment appointment) {
    return 'Voce ja possui ${appointment.serviceName} as ${formatTime(appointment.date)} neste dia. Escolha outro dia ou fale com o salao para remarcar.';
  }

  StaffAvailability? _resolveFocusedStaffMember(
    List<StaffAvailability> staffMembers,
  ) {
    if (staffMembers.isEmpty) {
      return null;
    }

    final selectedStaffId = _selectedStaffMemberId?.trim();
    if (selectedStaffId != null && selectedStaffId.isNotEmpty) {
      for (final staff in staffMembers) {
        if (staff.id == selectedStaffId) {
          return staff;
        }
      }
    }

    final withFreeSlots =
        staffMembers.where((staff) => staff.availableSlotsCount > 0).toList()
          ..sort((a, b) {
            final aNext = a.nextAvailableAt;
            final bNext = b.nextAvailableAt;

            if (aNext != null && bNext != null) {
              final compareNext = aNext.compareTo(bNext);
              if (compareNext != 0) {
                return compareNext;
              }
            } else if (aNext != null) {
              return -1;
            } else if (bNext != null) {
              return 1;
            }

            final compareSlots = b.availableSlotsCount.compareTo(
              a.availableSlotsCount,
            );
            if (compareSlots != 0) {
              return compareSlots;
            }

            return a.name.toLowerCase().compareTo(b.name.toLowerCase());
          });

    if (withFreeSlots.isNotEmpty) {
      return withFreeSlots.first;
    }

    return staffMembers.first;
  }

  void _selectStaffMember(StaffAvailability staff) {
    final reschedulingAppointment = _reschedulingAppointment();
    if (reschedulingAppointment?.isMembershipPlanAppointment == true &&
        reschedulingAppointment?.staffMemberId?.trim().isNotEmpty == true &&
        reschedulingAppointment!.staffMemberId != staff.id) {
      _showLoadError(
        'Esse horario de plano precisa continuar com o mesmo profissional.',
      );
      return;
    }

    if (_selectedStaffMemberId == staff.id) {
      return;
    }

    _commitAgendaState(() {
      _selectedStaffMemberId = staff.id;
    });
  }

  Future<void> _confirmBooking(AppointmentSlot slot) async {
    final service = _selectedService;
    if (service == null) {
      return;
    }

    final reschedulingAppointment = _reschedulingAppointment();

    final requestOffer = reschedulingAppointment == null
        ? _focusedMembershipRequestOffer()
        : null;
    if (requestOffer != null &&
        _locallyRequestedMembershipOfferIds.contains(requestOffer.id)) {
      _showLoadError(
        'Seu pedido desse plano ja foi enviado. Aguarde o salao aprovar e confirmar o pagamento para liberar a serie.',
      );
      return;
    }

    final sameDayAppointment = _activeAppointmentOnDay(
      _appointments,
      slot.startAt,
      DateTime.now(),
      ignoreAppointmentId: reschedulingAppointment?.id,
    );
    if (sameDayAppointment != null) {
      _showLoadError(_sameDayBookingBlockMessage(sameDayAppointment));
      return;
    }

    final focusedMembershipPlan = reschedulingAppointment == null
        ? _focusedPendingMembershipForService(service, slot.startAt)
        : null;
    final eligibleMembership = reschedulingAppointment == null
        ? _eligibleMembershipForService(service, slot.startAt)
        : null;
    final preferredMembership = focusedMembershipPlan ?? eligibleMembership;
    final forceMembershipPlan = focusedMembershipPlan != null;
    final forceMembershipRequest =
        requestOffer != null && preferredMembership == null;
    bool isSubmitting = false;
    bool useMembershipPlan = preferredMembership != null;
    String selectedPaymentPreference = 'to_be_defined';
    final created = await showModalBottomSheet<Object>(
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
                salonBottomActionInset(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionTitle(
                    title: reschedulingAppointment != null
                        ? 'Confirmar remarcacao'
                        : forceMembershipPlan
                        ? 'Confirmar horario fixo do plano'
                        : forceMembershipRequest
                        ? 'Confirmar pedido com horario preferido'
                        : 'Confirmar horario',
                    subtitle: reschedulingAppointment != null
                        ? reschedulingAppointment.isMembershipPlanAppointment
                              ? 'Esse horario continua no mesmo plano e no mesmo profissional. Voce so escolhe o novo encaixe.'
                              : 'Voce vai manter o mesmo servico e atualizar apenas o dia, horario ou profissional.'
                        : forceMembershipPlan
                        ? 'Esse sera o horario-base. O app reserva o restante da serie automaticamente.'
                        : forceMembershipRequest
                        ? 'Esse horario nao sera reservado agora. O salao aprova primeiro, confirma o pagamento e o sistema tenta aplicar a serie automaticamente.'
                        : 'O app valida a disponibilidade em tempo real.',
                  ),
                  const SizedBox(height: 18),
                  _AgendaInfoTile(
                    label: 'Servico',
                    value: service.name,
                    support:
                        '${service.durationMinutes} min • ${formatCurrency(service.price)}',
                  ),
                  const SizedBox(height: 10),
                  _AgendaInfoTile(
                    label: 'Data',
                    value: formatFullDate(slot.startAt),
                    support:
                        '${formatTime(slot.startAt)} ate ${formatTime(slot.endsAt)}',
                  ),
                  const SizedBox(height: 10),
                  _AgendaInfoTile(
                    label: 'Profissional',
                    value: slot.staffMemberName,
                    support: reschedulingAppointment != null
                        ? reschedulingAppointment.isMembershipPlanAppointment
                              ? 'Para horarios de plano, o profissional fica travado na remarcacao.'
                              : 'Voce pode mudar o profissional se a grade real mostrar disponibilidade.'
                        : forceMembershipPlan
                        ? 'Esse profissional fica travado para a serie do plano nesse mesmo ritmo.'
                        : forceMembershipRequest
                        ? 'Se o salao aprovar e confirmar o pagamento, esse profissional vira a referencia da serie fixa.'
                        : 'Se usar o plano, esse horario fica fixo com esse profissional.',
                  ),
                  const SizedBox(height: 18),
                  if (reschedulingAppointment != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.panel,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: Text(
                        reschedulingAppointment.isMembershipPlanAppointment
                            ? 'Remarcando ${reschedulingAppointment.serviceName}: o plano e a sessao continuam os mesmos. O painel do salao recebe esse novo horario automaticamente.'
                            : 'Remarcando ${reschedulingAppointment.serviceName}: o horario antigo sai da grade e o novo encaixe entra no mesmo atendimento.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  if (preferredMembership != null && !forceMembershipPlan) ...[
                    Text(
                      'Como voce quer fechar esse horario?',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('Usar plano mensal'),
                          selected: useMembershipPlan,
                          onSelected: (_) {
                            setModalState(() => useMembershipPlan = true);
                          },
                        ),
                        ChoiceChip(
                          label: const Text('Pagar avulso'),
                          selected: !useMembershipPlan,
                          onSelected: (_) {
                            setModalState(() => useMembershipPlan = false);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.panel,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: Text(
                        useMembershipPlan
                            ? 'Plano ${preferredMembership.title}: ${_reservableSessionsRemaining(preferredMembership)} sessoes ainda podem ser programadas ate ${formatFullDate(preferredMembership.expiresAt)}. O primeiro horario escolhido vira fixo e o app replica as proximas sessoes com esse mesmo profissional no mesmo dia e horario dentro da vigencia do plano.'
                            : 'Voce pode manter esse horario como atendimento avulso sem mexer no plano mensal.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  if (forceMembershipRequest) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.panel,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: Text(
                        'Pedido de ${requestOffer.title}: esse horario entra como preferencia de ativacao. Depois que o salao aprovar e marcar o pagamento no painel, o sistema tenta reservar a serie no mesmo dia, horario e profissional sem voce precisar refazer tudo.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  if (forceMembershipPlan) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.panel,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppTheme.line),
                      ),
                      child: Text(
                        'Plano ${preferredMembership!.title}: confirme esse dia e horario uma vez e o app distribui automaticamente as proximas sessoes no mesmo dia, horario e profissional, sempre marcadas como plano na agenda do salao.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  if (reschedulingAppointment == null &&
                      !useMembershipPlan &&
                      !forceMembershipRequest) ...[
                    Text(
                      'Forma prevista de pagamento',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Isso ajuda o salao a prever o caixa. A receita real so entra quando o atendimento for concluido e baixado.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final value in _appointmentPaymentPreferenceValues)
                          ChoiceChip(
                            label: Text(
                              appointmentPaymentPreferenceLabel(value),
                            ),
                            selected: selectedPaymentPreference == value,
                            onSelected: (_) {
                              setModalState(
                                () => selectedPaymentPreference = value,
                              );
                            },
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 18),
                  AsyncButton(
                    label: reschedulingAppointment != null
                        ? 'Confirmar remarcacao'
                        : forceMembershipPlan
                        ? 'Confirmar horario fixo do plano'
                        : forceMembershipRequest
                        ? 'Pedir plano com esse horario'
                        : useMembershipPlan
                        ? 'Fixar plano'
                        : 'Fechar agendamento',
                    isBusy: isSubmitting,
                    icon: Icons.check_circle_rounded,
                    onPressed: () async {
                      setModalState(() => isSubmitting = true);
                      try {
                        if (reschedulingAppointment != null) {
                          await widget.bookingRepository.rescheduleAppointment(
                            appointment: reschedulingAppointment,
                            service: service,
                            slot: slot,
                          );
                          if (!context.mounted) {
                            return;
                          }
                          Navigator.of(context).pop('rescheduled');
                          return;
                        }

                        if (forceMembershipRequest) {
                          final profileRepository = widget.profileRepository;
                          if (profileRepository == null) {
                            throw Exception(
                              'O pedido do plano nao esta disponivel neste app agora.',
                            );
                          }

                          final request = await profileRepository
                              .requestMembershipPlan(
                                offerId: requestOffer.id,
                                preferredStartAt: slot.startAt,
                                preferredStaffMemberId: slot.staffMemberId,
                                preferredStaffMemberName: slot.staffMemberName,
                              );
                          if (!context.mounted) {
                            return;
                          }
                          Navigator.of(context).pop(request);
                          return;
                        }

                        if (useMembershipPlan) {
                          final membership = preferredMembership;
                          if (membership == null) {
                            throw Exception(
                              'Seu plano mensal nao esta disponivel para esse horario.',
                            );
                          }
                          final result = await widget.bookingRepository
                              .scheduleMembershipPlan(
                                membership: membership,
                                service: service,
                                slot: slot,
                              );
                          if (!context.mounted) {
                            return;
                          }
                          Navigator.of(context).pop(result);
                          return;
                        }

                        final appointment = await widget.bookingRepository
                            .createAppointment(
                              service: service,
                              slot: slot,
                              paymentPreference: selectedPaymentPreference,
                            );
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

    if (created == 'rescheduled') {
      _cancelReschedulingMode();
      widget.notificationsController.touchHomeRevision();
      await _bootstrap();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Horario remarcado com sucesso.')),
      );
      return;
    }

    if (created is CustomerMembershipRequest) {
      _commitAgendaState(() {
        _locallyRequestedMembershipOfferIds.add(created.offerId);
      });
      widget.notificationsController.touchHomeRevision();
      final preferredStartAt = created.preferredStartAt;
      final preferredLabel = preferredStartAt == null
          ? 'Assim que o salao aprovar e confirmar o pagamento, o app tenta aplicar esse ritmo automaticamente.'
          : 'Assim que o salao aprovar e confirmar o pagamento, o app tenta aplicar ${formatFullDate(preferredStartAt)} as ${formatTime(preferredStartAt)} como base da serie.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Pedido do plano enviado. $preferredLabel')),
      );
      return;
    }

    if (created is MembershipPlanScheduleResult &&
        created.membershipId.trim().isNotEmpty) {
      _commitAgendaState(() {
        _locallyScheduledMembershipPlanIds.add(created.membershipId);
      });
    }

    await _bootstrap();
    if (!mounted) {
      return;
    }

    if (created is MembershipPlanScheduleResult) {
      widget.notificationsController.touchHomeRevision();
      final skippedLabel = created.skippedCount <= 0
          ? 'Serie fixa criada sem pendencias.'
          : '${created.skippedCount} sessao(oes) ficaram sem encaixe no mesmo dia e horario.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Plano fixado: ${created.scheduledCount} sessao(oes) reservadas com esse profissional. $skippedLabel',
          ),
        ),
      );
      return;
    }

    final createdAppointment = created as CustomerAppointment;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          createdAppointment.bookingPolicySnapshot?.isNotEmpty == true
              ? 'Agendamento confirmado. Regras e sinal ja foram aplicados.'
              : 'Agendamento confirmado com sucesso.',
        ),
      ),
    );

    if (!mounted || createdAppointment.bookingPolicySnapshot == null) {
      return;
    }

    await _showDepositExperience(createdAppointment);
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
                salonBottomActionInset(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionTitle(
                    title: 'Cancelar horario',
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
                          isMembershipPlanAppointment:
                              appointment.isMembershipPlanAppointment,
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

  Future<void> _reviewAppointment(CustomerAppointment appointment) async {
    var selectedRating = appointment.reviewRating ?? 5;
    final commentController = TextEditingController(
      text: appointment.reviewComment ?? '',
    );
    var submitting = false;

    final saved = await showModalBottomSheet<bool>(
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
                salonBottomActionInset(context),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionTitle(
                    title: appointment.reviewRating == null
                        ? 'Avaliar atendimento'
                        : 'Editar avaliação',
                    subtitle:
                        'Essa nota aparece em tempo real na equipe do salão.',
                  ),
                  const SizedBox(height: 18),
                  Text(
                    '${appointment.serviceName} • ${appointment.staffName ?? 'Profissional do salão'}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Sua nota',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: List<Widget>.generate(5, (index) {
                      final value = index + 1;
                      return ChoiceChip(
                        label: Text('$value estrela${value > 1 ? 's' : ''}'),
                        selected: selectedRating == value,
                        onSelected: (_) {
                          setModalState(() => selectedRating = value);
                        },
                      );
                    }),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: commentController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Comentário',
                      hintText:
                          'Conte como foi o atendimento, resultado e experiência.',
                    ),
                  ),
                  const SizedBox(height: 18),
                  AsyncButton(
                    label: 'Salvar avaliação',
                    isBusy: submitting,
                    icon: Icons.star_rate_rounded,
                    onPressed: () async {
                      setModalState(() => submitting = true);
                      try {
                        await widget.bookingRepository.submitAppointmentReview(
                          appointmentId: appointment.id,
                          rating: selectedRating,
                          comment: commentController.text,
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
                              _formatAgendaError(
                                error,
                                fallback:
                                    'Não foi possível salvar a avaliação agora.',
                              ),
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

    commentController.dispose();

    if (saved != true || !mounted) {
      return;
    }

    await _bootstrap();
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Avaliação salva e enviada para a equipe do salão.'),
      ),
    );
  }

  bool _isHistoryAppointment(CustomerAppointment appointment, DateTime now) {
    if (_isFinalAppointmentStatusValue(appointment.status)) {
      return true;
    }

    final endsAt = appointment.endsAt ?? appointment.date;
    return !endsAt.isAfter(now);
  }

  Future<void> _completeAppointment(CustomerAppointment appointment) async {
    final now = DateTime.now();
    if (!_canCustomerCompleteAppointment(appointment, now)) {
      _showLoadError(
        _appointmentCompletionHint(appointment, now) ??
            'A conclusao so libera 3 minutos apos o horario marcado.',
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        final planWarning = appointment.isMembershipPlanAppointment
            ? ' Como este horario veio de plano, essa sessao tambem sera fechada.'
            : '';
        return AlertDialog(
          title: const Text('Concluir atendimento?'),
          content: Text(
            'Confirme apenas quando o atendimento realmente terminou.$planWarning',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Agora nao'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Concluir'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await widget.bookingRepository.completeAppointment(
        appointmentId: appointment.id,
      );
      if (!mounted) {
        return;
      }
      await _bootstrap();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Atendimento concluido no app com sucesso.'),
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _formatAgendaError(
              error,
              fallback: 'Nao foi possivel concluir esse atendimento agora.',
            ),
          ),
        ),
      );
    }
  }

  Future<void> _archiveAppointment(CustomerAppointment appointment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Remover do app?'),
          content: const Text(
            'Esse item sai da sua agenda, mas continua preservado para o salao acompanhar o atendimento.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Remover'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await widget.bookingRepository.archiveAppointment(
        appointmentId: appointment.id,
      );
      if (!mounted) {
        return;
      }
      _removeAppointmentsFromState({appointment.id});
      await _bootstrap();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Item removido do historico do app.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      if (_isAppointmentNotFoundError(error)) {
        _removeAppointmentsFromState({appointment.id});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Item antigo removido do historico do app.'),
          ),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _formatAgendaError(
              error,
              fallback: 'Nao foi possivel remover esse item agora.',
            ),
          ),
        ),
      );
    }
  }

  Future<void> _clearAppointmentHistory(
    List<CustomerAppointment> historyAppointments,
  ) async {
    if (historyAppointments.isEmpty) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Limpar historico?'),
          content: Text(
            historyAppointments.length == 1
                ? 'Esse atendimento sai do app. O salao ainda mantem o registro operacional.'
                : '${historyAppointments.length} atendimentos saem do app. O salao ainda mantem os registros operacionais.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Limpar historico'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    final historyIds = historyAppointments
        .map((appointment) => appointment.id)
        .toSet();

    try {
      await widget.bookingRepository.clearAppointmentHistory(
        appointmentIds: historyIds.toList(growable: false),
      );
      if (!mounted) {
        return;
      }
      _removeAppointmentsFromState(historyIds);
      await _bootstrap();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Historico removido do app.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      if (_isAppointmentNotFoundError(error)) {
        _removeAppointmentsFromState(historyIds);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Historico removido do app.')),
        );
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _formatAgendaError(
              error,
              fallback: 'Nao foi possivel limpar o historico agora.',
            ),
          ),
        ),
      );
    }
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
                    content: Text('Pagamento informado para o salao.'),
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
                salonBottomActionInset(context),
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
                          ? 'Seu horario ja foi criado. Falta concluir o sinal para segurar a vaga.'
                          : 'Tudo alinhado logo apos o encaixe do horario.',
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
                              '${preview.bookingPixRecipientName ?? 'Favorecido'} • ${preview.bookingPixRecipientCity ?? 'Cidade nao informada'}',
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: referenceController,
                          decoration: const InputDecoration(
                            labelText: 'Comprovante ou observacao',
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
                              label: 'Ja paguei',
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
                            labelText: 'Referencia do pagamento',
                            hintText: 'Ex.: codigo do checkout',
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
                              label: 'Ja conclui pagamento',
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
                                ? 'Cobranca gerada.'
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
                                label: 'Copiar codigo Pix',
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
                                        'Codigo Pix copiado com sucesso.',
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
                                label: 'Abrir cobranca',
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
                          'O salao vai orientar a validacao manual desse sinal.',
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
                                ? 'Pagamento ja informado via ${appointment.depositReportedPaidVia}. O salao vai validar o sinal e manter a reserva protegida.'
                                : 'Pagamento ja informado ao salao. Falta apenas a validacao final do sinal.',
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
        'Copie a chave Pix do salao, conclua o pagamento e marque como pago logo abaixo.',
      'external_checkout' =>
        'Abra o checkout do salao, conclua o pagamento e volte para acompanhar o sinal.',
      'asaas_pix' =>
        'Gere o Pix do sinal agora. Assim que o pagamento entrar, o status atualiza para o salao.',
      _ => 'O salao vai orientar a melhor forma de validar seu sinal.',
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
}
