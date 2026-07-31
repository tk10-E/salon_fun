import 'dart:typed_data';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/network/network_guard.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../shared/app_models.dart';
import '../shared/storage_asset_urls.dart';

class ProfileRepository {
  ProfileRepository({required this.client});

  final SupabaseClient? client;

  static const _customerProfileBucket = 'customer-profiles';
  static const _customerProfileFields =
      'id, salon_id, auth_user_id, name, phone, email, birth_date, profile_image_path, referral_code, consent_status';
  static const _currentCustomerCacheKey = 'profile:currentCustomer';
  static const _birthdayHomeCacheKey = 'profile:birthdayHome';
  static const _loyaltySummaryCacheKey = 'profile:loyaltySummary';
  static const _referralSummaryCacheKey = 'profile:referralSummary';
  static const _currentCustomerCacheTtl = Duration(seconds: 20);
  static const _birthdayHomeCacheTtl = Duration(seconds: 45);
  static const _loyaltySummaryCacheTtl = Duration(seconds: 35);
  static const _referralSummaryCacheTtl = Duration(seconds: 35);
  static const _loyaltyTransactionsCacheTtl = Duration(seconds: 35);
  static const _membershipOverviewCacheTtl = Duration(seconds: 25);
  final SnapshotReadCache _cache = SnapshotReadCache();

  bool get isConfigured => client != null;

  Future<CustomerProfile?> fetchCurrentCustomer() async {
    final safeClient = client;
    final authUser = safeClient?.auth.currentUser;
    if (safeClient == null || authUser == null) {
      return null;
    }

    return _cache.read<CustomerProfile?>(
      key: _currentCustomerCacheKey,
      ttl: _currentCustomerCacheTtl,
      loader: () async {
        final result = await runGuardedRead<dynamic>(
          () => safeClient
              .from('customers')
              .select(_customerProfileFields)
              .eq('auth_user_id', authUser.id)
              .order('updated_at', ascending: false, nullsFirst: false)
              .order('created_at', ascending: false)
              .order('id', ascending: false)
              .limit(3),
        );

        final rows = (result as List<dynamic>? ?? const <dynamic>[])
            .cast<Map<String, dynamic>>();
        if (rows.isEmpty) {
          return null;
        }

        return _hydrateCustomerProfile(rows.first);
      },
    );
  }

  Future<CustomerProfile> saveCustomerProfile({
    required String customerId,
    required String name,
    String? phone,
    String? email,
    required DateTime? birthDate,
  }) async {
    final safeClient = client;
    final authUser = safeClient?.auth.currentUser;
    if (safeClient == null || authUser == null) {
      throw Exception('Entre novamente para atualizar seu cadastro.');
    }

    final normalizedName = name.trim();
    if (normalizedName.length < 2) {
      throw Exception('Informe seu nome com pelo menos 2 letras.');
    }

    final normalizedPhone = _normalizeOptionalPhone(phone);
    final normalizedEmail = _normalizeOptionalEmail(email);
    _validateBirthDate(birthDate);

    try {
      final response = await runGuardedWrite<dynamic>(
        () => safeClient
            .from('customers')
            .update(<String, dynamic>{
              'name': normalizedName,
              'phone': normalizedPhone,
              'email': normalizedEmail,
              'birth_date': dateOnlyToIsoString(birthDate),
            })
            .eq('id', customerId)
            .eq('auth_user_id', authUser.id)
            .select(_customerProfileFields)
            .single(),
      );

      final profile = await _hydrateCustomerProfile(response);
      _invalidateProfileReadCache(customerId: customerId);
      return profile;
    } on PostgrestException catch (error) {
      throw Exception(_formatCustomerProfileError(error.message));
    }
  }

  Future<CustomerProfile> saveCustomerBirthDate({
    required String customerId,
    required DateTime? birthDate,
  }) async {
    final current = await _requireCurrentCustomer(customerId);
    return saveCustomerProfile(
      customerId: customerId,
      name: current.name,
      phone: current.phone,
      email: current.email,
      birthDate: birthDate,
    );
  }

