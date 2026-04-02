import '../models/app_models.dart';
import '../models/client_app_config.dart';

Map<String, dynamic> encodeCustomerProfile(CustomerProfile profile) {
  return <String, dynamic>{
    'id': profile.id,
    'name': profile.name,
    'salon_id': profile.salonId,
    'salon_name': profile.salonName,
    'phone': profile.phone,
    'preferences': profile.preferences,
    'allergies': profile.allergies,
    'beauty_products': profile.beautyProducts,
    'salon_tagline': profile.salonTagline,
    'salon_brand_color': profile.salonBrandColor,
    'salon_business_segment': profile.salonBusinessSegment,
    'salon_whatsapp_phone': profile.salonWhatsappPhone,
    'salon_logo_url': profile.salonLogoUrl,
    'salon_client_app_config': profile.salonClientAppConfig.rawConfig,
  };
}

CustomerProfile decodeCustomerProfile(Map<String, dynamic> map) {
  return CustomerProfile(
    id: map['id']?.toString() ?? '',
    name: map['name']?.toString() ?? 'Cliente',
    salonId: map['salon_id']?.toString() ?? '',
    salonName: map['salon_name']?.toString() ?? 'Salão',
    phone: _asNullableString(map['phone']),
    preferences: _asNullableString(map['preferences']),
    allergies: _asNullableString(map['allergies']),
    beautyProducts: _asNullableString(map['beauty_products']),
    salonTagline: _asNullableString(map['salon_tagline']),
    salonBrandColor: _asNullableString(map['salon_brand_color']),
    salonBusinessSegment: _asNullableString(map['salon_business_segment']),
    salonWhatsappPhone: _asNullableString(map['salon_whatsapp_phone']),
    salonLogoUrl: _asNullableString(map['salon_logo_url']),
    salonClientAppConfig: SalonClientAppConfig.fromDynamic(
      map['salon_client_app_config'],
    ),
  );
}

Map<String, dynamic> encodeHomeSnapshot(HomeSnapshot snapshot) {
  return <String, dynamic>{
    'services': snapshot.services.map(_encodeService).toList(growable: false),
    'team_members': snapshot.teamMembers
        .map(_encodeTeamMember)
        .toList(growable: false),
    'offers': snapshot.offers.map(_encodeOffer).toList(growable: false),
    'products': snapshot.products.map(_encodeProduct).toList(growable: false),
    'appointments': snapshot.appointments
        .map(_encodeAppointment)
        .toList(growable: false),
    'vacancy_alerts': snapshot.vacancyAlerts
        .map(_encodeVacancyAlert)
        .toList(growable: false),
    'posts': snapshot.posts.map(_encodeFeedPost).toList(growable: false),
    'notifications': snapshot.notifications
        .map(_encodeNotification)
        .toList(growable: false),
    'loyalty_summary': snapshot.loyaltySummary == null
        ? null
        : _encodeLoyaltySummary(snapshot.loyaltySummary!),
    'referral_summary': snapshot.referralSummary == null
        ? null
        : _encodeReferralSummary(snapshot.referralSummary!),
  };
}

HomeSnapshot decodeHomeSnapshot(Map<String, dynamic> map) {
  final loyaltyPayload = _readMap(map['loyalty_summary']);
  final referralPayload = _readMap(map['referral_summary']);

  return HomeSnapshot(
    services: _readMapList(
      map['services'],
    ).map(_decodeService).toList(growable: false),
    teamMembers: _readMapList(
      map['team_members'],
    ).map(_decodeTeamMember).toList(growable: false),
    offers: _readMapList(
      map['offers'],
    ).map(_decodeOffer).toList(growable: false),
    products: _readMapList(
      map['products'],
    ).map(_decodeProduct).toList(growable: false),
    appointments: _readMapList(
      map['appointments'],
    ).map(_decodeAppointment).toList(growable: false),
    vacancyAlerts: _readMapList(
      map['vacancy_alerts'],
    ).map(_decodeVacancyAlert).toList(growable: false),
    posts: _readMapList(
      map['posts'],
    ).map(_decodeFeedPost).toList(growable: false),
    notifications: _readMapList(
      map['notifications'],
    ).map(_decodeNotification).toList(growable: false),
    loyaltySummary: loyaltyPayload == null
        ? null
        : _decodeLoyaltySummary(loyaltyPayload),
    referralSummary: referralPayload == null
        ? null
        : _decodeReferralSummary(referralPayload),
  );
}

