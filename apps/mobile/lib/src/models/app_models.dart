import 'client_app_config.dart';

class CustomerProfile {
  const CustomerProfile({
    required this.id,
    required this.name,
    required this.salonId,
    required this.salonName,
    this.phone,
    this.preferences,
    this.allergies,
    this.beautyProducts,
    this.salonTagline,
    this.salonBrandColor,
    this.salonBusinessSegment,
    this.salonWhatsappPhone,
    this.salonLogoUrl,
    this.salonClientAppConfig = const SalonClientAppConfig(),
  });

  final String id;
  final String name;
  final String salonId;
  final String salonName;
  final String? phone;
  final String? preferences;
  final String? allergies;
  final String? beautyProducts;
  final String? salonTagline;
  final String? salonBrandColor;
  final String? salonBusinessSegment;
  final String? salonWhatsappPhone;
  final String? salonLogoUrl;
  final SalonClientAppConfig salonClientAppConfig;

  CustomerProfile copyWith({
    String? name,
    String? phone,
    bool clearPhone = false,
    String? preferences,
    bool clearPreferences = false,
    String? allergies,
    bool clearAllergies = false,
    String? beautyProducts,
    bool clearBeautyProducts = false,
  }) {
    return CustomerProfile(
      id: id,
      name: name ?? this.name,
      salonId: salonId,
      salonName: salonName,
      phone: clearPhone ? null : phone ?? this.phone,
      preferences: clearPreferences ? null : preferences ?? this.preferences,
      allergies: clearAllergies ? null : allergies ?? this.allergies,
      beautyProducts: clearBeautyProducts
          ? null
          : beautyProducts ?? this.beautyProducts,
      salonTagline: salonTagline,
      salonBrandColor: salonBrandColor,
      salonBusinessSegment: salonBusinessSegment,
      salonWhatsappPhone: salonWhatsappPhone,
      salonLogoUrl: salonLogoUrl,
      salonClientAppConfig: salonClientAppConfig,
    );
  }

  factory CustomerProfile.fromMap(
    Map<String, dynamic> map, {
    String? salonLogoUrl,
  }) {
    final salonMap = _asSingleMap(map['salons']);

    return CustomerProfile(
      id: map['id'] as String,
      name: (map['name'] ?? 'Cliente') as String,
      salonId: (map['salon_id'] ?? '') as String,
      salonName: (salonMap['name'] ?? 'Salão') as String,
      phone: _readNullableString(map['phone']),
      preferences: _readNullableString(map['preferences']),
      allergies: _readNullableString(map['allergies']),
      beautyProducts: _readNullableString(map['beauty_products']),
      salonTagline: _readNullableString(salonMap['tagline']),
      salonBrandColor: _readNullableString(salonMap['brand_color']),
      salonBusinessSegment: _readNullableString(salonMap['business_segment']),
      salonWhatsappPhone: _readNullableString(salonMap['whatsapp_phone']),
      salonLogoUrl: salonLogoUrl,
      salonClientAppConfig: SalonClientAppConfig.fromDynamic(
        salonMap['client_app_config'],
      ),
    );
  }
}

class SalonJoinPreview {
  const SalonJoinPreview({
    required this.salonId,
    required this.name,
    this.tagline,
    this.brandColor,
    this.businessSegment,
    this.whatsappPhone,
    this.logoUrl,
    this.clientAppConfig = const SalonClientAppConfig(),
  });

  final String salonId;
  final String name;
  final String? tagline;
  final String? brandColor;
  final String? businessSegment;
  final String? whatsappPhone;
  final String? logoUrl;
  final SalonClientAppConfig clientAppConfig;

  factory SalonJoinPreview.fromMap(
    Map<String, dynamic> map, {
    String? salonLogoUrl,
  }) {
    return SalonJoinPreview(
      salonId: (map['salon_id'] ?? map['id'] ?? '') as String,
      name: (map['name'] ?? 'Salão') as String,
      tagline: _readNullableString(map['tagline']),
      brandColor: _readNullableString(map['brand_color']),
      businessSegment: _readNullableString(map['business_segment']),
      whatsappPhone: _readNullableString(map['whatsapp_phone']),
      logoUrl: salonLogoUrl,
      clientAppConfig: SalonClientAppConfig.fromDynamic(
        map['client_app_config'],
      ),
    );
  }
}