  Future<CustomerProfile> uploadCustomerProfileImage({
    required CustomerProfile customer,
    required Uint8List bytes,
    required String fileExtension,
    required String contentType,
  }) async {
    final safeClient = client;
    final authUser = safeClient?.auth.currentUser;
    if (safeClient == null || authUser == null) {
      throw Exception('Entre novamente para atualizar sua foto.');
    }

    final normalizedExtension = _normalizeImageExtension(fileExtension);
    final previousPath = customer.profileImagePath?.trim();
    final uploadPath =
        '${customer.salonId}/${customer.id}/avatar-${DateTime.now().millisecondsSinceEpoch}.$normalizedExtension';

    try {
      await runGuardedWrite<void>(() async {
        await safeClient.storage
            .from(_customerProfileBucket)
            .uploadBinary(
              uploadPath,
              bytes,
              fileOptions: FileOptions(contentType: contentType, upsert: false),
            );
      });

      final response = await runGuardedWrite<dynamic>(
        () => safeClient
            .from('customers')
            .update(<String, dynamic>{'profile_image_path': uploadPath})
            .eq('id', customer.id)
            .eq('auth_user_id', authUser.id)
            .select(_customerProfileFields)
            .single(),
      );

      if (previousPath != null &&
          previousPath.isNotEmpty &&
          previousPath != uploadPath) {
        try {
          await safeClient.storage.from(_customerProfileBucket).remove([
            previousPath,
          ]);
        } catch (_) {}
      }

      final profile = await _hydrateCustomerProfile(response);
      _invalidateProfileReadCache(customerId: customer.id);
      return profile;
    } on PostgrestException catch (error) {
      try {
        await safeClient.storage.from(_customerProfileBucket).remove([
          uploadPath,
        ]);
      } catch (_) {}
      throw Exception(_formatCustomerProfileImageError(error.message));
    } catch (_) {
      try {
        await safeClient.storage.from(_customerProfileBucket).remove([
          uploadPath,
        ]);
      } catch (_) {}
      rethrow;
    }
  }

  Future<CustomerProfile> removeCustomerProfileImage({
    required CustomerProfile customer,
  }) async {
    final safeClient = client;
    final authUser = safeClient?.auth.currentUser;
    if (safeClient == null || authUser == null) {
      throw Exception('Entre novamente para atualizar sua foto.');
    }

    final previousPath = customer.profileImagePath?.trim();
    if (previousPath == null || previousPath.isEmpty) {
      return customer;
    }

    try {
      final response = await runGuardedWrite<dynamic>(
        () => safeClient
            .from('customers')
            .update(<String, dynamic>{'profile_image_path': null})
            .eq('id', customer.id)
            .eq('auth_user_id', authUser.id)
            .select(_customerProfileFields)
            .single(),
      );

      try {
        await safeClient.storage.from(_customerProfileBucket).remove([
          previousPath,
        ]);
      } catch (_) {}

      final profile = await _hydrateCustomerProfile(response);
      _invalidateProfileReadCache(customerId: customer.id);
      return profile;
    } on PostgrestException catch (error) {
      throw Exception(_formatCustomerProfileImageError(error.message));
    }
  }