Map<String, dynamic> encodeExploreSnapshot(ExploreSnapshot snapshot) {
  return <String, dynamic>{
    'services': snapshot.services.map(_encodeService).toList(growable: false),
    'team_members': snapshot.teamMembers
        .map(_encodeTeamMember)
        .toList(growable: false),
    'offers': snapshot.offers.map(_encodeOffer).toList(growable: false),
    'products': snapshot.products.map(_encodeProduct).toList(growable: false),
  };
}

ExploreSnapshot decodeExploreSnapshot(Map<String, dynamic> map) {
  return ExploreSnapshot(
    services: _readMapList(
      map['services'],
    ).map(_decodeService).toList(growable: false),
    teamMembers: _readMapList(
      map['team_members'],
    ).map(_decodeTeamMember).toList(growable: false),
    offers: _readMapList(
      map['offers'],
    ).map(_decodeOffer).toList(growable: false),
    products: _readMapList(
      map['products'],
    ).map(_decodeProduct).toList(growable: false),
  );
}

Map<String, dynamic> encodeAppointmentsSnapshot(AppointmentsSnapshot snapshot) {
  return <String, dynamic>{
    'appointments': snapshot.appointments
        .map(_encodeAppointment)
        .toList(growable: false),
    'vacancy_alerts': snapshot.vacancyAlerts
        .map(_encodeVacancyAlert)
        .toList(growable: false),
  };
}

AppointmentsSnapshot decodeAppointmentsSnapshot(Map<String, dynamic> map) {
  return AppointmentsSnapshot(
    appointments: _readMapList(
      map['appointments'],
    ).map(_decodeAppointment).toList(growable: false),
    vacancyAlerts: _readMapList(
      map['vacancy_alerts'],
    ).map(_decodeVacancyAlert).toList(growable: false),
  );
}

Map<String, dynamic> encodeFeedSnapshot(FeedSnapshot snapshot) {
  return <String, dynamic>{
    'posts': snapshot.posts.map(_encodeFeedPost).toList(growable: false),
  };
}

FeedSnapshot decodeFeedSnapshot(Map<String, dynamic> map) {
  return FeedSnapshot(
    posts: _readMapList(
      map['posts'],
    ).map(_decodeFeedPost).toList(growable: false),
  );
}

Map<String, dynamic> encodeProfileSnapshot(ProfileSnapshot snapshot) {
  return <String, dynamic>{
    'loyalty_summary': snapshot.loyaltySummary == null
        ? null
        : _encodeLoyaltySummary(snapshot.loyaltySummary!),
    'referral_summary': snapshot.referralSummary == null
        ? null
        : _encodeReferralSummary(snapshot.referralSummary!),
    'unread_notifications_count': snapshot.unreadNotificationsCount,
  };
}

ProfileSnapshot decodeProfileSnapshot(Map<String, dynamic> map) {
  final loyaltyPayload = _readMap(map['loyalty_summary']);
  final referralPayload = _readMap(map['referral_summary']);

  return ProfileSnapshot(
    loyaltySummary: loyaltyPayload == null
        ? null
        : _decodeLoyaltySummary(loyaltyPayload),
    referralSummary: referralPayload == null
        ? null
        : _decodeReferralSummary(referralPayload),
    unreadNotificationsCount:
        (map['unread_notifications_count'] as num?)?.toInt() ?? 0,
  );
}

