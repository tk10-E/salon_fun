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
    'consent_status': profile.consentStatus,
    'consent_signed_at': profile.consentSignedAt?.toIso8601String(),
    'consent_version': profile.consentVersion,
    'booking_policy_enabled': profile.bookingPolicyEnabled,
    'booking_policy_title': profile.bookingPolicyTitle,
    'booking_policy_summary': profile.bookingPolicySummary,
    'booking_policy_cancellation_window_hours':
        profile.bookingPolicyCancellationWindowHours,
    'booking_policy_confirmation_required':
        profile.bookingPolicyConfirmationRequired,
    'booking_policy_confirmation_lead_minutes':
        profile.bookingPolicyConfirmationLeadMinutes,
    'booking_policy_auto_cancel_unconfirmed':
        profile.bookingPolicyAutoCancelUnconfirmed,
    'booking_policy_auto_cancel_lead_minutes':
        profile.bookingPolicyAutoCancelLeadMinutes,
    'booking_policy_auto_cancel_pending_deposit':
        profile.bookingPolicyAutoCancelPendingDeposit,
    'booking_policy_deposit_reminder_lead_hours':
        profile.bookingPolicyDepositReminderLeadHours,
    'booking_policy_requires_deposit': profile.bookingPolicyRequiresDeposit,
    'booking_policy_deposit_amount': profile.bookingPolicyDepositAmount,
    'booking_policy_payment_mode': profile.bookingPolicyPaymentMode,
    'booking_policy_pix_key': profile.bookingPolicyPixKey,
    'booking_policy_pix_recipient_name': profile.bookingPolicyPixRecipientName,
    'booking_policy_pix_recipient_city': profile.bookingPolicyPixRecipientCity,
    'booking_policy_external_checkout_url':
        profile.bookingPolicyExternalCheckoutUrl,
    'booking_policy_payment_instructions':
        profile.bookingPolicyPaymentInstructions,
    'booking_policy_version': profile.bookingPolicyVersion,
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
    consentStatus: _asNullableString(map['consent_status']) ?? 'not_required',
    consentSignedAt: _asNullableDateTime(map['consent_signed_at']),
    consentVersion: _asNullableString(map['consent_version']),
    bookingPolicyEnabled: map['booking_policy_enabled'] as bool? ?? false,
    bookingPolicyTitle: _asNullableString(map['booking_policy_title']),
    bookingPolicySummary: _asNullableString(map['booking_policy_summary']),
    bookingPolicyCancellationWindowHours:
        (map['booking_policy_cancellation_window_hours'] as num?)?.toInt() ??
        24,
    bookingPolicyConfirmationRequired:
        map['booking_policy_confirmation_required'] as bool? ?? true,
    bookingPolicyConfirmationLeadMinutes:
        (map['booking_policy_confirmation_lead_minutes'] as num?)?.toInt() ??
        30,
    bookingPolicyAutoCancelUnconfirmed:
        map['booking_policy_auto_cancel_unconfirmed'] as bool? ?? true,
    bookingPolicyAutoCancelLeadMinutes:
        (map['booking_policy_auto_cancel_lead_minutes'] as num?)?.toInt() ?? 10,
    bookingPolicyAutoCancelPendingDeposit:
        map['booking_policy_auto_cancel_pending_deposit'] as bool? ?? false,
    bookingPolicyDepositReminderLeadHours:
        (map['booking_policy_deposit_reminder_lead_hours'] as num?)?.toInt() ??
        6,
    bookingPolicyRequiresDeposit:
        map['booking_policy_requires_deposit'] as bool? ?? false,
    bookingPolicyDepositAmount:
        (map['booking_policy_deposit_amount'] as num?)?.toDouble() ?? 0,
    bookingPolicyPaymentMode:
        _asNullableString(map['booking_policy_payment_mode']) ?? 'manual',
    bookingPolicyPixKey: _asNullableString(map['booking_policy_pix_key']),
    bookingPolicyPixRecipientName: _asNullableString(
      map['booking_policy_pix_recipient_name'],
    ),
    bookingPolicyPixRecipientCity: _asNullableString(
      map['booking_policy_pix_recipient_city'],
    ),
    bookingPolicyExternalCheckoutUrl: _asNullableString(
      map['booking_policy_external_checkout_url'],
    ),
    bookingPolicyPaymentInstructions: _asNullableString(
      map['booking_policy_payment_instructions'],
    ),
    bookingPolicyVersion: _asNullableString(map['booking_policy_version']),
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
    'memberships': snapshot.memberships
        .map(_encodeMembershipPackage)
        .toList(growable: false),
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
    'issues': _encodeOperationalIssues(snapshot.issues),
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
    memberships: _readMapList(
      map['memberships'],
    ).map(_decodeMembershipPackage).toList(growable: false),
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
    issues: _decodeOperationalIssues(map['issues']),
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
    'issues': _encodeOperationalIssues(snapshot.issues),
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
    issues: _decodeOperationalIssues(map['issues']),
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
    'issues': _encodeOperationalIssues(snapshot.issues),
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
    issues: _decodeOperationalIssues(map['issues']),
  );
}

