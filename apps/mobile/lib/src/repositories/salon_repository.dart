import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/home/home_data_loader.dart';
import '../models/app_models.dart';
import '../services/push_token_sync_service.dart';

class SignUpResult {
  const SignUpResult({
    required this.email,
    required this.requiresEmailConfirmation,
  });

  final String email;
  final bool requiresEmailConfirmation;
}

class SalonRepository implements HomeDataRepository, PushTokenSyncRepository {
  SalonRepository(this.client);

  final SupabaseClient client;

  Stream<AuthState> get authChanges => client.auth.onAuthStateChange;
  User? get currentUser => client.auth.currentUser;

  Future<void> signIn({required String email, required String password}) async {
    await client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<SignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim();

    final response = await client.auth.signUp(
      email: normalizedEmail,
      password: password,
      emailRedirectTo: _emailRedirectTo(),
    );

    return SignUpResult(
      email: normalizedEmail,
      requiresEmailConfirmation: response.session == null,
    );
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  Future<void> sendPasswordResetEmail({required String email}) async {
    await client.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo: _emailRedirectTo(),
    );
  }

  Future<CustomerProfile?> getCustomerProfile() async {
    final user = currentUser;
    if (user == null) {
      return null;
    }

    Map<String, dynamic>? data;

    try {
      final response = await client
          .from('customers')
          .select(
            'id, name, salon_id, salons(name, tagline, brand_color, whatsapp_phone, logo_path)',
          )
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (response != null) {
        data = Map<String, dynamic>.from(response);
      }
    } on PostgrestException catch (error) {
      if (!_isLegacyProfileSchemaError(error)) {
        rethrow;
      }

      final legacyResponse = await client
          .from('customers')
          .select('id, name, salon_id, salons(name)')
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (legacyResponse != null) {
        data = Map<String, dynamic>.from(legacyResponse);
      }
    }

    if (data == null) {
      return null;
    }

    final salonMap = _extractSalonMap(data['salons']);
    final logoPath = _readNullableString(salonMap['logo_path']);
    final salonLogoUrl = _buildSalonLogoUrl(logoPath);

    return CustomerProfile.fromMap(data, salonLogoUrl: salonLogoUrl);
  }

  @override
  Future<List<ServiceItem>> getServices() async {
    final data = await client
        .from('services')
        .select(
          'id, category, name, description, price, duration, sort_order, image_path',
        )
        .order('sort_order')
        .order('category')
        .order('name');

    return (data as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map((serviceMap) {
          final imagePath = _readNullableString(serviceMap['image_path']);
          return ServiceItem.fromMap({
            ...serviceMap,
            'image_url': imagePath == null
                ? null
                : _buildSalonLogoUrl(imagePath),
          });
        })
        .toList();
  }

  @override
  Future<List<SalonOfferItem>> getSalonOffers() async {
    try {
      final data = await client
          .from('salon_offers')
          .select(
            'id, kind, title, description, highlight_text, price, starts_on, ends_on, is_active, sort_order',
          )
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at', ascending: false);

      final today = DateTime.now();
      final startOfToday = DateTime(today.year, today.month, today.day);

      return (data as List)
          .map(
            (item) => SalonOfferItem.fromMap(Map<String, dynamic>.from(item)),
          )
          .where((offer) {
            final startsOn = offer.startsOn;
            final endsOn = offer.endsOn;

            if (startsOn != null &&
                DateTime(
                  startsOn.year,
                  startsOn.month,
                  startsOn.day,
                ).isAfter(startOfToday)) {
              return false;
            }

            if (endsOn != null &&
                DateTime(
                  endsOn.year,
                  endsOn.month,
                  endsOn.day,
                ).isBefore(startOfToday)) {
              return false;
            }

            return true;
          })
          .toList();
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_offers')) {
        return const [];
      }
      rethrow;
    }
  }