  Future<BirthdayHomeExperience?> fetchBirthdayHomeExperience() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    return _cache.read<BirthdayHomeExperience?>(
      key: _birthdayHomeCacheKey,
      ttl: _birthdayHomeCacheTtl,
      loader: () async {
        final data = await runGuardedRead<dynamic>(
          () => safeClient.rpc('get_customer_birthday_home_experience'),
        );
        final payload = jsonMapOrNull(data);
        if (payload == null || payload.isEmpty) {
          return null;
        }

        final imagePath = stringOrNull(payload['imagePath']);
        final videoPath = stringOrNull(payload['videoPath']);
        final resolvedPayload = <String, dynamic>{
          ...payload,
          'imageUrl': resolvePublicStorageAssetUrl(
            safeClient,
            bucket: 'salon-posts',
            assetPath: imagePath,
          ),
          'videoUrl': resolvePublicStorageAssetUrl(
            safeClient,
            bucket: 'salon-posts',
            assetPath: videoPath,
          ),
        };

        return BirthdayHomeExperience.fromJson(resolvedPayload);
      },
    );
  }

  Future<LoyaltySummary?> fetchLoyaltySummary() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    return _cache.read<LoyaltySummary?>(
      key: _loyaltySummaryCacheKey,
      ttl: _loyaltySummaryCacheTtl,
      loader: () async {
        final data = await runGuardedRead<dynamic>(
          () => safeClient.rpc('get_customer_loyalty_summary'),
        );
        return LoyaltySummary.fromJson(jsonMap(data));
      },
    );
  }

  Future<List<CustomerLoyaltyTransaction>> fetchLoyaltyTransactions({
    required String customerId,
    int limit = 12,
  }) async {
    final safeClient = client;
    final normalizedCustomerId = customerId.trim();
    if (safeClient == null || normalizedCustomerId.isEmpty) {
      return const <CustomerLoyaltyTransaction>[];
    }

    return _cache.read<List<CustomerLoyaltyTransaction>>(
      key: 'profile:loyaltyTransactions:$normalizedCustomerId:$limit',
      ttl: _loyaltyTransactionsCacheTtl,
      loader: () async {
        final response = await runGuardedRead<dynamic>(
          () => safeClient
              .from('customer_loyalty_transactions')
              .select(
                'id, appointment_id, transaction_kind, points_delta, cashback_delta, completed_visit_delta, description, metadata, created_at',
              )
              .eq('customer_id', normalizedCustomerId)
              .order('created_at', ascending: false)
              .limit(limit),
        );

        final rows = (response as List<dynamic>)
            .map((entry) => jsonMap(entry))
            .toList(growable: false);
        if (rows.isEmpty) {
          return const <CustomerLoyaltyTransaction>[];
        }

        final appointmentContextById = await _loadLoyaltyAppointmentContext(
          safeClient,
          rows,
        );

        return rows
            .map(
              (row) => _mapLoyaltyTransaction(
                row,
                appointmentContextById[stringOrNull(row['appointment_id'])],
              ),
            )
            .toList(growable: false);
      },
    );
  }

  Future<ReferralSummary?> fetchReferralSummary() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    return _cache.read<ReferralSummary?>(
      key: _referralSummaryCacheKey,
      ttl: _referralSummaryCacheTtl,
      loader: () async {
        final data = await runGuardedRead<dynamic>(
          () => safeClient.rpc('get_customer_referral_summary'),
        );
        return ReferralSummary.fromJson(jsonMap(data));
      },
    );
  }

  Future<CustomerMembershipOverview> fetchMembershipOverview({
    required String customerId,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      return const CustomerMembershipOverview.empty();
    }

    final normalizedCustomerId = customerId.trim();
    return _cache.read<CustomerMembershipOverview>(
      key: 'profile:membershipOverview:$normalizedCustomerId',
      ttl: _membershipOverviewCacheTtl,
      loader: () async {
        final membershipsResponse = await runGuardedRead<dynamic>(
          () => safeClient
              .from('customer_memberships')
              .select(
                'id, offer_id, title, service_id, service_name_snapshot, status, sessions_included, sessions_used, started_at, expires_at, price_snapshot',
              )
              .eq('customer_id', customerId)
              .order('expires_at'),
        );

        dynamic pendingRequestsResponse;
        try {
          pendingRequestsResponse = await runGuardedRead<dynamic>(
            () => safeClient
                .from('customer_membership_requests')
                .select(
                  'id, offer_id, offer_title_snapshot, status, requested_at, decided_at, approved_starts_on, membership_id, price_snapshot, notes, preferred_start_at, preferred_staff_member_id, preferred_staff_member_name_snapshot',
                )
                .eq('customer_id', customerId)
                .or('status.eq.pending,and(status.eq.approved,membership_id.is.null)')
                .order('requested_at', ascending: false),
          );
        } on PostgrestException catch (error) {
          if (!_isMissingMembershipRequestPreferredScheduleColumnsError(error)) {
            rethrow;
          }

          pendingRequestsResponse = await runGuardedRead<dynamic>(
            () => safeClient
                .from('customer_membership_requests')
                .select(
                  'id, offer_id, offer_title_snapshot, status, requested_at, decided_at, membership_id, price_snapshot, notes',
                )
                .eq('customer_id', customerId)
                .or('status.eq.pending,and(status.eq.approved,membership_id.is.null)')
                .order('requested_at', ascending: false),
          );
        }

        final memberships = (membershipsResponse as List<dynamic>)
            .map((entry) => CustomerMembershipPlan.fromJson(jsonMap(entry)))
            .toList(growable: false);
        final pendingRequests = (pendingRequestsResponse as List<dynamic>)
            .map((entry) => CustomerMembershipRequest.fromJson(jsonMap(entry)))
            .toList(growable: false);

        return CustomerMembershipOverview(
          memberships: memberships,
          pendingRequests: pendingRequests,
        );
      },
    );
  }

  Future<CustomerMembershipRequest> requestMembershipPlan({
    required String offerId,
    String? notes,
    DateTime? preferredStartAt,
    String? preferredStaffMemberId,
    String? preferredStaffMemberName,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      throw Exception('Supabase não configurado.');
    }

    final normalizedNotes = notes?.trim().isEmpty == true
        ? null
        : notes?.trim();
    final normalizedPreferredStaffMemberId =
        preferredStaffMemberId?.trim().isEmpty == true
        ? null
        : preferredStaffMemberId?.trim();
    final legacyCompatibleNotes = encodeLegacyMembershipRequestNotes(
      notes: normalizedNotes,
      preferredStartAt: preferredStartAt,
      preferredStaffMemberId: normalizedPreferredStaffMemberId,
      preferredStaffMemberName: preferredStaffMemberName,
    );

    try {
      dynamic response;
      try {
        response = await runGuardedWrite<dynamic>(
          () => safeClient.rpc(
            'request_customer_membership_package',
            params: <String, dynamic>{
              'offer_uuid': offerId,
              'notes_input': normalizedNotes,
              'preferred_start_at_input': preferredStartAt
                  ?.toUtc()
                  .toIso8601String(),
              'preferred_staff_member_uuid': normalizedPreferredStaffMemberId,
            },
          ),
        );
      } on PostgrestException catch (error) {
        if (!_isLegacyMembershipRequestRoutineError(error)) {
          rethrow;
        }

        response = await runGuardedWrite<dynamic>(
          () => safeClient.rpc(
            'request_customer_membership_package',
            params: <String, dynamic>{
              'offer_uuid': offerId,
              'notes_input': legacyCompatibleNotes,
            },
          ),
        );
      }

      final payload = jsonMapOrNull(response);
      if (payload == null || payload.isEmpty) {
        return CustomerMembershipRequest(
          id: 'pending-$offerId',
          offerId: offerId,
          offerTitle: 'Plano do salão',
          status: 'pending',
          requestedAt: DateTime.now(),
          priceSnapshot: null,
          notes: normalizedNotes,
          preferredStartAt: preferredStartAt,
          preferredStaffMemberId: normalizedPreferredStaffMemberId,
          preferredStaffMemberName: preferredStaffMemberName,
        );
      }

      _invalidateMembershipReadCache(offerScoped: false);
      return CustomerMembershipRequest.fromJson(payload);
    } on PostgrestException catch (error) {
      throw Exception(_formatMembershipRequestError(error.message));
    }
  }

  Future<CustomerProfile> _requireCurrentCustomer(String customerId) async {
    final current = await fetchCurrentCustomer();
    if (current == null || current.id != customerId) {
      throw Exception('Entre novamente para atualizar seu cadastro.');
    }
    return current;
  }

  void _invalidateProfileReadCache({String? customerId}) {
    _cache.invalidate(_currentCustomerCacheKey);
    _invalidateMembershipReadCache(
      customerId: customerId?.trim(),
      offerScoped: true,
    );
  }

  void _invalidateMembershipReadCache({
    String? customerId,
    required bool offerScoped,
  }) {
    if (customerId != null && customerId.isNotEmpty) {
      _cache.invalidate('profile:membershipOverview:$customerId');
      _cache.invalidatePrefix('profile:loyaltyTransactions:$customerId:');
    } else {
      _cache.invalidatePrefix('profile:membershipOverview:');
      _cache.invalidatePrefix('profile:loyaltyTransactions:');
    }

    if (offerScoped) {
      _cache.invalidate(_loyaltySummaryCacheKey);
      _cache.invalidate(_referralSummaryCacheKey);
      _cache.invalidate(_birthdayHomeCacheKey);
    }
  }

  Future<Map<String, _LoyaltyAppointmentContext>>
  _loadLoyaltyAppointmentContext(
    SupabaseClient safeClient,
    List<Map<String, dynamic>> transactionRows,
  ) async {
    final appointmentIds = transactionRows
        .map((row) => stringOrNull(row['appointment_id']))
        .whereType<String>()
        .toSet()
        .toList(growable: false);
    if (appointmentIds.isEmpty) {
      return const <String, _LoyaltyAppointmentContext>{};
    }

    try {
      final response = await runGuardedRead<dynamic>(
        () => _fetchLoyaltyAppointmentContextResponse(
          safeClient,
          appointmentIds: appointmentIds,
        ),
      );
      return _mapLoyaltyAppointmentContextResponse(response, safeClient);
    } on PostgrestException catch (error) {
      if (!_isMissingStaffImagePathColumnError(error)) {
        rethrow;
      }

      final legacyResponse = await runGuardedRead<dynamic>(
        () => _fetchLoyaltyAppointmentContextResponse(
          safeClient,
          appointmentIds: appointmentIds,
          includeStaffImage: false,
        ),
      );
      return _mapLoyaltyAppointmentContextResponse(
        legacyResponse,
        safeClient,
        includeStaffImage: false,
      );
    }
  }

  dynamic _fetchLoyaltyAppointmentContextResponse(
    SupabaseClient safeClient, {
    required List<String> appointmentIds,
    bool includeStaffImage = true,
  }) {
    final staffSelect = includeStaffImage
        ? 'staff_members(name, image_path)'
        : 'staff_members(name)';
    return safeClient
        .from('appointments')
        .select('id, services(name), $staffSelect')
        .inFilter('id', appointmentIds);
  }

  Map<String, _LoyaltyAppointmentContext> _mapLoyaltyAppointmentContextResponse(
    dynamic response,
    SupabaseClient safeClient, {
    bool includeStaffImage = true,
  }) {
    final rows = (response as List<dynamic>)
        .map((entry) => jsonMap(entry))
        .toList(growable: false);
    final mapped = <String, _LoyaltyAppointmentContext>{};
    for (final row in rows) {
      final appointmentId = stringOrNull(row['id']);
      if (appointmentId == null) {
        continue;
      }

      final service = jsonMapOrNull(row['services']);
      final staff = jsonMapOrNull(row['staff_members']);
      mapped[appointmentId] = _LoyaltyAppointmentContext(
        serviceName: stringOrNull(service?['name']),
        staffMemberName: stringOrNull(staff?['name']),
        staffMemberImageUrl: includeStaffImage
            ? _publicSalonAssetUrl(
                safeClient,
                stringOrNull(staff?['image_path']),
              )
            : null,
      );
    }
    return mapped;
  }

  CustomerLoyaltyTransaction _mapLoyaltyTransaction(
    Map<String, dynamic> row,
    _LoyaltyAppointmentContext? appointmentContext,
  ) {
    final metadata = <String, dynamic>{...jsonMap(row['metadata'])};
    if ((stringOrNull(metadata['serviceName']) == null) &&
        appointmentContext?.serviceName != null) {
      metadata['serviceName'] = appointmentContext!.serviceName;
    }
    if ((stringOrNull(metadata['staffMemberName']) == null) &&
        appointmentContext?.staffMemberName != null) {
      metadata['staffMemberName'] = appointmentContext!.staffMemberName;
    }
    if ((stringOrNull(metadata['staffMemberImageUrl']) == null) &&
        appointmentContext?.staffMemberImageUrl != null) {
      metadata['staffMemberImageUrl'] = appointmentContext!.staffMemberImageUrl;
    }

    return CustomerLoyaltyTransaction.fromJson(<String, dynamic>{
      ...row,
      'metadata': metadata,
      'staff_member_name':
          appointmentContext?.staffMemberName ??
          stringOrNull(metadata['staffMemberName']),
      'staff_member_image_url':
          appointmentContext?.staffMemberImageUrl ??
          stringOrNull(metadata['staffMemberImageUrl']),
    });
  }

  String? _publicSalonAssetUrl(SupabaseClient safeClient, String? assetPath) {
    return resolvePublicStorageAssetUrl(
      safeClient,
      bucket: 'salon-assets',
      assetPath: assetPath,
      transform: TransformOptions(width: 320, height: 320, quality: 100),
    );
  }

  Future<CustomerProfile> _hydrateCustomerProfile(
    Map<String, dynamic> row,
  ) async {
    final safeClient = client;
    final imagePath = stringOrNull(row['profile_image_path']);
    String? imageUrl;
    if (safeClient != null &&
        imagePath != null &&
        imagePath.trim().isNotEmpty) {
      try {
        imageUrl = await resolveSignedStorageAssetUrl(
          safeClient,
          bucket: _customerProfileBucket,
          assetPath: imagePath,
        );
      } catch (_) {
        imageUrl = null;
      }
    }

    return CustomerProfile.fromMap(<String, dynamic>{
      ...row,
      'profile_image_url': imageUrl,
    });
  }
}