class ServiceItem {
  const ServiceItem({
    required this.id,
    required this.name,
    required this.price,
    required this.duration,
    this.category,
    this.description,
    this.imageUrl,
  });

  final String id;
  final String name;
  final double price;
  final int duration;
  final String? category;
  final String? description;
  final String? imageUrl;

  factory ServiceItem.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price'];

    return ServiceItem(
      id: (map['id'] ?? '') as String,
      name: (map['name'] ?? 'Serviço') as String,
      price: rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice?.toString() ?? '') ?? 0,
      duration: _readInt(map['duration']),
      category: _readNullableString(map['category']),
      description: _readNullableString(map['description']),
      imageUrl: _readNullableString(map['image_url']),
    );
  }
}

class TeamMember {
  const TeamMember({
    required this.id,
    required this.name,
    this.role,
    this.isWorkingToday = false,
    this.opensAt,
    this.closesAt,
    this.serviceNames = const <String>[],
    this.serviceCategories = const <String>[],
  });

  final String id;
  final String name;
  final String? role;
  final bool isWorkingToday;
  final String? opensAt;
  final String? closesAt;
  final List<String> serviceNames;
  final List<String> serviceCategories;

  String get primarySpecialty {
    if (role != null && role!.trim().isNotEmpty) {
      return role!;
    }
    if (serviceCategories.isNotEmpty) {
      return serviceCategories.first;
    }
    if (serviceNames.isNotEmpty) {
      return serviceNames.first;
    }

    return 'Profissional do salão';
  }

  factory TeamMember.fromMap(Map<String, dynamic> map) {
    return TeamMember(
      id: (map['id'] ?? '') as String,
      name: (map['name'] ?? 'Profissional') as String,
      role: _readNullableString(map['role']),
      isWorkingToday: (map['is_working_today'] ?? false) as bool,
      opensAt: _readNullableString(map['opens_at']),
      closesAt: _readNullableString(map['closes_at']),
      serviceNames: _readStringList(map['service_names']),
      serviceCategories: _readStringList(map['service_categories']),
    );
  }
}

class OfferItem {
  const OfferItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.isActive,
    required this.sortOrder,
    this.description,
    this.highlightText,
    this.price,
    this.startsOn,
    this.endsOn,
  });

  final String id;
  final String kind;
  final String title;
  final String? description;
  final String? highlightText;
  final double? price;
  final DateTime? startsOn;
  final DateTime? endsOn;
  final bool isActive;
  final int sortOrder;

  bool get isMembership => kind == 'membership';

  factory OfferItem.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price'];

    return OfferItem(
      id: (map['id'] ?? '') as String,
      kind: (map['kind'] ?? 'promotion') as String,
      title: (map['title'] ?? 'Oferta do salão') as String,
      description: _readNullableString(map['description']),
      highlightText: _readNullableString(map['highlight_text']),
      price: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
      startsOn: _parseDateOnly(map['starts_on']),
      endsOn: _parseDateOnly(map['ends_on']),
      isActive: (map['is_active'] ?? false) as bool,
      sortOrder: _readInt(map['sort_order']),
    );
  }
}