Map<String, dynamic> encodeFeedSnapshot(FeedSnapshot snapshot) {
  return <String, dynamic>{
    'posts': snapshot.posts.map(_encodeFeedPost).toList(growable: false),
    'issues': _encodeOperationalIssues(snapshot.issues),
  };
}

FeedSnapshot decodeFeedSnapshot(Map<String, dynamic> map) {
  return FeedSnapshot(
    posts: _readMapList(
      map['posts'],
    ).map(_decodeFeedPost).toList(growable: false),
    issues: _decodeOperationalIssues(map['issues']),
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
    'memberships': snapshot.memberships
        .map(_encodeMembershipPackage)
        .toList(growable: false),
    'store_orders': snapshot.storeOrders
        .map(_encodeCustomerStoreOrder)
        .toList(growable: false),
    'issues': _encodeOperationalIssues(snapshot.issues),
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
    memberships: _readMapList(
      map['memberships'],
    ).map(_decodeMembershipPackage).toList(growable: false),
    storeOrders: _readMapList(
      map['store_orders'],
    ).map(_decodeCustomerStoreOrder).toList(growable: false),
    issues: _decodeOperationalIssues(map['issues']),
  );
}

List<Map<String, dynamic>> _encodeOperationalIssues(
  List<OperationalIssue> issues,
) {
  return issues
      .map(
        (issue) => <String, dynamic>{
          'scope': issue.scope,
          'title': issue.title,
          'message': issue.message,
        },
      )
      .toList(growable: false);
}