Map<String, dynamic> encodeDayAvailability(DayAvailability availability) {
  return <String, dynamic>{
    'target_day': _encodeDate(availability.day),
    'timezone': availability.timezone,
    'slot_step_minutes': availability.slotStepMinutes,
    'service_duration': availability.serviceDuration,
    'is_open': availability.isOpen,
    'available_slots': availability.availableSlots
        .map(_encodeAvailableSlot)
        .toList(growable: false),
    'staff_members': availability.staffNames
        .map((name) => <String, dynamic>{'name': name})
        .toList(growable: false),
    'opens_at': availability.opensAt,
    'closes_at': availability.closesAt,
  };
}

DayAvailability decodeDayAvailability(Map<String, dynamic> map) {
  return DayAvailability(
    day: _decodeDate(map['target_day']) ?? DateTime.now(),
    timezone: map['timezone']?.toString() ?? 'America/Sao_Paulo',
    slotStepMinutes: (map['slot_step_minutes'] as num?)?.toInt() ?? 30,
    serviceDuration: (map['service_duration'] as num?)?.toInt() ?? 0,
    isOpen: map['is_open'] as bool? ?? false,
    availableSlots: _readMapList(
      map['available_slots'],
    ).map(_decodeAvailableSlot).toList(growable: false),
    staffNames: _readMapList(map['staff_members'])
        .map((entry) => _asNullableString(entry['name']))
        .whereType<String>()
        .toList(growable: false),
    opensAt: _asNullableString(map['opens_at']),
    closesAt: _asNullableString(map['closes_at']),
  );
}

Map<String, dynamic> _encodeService(ServiceItem item) {
  return <String, dynamic>{
    'id': item.id,
    'name': item.name,
    'price': item.price,
    'duration': item.duration,
    'category': item.category,
    'description': item.description,
    'image_url': item.imageUrl,
  };
}

ServiceItem _decodeService(Map<String, dynamic> map) {
  return ServiceItem(
    id: map['id']?.toString() ?? '',
    name: map['name']?.toString() ?? 'Serviço',
    price: (map['price'] as num?)?.toDouble() ?? 0,
    duration: (map['duration'] as num?)?.toInt() ?? 0,
    category: _asNullableString(map['category']),
    description: _asNullableString(map['description']),
    imageUrl: _asNullableString(map['image_url']),
  );
}

Map<String, dynamic> _encodeTeamMember(TeamMember item) {
  return <String, dynamic>{
    'id': item.id,
    'name': item.name,
    'role': item.role,
    'is_working_today': item.isWorkingToday,
    'opens_at': item.opensAt,
    'closes_at': item.closesAt,
    'service_names': item.serviceNames,
    'service_categories': item.serviceCategories,
  };
}

TeamMember _decodeTeamMember(Map<String, dynamic> map) {
  return TeamMember(
    id: map['id']?.toString() ?? '',
    name: map['name']?.toString() ?? 'Profissional',
    role: _asNullableString(map['role']),
    isWorkingToday: map['is_working_today'] as bool? ?? false,
    opensAt: _asNullableString(map['opens_at']),
    closesAt: _asNullableString(map['closes_at']),
    serviceNames: _readStringList(map['service_names']),
    serviceCategories: _readStringList(map['service_categories']),
  );
}

Map<String, dynamic> _encodeOffer(OfferItem item) {
  return <String, dynamic>{
    'id': item.id,
    'kind': item.kind,
    'title': item.title,
    'description': item.description,
    'highlight_text': item.highlightText,
    'price': item.price,
    'starts_on': _encodeDate(item.startsOn),
    'ends_on': _encodeDate(item.endsOn),
    'is_active': item.isActive,
    'sort_order': item.sortOrder,
  };
}

