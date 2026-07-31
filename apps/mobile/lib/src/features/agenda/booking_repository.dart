import 'dart:convert';

import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/network/network_guard.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../shared/app_models.dart';
import '../shared/storage_asset_urls.dart';

class _RemoteAppointmentReview {
  const _RemoteAppointmentReview({
    required this.appointmentId,
    required this.comment,
    required this.createdAt,
    required this.rating,
    required this.updatedAt,
  });

  factory _RemoteAppointmentReview.fromJson(Map<String, dynamic> map) {
    return _RemoteAppointmentReview(
      appointmentId: stringValue(map['appointmentId']),
      comment: stringOrNull(map['comment']),
      createdAt: dateTimeValue(map['createdAt']) ?? DateTime.now(),
      rating: intValue(map['rating']),
      updatedAt:
          dateTimeOrNull(map['updatedAt']) ??
          dateTimeValue(map['createdAt']) ??
          DateTime.now(),
    );
  }

  final String appointmentId;
  final String? comment;
  final DateTime createdAt;
  final int rating;
  final DateTime updatedAt;
}

class _RemoteAppointmentPlanReservation {
  const _RemoteAppointmentPlanReservation({
    required this.appointmentId,
    required this.membershipId,
    required this.membershipTitle,
    required this.reservationStatus,
    required this.serviceId,
    required this.membershipExpiresAt,
    required this.membershipStartedAt,
    required this.sessionIndex,
    required this.sessionsIncluded,
  });

  factory _RemoteAppointmentPlanReservation.fromJson(Map<String, dynamic> map) {
    return _RemoteAppointmentPlanReservation(
      appointmentId: stringValue(map['appointmentId']),
      membershipId: stringValue(map['membershipId']),
      membershipTitle:
          stringOrNull(map['membershipTitle']) ?? 'Plano mensal do app',
      reservationStatus: stringOrNull(map['reservationStatus']) ?? 'scheduled',
      serviceId: stringValue(map['serviceId']),
      membershipExpiresAt: dateTimeOrNull(map['membershipExpiresAt']),
      membershipStartedAt: dateTimeOrNull(map['membershipStartedAt']),
      sessionIndex: intOrNull(map['sessionIndex']),
      sessionsIncluded: intOrNull(map['sessionsIncluded']),
    );
  }

  final String appointmentId;
  final String membershipId;
  final String membershipTitle;
  final String reservationStatus;
  final String serviceId;
  final DateTime? membershipExpiresAt;
  final DateTime? membershipStartedAt;
  final int? sessionIndex;
  final int? sessionsIncluded;
}

class MembershipPlanScheduledAppointment {
  const MembershipPlanScheduledAppointment({
    required this.appointmentId,
    required this.membershipExpiresAt,
    required this.membershipId,
    required this.membershipTitle,
    required this.sessionIndex,
    required this.sessionsIncluded,
    required this.staffMemberId,
    required this.startsAt,
    required this.status,
  });

  factory MembershipPlanScheduledAppointment.fromJson(
    Map<String, dynamic> map,
  ) {
    return MembershipPlanScheduledAppointment(
      appointmentId: stringValue(map['appointmentId']),
      membershipExpiresAt: dateTimeOrNull(map['membershipExpiresAt']),
      membershipId: stringOrNull(map['membershipId']),
      membershipTitle: stringOrNull(map['membershipTitle']),
      sessionIndex: intOrNull(map['sessionIndex']),
      sessionsIncluded: intOrNull(map['sessionsIncluded']),
      staffMemberId: stringOrNull(map['staffMemberId']),
      startsAt: dateTimeOrNull(map['startsAt']),
      status: stringOrNull(map['status']) ?? 'confirmed',
    );
  }

  final String appointmentId;
  final DateTime? membershipExpiresAt;
  final String? membershipId;
  final String? membershipTitle;
  final int? sessionIndex;
  final int? sessionsIncluded;
  final String? staffMemberId;
  final DateTime? startsAt;
  final String status;
}

class MembershipPlanScheduleResult {
  const MembershipPlanScheduleResult({
    required this.createdAppointments,
    required this.membershipId,
    required this.membershipTitle,
    required this.membershipExpiresAt,
    required this.scheduledCount,
    required this.sessionsIncluded,
    required this.skippedCount,
  });

  factory MembershipPlanScheduleResult.fromJson(Map<String, dynamic> map) {
    return MembershipPlanScheduleResult(
      createdAppointments: jsonMapList(map['createdAppointments'])
          .map(MembershipPlanScheduledAppointment.fromJson)
          .toList(growable: false),
      membershipId: stringValue(map['membershipId']),
      membershipTitle:
          stringOrNull(map['membershipTitle']) ?? 'Plano mensal do app',
      membershipExpiresAt: dateTimeOrNull(map['membershipExpiresAt']),
      scheduledCount: intValue(map['scheduledCount']),
      sessionsIncluded: intValue(map['sessionsIncluded']),
      skippedCount: intValue(map['skippedCount']),
    );
  }

  final List<MembershipPlanScheduledAppointment> createdAppointments;
  final String membershipId;
  final String membershipTitle;
  final DateTime? membershipExpiresAt;
  final int scheduledCount;
  final int sessionsIncluded;
  final int skippedCount;

  List<String> get createdAppointmentIds {
    return createdAppointments
        .map((appointment) => appointment.appointmentId)
        .where((appointmentId) => appointmentId.trim().isNotEmpty)
        .toList(growable: false);
  }
}

String _normalizeBaseUrl(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) {
    return '';
  }

  return normalized.endsWith('/')
      ? normalized.substring(0, normalized.length - 1)
      : normalized;
}

class BookingRepository {
  BookingRepository({
    required this.client,
    http.Client? httpClient,
    String? publicWebBaseUrl,
    Future<bool> Function()? restoreSession,
    Future<SharedPreferences> Function()? prefsLoader,
  }) : _restoreSession = restoreSession,
       _httpClient = httpClient ?? http.Client(),
       _prefsLoader = prefsLoader ?? SharedPreferences.getInstance,
       _publicWebBaseUrl = _normalizeBaseUrl(publicWebBaseUrl);

  final SupabaseClient? client;
  final http.Client _httpClient;
  final String _publicWebBaseUrl;
  final Future<bool> Function()? _restoreSession;
  final Future<SharedPreferences> Function() _prefsLoader;
  Future<void>? _restoreSessionInFlight;
  final SnapshotReadCache _cache = SnapshotReadCache();
  final Map<String, String?> _staffImagePathCache = <String, String?>{};
  final Map<String, _RemoteAppointmentPlanReservation>
  _optimisticAppointmentPlanReservations =
      <String, _RemoteAppointmentPlanReservation>{};
  static const _expiredSessionMessage =
      'Sua sessão do app expirou. Entre novamente para carregar a agenda.';
  static const _locallyArchivedAppointmentIdsKeyPrefix =
      'agenda.locally_archived_history_appointment_ids.v1.';
  static const _systemPlanCompensationCancellationReason =
      'Programacao automatica do plano revertida pelo sistema.';
  static const _servicesCacheKey = 'agenda:services';
  static const _appointmentsCacheKey = 'agenda:appointments';
  static const _servicesCacheTtl = Duration(minutes: 5);
  static const _appointmentsCacheTtl = Duration(seconds: 15);
  static const _membershipPlansCacheTtl = Duration(seconds: 20);