  @override
  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions() async {
    try {
      final data = await client.rpc('get_customer_growth_suggestions');
      if (data == null) {
        return null;
      }

      final feed = CustomerGrowthSuggestionFeed.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      return feed.hasVisibleContent ? feed : null;
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_growth_suggestions') ||
          message.contains('customer_growth_automation_runs')) {
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() async {
    try {
      final data = await client.rpc('get_customer_loyalty_summary');
      final summary = CustomerLoyaltySummary.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      return summary.hasVisibleContent ? summary : null;
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_loyalty_summary') ||
          message.contains('salon_loyalty_programs') ||
          message.contains('customer_loyalty_transactions')) {
        return null;
      }
      rethrow;
    }
  }

  Future<List<LoyaltyTransactionItem>> getLoyaltyTransactions({
    int limit = 20,
  }) async {
    try {
      final data = await client
          .from('customer_loyalty_transactions')
          .select(
            'id, transaction_kind, points_delta, cashback_delta, completed_visit_delta, description, metadata, created_at',
          )
          .order('created_at', ascending: false)
          .limit(limit);

      return (data as List)
          .map(
            (item) => LoyaltyTransactionItem.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('customer_loyalty_transactions')) {
        return const [];
      }
      rethrow;
    }
  }

  @override
  Future<ReferralSummary?> getReferralSummary() async {
    try {
      final data = await client.rpc('get_customer_referral_summary');
      final summary = ReferralSummary.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      if (summary.hasActiveProgram || summary.referralCode.isNotEmpty) {
        return summary;
      }

      return _getReferralSummaryFallback();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_referral_summary') ||
          message.contains('salon_referral_') ||
          message.contains('referral_code')) {
        return _getReferralSummaryFallback();
      }
      rethrow;
    }
  }

  Future<ReferralSummary?> _getReferralSummaryFallback() async {
    final user = currentUser;
    if (user == null) {
      return null;
    }

    final customerResponse = await client
        .from('customers')
        .select('id, salon_id, referral_code')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    if (customerResponse == null) {
      return null;
    }

    final customer = Map<String, dynamic>.from(customerResponse);
    final customerId = customer['id'] as String?;
    final salonId = customer['salon_id'] as String?;

    if (customerId == null || salonId == null) {
      return null;
    }

    final activeProgramResponse = await client
        .from('salon_referral_programs')
        .select(
          'title, description, reward_for_referrer, reward_for_invited, is_active',
        )
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('updated_at', ascending: false)
        .limit(1)
        .maybeSingle();

    final referralEventsResponse = await client
        .from('salon_referral_events')
        .select('id, invited_customer_id, status, qualified_at, created_at')
        .eq('referrer_customer_id', customerId)
        .order('created_at', ascending: false);

    final referralEvents = (referralEventsResponse as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();

    final invitedCustomerIds = referralEvents
        .map((item) => item['invited_customer_id'] as String?)
        .whereType<String>()
        .toSet()
        .toList();

    final invitedCustomerNames = <String, String>{};
    if (invitedCustomerIds.isNotEmpty) {
      final invitedCustomersResponse = await client
          .from('customers')
          .select('id, name')
          .inFilter('id', invitedCustomerIds);

      for (final item in invitedCustomersResponse as List) {
        final map = Map<String, dynamic>.from(item as Map);
        final invitedId = map['id'] as String?;
        final invitedName = _readNullableString(map['name']);
        if (invitedId != null && invitedName != null) {
          invitedCustomerNames[invitedId] = invitedName;
        }
      }
    }

    final referrals = referralEvents
        .map(
          (item) => ReferralProgressItem.fromMap({
            ...item,
            'customer_name':
                invitedCustomerNames[item['invited_customer_id']] ?? 'Cliente',
          }),
        )
        .toList();

    final pendingCount = referralEvents
        .where((item) => item['status'] == 'pending')
        .length;
    final qualifiedCount = referralEvents
        .where((item) => item['status'] == 'qualified')
        .length;

    return ReferralSummary(
      referralCode: _readNullableString(customer['referral_code']) ?? '',
      pendingCount: pendingCount,
      qualifiedCount: qualifiedCount,
      referrals: referrals,
      program: activeProgramResponse == null
          ? null
          : ReferralProgramInfo.fromMap(
              Map<String, dynamic>.from(activeProgramResponse),
            ),
    );
  }

  @override
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

  @override
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

  @override
  Future<List<CustomerNotificationItem>> getCustomerNotifications() async {
    try {
      final data = await client
          .from('salon_customer_notifications')
          .select('id, notification_type, title, body, created_at, payload')
          .order('created_at', ascending: false)
          .limit(30);

      return (data as List)
          .map(
            (item) => CustomerNotificationItem.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'salon_customer_notifications',
      )) {
        return const [];
      }
      rethrow;
    }
  }