OfferItem _decodeOffer(Map<String, dynamic> map) {
  return OfferItem(
    id: map['id']?.toString() ?? '',
    kind: map['kind']?.toString() ?? 'promotion',
    title: map['title']?.toString() ?? 'Oferta do salão',
    description: _asNullableString(map['description']),
    highlightText: _asNullableString(map['highlight_text']),
    price: (map['price'] as num?)?.toDouble(),
    startsOn: _decodeDate(map['starts_on']),
    endsOn: _decodeDate(map['ends_on']),
    isActive: map['is_active'] as bool? ?? false,
    sortOrder: (map['sort_order'] as num?)?.toInt() ?? 0,
  );
}

Map<String, dynamic> _encodeProduct(RetailProduct item) {
  return <String, dynamic>{
    'id': item.id,
    'name': item.name,
    'brand': item.brand,
    'retail_price': item.retailPrice,
    'updated_at': _encodeDate(item.updatedAt),
  };
}

RetailProduct _decodeProduct(Map<String, dynamic> map) {
  return RetailProduct(
    id: map['id']?.toString() ?? '',
    name: map['name']?.toString() ?? 'Produto',
    brand: _asNullableString(map['brand']),
    retailPrice: (map['retail_price'] as num?)?.toDouble(),
    updatedAt: _decodeDate(map['updated_at']),
  );
}

Map<String, dynamic> _encodeFeedComment(FeedComment item) {
  return <String, dynamic>{
    'id': item.id,
    'customer_id': item.customerId,
    'customer_name': item.customerName,
    'body': item.body,
    'created_at': _encodeDate(item.createdAt),
  };
}

FeedComment _decodeFeedComment(Map<String, dynamic> map) {
  return FeedComment(
    id: map['id']?.toString() ?? '',
    customerId: map['customer_id']?.toString() ?? '',
    customerName: map['customer_name']?.toString() ?? 'Cliente',
    body: map['body']?.toString() ?? '',
    createdAt: _decodeDate(map['created_at']) ?? DateTime.now(),
  );
}

Map<String, dynamic> _encodeFeedPost(FeedPost item) {
  return <String, dynamic>{
    'id': item.id,
    'title': item.title,
    'caption': item.caption,
    'image_urls': item.imageUrls,
    'created_at': _encodeDate(item.createdAt),
    'like_count': item.likeCount,
    'comment_count': item.commentCount,
    'liked_by_me': item.likedByMe,
    'comments': item.comments.map(_encodeFeedComment).toList(growable: false),
    'post_type': item.postType,
    'video_url': item.videoUrl,
    'staff_member_name': item.staffMemberName,
    'staff_member_role': item.staffMemberRole,
    'linked_service': item.linkedService == null
        ? null
        : _encodeService(item.linkedService!),
  };
}

FeedPost _decodeFeedPost(Map<String, dynamic> map) {
  final linkedService = _readMap(map['linked_service']);

  return FeedPost(
    id: map['id']?.toString() ?? '',
    title: map['title']?.toString() ?? 'Resultado do salão',
    caption: _asNullableString(map['caption']),
    imageUrls: _readStringList(map['image_urls']),
    createdAt: _decodeDate(map['created_at']) ?? DateTime.now(),
    likeCount: (map['like_count'] as num?)?.toInt() ?? 0,
    commentCount: (map['comment_count'] as num?)?.toInt() ?? 0,
    likedByMe: map['liked_by_me'] as bool? ?? false,
    comments: _readMapList(
      map['comments'],
    ).map(_decodeFeedComment).toList(growable: false),
    postType: map['post_type']?.toString() ?? 'standard',
    videoUrl: _asNullableString(map['video_url']),
    staffMemberName: _asNullableString(map['staff_member_name']),
    staffMemberRole: _asNullableString(map['staff_member_role']),
    linkedService: linkedService == null ? null : _decodeService(linkedService),
  );
}