  Future<List<ServiceOption>> fetchServices() async {
    final safeClient = await _ensureAuthenticatedClient();
    if (safeClient == null) {
      return const [];
    }

    return _cache.read<List<ServiceOption>>(
      key: _servicesCacheKey,
      ttl: _servicesCacheTtl,
      loader: () async {
        final response = await runGuardedRead<dynamic>(
          () => safeClient
              .from('services')
              .select('id, name, description, duration, price, image_path')
              .eq('is_active', true)
              .order('name'),
        );

        return (response as List<dynamic>).map((entry) => jsonMap(entry)).map((
          map,
        ) {
          final imagePath = stringOrNull(map['image_path']);
          return ServiceOption(
            id: stringValue(map['id']),
            name: stringValue(map['name']),
            description: stringOrNull(map['description']),
            durationMinutes: intValue(map['duration']),
            price: doubleValue(map['price']),
            imageUrl: resolvePublicStorageAssetUrl(
              safeClient,
              bucket: 'salon-assets',
              assetPath: imagePath,
            ),
          );
        }).toList(growable: false);
      },
    );
  }

  Future<DayAvailability?> fetchDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final safeClient = await _ensureAuthenticatedClient();
    if (safeClient == null) {
      return null;
    }

    final data = await runGuardedRead<dynamic>(
      () => safeClient.rpc(
        'get_day_availability',
        params: <String, dynamic>{
          'service_uuid': serviceId,
          'target_day': DateFormat('yyyy-MM-dd').format(day),
        },
      ),
    );

    final availabilityData = jsonMap(data);
    final staffIds = <String>{
      for (final entry in jsonMapList(availabilityData['staff_members']))
        stringValue(entry['id']),
      for (final entry in jsonMapList(availabilityData['available_slots']))
        stringValue(entry['staff_member_id']),
    };
    final imagePathsByStaffId = await _fetchStaffImagePaths(
      safeClient,
      staffIds: staffIds,
    );