class _LoyaltyAppointmentContext {
  const _LoyaltyAppointmentContext({
    required this.serviceName,
    required this.staffMemberName,
    required this.staffMemberImageUrl,
  });

  final String? serviceName;
  final String? staffMemberName;
  final String? staffMemberImageUrl;
}

String _formatCustomerProfileError(String rawMessage) {
  final normalized = rawMessage.trim().toLowerCase();
  if (normalized == 'unauthenticated') {
    return 'Entre novamente para atualizar seu cadastro.';
  }
  if (normalized.contains('customers_email_length_check')) {
    return 'Informe um e-mail válido para o cadastro.';
  }
  if (normalized.contains('phone_length_check')) {
    return 'Informe um telefone válido com DDD.';
  }
  return 'Nao foi possivel salvar seu cadastro agora.';
}

bool _isMissingStaffImagePathColumnError(PostgrestException error) {
  final normalizedMessage = error.message.trim().toLowerCase();
  return error.code == '42703' &&
      normalizedMessage.contains('image_path') &&
      normalizedMessage.contains('staff_members');
}

bool _isMissingMembershipRequestPreferredScheduleColumnsError(
  PostgrestException error,
) {
  final normalizedMessage = error.message.trim().toLowerCase();
  return error.code == '42703' &&
      normalizedMessage.contains('customer_membership_requests') &&
      (normalizedMessage.contains('preferred_start_at') ||
          normalizedMessage.contains('preferred_staff_member_id') ||
          normalizedMessage.contains('preferred_staff_member_name_snapshot') ||
          normalizedMessage.contains('approved_starts_on'));
}