Map<String, dynamic> _encodeAppointment(AppointmentItem item) {
  return <String, dynamic>{
    'id': item.id,
    'date': _encodeDate(item.date),
    'ends_at': _encodeDate(item.endsAt),
    'status': item.status,
    'service_name': item.serviceName,
    'service_duration': item.serviceDuration,
    'service_price': item.servicePrice,
    'staff_member_name': item.staffMemberName,
    'cancelled_at': _encodeDate(item.cancelledAt),
    'cancelled_by': item.cancelledBy,
    'cancellation_reason': item.cancellationReason,
    'completed_at': _encodeDate(item.completedAt),
    'customer_confirmation_requested_at': _encodeDate(
      item.customerConfirmationRequestedAt,
    ),
    'customer_presence_confirmed_at': _encodeDate(
      item.customerPresenceConfirmedAt,
    ),
  };
}

AppointmentItem _decodeAppointment(Map<String, dynamic> map) {
  return AppointmentItem(
    id: map['id']?.toString() ?? '',
    date: _decodeDate(map['date']) ?? DateTime.now(),
    endsAt: _decodeDate(map['ends_at']) ?? DateTime.now(),
    status: map['status']?.toString() ?? 'pending',
    serviceName: map['service_name']?.toString() ?? 'Serviço',
    serviceDuration: (map['service_duration'] as num?)?.toInt() ?? 0,
    servicePrice: (map['service_price'] as num?)?.toDouble() ?? 0,
    staffMemberName: _asNullableString(map['staff_member_name']),
    cancelledAt: _decodeDate(map['cancelled_at']),
    cancelledBy: _asNullableString(map['cancelled_by']),
    cancellationReason: _asNullableString(map['cancellation_reason']),
    completedAt: _decodeDate(map['completed_at']),
    customerConfirmationRequestedAt: _decodeDate(
      map['customer_confirmation_requested_at'],
    ),
    customerPresenceConfirmedAt: _decodeDate(
      map['customer_presence_confirmed_at'],
    ),
  );
}

Map<String, dynamic> _encodeVacancyAlert(VacancyAlert item) {
  return <String, dynamic>{
    'id': item.id,
    'headline': item.headline,
    'body': item.body,
    'starts_at': _encodeDate(item.startsAt),
    'ends_at': _encodeDate(item.endsAt),
    'created_at': _encodeDate(item.createdAt),
    'service_id': item.serviceId,
    'staff_member_id': item.staffMemberId,
  };
}

VacancyAlert _decodeVacancyAlert(Map<String, dynamic> map) {
  return VacancyAlert(
    id: map['id']?.toString() ?? '',
    headline: map['headline']?.toString() ?? 'Horário liberado',
    body: map['body']?.toString() ?? '',
    startsAt: _decodeDate(map['starts_at']) ?? DateTime.now(),
    endsAt: _decodeDate(map['ends_at']) ?? DateTime.now(),
    createdAt: _decodeDate(map['created_at']) ?? DateTime.now(),
    serviceId: map['service_id']?.toString() ?? '',
    staffMemberId: _asNullableString(map['staff_member_id']),
  );
}

Map<String, dynamic> _encodeNotification(CustomerNotificationItem item) {
  return <String, dynamic>{
    'id': item.id,
    'source_type': item.sourceType,
    'type': item.type,
    'title': item.title,
    'body': item.body,
    'created_at': _encodeDate(item.createdAt),
    'payload': item.payload,
    'is_read': item.isRead,
  };
}

CustomerNotificationItem _decodeNotification(Map<String, dynamic> map) {
  return CustomerNotificationItem(
    id: map['id']?.toString() ?? '',
    sourceType: map['source_type']?.toString() ?? 'salon_notification',
    type: map['type']?.toString() ?? 'salon_update',
    title: map['title']?.toString() ?? 'Atualização do salão',
    body: map['body']?.toString() ?? '',
    createdAt: _decodeDate(map['created_at']) ?? DateTime.now(),
    payload: _readMap(map['payload']) ?? const <String, dynamic>{},
    isRead: map['is_read'] as bool? ?? false,
  );
}

