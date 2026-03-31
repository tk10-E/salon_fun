part of 'home_screen.dart';

mixin _HomeScreenActionsMixin on _HomeScreenStateBase {
  Future<void> _toggleFavoriteService(ServiceItem service) async {
    if (_busyFavoriteServiceIds.contains(service.id)) {
      return;
    }

    final currentData = _cachedData;
    final isFavorite =
        currentData?.favoriteServiceIds.contains(service.id) ?? false;

    setState(() => _busyFavoriteServiceIds.add(service.id));

    try {
      await widget.repository.toggleFavoriteService(
        serviceId: service.id,
        isFavorite: !isFavorite,
      );

      _replaceCachedData((current) {
        final updatedIds = <String>{...current.favoriteServiceIds};
        if (isFavorite) {
          updatedIds.remove(service.id);
        } else {
          updatedIds.add(service.id);
        }

        return current.copyWith(favoriteServiceIds: updatedIds);
      });

      if (mounted) {
        _showMessage(
          isFavorite
              ? '${service.name} saiu dos seus favoritos.'
              : '${service.name} foi salvo nos seus favoritos.',
        );
      }
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      final raw = error.message.toLowerCase();
      final message = raw.contains('customer_favorite_services')
          ? 'Os favoritos ainda não estão disponíveis agora.'
          : 'Não foi possível atualizar seus favoritos agora.';
      _showMessage(message);
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível atualizar seus favoritos agora.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyFavoriteServiceIds.remove(service.id));
      }
    }
  }

  void _showBookingCreated(BookAppointmentResult result, [HomeData? data]) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.message),
        action: result.canOpenWhatsApp
            ? SnackBarAction(label: 'WhatsApp', onPressed: _openWhatsApp)
            : result.canOpenWallet
            ? SnackBarAction(
                label: 'Carteira',
                onPressed: () {
                  _openBenefitsWallet(data);
                },
              )
            : null,
      ),
    );
  }

  Future<void> _openBooking(ServiceItem service, [HomeData? data]) async {
    final result = await Navigator.of(context).push<BookAppointmentResult>(
      SalonPageRoute(
        builder: (_) => PremiumBookingScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
          initialLoyaltySummary: data?.loyaltySummary,
          activeOffers: data?.offers ?? const [],
        ),
      ),
    );

    if (result != null) {
      if (!mounted) {
        return;
      }

      _showBookingCreated(result, data);
      _refreshDataInBackground();
    }
  }

  Future<void> _openSuggestedBooking(
    ServiceItem service,
    SmartScheduleSuggestionItem suggestion, [
    HomeData? data,
  ]) async {
    final result = await Navigator.of(context).push<BookAppointmentResult>(
      SalonPageRoute(
        builder: (_) => PremiumBookingScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
          initialLoyaltySummary: data?.loyaltySummary,
          activeOffers: data?.offers ?? const [],
          initialDay: suggestion.suggestedStart,
          initialSlot: suggestion.suggestedStart,
          initialStaffMemberId: suggestion.staffMemberId,
          entryMessage: suggestion.headline,
        ),
      ),
    );

    if (result != null) {
      if (!mounted) {
        return;
      }

      _showBookingCreated(result, data);
      _refreshDataInBackground();
    }
  }

  Future<void> _openGrowthSuggestion(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion, [
    HomeData? data,
  ]) async {
    final recommendedDate = suggestion.recommendedBookingDate;
    final now = DateTime.now();
    final normalizedInitialDay = recommendedDate == null
        ? null
        : DateTime(
            recommendedDate.year,
            recommendedDate.month,
            recommendedDate.day,
          ).isBefore(DateTime(now.year, now.month, now.day))
        ? DateTime(now.year, now.month, now.day)
        : DateTime(
            recommendedDate.year,
            recommendedDate.month,
            recommendedDate.day,
          );

    final result = await Navigator.of(context).push<BookAppointmentResult>(
      SalonPageRoute(
        builder: (_) => PremiumBookingScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
          initialLoyaltySummary: data?.loyaltySummary,
          activeOffers: data?.offers ?? const [],
          initialDay: normalizedInitialDay,
          entryMessage: suggestion.hasIncentive
              ? 'Reativar sua frequência com esse serviço'
              : suggestion.isHabitBased
              ? 'Rebook inteligente baseado no seu horário de costume'
              : suggestion.isCombo
              ? 'Sugestão de combo para sua próxima visita'
              : 'Sugestão automática para você não perder o melhor momento',
        ),
      ),
    );

    if (result != null) {
      if (!mounted) {
        return;
      }

      _showBookingCreated(result, data);
      _refreshDataInBackground();
    }
  }

  Future<void> _claimVacancyAlert(VacancyAlert alert) async {
    if (_busyVacancyAlertIds.contains(alert.id) ||
        _bookedVacancyAlertIds.contains(alert.id)) {
      return;
    }

    setState(() => _busyVacancyAlertIds.add(alert.id));

    try {
      await widget.repository.claimVacancyAlert(alertId: alert.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _busyVacancyAlertIds.remove(alert.id);
        _bookedVacancyAlertIds.remove(alert.id);
      });
      _removeVacancyAlertLocally(alert.id);

      _showMessage('Horário marcado com sucesso.');
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _busyVacancyAlertIds.remove(alert.id));

      final raw = error.message.toLowerCase();
      if (raw.contains('vacancy_alert_not_found') ||
          raw.contains('vacancy_alert_not_available') ||
          raw.contains('time_slot_unavailable')) {
        _showMessage('Essa vaga acabou de ser ocupada.');
        _refreshDataInBackground();
        return;
      }

      if (raw.contains('customer_not_linked') ||
          raw.contains('unauthenticated')) {
        _showMessage('Entre novamente no app para reservar essa vaga.');
        return;
      }

      _showMessage('Não foi possível marcar essa vaga agora.');
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _busyVacancyAlertIds.remove(alert.id));
      _showMessage('Não foi possível marcar essa vaga agora.');
    }
  }

  Future<void> _cancelAppointment(AppointmentItem appointment) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) =>
          CancelAppointmentSheet(serviceName: appointment.serviceName),
    );

    if (reason == null || reason.trim().isEmpty) {
      return;
    }

    try {
      await widget.repository.cancelAppointment(
        appointmentId: appointment.id,
        reason: reason,
      );
      _suppressRealtimeVacancyNotice = true;
      unawaited(
        Future<void>.delayed(const Duration(seconds: 3)).then((_) {
          _suppressRealtimeVacancyNotice = false;
        }),
      );
      _updateAppointmentLocally(
        appointment.id,
        (current) => current.copyWith(
          status: 'cancelled',
          cancelledAt: DateTime.now(),
          cancelledBy: 'salon',
          cancellationReason: reason,
          clearCompletedAt: true,
        ),
      );
      if (mounted) {
        _showMessage(
          'Horário desmarcado com sucesso. O salão recebeu o motivo do cancelamento.',
        );
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      final raw = error.message;
      if (raw.contains('cancellation_reason_required')) {
        _showMessage('Informe o motivo para concluir o cancelamento.');
        return;
      }
      if (raw.contains('appointment_already_cancelled')) {
        _showMessage('Esse horário já foi cancelado.');
        _refreshDataInBackground();
        return;
      }
      if (raw.contains('appointment_already_completed')) {
        _showMessage('Esse atendimento já foi concluído pelo salão.');
        _refreshDataInBackground();
        return;
      }
      if (raw.contains('past_appointment_cannot_be_cancelled')) {
        _showMessage(
          'Esse horário já passou e não pode mais ser cancelado pelo app.',
        );
        _refreshDataInBackground();
        return;
      }

      _showMessage('Não foi possível desmarcar esse horário agora.');
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível desmarcar esse horário agora.');
      }
    }
  }

  Future<void> _confirmAppointmentPresence(AppointmentItem appointment) async {
    try {
      await widget.repository.confirmUpcomingAppointmentPresence(
        appointmentId: appointment.id,
      );
      _updateAppointmentLocally(
        appointment.id,
        (current) =>
            current.copyWith(customerPresenceConfirmedAt: DateTime.now()),
      );
      if (mounted) {
        _showMessage('Presença confirmada com sucesso.');
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      final raw = error.message.toLowerCase();
      final message = raw.contains('confirmation_not_requested')
          ? 'A confirmação ainda não foi liberada para esse horário.'
          : raw.contains('appointment_already_started')
          ? 'Esse atendimento já começou.'
          : raw.contains('appointment_not_confirmed')
          ? 'Esse horário ainda não foi confirmado pelo salão.'
          : raw.contains('appointment_not_found')
          ? 'Esse horário não foi encontrado.'
          : 'Não foi possível confirmar sua presença agora.';

      _showMessage(message);
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível confirmar sua presença agora.');
      }
    }
  }

  Future<void> _signOut() async {
    await _pushTokenSyncService.deactivateCurrentToken();
    await widget.repository.signOut();
  }

  Future<void> _openBenefitsWallet([HomeData? data]) async {
    await Navigator.of(context).push(
      SalonPageRoute<void>(
        builder: (_) => BenefitsWalletScreen(
          repository: widget.repository,
          profile: _profile,
          initialLoyaltySummary: data?.loyaltySummary,
          initialReferralSummary: data?.referralSummary,
        ),
      ),
    );
  }

  Future<void> _openProfile([HomeData? data]) async {
    await Navigator.of(context).push(
      SalonPageRoute<void>(
        builder: (_) => PremiumClientProfileScreen(
          repository: widget.repository,
          profile: _profile,
          userEmail: widget.repository.currentUser?.email,
          initialLoyaltySummary: data?.loyaltySummary,
          initialReferralSummary: data?.referralSummary,
          initialAppointments: data?.appointments ?? const [],
          initialServices: data?.services ?? const [],
          initialFavoriteServiceIds:
              data?.favoriteServiceIds ?? const <String>{},
          onSignOut: _signOut,
          onWhatsApp: _openWhatsApp,
          onProfileChanged: (updatedProfile) {
            if (!mounted) {
              return;
            }

            setState(() => _profile = updatedProfile);
            widget.onActiveProfileChanged?.call(updatedProfile);
          },
        ),
      ),
    );
  }

  Future<void> _openSalonProfile([HomeData? data]) async {
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
      businessSegment: _profile.salonBusinessSegment,
      clientAppConfig: _profile.salonClientAppConfig,
    );

    await Navigator.of(context).push(
      SalonPageRoute<void>(
        builder: (_) => PremiumSalonProfileScreen(
          profile: _profile,
          branding: branding,
          services: data?.services ?? const <ServiceItem>[],
          posts: data?.posts ?? const <SalonPost>[],
          offers: data?.offers ?? const <SalonOfferItem>[],
          onBookService: (service) => _openBooking(service, data),
          onWhatsApp: _openWhatsApp,
        ),
      ),
    );
  }

  Future<void> _handleAccountMenuSelection(
    _AccountMenuAction action, [
    HomeData? data,
  ]) async {
    switch (action) {
      case _AccountMenuAction.profile:
        await _openProfile(data);
        return;
      case _AccountMenuAction.wallet:
        await _openBenefitsWallet(data);
        return;
      case _AccountMenuAction.signOut:
        await _signOut();
        return;
    }
  }

  Future<void> _openNotificationsCenter(
    List<CustomerNotificationItem> notifications,
  ) async {
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
      businessSegment: _profile.salonBusinessSegment,
      clientAppConfig: _profile.salonClientAppConfig,
    );

    await Navigator.of(context).push(
      SalonPageRoute<void>(
        builder: (_) => PremiumNotificationsScreen(
          branding: branding,
          notifications: notifications,
          onArchiveNotifications: widget.repository.archiveNotifications,
        ),
      ),
    );

    final unreadItems = notifications.where((item) => !item.isRead).toList();
    try {
      if (unreadItems.isNotEmpty) {
        await widget.repository.markNotificationsRead(unreadItems);
        _markNotificationsReadLocally(unreadItems.map((item) => item.readKey));
      }

      if (mounted) {
        _refreshDataInBackground();
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível atualizar o status das notificações.');
      }
    }
  }

  Future<void> _copyReferralCode(String code) async {
    if (code.trim().isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) {
      return;
    }

    _showMessage('Código de indicação copiado.');
  }

  Future<void> _openPostVideo(SalonPost post) async {
    final videoUrl = post.videoUrl;
    if (videoUrl == null || videoUrl.trim().isEmpty) {
      return;
    }

    final launched = await launchUrl(
      Uri.parse(videoUrl),
      mode: LaunchMode.platformDefault,
    );

    if (!launched && mounted) {
      _showMessage(
        'Não foi possível abrir o video de ${post.title} agora. Tente novamente em instantes.',
      );
    }
  }

  Future<void> _openWhatsApp() async {
    final whatsappDigits = _profile.salonWhatsappPhone?.replaceAll(
      RegExp(r'\D'),
      '',
    );

    if (whatsappDigits == null || whatsappDigits.length < 10) {
      _showWhatsAppFallback();
      return;
    }

    final message = Uri.encodeComponent(
      'Olá, quero agendar com ${_profile.salonName}.',
    );
    final uri = Uri.parse('https://wa.me/$whatsappDigits?text=$message');
    final launched = await launchUrl(uri, mode: LaunchMode.platformDefault);

    if (!launched && mounted) {
      _showWhatsAppFallback(
        'Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.',
      );
    }
  }
}