  @override
  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() async {
    try {
      final data = await client
          .from('customer_notification_receipts')
          .select('source_type, source_id, archived_at');

      final readKeys = <String>{};
      final archivedKeys = <String>{};

      for (final item in data as List) {
        final map = Map<String, dynamic>.from(item as Map);
        final key =
            '${map['source_type']?.toString() ?? 'salon_notification'}:${map['source_id']}';
        readKeys.add(key);
        if (map['archived_at'] != null) {
          archivedKeys.add(key);
        }
      }

      return NotificationReceiptSnapshot(
        readKeys: readKeys,
        archivedKeys: archivedKeys,
      );
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'customer_notification_receipts',
      )) {
        return const NotificationReceiptSnapshot(
          readKeys: <String>{},
          archivedKeys: <String>{},
        );
      }
      rethrow;
    }
  }

  Future<void> markNotificationsRead(
    List<CustomerNotificationItem> notifications,
  ) async {
    if (notifications.isEmpty) {
      return;
    }

    final salonNotificationIds = notifications
        .where((item) => item.sourceType == 'salon_notification')
        .map((item) => item.id)
        .toList();
    final vacancyAlertIds = notifications
        .where((item) => item.sourceType == 'vacancy_alert')
        .map((item) => item.id)
        .toList();

    try {
      await client.rpc(
        'mark_customer_notifications_read',
        params: {
          'salon_notification_ids': salonNotificationIds,
          'vacancy_alert_ids': vacancyAlertIds,
        },
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('mark_customer_notifications_read') ||
          message.contains('customer_notification_receipts')) {
        return;
      }
      rethrow;
    }
  }

  Future<void> archiveNotifications(
    List<CustomerNotificationItem> notifications,
  ) async {
    if (notifications.isEmpty) {
      return;
    }

    final salonNotificationIds = notifications
        .where((item) => item.sourceType == 'salon_notification')
        .map((item) => item.id)
        .toList();
    final vacancyAlertIds = notifications
        .where((item) => item.sourceType == 'vacancy_alert')
        .map((item) => item.id)
        .toList();

    try {
      await client.rpc(
        'archive_customer_notifications',
        params: {
          'salon_notification_ids': salonNotificationIds,
          'vacancy_alert_ids': vacancyAlertIds,
        },
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('archive_customer_notifications') ||
          message.contains('customer_notification_receipts')) {
        return;
      }
      rethrow;
    }
  }

  @override
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

  @override
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

  @override
  Future<List<SalonPost>> getFeedPosts({required String customerId}) async {
    try {
      final data = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,created_at,services(id,name,price,duration),salon_post_images(image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
          )
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((postMap) {
            final imagePath = _readNullableString(postMap['image_path']) ?? '';
            final galleryMaps = _readListMap(postMap['salon_post_images'])
              ..sort(
                (left, right) => ((left['sort_order'] ?? 0) as num).compareTo(
                  (right['sort_order'] ?? 0) as num,
                ),
              );
            final imageUrls = galleryMaps.isNotEmpty
                ? galleryMaps
                      .map(
                        (image) => _buildSalonPostImageUrl(
                          image['image_path'] as String,
                        ),
                      )
                      .toList()
                : [_buildSalonPostImageUrl(imagePath)];
            return SalonPost.fromMap(
              postMap,
              currentCustomerId: customerId,
              imageUrls: imageUrls,
            );
          })
          .toList();
    } on PostgrestException catch (error) {
      if (_isLegacyFeedSchemaError(error)) {
        return _getLegacyFeedPosts(customerId: customerId);
      }
      rethrow;
    }
  }

  Future<void> likePost({required String postId}) async {
    await client.from('salon_post_likes').insert({'post_id': postId});
  }

  Future<void> unlikePost({
    required String postId,
    required String customerId,
  }) async {
    await client
        .from('salon_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('customer_id', customerId);
  }

  Future<void> addPostComment({
    required String postId,
    required String body,
  }) async {
    await client.from('salon_post_comments').insert({
      'post_id': postId,
      'body': body.trim(),
    });
  }

  Future<void> joinSalon({
    required String code,
    required String customerName,
    String? referralCode,
  }) async {
    final normalizedReferralCode = referralCode?.trim();

    await client.rpc(
      'join_salon',
      params: {
        'input_join_code': code.trim().toUpperCase(),
        'customer_name': customerName.trim(),
        'referral_code_input':
            normalizedReferralCode == null || normalizedReferralCode.isEmpty
            ? null
            : normalizedReferralCode.toUpperCase(),
      },
    );
  }

  Future<void> updateCustomerName({
    required String customerId,
    required String customerName,
  }) async {
    await client
        .from('customers')
        .update({'name': customerName.trim()})
        .eq('id', customerId);
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

  @override
  Future<void> registerPushToken({
    required String token,
    required String platform,
    String? deviceLabel,
  }) async {
    await client.rpc(
      'register_customer_push_token',
      params: {
        'input_token': token.trim(),
        'device_platform_input': platform.trim().toLowerCase(),
        'device_label_input': deviceLabel?.trim(),
      },
    );
  }

  @override
  Future<void> deactivatePushToken({required String token}) async {
    await client.rpc(
      'deactivate_customer_push_token',
      params: {'input_token': token.trim()},
    );
  }

  String? _emailRedirectTo() {
    if (!kIsWeb) {
      return null;
    }

    final base = Uri.base;
    if (base.hasAuthority) {
      return '${base.origin}/';
    }

    return null;
  }

  String? _buildSalonLogoUrl(String? logoPath) {
    if (logoPath == null) {
      return null;
    }

    return client.storage.from('salon-assets').getPublicUrl(logoPath);
  }

  String _buildSalonPostImageUrl(String imagePath) {
    return client.storage.from('salon-posts').getPublicUrl(imagePath);
  }

  bool _isLegacyProfileSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return message.contains('tagline') ||
        message.contains('brand_color') ||
        message.contains('whatsapp_phone') ||
        message.contains('logo_path');
  }

  bool _isMissingFeedSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return message.contains('salon_posts') ||
        message.contains('salon_post_likes') ||
        message.contains('salon_post_comments');
  }

  bool _isLegacyFeedSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return _isMissingFeedSchemaError(error) ||
        message.contains('salon_post_images') ||
        message.contains('service_id');
  }

  Future<List<SalonPost>> _getLegacyFeedPosts({
    required String customerId,
  }) async {
    try {
      final data = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,created_at,salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
          )
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((postMap) {
            final imagePath = _readNullableString(postMap['image_path']) ?? '';
            return SalonPost.fromMap(
              postMap,
              currentCustomerId: customerId,
              imageUrls: [_buildSalonPostImageUrl(imagePath)],
            );
          })
          .toList();
    } on PostgrestException catch (error) {
      if (_isMissingFeedSchemaError(error)) {
        return const [];
      }
      rethrow;
    }
  }
}

Map<String, dynamic> _extractSalonMap(Object? salonData) {
  if (salonData is List) {
    if (salonData.isEmpty) {
      return <String, dynamic>{};
    }

    return Map<String, dynamic>.from(salonData.first as Map);
  }

  if (salonData is Map) {
    return Map<String, dynamic>.from(salonData);
  }

  return <String, dynamic>{};
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}

List<Map<String, dynamic>> _readListMap(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}