    return DayAvailability.fromJson(
      _withAvailabilityMediaUrls(
        availabilityData,
        imagePathsByStaffId,
        safeClient,
      ),
    );
  }

  Future<List<CustomerAppointment>> fetchAppointments() async {
    final safeClient = await _ensureAuthenticatedClient();
    if (safeClient == null) {
      return const [];
    }

    try {
      return _cache.read<List<CustomerAppointment>>(
        key: _appointmentsCacheKey,
        ttl: _appointmentsCacheTtl,
        loader: () async {
          final response = await runGuardedRead<dynamic>(
            () => _fetchAppointmentsResponse(
              safeClient,
              filterArchivedHistory: true,
            ),
          );

          final appointments = await _hydrateRemoteAppointmentPlanReservations(
            await _hydrateRemoteAppointmentReviews(
              _mapAppointmentsResponse(response, safeClient),
              safeClient,
            ),
            safeClient,
          );
          return _filterLocallyArchivedAppointments(
            _applyOptimisticAppointmentPlanReservations(appointments),
            safeClient,
          );
        },
      );
    } on PostgrestException catch (error) {
      if (!_isMissingCustomerArchiveColumnError(error) &&
          !_isMissingStaffImagePathColumnError(error) &&
          !_isMissingPaymentPreferenceColumnError(error) &&
          !_isMissingAppointmentReviewRelationError(error)) {
        rethrow;
      }

      return _cache.read<List<CustomerAppointment>>(
        key: _appointmentsCacheKey,
        ttl: _appointmentsCacheTtl,
        loader: () async {
          final legacyResponse = await runGuardedRead<dynamic>(
            () => _fetchAppointmentsResponse(
              safeClient,
              filterArchivedHistory: !_isMissingCustomerArchiveColumnError(
                error,
              ),
              includeStaffImage: !_isMissingStaffImagePathColumnError(error),
              includePaymentPreference:
                  !_isMissingPaymentPreferenceColumnError(error),
              includeReviews: !_isMissingAppointmentReviewRelationError(error),
            ),
          );
          final appointments =
              await _hydrateRemoteAppointmentPlanReservations(
                await _hydrateRemoteAppointmentReviews(
                  _mapAppointmentsResponse(legacyResponse, safeClient),
                  safeClient,
                ),
                safeClient,
              );
          return _filterLocallyArchivedAppointments(
            _applyOptimisticAppointmentPlanReservations(appointments),
            safeClient,
          );
        },
      );
    }
  }

  Future<List<CustomerMembershipPlan>> fetchMembershipPlans({
    required String customerId,
  }) async {
    final safeClient = await _ensureAuthenticatedClient();
    if (safeClient == null) {
      return const <CustomerMembershipPlan>[];
    }

    final normalizedCustomerId = customerId.trim();
    return _cache.read<List<CustomerMembershipPlan>>(
      key: 'agenda:membershipPlans:$normalizedCustomerId',
      ttl: _membershipPlansCacheTtl,
      loader: () async {
        final response = await runGuardedRead<dynamic>(
          () => safeClient
              .from('customer_memberships')
              .select(
                'id, offer_id, title, service_id, service_name_snapshot, status, sessions_included, sessions_used, started_at, expires_at, price_snapshot',
              )
              .eq('customer_id', customerId)
              .order('expires_at'),
        );

        return (response as List<dynamic>)
            .map((entry) => CustomerMembershipPlan.fromJson(jsonMap(entry)))
            .toList(growable: false);
      },
    );
  }

  Future<CustomerAppointment> createAppointment({
    required ServiceOption service,
    required AppointmentSlot slot,
    String? paymentPreference,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();
    final normalizedPaymentPreference = paymentPreference?.trim();
    dynamic data = await _createAppointmentThroughPublicApi(
      safeClient,
      paymentPreference: normalizedPaymentPreference,
      service: service,
      slot: slot,
    );

    if (data == null) {
      try {
        data = await runGuardedWrite<dynamic>(
          () => safeClient.rpc(
            'create_appointment',
            params: <String, dynamic>{
              'service_uuid': service.id,
              'requested_date': slot.startAt.toUtc().toIso8601String(),
              'preferred_staff_member_uuid': slot.staffMemberId,
              'payment_preference_input': normalizedPaymentPreference,
            },
          ),
        );
      } on PostgrestException catch (error) {
        if (!_isLegacyCreateAppointmentRoutineError(error)) {
          throw Exception(_formatCreateAppointmentError(error));
        }

        try {
          data = await runGuardedWrite<dynamic>(
            () => safeClient.rpc(
              'create_appointment',
              params: <String, dynamic>{
                'service_uuid': service.id,
                'requested_date': slot.startAt.toUtc().toIso8601String(),
                'preferred_staff_member_uuid': slot.staffMemberId,
              },
            ),
          );
        } on PostgrestException catch (legacyError) {
          throw Exception(_formatCreateAppointmentError(legacyError));
        }
      }
    }

    final created = jsonMap(data);
    _invalidateAgendaReadCache();
    return CustomerAppointment(
      id: stringValue(created['id']),
      date: dateTimeValue(created['date']) ?? slot.startAt,
      endsAt: dateTimeOrNull(created['ends_at']) ?? slot.endsAt,
      status: stringOrNull(created['status']) ?? 'confirmed',
      paymentPreference:
          stringOrNull(created['payment_preference']) ??
          normalizedPaymentPreference,
      depositAmount: doubleValue(created['deposit_amount']),
      depositStatus: stringOrNull(created['deposit_status']) ?? 'not_required',
      depositReportedPaidAt: dateTimeOrNull(
        created['deposit_customer_reported_paid_at'],
      ),
      depositReportedPaidVia: stringOrNull(
        created['deposit_customer_reported_paid_via'],
      ),
      bookingPolicySnapshot: stringOrNull(created['booking_policy_snapshot']),
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      serviceImageUrl: service.imageUrl,
      staffMemberId: slot.staffMemberId,
      staffName: slot.staffMemberName,
      staffRole: null,
      staffImageUrl: slot.staffMemberImageUrl,
      presenceConfirmedAt: dateTimeOrNull(
        created['customer_presence_confirmed_at'],
      ),
      depositPaymentProvider: stringOrNull(created['deposit_payment_provider']),
      depositPaymentProviderChargeId: stringOrNull(
        created['deposit_payment_provider_charge_id'],
      ),
      depositPaymentProviderStatus: stringOrNull(
        created['deposit_payment_provider_status'],
      ),
      depositPaymentProviderInvoiceUrl: stringOrNull(
        created['deposit_payment_provider_invoice_url'],
      ),
      depositPaymentProviderPayload: stringOrNull(
        created['deposit_payment_provider_payload'],
      ),
      depositPaymentProviderError: stringOrNull(
        created['deposit_payment_provider_error'],
      ),
      reviewRating: null,
      reviewComment: null,
      reviewCreatedAt: null,
      reviewUpdatedAt: null,
      membershipPlanId: null,
      membershipPlanTitle: null,
      membershipPlanReservationStatus: null,
      membershipSessionIndex: null,
      membershipSessionsIncluded: null,
      membershipPlanExpiresAt: null,
    );
  }

  Future<Map<String, dynamic>?> _createAppointmentThroughPublicApi(
    SupabaseClient safeClient, {
    required String? paymentPreference,
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    final uri = _buildPublicCustomerAppointmentUri();
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();

    if (uri == null || accessToken == null || accessToken.isEmpty) {
      return null;
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{
          'paymentPreference': paymentPreference,
          'preferredStaffMemberId': slot.staffMemberId,
          'requestedDate': slot.startAt.toUtc().toIso8601String(),
          'serviceId': service.id,
        }),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode == 404 || response.statusCode == 405) {
      return null;
    }

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      return jsonMap(payload['appointment']);
    }

    throw Exception(
      _formatPublicAppointmentCreateError(response.statusCode, payload),
    );
  }

  Future<MembershipPlanScheduleResult> scheduleMembershipPlan({
    required CustomerMembershipPlan membership,
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception(_expiredSessionMessage);
    }

    final uri = _buildPublicAppointmentPlanReservationUri();
    if (uri == null) {
      throw Exception('O plano mensal ainda nao foi ativado neste ambiente.');
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{
          'action': 'schedule_membership_plan',
          'membershipId': membership.id,
          'preferredStaffMemberId': slot.staffMemberId,
          'preferredStartAt': slot.startAt.toUtc().toIso8601String(),
          'serviceId': service.id,
        }),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      final result = MembershipPlanScheduleResult.fromJson(
        jsonMap(payload['result']),
      );
      _rememberOptimisticMembershipPlanReservations(
        membership: membership,
        result: result,
        serviceId: service.id,
      );
      _invalidateAgendaReadCache();
      return result;
    }

    throw Exception(
      _formatPublicAppointmentPlanError(response.statusCode, payload),
    );
  }

  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
    bool isMembershipPlanAppointment = false,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();

    if (isMembershipPlanAppointment) {
      await _cancelMembershipPlanAppointmentThroughPublicApi(
        safeClient,
        appointmentId: appointmentId,
        reason: reason,
      );
      _invalidateAgendaReadCache();
      return;
    }

    await runGuardedWrite<void>(
      () => safeClient.rpc(
        'cancel_appointment',
        params: <String, dynamic>{
          'appointment_uuid': appointmentId,
          'cancellation_reason_input': reason.trim(),
        },
      ),
    );
    _invalidateAgendaReadCache();
  }

  Future<void> completeAppointment({required String appointmentId}) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception(_expiredSessionMessage);
    }

    final uri = _buildPublicCustomerAppointmentStatusUri();
    if (uri == null) {
      throw Exception(
        'A conclusao do atendimento ainda nao foi ativada neste ambiente.',
      );
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{'appointmentId': appointmentId}),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      _invalidateAgendaReadCache();
      return;
    }

    throw Exception(
      _formatPublicAppointmentStatusError(response.statusCode, payload),
    );
  }

  Future<void> rescheduleAppointment({
    required CustomerAppointment appointment,
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception(_expiredSessionMessage);
    }

    final uri = _buildPublicCustomerAppointmentRescheduleUri();
    if (uri == null) {
      throw Exception(
        'A remarcacao do atendimento ainda nao foi ativada neste ambiente.',
      );
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{
          'appointmentId': appointment.id,
          'preferredStaffMemberId': slot.staffMemberId,
          'requestedDate': slot.startAt.toUtc().toIso8601String(),
          'serviceId': service.id,
        }),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      _invalidateAgendaReadCache();
      return;
    }

    throw Exception(
      _formatPublicAppointmentRescheduleError(response.statusCode, payload),
    );
  }

  Future<void> archiveAppointment({required String appointmentId}) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();

    try {
      await runGuardedWrite<void>(
        () => safeClient.rpc(
          'archive_customer_appointment',
          params: <String, dynamic>{'appointment_uuid': appointmentId},
        ),
      );
    } on PostgrestException catch (error) {
      if (_isAppointmentNotFoundError(error)) {
        await _markAppointmentArchivedLocally(safeClient, appointmentId);
        _invalidateAgendaReadCache();
        return;
      }
      if (_isMissingCustomerArchiveRoutineError(error)) {
        throw Exception(
          'O historico do app ainda nao foi ativado neste ambiente.',
        );
      }
      rethrow;
    }
    _invalidateAgendaReadCache();
  }

  Future<void> clearAppointmentHistory({
    required List<String> appointmentIds,
  }) async {
    final uniqueAppointmentIds = appointmentIds
        .map((appointmentId) => appointmentId.trim())
        .where((appointmentId) => appointmentId.isNotEmpty)
        .toSet()
        .toList(growable: false);

    if (uniqueAppointmentIds.isEmpty) {
      return;
    }

    for (final appointmentId in uniqueAppointmentIds) {
      await archiveAppointment(appointmentId: appointmentId);
    }
  }

  Future<void> submitAppointmentReview({
    required String appointmentId,
    required int rating,
    String? comment,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();
    final normalizedComment = comment?.trim().isEmpty == true
        ? null
        : comment?.trim();

    try {
      await runGuardedWrite<void>(
        () => safeClient.rpc(
          'submit_appointment_review',
          params: <String, dynamic>{
            'appointment_uuid': appointmentId,
            'rating_input': rating,
            'comment_input': normalizedComment,
          },
        ),
      );
    } on PostgrestException catch (error) {
      if (!_isMissingAppointmentReviewRoutineError(error)) {
        rethrow;
      }

      await _submitAppointmentReviewThroughPublicApi(
        safeClient,
        appointmentId: appointmentId,
        comment: normalizedComment,
        rating: rating,
      );
    }
    _invalidateAgendaReadCache();
  }

  Future<void> reportDepositPaid({
    required String appointmentId,
    required String paymentMethod,
    String? paymentReference,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();

    await runGuardedWrite<void>(
      () => safeClient.rpc(
        'report_appointment_deposit_paid',
        params: <String, dynamic>{
          'appointment_uuid': appointmentId,
          'payment_method_input': paymentMethod,
          'payment_reference_input': paymentReference?.trim(),
        },
      ),
    );
    _invalidateAgendaReadCache();
  }

  Future<AppointmentDepositCharge> createManagedDepositCharge({
    required String appointmentId,
    bool forceRefresh = false,
  }) async {
    final safeClient = await _requireConfiguredAuthenticatedClient();

    final response = await runGuardedWrite<dynamic>(
      () => safeClient.functions.invoke(
        'asaas-create-deposit-charge',
        body: <String, dynamic>{
          'appointment_id': appointmentId,
          'force_refresh': forceRefresh,
        },
      ),
    );
    final data = jsonMap(response.data);
    if (data['ok'] != true) {
      throw Exception(
        stringOrNull(data['detail']) ??
            stringOrNull(data['error']) ??
            'Não foi possível preparar o Pix do sinal.',
      );
    }

    _invalidateAgendaReadCache();
    return AppointmentDepositCharge.fromJson(data);
  }

  CustomerAppointment _mapAppointment(
    Map<String, dynamic> map,
    SupabaseClient safeClient,
  ) {
    final service = jsonMapOrNull(map['services']);
    final staff = jsonMapOrNull(map['staff_members']);
    final reviews = jsonMapList(map['appointment_reviews']);
    final review = reviews.isEmpty ? null : reviews.first;
    final imagePath = stringOrNull(service?['image_path']);
    final staffImagePath = stringOrNull(staff?['image_path']);
    return CustomerAppointment(
      id: stringValue(map['id']),
      date: dateTimeValue(map['date']) ?? DateTime.now(),
      endsAt: dateTimeOrNull(map['ends_at']),
      status: stringOrNull(map['status']) ?? 'pending',
      paymentPreference: stringOrNull(map['payment_preference']),
      depositAmount: doubleValue(map['deposit_amount']),
      depositStatus: stringOrNull(map['deposit_status']) ?? 'not_required',
      depositReportedPaidAt: dateTimeOrNull(
        map['deposit_customer_reported_paid_at'],
      ),
      depositReportedPaidVia: stringOrNull(
        map['deposit_customer_reported_paid_via'],
      ),
      bookingPolicySnapshot: stringOrNull(map['booking_policy_snapshot']),
      serviceId: stringOrNull(service?['id']),
      serviceName: stringOrNull(service?['name']) ?? 'Serviço',
      serviceDuration: intOrNull(service?['duration']),
      servicePrice: doubleOrNull(service?['price']),
      serviceImageUrl: _publicAssetUrl(
        safeClient,
        imagePath,
        width: 720,
        height: 720,
      ),
      staffMemberId: stringOrNull(staff?['id']),
      staffName: stringOrNull(staff?['name']),
      staffRole: stringOrNull(staff?['role']),
      staffImageUrl: _publicAssetUrl(
        safeClient,
        staffImagePath,
        width: 320,
        height: 320,
      ),
      presenceConfirmedAt: dateTimeOrNull(
        map['customer_presence_confirmed_at'],
      ),
      depositPaymentProvider: stringOrNull(map['deposit_payment_provider']),
      depositPaymentProviderChargeId: stringOrNull(
        map['deposit_payment_provider_charge_id'],
      ),
      depositPaymentProviderStatus: stringOrNull(
        map['deposit_payment_provider_status'],
      ),
      depositPaymentProviderInvoiceUrl: stringOrNull(
        map['deposit_payment_provider_invoice_url'],
      ),
      depositPaymentProviderPayload: stringOrNull(
        map['deposit_payment_provider_payload'],
      ),
      depositPaymentProviderError: stringOrNull(
        map['deposit_payment_provider_error'],
      ),
      reviewRating: intOrNull(review?['rating']),
      reviewComment: stringOrNull(review?['comment']),
      reviewCreatedAt: dateTimeOrNull(review?['created_at']),
      reviewUpdatedAt: dateTimeOrNull(review?['updated_at']),
      membershipPlanId: null,
      membershipPlanTitle: null,
      membershipPlanReservationStatus: null,
      membershipSessionIndex: null,
      membershipSessionsIncluded: null,
      membershipPlanExpiresAt: null,
    );
  }

  Future<dynamic> _fetchAppointmentsResponse(
    SupabaseClient safeClient, {
    required bool filterArchivedHistory,
    bool includeStaffImage = true,
    bool includePaymentPreference = true,
    bool includeReviews = true,
  }) {
    final staffSelect = includeStaffImage
        ? 'staff_members(id, name, role, image_path)'
        : 'staff_members(id, name, role)';
    final paymentPreferenceSelect = includePaymentPreference
        ? 'payment_preference, '
        : '';
    final reviewsSelect = includeReviews
        ? ', appointment_reviews(rating, comment, created_at, updated_at)'
        : '';
    final query = safeClient
        .from('appointments')
        .select(
          'id, date, ends_at, status, cancellation_reason, ${paymentPreferenceSelect}deposit_amount, deposit_status, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, booking_policy_snapshot, customer_presence_confirmed_at, deposit_payment_provider, deposit_payment_provider_charge_id, deposit_payment_provider_status, deposit_payment_provider_invoice_url, deposit_payment_provider_payload, deposit_payment_provider_error, services(id, name, duration, price, image_path), $staffSelect$reviewsSelect',
        );

    final filteredQuery = filterArchivedHistory
        ? query.isFilter('customer_archived_at', null)
        : query;

    return filteredQuery.order('date', ascending: false).limit(100);
  }

  List<CustomerAppointment> _mapAppointmentsResponse(
    dynamic response,
    SupabaseClient safeClient,
  ) {
    return (response as List<dynamic>)
        .map((entry) => jsonMap(entry))
        .where(
          (map) =>
              !(stringOrNull(map['status']) == 'cancelled' &&
                  stringOrNull(map['cancellation_reason']) ==
                      _systemPlanCompensationCancellationReason),
        )
        .map((map) => _mapAppointment(map, safeClient))
        .toList();
  }

  Future<List<CustomerAppointment>> _hydrateRemoteAppointmentReviews(
    List<CustomerAppointment> appointments,
    SupabaseClient safeClient,
  ) async {
    if (appointments.isEmpty || _publicWebBaseUrl.isEmpty) {
      return appointments;
    }

    try {
      final remoteReviews = await _fetchRemoteAppointmentReviews(
        safeClient,
        appointmentIds: appointments
            .map((appointment) => appointment.id)
            .toList(growable: false),
      );

      if (remoteReviews.isEmpty) {
        return appointments;
      }

      final remoteReviewsByAppointmentId = <String, _RemoteAppointmentReview>{
        for (final review in remoteReviews) review.appointmentId: review,
      };

      return appointments
          .map((appointment) {
            final remoteReview = remoteReviewsByAppointmentId[appointment.id];
            if (remoteReview == null) {
              return appointment;
            }

            final localTimestamp =
                appointment.reviewUpdatedAt ?? appointment.reviewCreatedAt;
            if (localTimestamp != null &&
                localTimestamp.isAfter(remoteReview.updatedAt)) {
              return appointment;
            }

            return _copyAppointmentWithRemoteReview(appointment, remoteReview);
          })
          .toList(growable: false);
    } catch (_) {
      return appointments;
    }
  }

  Future<List<CustomerAppointment>> _hydrateRemoteAppointmentPlanReservations(
    List<CustomerAppointment> appointments,
    SupabaseClient safeClient,
  ) async {
    if (appointments.isEmpty || _publicWebBaseUrl.isEmpty) {
      return appointments;
    }

    try {
      final remoteReservations = await _fetchRemoteAppointmentPlanReservations(
        safeClient,
        appointmentIds: appointments
            .map((appointment) => appointment.id)
            .toList(growable: false),
      );

      if (remoteReservations.isEmpty) {
        return appointments;
      }

      final reservationsByAppointmentId =
          <String, _RemoteAppointmentPlanReservation>{
            for (final reservation in remoteReservations)
              reservation.appointmentId: reservation,
          };

      return appointments
          .map((appointment) {
            final reservation = reservationsByAppointmentId[appointment.id];
            if (reservation == null) {
              return appointment;
            }

            return _copyAppointmentWithRemotePlanReservation(
              appointment,
              reservation,
            );
          })
          .toList(growable: false);
    } catch (_) {
      return appointments;
    }
  }

  Future<List<_RemoteAppointmentReview>> _fetchRemoteAppointmentReviews(
    SupabaseClient safeClient, {
    required List<String> appointmentIds,
  }) async {
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    final uri = _buildPublicAppointmentReviewUri(
      appointmentIds: appointmentIds,
    );

    if (accessToken == null || accessToken.isEmpty || uri == null) {
      return const <_RemoteAppointmentReview>[];
    }

    final response = await runGuardedRead<http.Response>(
      () => _httpClient.get(
        uri,
        headers: _authorizedPublicApiHeaders(accessToken),
      ),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return const <_RemoteAppointmentReview>[];
    }

    final payload = _decodeJsonObject(response.body);
    if (payload['ok'] != true) {
      return const <_RemoteAppointmentReview>[];
    }

    return jsonMapList(
      payload['reviews'],
    ).map(_RemoteAppointmentReview.fromJson).toList(growable: false);
  }

  Future<void> _submitAppointmentReviewThroughPublicApi(
    SupabaseClient safeClient, {
    required String appointmentId,
    required String? comment,
    required int rating,
  }) async {
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception(_expiredSessionMessage);
    }

    final uri = _buildPublicAppointmentReviewUri();
    if (uri == null) {
      throw Exception(
        'A avaliacao do app ainda nao foi ativada neste ambiente.',
      );
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{
          'appointmentId': appointmentId,
          'comment': comment,
          'rating': rating,
        }),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      return;
    }

    throw Exception(
      _formatPublicAppointmentReviewError(response.statusCode, payload),
    );
  }

  Future<List<_RemoteAppointmentPlanReservation>>
  _fetchRemoteAppointmentPlanReservations(
    SupabaseClient safeClient, {
    required List<String> appointmentIds,
  }) async {
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    final uri = _buildPublicAppointmentPlanReservationUri(
      appointmentIds: appointmentIds,
    );

    if (accessToken == null || accessToken.isEmpty || uri == null) {
      return const <_RemoteAppointmentPlanReservation>[];
    }

    final response = await runGuardedRead<http.Response>(
      () => _httpClient.get(
        uri,
        headers: _authorizedPublicApiHeaders(accessToken),
      ),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return const <_RemoteAppointmentPlanReservation>[];
    }

    final payload = _decodeJsonObject(response.body);
    if (payload['ok'] != true) {
      return const <_RemoteAppointmentPlanReservation>[];
    }

    return jsonMapList(
      payload['reservations'],
    ).map(_RemoteAppointmentPlanReservation.fromJson).toList(growable: false);
  }

  Future<void> _cancelMembershipPlanAppointmentThroughPublicApi(
    SupabaseClient safeClient, {
    required String appointmentId,
    required String reason,
  }) async {
    final accessToken = safeClient.auth.currentSession?.accessToken.trim();
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception(_expiredSessionMessage);
    }

    final uri = _buildPublicAppointmentPlanReservationUri();
    if (uri == null) {
      throw Exception('O plano mensal ainda nao foi ativado neste ambiente.');
    }

    final response = await runGuardedWrite<http.Response>(
      () => _httpClient.post(
        uri,
        headers: {
          ..._authorizedPublicApiHeaders(accessToken),
          'content-type': 'application/json',
        },
        body: jsonEncode(<String, dynamic>{
          'action': 'cancel_membership_plan_appointment',
          'appointmentId': appointmentId,
          'cancellationReason': reason.trim(),
        }),
      ),
    );
    final payload = _decodeJsonObject(response.body);

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        payload['ok'] == true) {
      return;
    }

    throw Exception(
      _formatPublicAppointmentPlanError(response.statusCode, payload),
    );
  }

  Uri? _buildPublicAppointmentReviewUri({
    List<String> appointmentIds = const <String>[],
  }) {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    final uri = Uri.parse('$_publicWebBaseUrl/api/public/appointment-reviews');

    if (appointmentIds.isEmpty) {
      return uri;
    }

    return uri.replace(
      queryParameters: <String, String>{
        'appointment_ids': appointmentIds.join(','),
      },
    );
  }

  Uri? _buildPublicCustomerAppointmentUri() {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    return Uri.parse('$_publicWebBaseUrl/api/public/customer-appointments');
  }

  Uri? _buildPublicCustomerAppointmentStatusUri() {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    return Uri.parse(
      '$_publicWebBaseUrl/api/public/customer-appointments/status',
    );
  }

  Uri? _buildPublicCustomerAppointmentRescheduleUri() {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    return Uri.parse(
      '$_publicWebBaseUrl/api/public/customer-appointments/reschedule',
    );
  }

  Uri? _buildPublicAppointmentPlanReservationUri({
    List<String> appointmentIds = const <String>[],
  }) {
    if (_publicWebBaseUrl.isEmpty) {
      return null;
    }

    final uri = Uri.parse(
      '$_publicWebBaseUrl/api/public/appointment-plan-reservations',
    );

    if (appointmentIds.isEmpty) {
      return uri;
    }

    return uri.replace(
      queryParameters: <String, String>{
        'appointment_ids': appointmentIds.join(','),
      },
    );
  }

  Map<String, String> _authorizedPublicApiHeaders(String accessToken) {
    return <String, String>{
      'accept': 'application/json',
      'authorization': 'Bearer $accessToken',
    };
  }

  String _formatPublicAppointmentCreateError(
    int statusCode,
    Map<String, dynamic> payload,
  ) {
    final detail =
        stringOrNull(payload['detail']) ?? stringOrNull(payload['error']) ?? '';

    switch (detail) {
      case 'time_slot_unavailable':
        return 'Esse horario acabou de ficar indisponivel. Escolha outro encaixe.';
      case 'customer_has_active_appointment_on_selected_day':
        return 'Voce ja possui um horario ativo neste dia. Escolha outro dia ou fale com o salao para remarcar.';
      case 'staff_member_not_available_for_service':
        return 'Esse profissional nao atende o servico escolhido.';
      case 'salon_closed_on_selected_day':
        return 'O salao nao atende nessa data.';
      case 'outside_business_hours':
      case 'slot_step_mismatch':
        return 'Esse horario nao cabe mais na grade atual do salao.';
      case 'past_time_not_allowed':
        return 'Esse horario ja passou. Escolha outro encaixe.';
      case 'service_not_found':
        return 'Esse servico nao esta mais disponivel.';
      case 'unauthenticated':
      case 'customer_not_linked':
        return _expiredSessionMessage;
    }

    if (statusCode == 401) {
      return _expiredSessionMessage;
    }

    return 'Nao foi possivel reservar esse horario agora.';
  }

  Map<String, dynamic> _decodeJsonObject(String body) {
    final normalizedBody = body.trim();
    if (normalizedBody.isEmpty) {
      return const <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(normalizedBody);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return decoded.map((key, value) => MapEntry(key.toString(), value));
      }
    } catch (_) {
      return const <String, dynamic>{};
    }

    return const <String, dynamic>{};
  }

  String _formatPublicAppointmentReviewError(
    int statusCode,
    Map<String, dynamic> payload,
  ) {
    final errorCode = stringOrNull(payload['error'])?.trim().toLowerCase();

    switch (errorCode) {
      case 'unauthenticated':
        return _expiredSessionMessage;
      case 'invalid_review_rating':
        return 'Escolha uma nota valida entre 1 e 5 estrelas.';
      case 'review_comment_too_long':
        return 'Seu comentario pode ter no maximo 600 caracteres.';
      case 'appointment_review_not_allowed':
        return 'Esse atendimento ainda nao pode ser avaliado.';
      case 'appointment_review_staff_required':
        return 'Esse atendimento ainda nao possui profissional para avaliacao.';
      case 'appointment_review_unavailable':
        return 'A avaliacao do app esta temporariamente indisponivel.';
    }

    if (statusCode == 401) {
      return _expiredSessionMessage;
    }

    return 'Nao foi possivel salvar a avaliacao agora.';
  }

  String _formatPublicAppointmentStatusError(
    int statusCode,
    Map<String, dynamic> payload,
  ) {
    final errorCode = stringOrNull(payload['error'])?.trim().toLowerCase();

    switch (errorCode) {
      case 'unauthenticated':
        return _expiredSessionMessage;
      case 'appointment_completion_too_early':
        return 'A conclusao so libera alguns minutos depois do fim do atendimento.';
      case 'appointment_completion_not_allowed':
        return 'Esse atendimento nao pode ser concluido por este app.';
      case 'appointment_complete_unavailable':
        return 'A conclusao do atendimento esta temporariamente indisponivel.';
    }

    if (statusCode == 401) {
      return _expiredSessionMessage;
    }

    return 'Nao foi possivel concluir esse atendimento agora.';
  }

  String _formatPublicAppointmentRescheduleError(
    int statusCode,
    Map<String, dynamic> payload,
  ) {
    final errorCode = stringOrNull(payload['error'])?.trim().toLowerCase();

    switch (errorCode) {
      case 'unauthenticated':
        return _expiredSessionMessage;
      case 'appointment_reschedule_not_allowed':
        return 'Esse atendimento nao pode ser remarcado por este app.';
      case 'appointment_reschedule_service_mismatch':
        return 'A remarcacao precisa manter o mesmo servico.';
      case 'membership_plan_staff_locked':
        return 'Esse horario de plano precisa continuar com o mesmo profissional.';
      case 'membership_plan_outside_period':
        return 'Esse horario precisa continuar dentro da vigencia do seu plano.';
      case 'service_not_found':
        return 'Esse servico nao esta mais disponivel para remarcacao.';
      case 'customer_has_active_appointment_on_selected_day':
        return 'Voce ja possui um horario ativo neste dia. Escolha outro dia ou fale com o salao para remarcar.';
      case 'appointment_reschedule_invalid_slot':
      case 'appointment_reschedule_time_slot_unavailable':
        return 'Esse horario acabou de ficar indisponivel. Escolha outro encaixe.';
    }

    if (statusCode == 401) {
      return _expiredSessionMessage;
    }

    return 'Nao foi possivel remarcar esse atendimento agora.';
  }

  String _formatPublicAppointmentPlanError(
    int statusCode,
    Map<String, dynamic> payload,
  ) {
    final errorCode = stringOrNull(payload['error'])?.trim().toLowerCase();

    switch (errorCode) {
      case 'unauthenticated':
        return _expiredSessionMessage;
      case 'membership_plan_not_found':
        return 'Seu plano mensal nao foi encontrado.';
      case 'membership_plan_no_sessions_remaining':
        return 'Esse plano nao possui sessoes disponiveis para programar.';
      case 'membership_plan_series_already_fixed':
        return 'Esse plano mensal ja esta com a serie fixa nesse dia e horario.';
      case 'membership_plan_outside_period':
        return 'Esse horario precisa ficar dentro da vigencia do seu plano.';
      case 'membership_plan_invalid_slot':
        return 'Escolha um horario valido para programar o plano.';
      case 'membership_plan_reservation_not_found':
        return 'Esse atendimento de plano nao foi encontrado.';
      case 'membership_plan_unavailable':
        return 'O plano mensal ainda nao foi ativado neste ambiente.';
    }

    if (statusCode == 401) {
      return _expiredSessionMessage;
    }

    return 'Nao foi possivel processar seu plano mensal agora.';
  }

  CustomerAppointment _copyAppointmentWithRemoteReview(
    CustomerAppointment appointment,
    _RemoteAppointmentReview review,
  ) {
    return CustomerAppointment(
      id: appointment.id,
      date: appointment.date,
      endsAt: appointment.endsAt,
      status: appointment.status,
      paymentPreference: appointment.paymentPreference,
      depositAmount: appointment.depositAmount,
      depositStatus: appointment.depositStatus,
      depositReportedPaidAt: appointment.depositReportedPaidAt,
      depositReportedPaidVia: appointment.depositReportedPaidVia,
      bookingPolicySnapshot: appointment.bookingPolicySnapshot,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      serviceDuration: appointment.serviceDuration,
      servicePrice: appointment.servicePrice,
      serviceImageUrl: appointment.serviceImageUrl,
      staffMemberId: appointment.staffMemberId,
      staffName: appointment.staffName,
      staffRole: appointment.staffRole,
      staffImageUrl: appointment.staffImageUrl,
      presenceConfirmedAt: appointment.presenceConfirmedAt,
      depositPaymentProvider: appointment.depositPaymentProvider,
      depositPaymentProviderChargeId:
          appointment.depositPaymentProviderChargeId,
      depositPaymentProviderStatus: appointment.depositPaymentProviderStatus,
      depositPaymentProviderInvoiceUrl:
          appointment.depositPaymentProviderInvoiceUrl,
      depositPaymentProviderPayload: appointment.depositPaymentProviderPayload,
      depositPaymentProviderError: appointment.depositPaymentProviderError,
      reviewRating: review.rating,
      reviewComment: review.comment,
      reviewCreatedAt: review.createdAt,
      reviewUpdatedAt: review.updatedAt,
      membershipPlanId: appointment.membershipPlanId,
      membershipPlanTitle: appointment.membershipPlanTitle,
      membershipPlanReservationStatus:
          appointment.membershipPlanReservationStatus,
      membershipSessionIndex: appointment.membershipSessionIndex,
      membershipSessionsIncluded: appointment.membershipSessionsIncluded,
      membershipPlanExpiresAt: appointment.membershipPlanExpiresAt,
    );
  }

  CustomerAppointment _copyAppointmentWithRemotePlanReservation(
    CustomerAppointment appointment,
    _RemoteAppointmentPlanReservation reservation,
  ) {
    return CustomerAppointment(
      id: appointment.id,
      date: appointment.date,
      endsAt: appointment.endsAt,
      status: appointment.status,
      paymentPreference: appointment.paymentPreference,
      depositAmount: appointment.depositAmount,
      depositStatus: appointment.depositStatus,
      depositReportedPaidAt: appointment.depositReportedPaidAt,
      depositReportedPaidVia: appointment.depositReportedPaidVia,
      bookingPolicySnapshot: appointment.bookingPolicySnapshot,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceName,
      serviceDuration: appointment.serviceDuration,
      servicePrice: appointment.servicePrice,
      serviceImageUrl: appointment.serviceImageUrl,
      staffMemberId: appointment.staffMemberId,
      staffName: appointment.staffName,
      staffRole: appointment.staffRole,
      staffImageUrl: appointment.staffImageUrl,
      presenceConfirmedAt: appointment.presenceConfirmedAt,
      depositPaymentProvider: appointment.depositPaymentProvider,
      depositPaymentProviderChargeId:
          appointment.depositPaymentProviderChargeId,
      depositPaymentProviderStatus: appointment.depositPaymentProviderStatus,
      depositPaymentProviderInvoiceUrl:
          appointment.depositPaymentProviderInvoiceUrl,
      depositPaymentProviderPayload: appointment.depositPaymentProviderPayload,
      depositPaymentProviderError: appointment.depositPaymentProviderError,
      reviewRating: appointment.reviewRating,
      reviewComment: appointment.reviewComment,
      reviewCreatedAt: appointment.reviewCreatedAt,
      reviewUpdatedAt: appointment.reviewUpdatedAt,
      membershipPlanId: reservation.membershipId,
      membershipPlanTitle: reservation.membershipTitle,
      membershipPlanReservationStatus: reservation.reservationStatus,
      membershipSessionIndex: reservation.sessionIndex,
      membershipSessionsIncluded: reservation.sessionsIncluded,
      membershipPlanExpiresAt: reservation.membershipExpiresAt,
    );
  }

  List<CustomerAppointment> _applyOptimisticAppointmentPlanReservations(
    List<CustomerAppointment> appointments,
  ) {
    if (appointments.isEmpty ||
        _optimisticAppointmentPlanReservations.isEmpty) {
      return appointments;
    }

    return appointments
        .map((appointment) {
          final optimisticReservation =
              _optimisticAppointmentPlanReservations[appointment.id];
          if (optimisticReservation == null) {
            return appointment;
          }

          final hasAuthoritativePlanMetadata =
              appointment.membershipPlanId?.trim().isNotEmpty == true &&
              appointment.membershipPlanReservationStatus?.trim().isNotEmpty ==
                  true;
          if (hasAuthoritativePlanMetadata) {
            _optimisticAppointmentPlanReservations.remove(appointment.id);
            return appointment;
          }

          return _copyAppointmentWithRemotePlanReservation(
            appointment,
            optimisticReservation,
          );
        })
        .toList(growable: false);
  }

  void _rememberOptimisticMembershipPlanReservations({
    required CustomerMembershipPlan membership,
    required MembershipPlanScheduleResult result,
    required String serviceId,
  }) {
    for (final createdAppointment in result.createdAppointments) {
      final appointmentId = createdAppointment.appointmentId.trim();
      if (appointmentId.isEmpty) {
        continue;
      }

      final reservationMembershipId =
          createdAppointment.membershipId?.trim().isNotEmpty == true
          ? createdAppointment.membershipId!.trim()
          : result.membershipId;
      final reservationMembershipTitle =
          createdAppointment.membershipTitle?.trim().isNotEmpty == true
          ? createdAppointment.membershipTitle!.trim()
          : result.membershipTitle;
      _optimisticAppointmentPlanReservations[appointmentId] =
          _RemoteAppointmentPlanReservation(
            appointmentId: appointmentId,
            membershipId: reservationMembershipId,
            membershipTitle: reservationMembershipTitle,
            reservationStatus: 'scheduled',
            serviceId: serviceId,
            membershipExpiresAt:
                createdAppointment.membershipExpiresAt ??
                result.membershipExpiresAt,
            membershipStartedAt: reservationMembershipId == membership.id
                ? membership.startedAt
                : null,
            sessionIndex: createdAppointment.sessionIndex,
            sessionsIncluded:
                createdAppointment.sessionsIncluded ?? result.sessionsIncluded,
          );
    }
  }

  bool _isMissingCustomerArchiveColumnError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return error.code == '42703' &&
        normalizedMessage.contains('customer_archived_at') &&
        normalizedMessage.contains('does not exist');
  }

  bool _isMissingCustomerArchiveRoutineError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return (error.code == 'PGRST202' ||
            error.code == '42883' ||
            normalizedMessage.contains('schema cache')) &&
        (normalizedMessage.contains('archive_customer_appointment') ||
            normalizedMessage.contains('archive_customer_appointment_history'));
  }

  bool _isAppointmentNotFoundError(PostgrestException error) {
    return error.message.trim().toLowerCase().contains('appointment_not_found');
  }

  bool _isMissingStaffImagePathColumnError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return error.code == '42703' &&
        normalizedMessage.contains('image_path') &&
        normalizedMessage.contains('staff_members');
  }

  bool _isMissingPaymentPreferenceColumnError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return error.code == '42703' &&
        normalizedMessage.contains('payment_preference') &&
        normalizedMessage.contains('appointments');
  }

  bool _isMissingAppointmentReviewRelationError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return normalizedMessage.contains('appointment_reviews') &&
        (normalizedMessage.contains('does not exist') ||
            normalizedMessage.contains('schema cache') ||
            normalizedMessage.contains('relationship') ||
            normalizedMessage.contains('could not find'));
  }

  bool _isMissingAppointmentReviewRoutineError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return (error.code == 'PGRST202' ||
            error.code == '42883' ||
            normalizedMessage.contains('schema cache')) &&
        normalizedMessage.contains('submit_appointment_review');
  }

  bool _isLegacyCreateAppointmentRoutineError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();
    return (error.code == 'PGRST202' ||
            error.code == '42883' ||
            normalizedMessage.contains('schema cache')) &&
        normalizedMessage.contains('create_appointment');
  }

  String _formatCreateAppointmentError(PostgrestException error) {
    final normalizedMessage = error.message.trim().toLowerCase();

    if (error.code == '23P01' ||
        normalizedMessage.contains('time_slot_unavailable')) {
      return 'Esse horário acabou de ficar indisponível. Escolha outro encaixe.';
    }

    if (normalizedMessage.contains(
      'customer_has_active_appointment_on_selected_day',
    )) {
      return 'Você já possui um horário ativo neste dia. Escolha outro dia ou fale com o salão para remarcar.';
    }

    if (normalizedMessage.contains('staff_member_not_available_for_service')) {
      return 'Esse profissional não atende o serviço escolhido.';
    }

    if (normalizedMessage.contains('salon_closed_on_selected_day')) {
      return 'O salão não atende nessa data.';
    }

    if (normalizedMessage.contains('outside_business_hours') ||
        normalizedMessage.contains('slot_step_mismatch')) {
      return 'Escolha um horário válido dentro da agenda do salão.';
    }

    if (normalizedMessage.contains('past_time_not_allowed')) {
      return 'Escolha uma data e um horário futuros.';
    }

    if (normalizedMessage.contains('invalid_payment_preference')) {
      return 'Selecione uma forma prevista de pagamento válida.';
    }

    return error.message.trim().isEmpty
        ? 'Não foi possível concluir o agendamento agora.'
        : error.message.trim();
  }

  Future<SupabaseClient?> _ensureAuthenticatedClient() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    if (_hasAuthenticatedSession(safeClient)) {
      return safeClient;
    }

    try {
      await _restoreSessionIfNeeded();
    } catch (_) {
      // Best effort: if the bridge is temporarily unavailable, the caller
      // still receives a clear session-expired message below.
    }

    if (_hasAuthenticatedSession(safeClient)) {
      return safeClient;
    }

    throw Exception(_expiredSessionMessage);
  }

  Future<SupabaseClient> _requireConfiguredAuthenticatedClient() async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    return await _ensureAuthenticatedClient() ?? safeClient;
  }

  bool _hasAuthenticatedSession(SupabaseClient safeClient) {
    return safeClient.auth.currentSession != null &&
        safeClient.auth.currentUser != null;
  }

  void _invalidateAgendaReadCache({String? customerId}) {
    _cache.invalidate(_appointmentsCacheKey);
    if (customerId != null && customerId.trim().isNotEmpty) {
      _cache.invalidate('agenda:membershipPlans:${customerId.trim()}');
    } else {
      _cache.invalidatePrefix('agenda:membershipPlans:');
    }
  }

  Future<void> _restoreSessionIfNeeded() {
    final inFlight = _restoreSessionInFlight;
    if (inFlight != null) {
      return inFlight;
    }

    final future = (() async {
      await _restoreSession?.call();
    })();
    _restoreSessionInFlight = future;
    return future.whenComplete(() {
      if (identical(_restoreSessionInFlight, future)) {
        _restoreSessionInFlight = null;
      }
    });
  }

  Future<Map<String, String>> _fetchStaffImagePaths(
    SupabaseClient safeClient, {
    required Set<String> staffIds,
  }) async {
    if (staffIds.isEmpty) {
      return const <String, String>{};
    }

    final missingStaffIds = staffIds
        .where((staffId) => !_staffImagePathCache.containsKey(staffId))
        .toList(growable: false);

    try {
      if (missingStaffIds.isNotEmpty) {
        final response = await runGuardedRead<dynamic>(
          () => safeClient
              .from('staff_members')
              .select('id, image_path')
              .inFilter('id', missingStaffIds),
        );

        final resolvedIds = <String>{};
        for (final entry in response as List<dynamic>) {
          final map = jsonMap(entry);
          final staffId = stringValue(map['id']);
          resolvedIds.add(staffId);
          _staffImagePathCache[staffId] = stringOrNull(map['image_path']);
        }

        for (final staffId in missingStaffIds) {
          if (!resolvedIds.contains(staffId)) {
            _staffImagePathCache[staffId] = null;
          }
        }
      }
    } on PostgrestException catch (error) {
      if (_isMissingStaffImagePathColumnError(error)) {
        for (final staffId in missingStaffIds) {
          _staffImagePathCache[staffId] = null;
        }
      } else {
        rethrow;
      }
    }

    final imagePaths = <String, String>{};
    for (final staffId in staffIds) {
      final imagePath = _staffImagePathCache[staffId];
      if (imagePath == null || imagePath.isEmpty) {
        continue;
      }
      imagePaths[staffId] = imagePath;
    }
    return imagePaths;
  }

  Map<String, dynamic> _withAvailabilityMediaUrls(
    Map<String, dynamic> availabilityData,
    Map<String, String> imagePathsByStaffId,
    SupabaseClient safeClient,
  ) {
    return <String, dynamic>{
      ...availabilityData,
      'staff_members': jsonMapList(availabilityData['staff_members']).map((
        staff,
      ) {
        final imagePath = imagePathsByStaffId[stringValue(staff['id'])];
        return <String, dynamic>{
          ...staff,
          'image_url': _publicAssetUrl(
            safeClient,
            imagePath,
            width: 320,
            height: 320,
          ),
        };
      }).toList(),
      'available_slots': jsonMapList(availabilityData['available_slots']).map((
        slot,
      ) {
        final imagePath =
            imagePathsByStaffId[stringValue(slot['staff_member_id'])];
        return <String, dynamic>{
          ...slot,
          'staff_member_image_url': _publicAssetUrl(
            safeClient,
            imagePath,
            width: 320,
            height: 320,
          ),
        };
      }).toList(),
    };
  }

  String? _publicAssetUrl(
    SupabaseClient? safeClient,
    String? assetPath, {
    int? width,
    int? height,
  }) {
    final normalized = assetPath?.trim();
    if (safeClient == null || normalized == null || normalized.isEmpty) {
      return null;
    }

    return resolvePublicStorageAssetUrl(
      safeClient,
      bucket: 'salon-assets',
      assetPath: normalized,
      transform: width == null && height == null
          ? null
          : TransformOptions(width: width, height: height, quality: 100),
    );
  }

  Future<List<CustomerAppointment>> _filterLocallyArchivedAppointments(
    List<CustomerAppointment> appointments,
    SupabaseClient safeClient,
  ) async {
    final hiddenIds = await _loadLocallyArchivedAppointmentIds(safeClient);
    if (hiddenIds.isEmpty) {
      return appointments;
    }

    return appointments
        .where((appointment) => !hiddenIds.contains(appointment.id))
        .toList(growable: false);
  }

  Future<Set<String>> _loadLocallyArchivedAppointmentIds(
    SupabaseClient safeClient,
  ) async {
    final prefs = await _prefsLoader();
    return (prefs.getStringList(_localArchiveKey(safeClient)) ??
            const <String>[])
        .where((id) => id.trim().isNotEmpty)
        .toSet();
  }

  Future<void> _markAppointmentArchivedLocally(
    SupabaseClient safeClient,
    String appointmentId,
  ) async {
    final normalizedId = appointmentId.trim();
    if (normalizedId.isEmpty) {
      return;
    }

    final prefs = await _prefsLoader();
    final key = _localArchiveKey(safeClient);
    final ids = <String>{
      ...(prefs.getStringList(key) ?? const <String>[]),
      normalizedId,
    }.toList()..sort();
    await prefs.setStringList(key, ids);
  }

  String _localArchiveKey(SupabaseClient safeClient) {
    final authUserId = safeClient.auth.currentUser?.id.trim();
    final scope = authUserId == null || authUserId.isEmpty
        ? 'anonymous'
        : authUserId;
    return '$_locallyArchivedAppointmentIdsKeyPrefix$scope';
  }
}