class RetailProduct {
  const RetailProduct({
    required this.id,
    required this.name,
    this.brand,
    this.retailPrice,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String? brand;
  final double? retailPrice;
  final DateTime? updatedAt;

  factory RetailProduct.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['retail_price'];

    return RetailProduct(
      id: (map['id'] ?? '') as String,
      name: (map['name'] ?? 'Produto') as String,
      brand: _readNullableString(map['brand']),
      retailPrice: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
      updatedAt: _readDateTime(map['updated_at']),
    );
  }
}

class FeedComment {
  const FeedComment({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String customerId;
  final String customerName;
  final String body;
  final DateTime createdAt;

  factory FeedComment.fromMap(Map<String, dynamic> map) {
    return FeedComment(
      id: (map['id'] ?? '') as String,
      customerId: (map['customer_id'] ?? '') as String,
      customerName: (map['customer_name'] ?? 'Cliente') as String,
      body: (map['body'] ?? '') as String,
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
    );
  }
}

class FeedPost {
  const FeedPost({
    required this.id,
    required this.title,
    required this.imageUrls,
    required this.createdAt,
    required this.likeCount,
    required this.commentCount,
    required this.likedByMe,
    required this.comments,
    this.caption,
    this.postType = 'standard',
    this.videoUrl,
    this.staffMemberName,
    this.staffMemberRole,
    this.linkedService,
  });

  final String id;
  final String title;
  final String? caption;
  final List<String> imageUrls;
  final DateTime createdAt;
  final int likeCount;
  final int commentCount;
  final bool likedByMe;
  final List<FeedComment> comments;
  final String postType;
  final String? videoUrl;
  final String? staffMemberName;
  final String? staffMemberRole;
  final ServiceItem? linkedService;

  String get coverImageUrl => imageUrls.first;

  FeedPost copyWith({
    int? likeCount,
    int? commentCount,
    bool? likedByMe,
    List<FeedComment>? comments,
  }) {
    return FeedPost(
      id: id,
      title: title,
      caption: caption,
      imageUrls: imageUrls,
      createdAt: createdAt,
      likeCount: likeCount ?? this.likeCount,
      commentCount: commentCount ?? this.commentCount,
      likedByMe: likedByMe ?? this.likedByMe,
      comments: comments ?? this.comments,
      postType: postType,
      videoUrl: videoUrl,
      staffMemberName: staffMemberName,
      staffMemberRole: staffMemberRole,
      linkedService: linkedService,
    );
  }

  factory FeedPost.fromMap(
    Map<String, dynamic> map, {
    required String currentCustomerId,
    required List<String> imageUrls,
  }) {
    final likes = _readListMaps(map['salon_post_likes']);
    final comments = _readListMaps(
      map['salon_post_comments'],
    ).map(FeedComment.fromMap).toList(growable: false);
    final staffMap = _asSingleMap(map['staff_members']);
    final serviceMap = _asSingleMap(map['services']);

    return FeedPost(
      id: (map['id'] ?? '') as String,
      title: (map['title'] ?? 'Resultado do salão') as String,
      caption: _readNullableString(map['caption']),
      imageUrls: imageUrls,
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
      likeCount: likes.length,
      commentCount: comments.length,
      likedByMe: likes.any(
        (entry) => entry['customer_id']?.toString() == currentCustomerId,
      ),
      comments: comments,
      postType: (map['post_type'] ?? 'standard') as String,
      videoUrl: _readNullableString(map['video_url']),
      staffMemberName: _readNullableString(staffMap['name']),
      staffMemberRole: _readNullableString(staffMap['role']),
      linkedService: serviceMap.isEmpty
          ? null
          : ServiceItem.fromMap(serviceMap),
    );
  }
}

class AppointmentItem {
  const AppointmentItem({
    required this.id,
    required this.date,
    required this.endsAt,
    required this.status,
    required this.serviceName,
    required this.serviceDuration,
    required this.servicePrice,
    this.staffMemberName,
    this.cancelledAt,
    this.cancelledBy,
    this.cancellationReason,
    this.completedAt,
    this.customerConfirmationRequestedAt,
    this.customerPresenceConfirmedAt,
  });

  final String id;
  final DateTime date;
  final DateTime endsAt;
  final String status;
  final String serviceName;
  final int serviceDuration;
  final double servicePrice;
  final String? staffMemberName;
  final DateTime? cancelledAt;
  final String? cancelledBy;
  final String? cancellationReason;
  final DateTime? completedAt;
  final DateTime? customerConfirmationRequestedAt;
  final DateTime? customerPresenceConfirmedAt;

  bool get isUpcoming =>
      (status == 'pending' || status == 'confirmed') &&
      date.isAfter(DateTime.now());

  bool get canBeCancelled =>
      (status == 'pending' || status == 'confirmed') &&
      date.isAfter(DateTime.now());

  bool get requiresPresenceConfirmation {
    if (status != 'confirmed' || customerPresenceConfirmedAt != null) {
      return false;
    }

    final now = DateTime.now();
    if (!date.isAfter(now)) {
      return false;
    }

    return customerConfirmationRequestedAt != null ||
        date.isBefore(now.add(const Duration(minutes: 35)));
  }

  factory AppointmentItem.fromMap(Map<String, dynamic> map) {
    final serviceMap = _asSingleMap(map['services']);
    final staffMap = _asSingleMap(map['staff_members']);
    final date = _readDateTime(map['date']) ?? DateTime.now();

    return AppointmentItem(
      id: (map['id'] ?? '') as String,
      date: date,
      endsAt:
          _readDateTime(map['ends_at']) ??
          date.add(
            Duration(minutes: _readInt(serviceMap['duration'], fallback: 60)),
          ),
      status: (map['status'] ?? 'pending') as String,
      serviceName: (serviceMap['name'] ?? 'Serviço') as String,
      serviceDuration: _readInt(serviceMap['duration'], fallback: 60),
      servicePrice: _readDouble(serviceMap['price']),
      staffMemberName: _readNullableString(staffMap['name']),
      cancelledAt: _readDateTime(map['cancelled_at']),
      cancelledBy: _readNullableString(map['cancelled_by']),
      cancellationReason: _readNullableString(map['cancellation_reason']),
      completedAt: _readDateTime(map['completed_at']),
      customerConfirmationRequestedAt: _readDateTime(
        map['customer_confirmation_requested_at'],
      ),
      customerPresenceConfirmedAt: _readDateTime(
        map['customer_presence_confirmed_at'],
      ),
    );
  }
}

class VacancyAlert {
  const VacancyAlert({
    required this.id,
    required this.headline,
    required this.body,
    required this.startsAt,
    required this.endsAt,
    required this.createdAt,
    required this.serviceId,
    this.staffMemberId,
  });

  final String id;
  final String headline;
  final String body;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime createdAt;
  final String serviceId;
  final String? staffMemberId;

  factory VacancyAlert.fromMap(Map<String, dynamic> map) {
    return VacancyAlert(
      id: (map['id'] ?? '') as String,
      headline: (map['headline'] ?? 'Horário liberado') as String,
      body: (map['body'] ?? '') as String,
      startsAt: _readDateTime(map['starts_at']) ?? DateTime.now(),
      endsAt: _readDateTime(map['ends_at']) ?? DateTime.now(),
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
      serviceId: (map['service_id'] ?? '') as String,
      staffMemberId: _readNullableString(map['staff_member_id']),
    );
  }
}

class AvailableSlot {
  const AvailableSlot({
    required this.startAt,
    required this.endsAt,
    required this.staffMemberId,
    required this.staffMemberName,
  });

  final DateTime startAt;
  final DateTime endsAt;
  final String staffMemberId;
  final String staffMemberName;

  factory AvailableSlot.fromMap(Map<String, dynamic> map) {
    return AvailableSlot(
      startAt: _readDateTime(map['start_at']) ?? DateTime.now(),
      endsAt: _readDateTime(map['ends_at']) ?? DateTime.now(),
      staffMemberId: (map['staff_member_id'] ?? '') as String,
      staffMemberName: (map['staff_member_name'] ?? 'Profissional') as String,
    );
  }
}

class DayAvailability {
  const DayAvailability({
    required this.day,
    required this.timezone,
    required this.slotStepMinutes,
    required this.serviceDuration,
    required this.isOpen,
    required this.availableSlots,
    required this.staffNames,
    this.opensAt,
    this.closesAt,
  });

  final DateTime day;
  final String timezone;
  final int slotStepMinutes;
  final int serviceDuration;
  final bool isOpen;
  final List<AvailableSlot> availableSlots;
  final List<String> staffNames;
  final String? opensAt;
  final String? closesAt;

  factory DayAvailability.fromMap(Map<String, dynamic> map) {
    return DayAvailability(
      day: _readDateTime(map['target_day']) ?? DateTime.now(),
      timezone: (map['timezone'] ?? 'America/Sao_Paulo') as String,
      slotStepMinutes: _readInt(map['slot_step_minutes'], fallback: 30),
      serviceDuration: _readInt(map['service_duration'], fallback: 0),
      isOpen: (map['is_open'] ?? false) as bool,
      availableSlots: _readListMaps(
        map['available_slots'],
      ).map(AvailableSlot.fromMap).toList(growable: false),
      staffNames: _readListMaps(map['staff_members'])
          .map((entry) => _readNullableString(entry['name']))
          .whereType<String>()
          .toList(growable: false),
      opensAt: _readNullableString(map['opens_at']),
      closesAt: _readNullableString(map['closes_at']),
    );
  }
}

class LoyaltySummary {
  const LoyaltySummary({
    required this.pointsBalance,
    required this.cashbackBalance,
    required this.completedVisits,
    required this.visitsToNextTier,
    this.rankPosition,
    this.currentTierLabel,
    this.nextTierLabel,
  });

  final int pointsBalance;
  final double cashbackBalance;
  final int completedVisits;
  final int visitsToNextTier;
  final int? rankPosition;
  final String? currentTierLabel;
  final String? nextTierLabel;

  bool get hasVisibleContent =>
      pointsBalance > 0 || cashbackBalance > 0 || completedVisits > 0;

  factory LoyaltySummary.fromMap(Map<String, dynamic> map) {
    final currentTier = _asSingleMap(map['current_tier']);
    final nextTier = _asSingleMap(map['next_tier']);

    return LoyaltySummary(
      pointsBalance: _readInt(map['points_balance']),
      cashbackBalance: _readDouble(map['cashback_balance']),
      completedVisits: _readInt(map['completed_visits']),
      visitsToNextTier: _readInt(map['visits_to_next_tier']),
      rankPosition: map['rank_position'] == null
          ? null
          : _readInt(map['rank_position']),
      currentTierLabel: _readNullableString(currentTier['label']),
      nextTierLabel: _readNullableString(nextTier['label']),
    );
  }
}

class ReferralSummary {
  const ReferralSummary({
    required this.referralCode,
    required this.pendingCount,
    required this.qualifiedCount,
    required this.nextRewardRemaining,
    required this.availableRewardsCount,
    this.hasActiveProgram = false,
  });

  final String referralCode;
  final int pendingCount;
  final int qualifiedCount;
  final int nextRewardRemaining;
  final int availableRewardsCount;
  final bool hasActiveProgram;

  bool get hasVisibleContent =>
      hasActiveProgram ||
      referralCode.isNotEmpty ||
      pendingCount > 0 ||
      qualifiedCount > 0 ||
      availableRewardsCount > 0;

  factory ReferralSummary.fromMap(Map<String, dynamic> map) {
    final program = _asSingleMap(map['program']);

    return ReferralSummary(
      referralCode: _readNullableString(map['referral_code']) ?? '',
      pendingCount: _readInt(map['pending_count']),
      qualifiedCount: _readInt(map['qualified_count']),
      nextRewardRemaining: _readInt(map['next_reward_remaining']),
      availableRewardsCount: _readInt(map['available_rewards_count']),
      hasActiveProgram: (program['is_active'] ?? false) as bool,
    );
  }
}

class NotificationReceiptSnapshot {
  const NotificationReceiptSnapshot({
    required this.readKeys,
    required this.archivedKeys,
  });

  final Set<String> readKeys;
  final Set<String> archivedKeys;
}

class CustomerNotificationItem {
  const CustomerNotificationItem({
    required this.id,
    required this.sourceType,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.payload = const <String, dynamic>{},
    this.isRead = false,
  });

  final String id;
  final String sourceType;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;
  final Map<String, dynamic> payload;
  final bool isRead;

  String get readKey => '$sourceType:$id';

  CustomerNotificationItem copyWith({bool? isRead}) {
    return CustomerNotificationItem(
      id: id,
      sourceType: sourceType,
      type: type,
      title: title,
      body: body,
      createdAt: createdAt,
      payload: payload,
      isRead: isRead ?? this.isRead,
    );
  }

  factory CustomerNotificationItem.fromMap(
    Map<String, dynamic> map, {
    bool isRead = false,
  }) {
    final payloadValue = map['payload'];
    final payload = payloadValue is Map
        ? Map<String, dynamic>.from(payloadValue)
        : <String, dynamic>{};

    return CustomerNotificationItem(
      id: (map['id'] ?? '') as String,
      sourceType: 'salon_notification',
      type: (map['notification_type'] ?? 'salon_update') as String,
      title: (map['title'] ?? 'Atualização do salão') as String,
      body: (map['body'] ?? '') as String,
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
      payload: payload,
      isRead: isRead,
    );
  }
}

class HomeSnapshot {
  const HomeSnapshot({
    required this.services,
    required this.teamMembers,
    required this.offers,
    required this.products,
    required this.appointments,
    required this.vacancyAlerts,
    required this.posts,
    required this.notifications,
    required this.loyaltySummary,
    required this.referralSummary,
  });

  final List<ServiceItem> services;
  final List<TeamMember> teamMembers;
  final List<OfferItem> offers;
  final List<RetailProduct> products;
  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
  final List<FeedPost> posts;
  final List<CustomerNotificationItem> notifications;
  final LoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;

  AppointmentItem? get nextAppointment {
    final upcoming =
        appointments.where((item) => item.isUpcoming).toList(growable: false)
          ..sort((left, right) => left.date.compareTo(right.date));

    return upcoming.isEmpty ? null : upcoming.first;
  }

  int get unreadNotificationsCount =>
      notifications.where((item) => !item.isRead).length;
}

class ExploreSnapshot {
  const ExploreSnapshot({
    required this.services,
    required this.teamMembers,
    required this.offers,
    required this.products,
  });

  final List<ServiceItem> services;
  final List<TeamMember> teamMembers;
  final List<OfferItem> offers;
  final List<RetailProduct> products;
}

class AppointmentsSnapshot {
  const AppointmentsSnapshot({
    required this.appointments,
    required this.vacancyAlerts,
  });

  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
}

class FeedSnapshot {
  const FeedSnapshot({required this.posts});

  final List<FeedPost> posts;
}

class ProfileSnapshot {
  const ProfileSnapshot({
    required this.loyaltySummary,
    required this.referralSummary,
    required this.unreadNotificationsCount,
  });

  final LoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final int unreadNotificationsCount;
}

class CachedView<T> {
  const CachedView({
    required this.data,
    required this.isFromCache,
    this.cachedAt,
    this.fallbackReason,
  });

  final T data;
  final bool isFromCache;
  final DateTime? cachedAt;
  final String? fallbackReason;
}

Map<String, dynamic> _asSingleMap(Object? value) {
  if (value is List && value.isNotEmpty && value.first is Map) {
    return Map<String, dynamic>.from(value.first as Map);
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }

  return <String, dynamic>{};
}

List<Map<String, dynamic>> _readListMaps(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList(growable: false);
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const <String>[];
  }

  return value
      .map((item) => item?.toString().trim())
      .whereType<String>()
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

DateTime? _readDateTime(Object? value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return null;
  }

  return DateTime.tryParse(raw)?.toLocal();
}

DateTime? _parseDateOnly(Object? value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return null;
  }

  return DateTime.tryParse('${raw}T12:00:00')?.toLocal();
}

int _readInt(Object? value, {int fallback = 0}) {
  if (value is num) {
    return value.toInt();
  }

  return int.tryParse(value?.toString() ?? '') ?? fallback;
}

double _readDouble(Object? value, {double fallback = 0}) {
  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse(value?.toString() ?? '') ?? fallback;
}