bool _isLegacyMembershipRequestRoutineError(PostgrestException error) {
  final normalizedMessage = error.message.trim().toLowerCase();
  return (error.code == 'PGRST202' ||
          error.code == '42883' ||
          normalizedMessage.contains('schema cache')) &&
      normalizedMessage.contains('request_customer_membership_package');
}

String _formatCustomerProfileImageError(String rawMessage) {
  final normalized = rawMessage.trim().toLowerCase();
  if (normalized == 'unauthenticated') {
    return 'Entre novamente para atualizar sua foto.';
  }
  return 'Nao foi possivel atualizar sua foto agora.';
}

String _formatMembershipRequestError(String rawMessage) {
  final normalized = rawMessage.trim().toLowerCase();

  switch (normalized) {
    case 'membership_request_already_pending':
      return 'Esse plano ja esta aguardando aceite do salao.';
    case 'offer_not_found':
    case 'offer_not_available':
      return 'Esse plano nao esta disponivel agora.';
    case 'offer_not_available_yet':
      return 'Esse plano ainda nao liberou assinatura.';
    case 'offer_not_membership':
      return 'Esse item nao pode ser assinado pelo app.';
    case 'membership_offer_not_operational':
      return 'O salao ainda nao terminou de configurar esse plano.';
    case 'membership_request_preferred_slot_incomplete':
      return 'Escolha um horario completo antes de pedir o plano.';
    case 'membership_request_slot_in_past':
      return 'Esse horario preferido ja passou. Escolha outro encaixe.';
    case 'membership_request_staff_not_found':
      return 'Esse profissional nao esta mais disponivel para o plano.';
    case 'customer_not_found':
      return 'Seu cadastro ainda nao esta vinculado ao salao.';
    case 'unauthenticated':
      return 'Entre novamente para pedir esse plano.';
    default:
      return 'Nao foi possivel enviar seu pedido de plano agora.';
  }
}

