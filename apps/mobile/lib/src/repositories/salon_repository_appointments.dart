part of 'salon_repository.dart';

mixin _SalonRepositoryAppointmentsMixin on _SalonRepositoryBase {
  Future<List<AppointmentItem>> getAppointments() async {
    try {
      final data = await client
          .from('appointments')
          .select(
            'id, date, ends_at, status, completed_at, cancelled_at, cancelled_by, cancellation_reason, customer_confirmation_requested_at, customer_presence_confirmed_at, services(name, price, duration), staff_members(name)',
          )
          .order('date', ascending: false);

      return (data as List)
          .map(
            (item) =>
                AppointmentItem.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (!message.contains('cancelled_at') &&
          !message.contains('cancelled_by') &&
          !message.contains('cancellation_reason') &&
          !message.contains('completed_at') &&
          !message.contains('customer_confirmation_requested_at') &&
          !message.contains('customer_presence_confirmed_at')) {
        rethrow;
      }

      final legacyData = await client
          .from('appointments')
          .select(
            'id, date, ends_at, status, services(name, price, duration), staff_members(name)',
          )
          .order('date', ascending: false);

      return (legacyData as List)
          .map(
            (item) =>
                AppointmentItem.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList();
    }
  }

  Future<List<VacancyAlert>> getVacancyAlerts() async {
    try {
      final data = await client
          .from('salon_vacancy_alerts')
          .select(
            'id, service_id, staff_member_id, headline, body, starts_at, ends_at, created_at, created_by',
          )
          .gte('ends_at', DateTime.now().toUtc().toIso8601String())
          .order('created_at', ascending: false)
          .limit(6);

      return (data as List)
          .map(
            (item) =>
                VacancyAlert.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList();
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_vacancy_alerts')) {
        return const [];
      }
      rethrow;
    }
  }

  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final data = await client.rpc(
      'get_day_availability',
      params: {
        'service_uuid': serviceId,
        'target_day': DateFormat('yyyy-MM-dd').format(day),
      },
    );

    return DayAvailability.fromMap(Map<String, dynamic>.from(data as Map));
  }

  Future<SmartScheduleOpportunityFeed?> getSmartScheduleOpportunities({
    DateTime? targetDay,
  }) async {
    try {
      final data = await client.rpc(
        'get_smart_schedule_opportunities',
        params: {
          'target_day': targetDay == null
              ? null
              : DateFormat('yyyy-MM-dd').format(targetDay),
        },
      );

      if (data == null) {
        return null;
      }

      return SmartScheduleOpportunityFeed.fromMap(
        Map<String, dynamic>.from(data as Map),
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_smart_schedule_opportunities') ||
          message.contains('staff_service_assignments') ||
          message.contains('staff_business_hours')) {
        return null;
      }
      rethrow;
    }
  }

  Future<void> createAppointment({
    required String serviceId,
    required DateTime startAt,
    String? preferredStaffMemberId,
  }) async {
    await client.rpc(
      'create_appointment',
      params: {
        'service_uuid': serviceId,
        'requested_date': startAt.toUtc().toIso8601String(),
        'preferred_staff_member_uuid': preferredStaffMemberId,
      },
    );
  }

  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
  }) async {
    await client.rpc(
      'cancel_appointment',
      params: {
        'appointment_uuid': appointmentId,
        'cancellation_reason_input': reason.trim(),
      },
    );
  }

  Future<void> confirmUpcomingAppointmentPresence({
    required String appointmentId,
  }) async {
    await client.rpc(
      'confirm_upcoming_appointment_presence',
      params: {'appointment_uuid': appointmentId},
    );
  }

  Future<void> claimVacancyAlert({required String alertId}) async {
    await client.rpc(
      'claim_vacancy_alert',
      params: {'vacancy_alert_uuid': alertId},
    );
  }
}