List<OperationalIssue> _decodeOperationalIssues(Object? value) {
  return _readMapList(value)
      .map(
        (map) => OperationalIssue(
          scope: map['scope']?.toString() ?? 'unknown',
          title: map['title']?.toString() ?? 'Sincronização indisponível',
          message:
              map['message']?.toString() ??
              'Alguns dados não puderam ser carregados agora.',
        ),
      )
      .toList(growable: false);
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

Map<String, dynamic> _encodeMembershipPackage(CustomerMembershipPackage item) {
  return <String, dynamic>{
    'id': item.id,
    'title': item.title,
    'service_name_snapshot': item.serviceName,
    'price_snapshot': item.price,
    'sessions_included': item.sessionsIncluded,
    'sessions_used': item.sessionsUsed,
    'started_at': _encodeDate(item.startedAt),
    'expires_at': _encodeDate(item.expiresAt),
    'status': item.status,
    'notes': item.notes,
  };
}

CustomerMembershipPackage _decodeMembershipPackage(Map<String, dynamic> map) {
  return CustomerMembershipPackage(
    id: map['id']?.toString() ?? '',
    title: map['title']?.toString() ?? 'Pacote do salão',
    serviceName: _asNullableString(map['service_name_snapshot']) ?? '',
    price: (map['price_snapshot'] as num?)?.toDouble(),
    sessionsIncluded: (map['sessions_included'] as num?)?.toInt() ?? 0,
    sessionsUsed: (map['sessions_used'] as num?)?.toInt() ?? 0,
    startedAt: _decodeDate(map['started_at']) ?? DateTime.now(),
    expiresAt: _decodeDate(map['expires_at']) ?? DateTime.now(),
    status: map['status']?.toString() ?? 'active',
    notes: _asNullableString(map['notes']),
  );
}

Map<String, dynamic> _encodeProduct(RetailProduct item) {
  return <String, dynamic>{
    'id': item.id,
    'name': item.name,
    'brand': item.brand,
    'description': item.description,
    'image_urls': item.imageUrls,
    'retail_price': item.retailPrice,
    'current_stock': item.currentStock,
    'unit': item.unit,
    'max_purchase_quantity': item.maxPurchaseQuantity,
    'updated_at': _encodeDate(item.updatedAt),
  };
}

RetailProduct _decodeProduct(Map<String, dynamic> map) {
  return RetailProduct(
    id: map['id']?.toString() ?? '',
    name: map['name']?.toString() ?? 'Produto',
    brand: _asNullableString(map['brand']),
    description: _asNullableString(map['description']),
    imageUrls: _readStringList(map['image_urls']),
    retailPrice: (map['retail_price'] as num?)?.toDouble(),
    currentStock: (map['current_stock'] as num?)?.toDouble() ?? 0,
    unit: _asNullableString(map['unit']) ?? 'un',
    maxPurchaseQuantity: (map['max_purchase_quantity'] as num?)?.toInt() ?? 6,
    updatedAt: _decodeDate(map['updated_at']),
  );
}

Map<String, dynamic> _encodeCustomerStoreOrderItem(
  CustomerStoreOrderItem item,
) {
  return <String, dynamic>{
    'id': item.id,
    'product_name_snapshot': item.productName,
    'product_brand_snapshot': item.brand,
    'quantity': item.quantity,
    'unit_snapshot': item.unit,
    'unit_price_snapshot': item.unitPrice,
    'line_total_amount': item.lineTotalAmount,
    'image_url': item.imageUrl,
  };
}

CustomerStoreOrderItem _decodeCustomerStoreOrderItem(Map<String, dynamic> map) {
  return CustomerStoreOrderItem(
    id: (map['id'] ?? '') as String,
    productName:
        _asNullableString(map['product_name_snapshot']) ?? 'Produto do salao',
    brand: _asNullableString(map['product_brand_snapshot']),
    quantity: (map['quantity'] as num?)?.toInt() ?? 1,
    unit: _asNullableString(map['unit_snapshot']) ?? 'un',
    unitPrice: (map['unit_price_snapshot'] as num?)?.toDouble() ?? 0,
    lineTotalAmount: (map['line_total_amount'] as num?)?.toDouble() ?? 0,
    imageUrl:
        _asNullableString(map['image_url']) ??
        _asNullableString(map['product_image_url']),
  );
}

Map<String, dynamic> _encodeCustomerStoreOrder(CustomerStoreOrder item) {
  return <String, dynamic>{
    'id': item.id,
    'order_number': item.orderNumber,
    'status': item.status,
    'total_items': item.totalItems,
    'subtotal_amount': item.subtotalAmount,
    'created_at': item.createdAt.toUtc().toIso8601String(),
    'notes': item.notes,
    'cancellation_reason': item.cancellationReason,
    'confirmed_at': item.confirmedAt?.toUtc().toIso8601String(),
    'ready_at': item.readyAt?.toUtc().toIso8601String(),
    'completed_at': item.completedAt?.toUtc().toIso8601String(),
    'cancelled_at': item.cancelledAt?.toUtc().toIso8601String(),
    'customer_product_order_items': item.items
        .map(_encodeCustomerStoreOrderItem)
        .toList(growable: false),
  };
}

CustomerStoreOrder _decodeCustomerStoreOrder(Map<String, dynamic> map) {
  return CustomerStoreOrder(
    id: (map['id'] ?? '') as String,
    orderNumber: (map['order_number'] as num?)?.toInt() ?? 0,
    status: _asNullableString(map['status']) ?? 'pending',
    totalItems: (map['total_items'] as num?)?.toInt() ?? 0,
    subtotalAmount: (map['subtotal_amount'] as num?)?.toDouble() ?? 0,
    createdAt: _asNullableDateTime(map['created_at']) ?? DateTime.now(),
    notes: _asNullableString(map['notes']),
    cancellationReason: _asNullableString(map['cancellation_reason']),
    confirmedAt: _asNullableDateTime(map['confirmed_at']),
    readyAt: _asNullableDateTime(map['ready_at']),
    completedAt: _asNullableDateTime(map['completed_at']),
    cancelledAt: _asNullableDateTime(map['cancelled_at']),
    items: _readMapList(
      map['customer_product_order_items'],
    ).map(_decodeCustomerStoreOrderItem).toList(growable: false),
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
    'source_type': item.sourceType,
    'external_platform': item.externalPlatform,
    'external_permalink': item.externalPermalink,
    'external_author_username': item.externalAuthorUsername,
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
    sourceType: _asNullableString(map['source_type']),
    externalPlatform: _asNullableString(map['external_platform']),
    externalPermalink: _asNullableString(map['external_permalink']),
    externalAuthorUsername: _asNullableString(map['external_author_username']),
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
    'protection_confirmation_required': item.protectionConfirmationRequired,
    'protection_confirmation_lead_minutes':
        item.protectionConfirmationLeadMinutes,
    'protection_auto_cancel_unconfirmed': item.protectionAutoCancelUnconfirmed,
    'protection_auto_cancel_lead_minutes': item.protectionAutoCancelLeadMinutes,
    'protection_auto_cancel_pending_deposit':
        item.protectionAutoCancelPendingDeposit,
    'protection_deposit_reminder_lead_hours':
        item.protectionDepositReminderLeadHours,
    'deposit_amount': item.depositAmount,
    'deposit_customer_reported_paid_at': _encodeDate(
      item.depositCustomerReportedPaidAt,
    ),
    'deposit_customer_reported_paid_via': item.depositCustomerReportedPaidVia,
    'deposit_customer_reported_reference':
        item.depositCustomerReportedReference,
    'deposit_status': item.depositStatus,
    'deposit_paid_at': _encodeDate(item.depositPaidAt),
    'deposit_payment_provider': item.depositPaymentProvider,
    'deposit_payment_provider_charge_id': item.depositPaymentProviderChargeId,
    'deposit_payment_provider_status': item.depositPaymentProviderStatus,
    'deposit_payment_provider_payload': item.depositPaymentProviderPayload,
    'deposit_payment_provider_invoice_url':
        item.depositPaymentProviderInvoiceUrl,
    'deposit_payment_provider_last_synced_at': _encodeDate(
      item.depositPaymentProviderLastSyncedAt,
    ),
    'deposit_payment_provider_error': item.depositPaymentProviderError,
    'deposit_receipt_content_type': item.depositReceiptContentType,
    'deposit_receipt_path': item.depositReceiptPath,
    'deposit_receipt_uploaded_at': _encodeDate(item.depositReceiptUploadedAt),
    'deposit_notes': item.depositNotes,
    'booking_policy_acknowledged_at': _encodeDate(
      item.bookingPolicyAcknowledgedAt,
    ),
    'booking_policy_version': item.bookingPolicyVersion,
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
    protectionConfirmationRequired:
        map['protection_confirmation_required'] as bool? ?? true,
    protectionConfirmationLeadMinutes:
        (map['protection_confirmation_lead_minutes'] as num?)?.toInt() ?? 30,
    protectionAutoCancelUnconfirmed:
        map['protection_auto_cancel_unconfirmed'] as bool? ?? true,
    protectionAutoCancelLeadMinutes:
        (map['protection_auto_cancel_lead_minutes'] as num?)?.toInt() ?? 10,
    protectionAutoCancelPendingDeposit:
        map['protection_auto_cancel_pending_deposit'] as bool? ?? false,
    protectionDepositReminderLeadHours:
        (map['protection_deposit_reminder_lead_hours'] as num?)?.toInt() ?? 6,
    depositAmount: (map['deposit_amount'] as num?)?.toDouble() ?? 0,
    depositCustomerReportedPaidAt: _decodeDate(
      map['deposit_customer_reported_paid_at'],
    ),
    depositCustomerReportedPaidVia: _asNullableString(
      map['deposit_customer_reported_paid_via'],
    ),
    depositCustomerReportedReference: _asNullableString(
      map['deposit_customer_reported_reference'],
    ),
    depositStatus: map['deposit_status']?.toString() ?? 'not_required',
    depositPaidAt: _decodeDate(map['deposit_paid_at']),
    depositPaymentProvider: _asNullableString(map['deposit_payment_provider']),
    depositPaymentProviderChargeId: _asNullableString(
      map['deposit_payment_provider_charge_id'],
    ),
    depositPaymentProviderStatus: _asNullableString(
      map['deposit_payment_provider_status'],
    ),
    depositPaymentProviderPayload: _asNullableString(
      map['deposit_payment_provider_payload'],
    ),
    depositPaymentProviderInvoiceUrl: _asNullableString(
      map['deposit_payment_provider_invoice_url'],
    ),
    depositPaymentProviderLastSyncedAt: _decodeDate(
      map['deposit_payment_provider_last_synced_at'],
    ),
    depositPaymentProviderError: _asNullableString(
      map['deposit_payment_provider_error'],
    ),
    depositReceiptContentType: _asNullableString(
      map['deposit_receipt_content_type'],
    ),
    depositReceiptPath: _asNullableString(map['deposit_receipt_path']),
    depositReceiptUploadedAt: _decodeDate(map['deposit_receipt_uploaded_at']),
    depositNotes: _asNullableString(map['deposit_notes']),
    bookingPolicyAcknowledgedAt: _decodeDate(
      map['booking_policy_acknowledged_at'],
    ),
    bookingPolicyVersion: _asNullableString(map['booking_policy_version']),
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
    'total_points_earned': item.totalPointsEarned,
    'total_cashback_earned': item.totalCashbackEarned,
    'ranked_customers': item.rankedCustomers,
    'program_is_active': item.programIsActive,
    'rank_position': item.rankPosition,
    'current_tier_label': item.currentTierLabel,
    'next_tier_label': item.nextTierLabel,
    'program_title': item.programTitle,
    'program_description': item.programDescription,
    'vip_reward_service_name': item.vipRewardServiceName,
    'last_reward_at': _encodeDate(item.lastRewardAt),
    'tiers': item.tiers.map(_encodeLoyaltyTier).toList(growable: false),
  };
}

LoyaltySummary _decodeLoyaltySummary(Map<String, dynamic> map) {
  return LoyaltySummary(
    pointsBalance: (map['points_balance'] as num?)?.toInt() ?? 0,
    cashbackBalance: (map['cashback_balance'] as num?)?.toDouble() ?? 0,
    completedVisits: (map['completed_visits'] as num?)?.toInt() ?? 0,
    visitsToNextTier: (map['visits_to_next_tier'] as num?)?.toInt() ?? 0,
    totalPointsEarned: (map['total_points_earned'] as num?)?.toInt() ?? 0,
    totalCashbackEarned:
        (map['total_cashback_earned'] as num?)?.toDouble() ?? 0,
    rankedCustomers: (map['ranked_customers'] as num?)?.toInt() ?? 0,
    programIsActive: map['program_is_active'] as bool? ?? false,
    tiers: _readMapList(
      map['tiers'],
    ).map(_decodeLoyaltyTier).toList(growable: false),
    rankPosition: (map['rank_position'] as num?)?.toInt(),
    currentTierLabel: _asNullableString(map['current_tier_label']),
    nextTierLabel: _asNullableString(map['next_tier_label']),
    programTitle: _asNullableString(map['program_title']),
    programDescription: _asNullableString(map['program_description']),
    vipRewardServiceName: _asNullableString(map['vip_reward_service_name']),
    lastRewardAt: _decodeDate(map['last_reward_at']),
  );
}

Map<String, dynamic> _encodeReferralSummary(ReferralSummary item) {
  return <String, dynamic>{
    'referral_code': item.referralCode,
    'pending_count': item.pendingCount,
    'qualified_count': item.qualifiedCount,
    'current_cycle_progress': item.currentCycleProgress,
    'next_reward_remaining': item.nextRewardRemaining,
    'unlocked_rewards_count': item.unlockedRewardsCount,
    'available_rewards_count': item.availableRewardsCount,
    'required_qualified_referrals': item.requiredQualifiedReferrals,
    'has_active_program': item.hasActiveProgram,
    'program_title': item.programTitle,
    'program_description': item.programDescription,
    'reward_for_referrer': item.rewardForReferrer,
    'reward_for_invited': item.rewardForInvited,
    'reward_service_name': item.rewardServiceName,
    'referrals': item.referrals
        .map(_encodeReferralEventSummary)
        .toList(growable: false),
    'reward_unlocks': item.rewardUnlocks
        .map(_encodeReferralRewardUnlockSummary)
        .toList(growable: false),
  };
}

ReferralSummary _decodeReferralSummary(Map<String, dynamic> map) {
  return ReferralSummary(
    referralCode: map['referral_code']?.toString() ?? '',
    pendingCount: (map['pending_count'] as num?)?.toInt() ?? 0,
    qualifiedCount: (map['qualified_count'] as num?)?.toInt() ?? 0,
    currentCycleProgress: (map['current_cycle_progress'] as num?)?.toInt() ?? 0,
    nextRewardRemaining: (map['next_reward_remaining'] as num?)?.toInt() ?? 0,
    unlockedRewardsCount: (map['unlocked_rewards_count'] as num?)?.toInt() ?? 0,
    availableRewardsCount:
        (map['available_rewards_count'] as num?)?.toInt() ?? 0,
    requiredQualifiedReferrals:
        (map['required_qualified_referrals'] as num?)?.toInt() ?? 0,
    hasActiveProgram: map['has_active_program'] as bool? ?? false,
    programTitle: _asNullableString(map['program_title']),
    programDescription: _asNullableString(map['program_description']),
    rewardForReferrer: _asNullableString(map['reward_for_referrer']),
    rewardForInvited: _asNullableString(map['reward_for_invited']),
    rewardServiceName: _asNullableString(map['reward_service_name']),
    referrals: _readMapList(
      map['referrals'],
    ).map(_decodeReferralEventSummary).toList(growable: false),
    rewardUnlocks: _readMapList(
      map['reward_unlocks'],
    ).map(_decodeReferralRewardUnlockSummary).toList(growable: false),
  );
}

Map<String, dynamic> _encodeLoyaltyTier(LoyaltyTierSummary item) {
  return <String, dynamic>{
    'label': item.label,
    'min_visits': item.minVisits,
    'discount_percent': item.discountPercent,
    'is_vip': item.isVip,
  };
}

LoyaltyTierSummary _decodeLoyaltyTier(Map<String, dynamic> map) {
  return LoyaltyTierSummary(
    label: map['label']?.toString() ?? 'Nível',
    minVisits: (map['min_visits'] as num?)?.toInt() ?? 0,
    discountPercent: (map['discount_percent'] as num?)?.toDouble() ?? 0,
    isVip: map['is_vip'] as bool? ?? false,
  );
}

Map<String, dynamic> _encodeReferralEventSummary(ReferralEventSummary item) {
  return <String, dynamic>{
    'id': item.id,
    'customer_name': item.customerName,
    'status': item.status,
    'created_at': _encodeDate(item.createdAt),
    'qualified_at': _encodeDate(item.qualifiedAt),
  };
}

ReferralEventSummary _decodeReferralEventSummary(Map<String, dynamic> map) {
  return ReferralEventSummary(
    id: map['id']?.toString() ?? '',
    customerName: map['customer_name']?.toString() ?? 'Cliente',
    status: map['status']?.toString() ?? 'pending',
    createdAt: _decodeDate(map['created_at']) ?? DateTime.now(),
    qualifiedAt: _decodeDate(map['qualified_at']),
  );
}

Map<String, dynamic> _encodeReferralRewardUnlockSummary(
  ReferralRewardUnlockSummary item,
) {
  return <String, dynamic>{
    'id': item.id,
    'threshold_reached': item.thresholdReached,
    'required_qualified_referrals': item.requiredQualifiedReferrals,
    'status': item.status,
    'unlocked_at': _encodeDate(item.unlockedAt),
    'reward_description': item.rewardDescription,
    'reward_service_name': item.rewardServiceName,
    'redeemed_at': _encodeDate(item.redeemedAt),
  };
}

ReferralRewardUnlockSummary _decodeReferralRewardUnlockSummary(
  Map<String, dynamic> map,
) {
  return ReferralRewardUnlockSummary(
    id: map['id']?.toString() ?? '',
    thresholdReached: (map['threshold_reached'] as num?)?.toInt() ?? 0,
    requiredQualifiedReferrals:
        (map['required_qualified_referrals'] as num?)?.toInt() ?? 0,
    status: map['status']?.toString() ?? 'available',
    unlockedAt: _decodeDate(map['unlocked_at']) ?? DateTime.now(),
    rewardDescription: _asNullableString(map['reward_description']),
    rewardServiceName: _asNullableString(map['reward_service_name']),
    redeemedAt: _decodeDate(map['redeemed_at']),
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

DateTime? _asNullableDateTime(Object? value) {
  if (value == null) {
    return null;
  }

  return DateTime.tryParse(value.toString());
}