Map<String, dynamic> _encodeAvailableSlot(AvailableSlot item) {
  return <String, dynamic>{
    'start_at': _encodeDate(item.startAt),
    'ends_at': _encodeDate(item.endsAt),
    'staff_member_id': item.staffMemberId,
    'staff_member_name': item.staffMemberName,
  };
}

AvailableSlot _decodeAvailableSlot(Map<String, dynamic> map) {
  return AvailableSlot(
    startAt: _decodeDate(map['start_at']) ?? DateTime.now(),
    endsAt: _decodeDate(map['ends_at']) ?? DateTime.now(),
    staffMemberId: map['staff_member_id']?.toString() ?? '',
    staffMemberName: map['staff_member_name']?.toString() ?? 'Profissional',
  );
}

Map<String, dynamic> _encodeLoyaltySummary(LoyaltySummary item) {
  return <String, dynamic>{
    'points_balance': item.pointsBalance,
    'cashback_balance': item.cashbackBalance,
    'completed_visits': item.completedVisits,
    'visits_to_next_tier': item.visitsToNextTier,
    'rank_position': item.rankPosition,
    'current_tier_label': item.currentTierLabel,
    'next_tier_label': item.nextTierLabel,
  };
}

LoyaltySummary _decodeLoyaltySummary(Map<String, dynamic> map) {
  return LoyaltySummary(
    pointsBalance: (map['points_balance'] as num?)?.toInt() ?? 0,
    cashbackBalance: (map['cashback_balance'] as num?)?.toDouble() ?? 0,
    completedVisits: (map['completed_visits'] as num?)?.toInt() ?? 0,
    visitsToNextTier: (map['visits_to_next_tier'] as num?)?.toInt() ?? 0,
    rankPosition: (map['rank_position'] as num?)?.toInt(),
    currentTierLabel: _asNullableString(map['current_tier_label']),
    nextTierLabel: _asNullableString(map['next_tier_label']),
  );
}

Map<String, dynamic> _encodeReferralSummary(ReferralSummary item) {
  return <String, dynamic>{
    'referral_code': item.referralCode,
    'pending_count': item.pendingCount,
    'qualified_count': item.qualifiedCount,
    'next_reward_remaining': item.nextRewardRemaining,
    'available_rewards_count': item.availableRewardsCount,
    'has_active_program': item.hasActiveProgram,
  };
}

ReferralSummary _decodeReferralSummary(Map<String, dynamic> map) {
  return ReferralSummary(
    referralCode: map['referral_code']?.toString() ?? '',
    pendingCount: (map['pending_count'] as num?)?.toInt() ?? 0,
    qualifiedCount: (map['qualified_count'] as num?)?.toInt() ?? 0,
    nextRewardRemaining: (map['next_reward_remaining'] as num?)?.toInt() ?? 0,
    availableRewardsCount:
        (map['available_rewards_count'] as num?)?.toInt() ?? 0,
    hasActiveProgram: map['has_active_program'] as bool? ?? false,
  );
}

String? _encodeDate(DateTime? value) => value?.toUtc().toIso8601String();

DateTime? _decodeDate(Object? value) {
  final raw = value?.toString();
  if (raw == null || raw.isEmpty) {
    return null;
  }

  return DateTime.tryParse(raw)?.toLocal();
}

List<Map<String, dynamic>> _readMapList(Object? value) {
  if (value is! List) {
    return const <Map<String, dynamic>>[];
  }

  return value
      .whereType<Map>()
      .map((entry) => Map<String, dynamic>.from(entry))
      .toList(growable: false);
}

Map<String, dynamic>? _readMap(Object? value) {
  if (value is! Map) {
    return null;
  }

  return Map<String, dynamic>.from(value);
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const <String>[];
  }

  return value
      .map((entry) => entry?.toString().trim())
      .whereType<String>()
      .where((entry) => entry.isNotEmpty)
      .toList(growable: false);
}

String? _asNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}