String? _normalizeOptionalPhone(String? value) {
  final digits = value?.replaceAll(RegExp(r'\D'), '') ?? '';
  if (digits.isEmpty) {
    return null;
  }
  if (digits.length < 10 || digits.length > 15) {
    throw Exception('Informe um telefone válido com DDD.');
  }
  return digits;
}

String? _normalizeOptionalEmail(String? value) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) {
    return null;
  }
  final pattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  if (!pattern.hasMatch(normalized)) {
    throw Exception('Informe um e-mail válido.');
  }
  return normalized.toLowerCase();
}

void _validateBirthDate(DateTime? birthDate) {
  final now = DateTime.now();
  if (birthDate == null) {
    return;
  }
  if (birthDate.year < 1900) {
    throw Exception('Escolha uma data de nascimento valida.');
  }
  final birthDateOnly = DateTime(
    birthDate.year,
    birthDate.month,
    birthDate.day,
  );
  final today = DateTime(now.year, now.month, now.day);
  if (birthDateOnly.isAfter(today)) {
    throw Exception('A data de nascimento nao pode ficar no futuro.');
  }
}

String _normalizeImageExtension(String value) {
  final normalized = value.trim().toLowerCase().replaceAll('.', '');
  switch (normalized) {
    case 'png':
    case 'jpeg':
    case 'jpg':
    case 'webp':
      return normalized == 'jpeg' ? 'jpg' : normalized;
    default:
      return 'jpg';
  }
}
