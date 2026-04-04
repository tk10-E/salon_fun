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
    this.consentStatus = 'not_required',
    this.consentSignedAt,
    this.consentVersion,
    this.bookingPolicyEnabled = false,
    this.bookingPolicyTitle,
    this.bookingPolicySummary,
    this.bookingPolicyCancellationWindowHours = 24,
    this.bookingPolicyConfirmationRequired = true,
    this.bookingPolicyConfirmationLeadMinutes = 30,
    this.bookingPolicyAutoCancelUnconfirmed = true,
    this.bookingPolicyAutoCancelLeadMinutes = 10,
    this.bookingPolicyAutoCancelPendingDeposit = false,
    this.bookingPolicyDepositReminderLeadHours = 6,
    this.bookingPolicyRequiresDeposit = false,
    this.bookingPolicyDepositAmount = 0,
    this.bookingPolicyPaymentMode = 'manual',
    this.bookingPolicyPixKey,
    this.bookingPolicyPixRecipientName,
    this.bookingPolicyPixRecipientCity,
    this.bookingPolicyExternalCheckoutUrl,
    this.bookingPolicyPaymentInstructions,
    this.bookingPolicyVersion,
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
  final String consentStatus;
  final DateTime? consentSignedAt;
  final String? consentVersion;
  final bool bookingPolicyEnabled;
  final String? bookingPolicyTitle;
  final String? bookingPolicySummary;
  final int bookingPolicyCancellationWindowHours;
  final bool bookingPolicyConfirmationRequired;
  final int bookingPolicyConfirmationLeadMinutes;
  final bool bookingPolicyAutoCancelUnconfirmed;
  final int bookingPolicyAutoCancelLeadMinutes;
  final bool bookingPolicyAutoCancelPendingDeposit;
  final int bookingPolicyDepositReminderLeadHours;
  final bool bookingPolicyRequiresDeposit;
  final double bookingPolicyDepositAmount;
  final String bookingPolicyPaymentMode;
  final String? bookingPolicyPixKey;
  final String? bookingPolicyPixRecipientName;
  final String? bookingPolicyPixRecipientCity;
  final String? bookingPolicyExternalCheckoutUrl;
  final String? bookingPolicyPaymentInstructions;
  final String? bookingPolicyVersion;
  final String? salonTagline;
  final String? salonBrandColor;
  final String? salonBusinessSegment;
  final String? salonWhatsappPhone;
  final String? salonLogoUrl;
  final SalonClientAppConfig salonClientAppConfig;

  bool get hasPendingOperationalConsent => consentStatus == 'pending';
  bool get hasSignedOperationalConsent => consentStatus == 'signed';
  bool get hasBookingPolicy => bookingPolicyEnabled;
  bool get bookingPolicyHasRequiredDeposit =>
      bookingPolicyEnabled &&
      bookingPolicyRequiresDeposit &&
      bookingPolicyDepositAmount > 0;
  String get bookingPolicyResolvedPaymentMode {
    if (bookingPolicyPaymentMode == 'asaas_pix') {
      return 'asaas_pix';
    }

    if (bookingPolicyPaymentMode == 'pix' &&
        (bookingPolicyPixKey?.trim().isNotEmpty ?? false) &&
        (bookingPolicyPixRecipientName?.trim().isNotEmpty ?? false) &&
        (bookingPolicyPixRecipientCity?.trim().isNotEmpty ?? false)) {
      return 'pix';
    }

    if (bookingPolicyPaymentMode == 'external_checkout' &&
        (bookingPolicyExternalCheckoutUrl?.trim().isNotEmpty ?? false)) {
      return 'external_checkout';
    }

    return 'manual';
  }

  bool get bookingPolicyUsesPix =>
      bookingPolicyHasRequiredDeposit &&
      bookingPolicyResolvedPaymentMode == 'pix';

  bool get bookingPolicyUsesManagedPix =>
      bookingPolicyHasRequiredDeposit &&
      bookingPolicyResolvedPaymentMode == 'asaas_pix';

  bool get bookingPolicyUsesExternalCheckout =>
      bookingPolicyHasRequiredDeposit &&
      bookingPolicyResolvedPaymentMode == 'external_checkout';

  String get bookingPolicyDepositPaymentLabel {
    switch (bookingPolicyResolvedPaymentMode) {
      case 'asaas_pix':
        return 'Pix automatico no app';
      case 'pix':
        return 'Pix direto no app';
      case 'external_checkout':
        return 'Checkout externo';
      default:
        return 'Operação manual';
    }
  }

  bool get requiresBookingPolicyAcknowledgement =>
      bookingPolicyEnabled &&
      (bookingPolicyVersion?.trim().isNotEmpty ?? false);

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
    String? consentStatus,
    DateTime? consentSignedAt,
    bool clearConsentSignedAt = false,
    String? consentVersion,
    bool clearConsentVersion = false,
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
      consentStatus: consentStatus ?? this.consentStatus,
      consentSignedAt: clearConsentSignedAt
          ? null
          : consentSignedAt ?? this.consentSignedAt,
      consentVersion: clearConsentVersion
          ? null
          : consentVersion ?? this.consentVersion,
      bookingPolicyEnabled: bookingPolicyEnabled,
      bookingPolicyTitle: bookingPolicyTitle,
      bookingPolicySummary: bookingPolicySummary,
      bookingPolicyCancellationWindowHours:
          bookingPolicyCancellationWindowHours,
      bookingPolicyConfirmationRequired: bookingPolicyConfirmationRequired,
      bookingPolicyConfirmationLeadMinutes:
          bookingPolicyConfirmationLeadMinutes,
      bookingPolicyAutoCancelUnconfirmed: bookingPolicyAutoCancelUnconfirmed,
      bookingPolicyAutoCancelLeadMinutes: bookingPolicyAutoCancelLeadMinutes,
      bookingPolicyAutoCancelPendingDeposit:
          bookingPolicyAutoCancelPendingDeposit,
      bookingPolicyDepositReminderLeadHours:
          bookingPolicyDepositReminderLeadHours,
      bookingPolicyRequiresDeposit: bookingPolicyRequiresDeposit,
      bookingPolicyDepositAmount: bookingPolicyDepositAmount,
      bookingPolicyPaymentMode: bookingPolicyPaymentMode,
      bookingPolicyPixKey: bookingPolicyPixKey,
      bookingPolicyPixRecipientName: bookingPolicyPixRecipientName,
      bookingPolicyPixRecipientCity: bookingPolicyPixRecipientCity,
      bookingPolicyExternalCheckoutUrl: bookingPolicyExternalCheckoutUrl,
      bookingPolicyPaymentInstructions: bookingPolicyPaymentInstructions,
      bookingPolicyVersion: bookingPolicyVersion,
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
      consentStatus:
          _readNullableString(map['consent_status']) ?? 'not_required',
      consentSignedAt: _readDateTime(map['consent_signed_at']),
      consentVersion: _readNullableString(map['consent_version']),
      bookingPolicyEnabled:
          salonMap['booking_policy_enabled'] as bool? ?? false,
      bookingPolicyTitle: _readNullableString(salonMap['booking_policy_title']),
      bookingPolicySummary: _readNullableString(
        salonMap['booking_policy_summary'],
      ),
      bookingPolicyCancellationWindowHours: _readInt(
        salonMap['booking_policy_cancellation_window_hours'],
        fallback: 24,
      ),
      bookingPolicyConfirmationRequired:
          salonMap['booking_policy_confirmation_required'] as bool? ?? true,
      bookingPolicyConfirmationLeadMinutes: _readInt(
        salonMap['booking_policy_confirmation_lead_minutes'],
        fallback: 30,
      ),
      bookingPolicyAutoCancelUnconfirmed:
          salonMap['booking_policy_auto_cancel_unconfirmed'] as bool? ?? true,
      bookingPolicyAutoCancelLeadMinutes: _readInt(
        salonMap['booking_policy_auto_cancel_lead_minutes'],
        fallback: 10,
      ),
      bookingPolicyAutoCancelPendingDeposit:
          salonMap['booking_policy_auto_cancel_pending_deposit'] as bool? ??
          false,
      bookingPolicyDepositReminderLeadHours: _readInt(
        salonMap['booking_policy_deposit_reminder_lead_hours'],
        fallback: 6,
      ),
      bookingPolicyRequiresDeposit:
          salonMap['booking_policy_requires_deposit'] as bool? ?? false,
      bookingPolicyDepositAmount: _readDouble(
        salonMap['booking_policy_deposit_amount'],
      ),
      bookingPolicyPaymentMode:
          _readNullableString(salonMap['booking_policy_payment_mode']) ??
          'manual',
      bookingPolicyPixKey: _readNullableString(
        salonMap['booking_policy_pix_key'],
      ),
      bookingPolicyPixRecipientName: _readNullableString(
        salonMap['booking_policy_pix_recipient_name'],
      ),
      bookingPolicyPixRecipientCity: _readNullableString(
        salonMap['booking_policy_pix_recipient_city'],
      ),
      bookingPolicyExternalCheckoutUrl: _readNullableString(
        salonMap['booking_policy_external_checkout_url'],
      ),
      bookingPolicyPaymentInstructions: _readNullableString(
        salonMap['booking_policy_payment_instructions'],
      ),
      bookingPolicyVersion: _readNullableString(
        salonMap['booking_policy_version'],
      ),
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
  bool get isPromotion => !isMembership;

  String get commercialLabel =>
      isMembership ? 'Clube / pacote' : 'Campanha ativa';

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

class CustomerMembershipPackage {
  const CustomerMembershipPackage({
    required this.id,
    required this.title,
    required this.serviceName,
    required this.sessionsIncluded,
    required this.sessionsUsed,
    required this.startedAt,
    required this.expiresAt,
    required this.status,
    this.price,
    this.notes,
  });

  final String id;
  final String title;
  final String serviceName;
  final double? price;
  final int sessionsIncluded;
  final int sessionsUsed;
  final DateTime startedAt;
  final DateTime expiresAt;
  final String status;
  final String? notes;

  int get sessionsRemaining {
    final remaining = sessionsIncluded - sessionsUsed;
    return remaining > 0 ? remaining : 0;
  }

  String get resolvedStatus {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final expiryDay = DateTime(expiresAt.year, expiresAt.month, expiresAt.day);

    if (status == 'cancelled') {
      return 'cancelled';
    }

    if (sessionsUsed >= sessionsIncluded) {
      return 'completed';
    }

    if (expiryDay.isBefore(today)) {
      return 'expired';
    }

    if (status == 'expired') {
      return 'expired';
    }

    return 'active';
  }

  bool get isActive => resolvedStatus == 'active';
  bool get isExpired => resolvedStatus == 'expired';
  bool get isCompleted => resolvedStatus == 'completed';

  factory CustomerMembershipPackage.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price_snapshot'];

    return CustomerMembershipPackage(
      id: (map['id'] ?? '') as String,
      title: (map['title'] ?? 'Pacote do salão') as String,
      serviceName:
          _readNullableString(map['service_name_snapshot']) ??
          'Serviço do pacote',
      price: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
      sessionsIncluded: _readInt(map['sessions_included']),
      sessionsUsed: _readInt(map['sessions_used']),
      startedAt: _parseDateOnly(map['started_at']) ?? DateTime.now(),
      expiresAt: _parseDateOnly(map['expires_at']) ?? DateTime.now(),
      status: (map['status'] ?? 'active') as String,
      notes: _readNullableString(map['notes']),
    );
  }
}

class RetailProduct {
  const RetailProduct({
    required this.id,
    required this.name,
    this.brand,
    this.description,
    this.imageUrls = const <String>[],
    this.retailPrice,
    this.currentStock = 0,
    this.unit = 'un',
    this.maxPurchaseQuantity = 6,
    this.updatedAt,
  });

  final String id;
  final String name;
  final String? brand;
  final String? description;
  final List<String> imageUrls;
  final double? retailPrice;
  final double currentStock;
  final String unit;
  final int maxPurchaseQuantity;
  final DateTime? updatedAt;

  String? get coverImageUrl {
    for (final imageUrl in imageUrls) {
      if (_hasUsableRemoteUrl(imageUrl)) {
        return imageUrl.trim();
      }
    }

    return null;
  }

  bool get hasUsableCoverImage => coverImageUrl != null;

  int get maxSelectableQuantity {
    final availableUnits = currentStock > 0 ? currentStock.floor() : 0;
    final stockCap = availableUnits > 0
        ? availableUnits
        : (currentStock > 0 ? 1 : 0);
    final purchaseCap = maxPurchaseQuantity <= 0 ? 1 : maxPurchaseQuantity;

    if (stockCap <= 0) {
      return purchaseCap;
    }

    return stockCap < purchaseCap ? stockCap : purchaseCap;
  }

  factory RetailProduct.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['retail_price'];
    final imageUrls = _readStringList(map['image_urls']);
    final imagePaths = _readStringList(map['image_paths']);

    return RetailProduct(
      id: (map['id'] ?? '') as String,
      name: (map['name'] ?? 'Produto') as String,
      brand: _readNullableString(map['brand']),
      description: _readNullableString(map['description']),
      imageUrls: imageUrls.isNotEmpty ? imageUrls : imagePaths,
      retailPrice: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
      currentStock: _readDouble(map['current_stock']),
      unit: _readNullableString(map['unit']) ?? 'un',
      maxPurchaseQuantity: _readInt(map['max_purchase_quantity'], fallback: 6),
      updatedAt: _readDateTime(map['updated_at']),
    );
  }
}

class StoreOrderLineInput {
  const StoreOrderLineInput({required this.productId, required this.quantity});

  final String productId;
  final int quantity;

  Map<String, dynamic> toMap() {
    return <String, dynamic>{'product_id': productId, 'quantity': quantity};
  }
}

class StoreOrderSubmissionResult {
  const StoreOrderSubmissionResult({
    required this.orderId,
    required this.orderNumber,
    required this.status,
    required this.totalItems,
    required this.subtotalAmount,
    required this.createdAt,
  });

  final String orderId;
  final int orderNumber;
  final String status;
  final int totalItems;
  final double subtotalAmount;
  final DateTime createdAt;

  factory StoreOrderSubmissionResult.fromMap(Map<String, dynamic> map) {
    return StoreOrderSubmissionResult(
      orderId: _readNullableString(map['order_id']) ?? '',
      orderNumber: _readInt(map['order_number']),
      status: _readNullableString(map['status']) ?? 'pending',
      totalItems: _readInt(map['total_items']),
      subtotalAmount: _readDouble(map['subtotal_amount']),
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
    );
  }
}

class CustomerStoreOrderItem {
  const CustomerStoreOrderItem({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unit,
    required this.unitPrice,
    required this.lineTotalAmount,
    this.brand,
    this.imageUrl,
  });

  final String id;
  final String productName;
  final String? brand;
  final int quantity;
  final String unit;
  final double unitPrice;
  final double lineTotalAmount;
  final String? imageUrl;

  factory CustomerStoreOrderItem.fromMap(Map<String, dynamic> map) {
    return CustomerStoreOrderItem(
      id: _readNullableString(map['id']) ?? '',
      productName:
          _readNullableString(map['product_name_snapshot']) ??
          'Produto do salao',
      brand: _readNullableString(map['product_brand_snapshot']),
      quantity: _readInt(map['quantity'], fallback: 1),
      unit: _readNullableString(map['unit_snapshot']) ?? 'un',
      unitPrice: _readDouble(map['unit_price_snapshot']),
      lineTotalAmount: _readDouble(map['line_total_amount']),
      imageUrl:
          _readNullableString(map['image_url']) ??
          _readNullableString(map['product_image_url']),
    );
  }
}

class CustomerStoreOrder {
  const CustomerStoreOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.totalItems,
    required this.subtotalAmount,
    required this.createdAt,
    this.items = const <CustomerStoreOrderItem>[],
    this.notes,
    this.cancellationReason,
    this.confirmedAt,
    this.readyAt,
    this.completedAt,
    this.cancelledAt,
  });

  final String id;
  final int orderNumber;
  final String status;
  final int totalItems;
  final double subtotalAmount;
  final DateTime createdAt;
  final List<CustomerStoreOrderItem> items;
  final String? notes;
  final String? cancellationReason;
  final DateTime? confirmedAt;
  final DateTime? readyAt;
  final DateTime? completedAt;
  final DateTime? cancelledAt;

  bool get isPending => status == 'pending';
  bool get isConfirmed => status == 'confirmed';
  bool get isReady => status == 'ready';
  bool get isCompleted => status == 'completed';
  bool get isCancelled => status == 'cancelled';

  DateTime get mostRelevantMoment {
    return cancelledAt ?? completedAt ?? readyAt ?? confirmedAt ?? createdAt;
  }

  factory CustomerStoreOrder.fromMap(Map<String, dynamic> map) {
    return CustomerStoreOrder(
      id: _readNullableString(map['id']) ?? '',
      orderNumber: _readInt(map['order_number']),
      status: _readNullableString(map['status']) ?? 'pending',
      totalItems: _readInt(map['total_items']),
      subtotalAmount: _readDouble(map['subtotal_amount']),
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
      items: _readListMaps(
        map['customer_product_order_items'],
      ).map(CustomerStoreOrderItem.fromMap).toList(growable: false),
      notes: _readNullableString(map['notes']),
      cancellationReason: _readNullableString(map['cancellation_reason']),
      confirmedAt: _readDateTime(map['confirmed_at']),
      readyAt: _readDateTime(map['ready_at']),
      completedAt: _readDateTime(map['completed_at']),
      cancelledAt: _readDateTime(map['cancelled_at']),
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
    this.sourceType,
    this.externalPlatform,
    this.externalPermalink,
    this.externalAuthorUsername,
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
  final String? sourceType;
  final String? externalPlatform;
  final String? externalPermalink;
  final String? externalAuthorUsername;

  String? get coverImageUrl {
    for (final imageUrl in imageUrls) {
      if (_hasUsableRemoteUrl(imageUrl)) {
        return imageUrl.trim();
      }
    }

    return null;
  }

  bool get hasUsableCoverImage => coverImageUrl != null;
  bool get hasUsableVideo => _hasUsableRemoteUrl(videoUrl);
  bool get hasExternalPermalink => _hasUsableRemoteUrl(externalPermalink);
  bool get isInstagramPost =>
      (externalPlatform ?? '').trim().toLowerCase() == 'instagram' ||
      (sourceType ?? '').trim().toLowerCase().startsWith('instagram_');
  bool get isInstagramMention =>
      isInstagramPost &&
      (sourceType ?? '').trim().toLowerCase() == 'instagram_mention';
  bool get isOwnedInstagramPost =>
      isInstagramPost &&
      (sourceType ?? '').trim().toLowerCase() == 'instagram_owned_post';

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
      sourceType: sourceType,
      externalPlatform: externalPlatform,
      externalPermalink: externalPermalink,
      externalAuthorUsername: externalAuthorUsername,
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
      sourceType: _readNullableString(map['source_type']),
      externalPlatform: _readNullableString(map['external_platform']),
      externalPermalink: _readNullableString(map['external_permalink']),
      externalAuthorUsername: _readNullableString(
        map['external_author_username'],
      ),
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
    this.protectionConfirmationRequired = true,
    this.protectionConfirmationLeadMinutes = 30,
    this.protectionAutoCancelUnconfirmed = true,
    this.protectionAutoCancelLeadMinutes = 10,
    this.protectionAutoCancelPendingDeposit = false,
    this.protectionDepositReminderLeadHours = 6,
    this.depositAmount = 0,
    this.depositCustomerReportedPaidAt,
    this.depositCustomerReportedPaidVia,
    this.depositCustomerReportedReference,
    this.depositStatus = 'not_required',
    this.depositPaidAt,
    this.depositPaymentProvider,
    this.depositPaymentProviderChargeId,
    this.depositPaymentProviderStatus,
    this.depositPaymentProviderPayload,
    this.depositPaymentProviderInvoiceUrl,
    this.depositPaymentProviderLastSyncedAt,
    this.depositPaymentProviderError,
    this.depositReceiptContentType,
    this.depositReceiptPath,
    this.depositReceiptUploadedAt,
    this.depositNotes,
    this.bookingPolicyAcknowledgedAt,
    this.bookingPolicyVersion,
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
  final bool protectionConfirmationRequired;
  final int protectionConfirmationLeadMinutes;
  final bool protectionAutoCancelUnconfirmed;
  final int protectionAutoCancelLeadMinutes;
  final bool protectionAutoCancelPendingDeposit;
  final int protectionDepositReminderLeadHours;
  final double depositAmount;
  final DateTime? depositCustomerReportedPaidAt;
  final String? depositCustomerReportedPaidVia;
  final String? depositCustomerReportedReference;
  final String depositStatus;
  final DateTime? depositPaidAt;
  final String? depositPaymentProvider;
  final String? depositPaymentProviderChargeId;
  final String? depositPaymentProviderStatus;
  final String? depositPaymentProviderPayload;
  final String? depositPaymentProviderInvoiceUrl;
  final DateTime? depositPaymentProviderLastSyncedAt;
  final String? depositPaymentProviderError;
  final String? depositReceiptContentType;
  final String? depositReceiptPath;
  final DateTime? depositReceiptUploadedAt;
  final String? depositNotes;
  final DateTime? bookingPolicyAcknowledgedAt;
  final String? bookingPolicyVersion;
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

  bool get hasDepositProtection => depositAmount > 0;
  bool get hasPendingDeposit =>
      hasDepositProtection && depositStatus == 'pending';
  bool get hasReceivedDeposit =>
      hasDepositProtection && depositStatus == 'received';
  bool get hasCustomerReportedDepositPayment =>
      depositCustomerReportedPaidAt != null;
  bool get usesManagedDepositProvider => depositPaymentProvider == 'asaas';
  bool get hasManagedDepositCharge =>
      usesManagedDepositProvider &&
      (depositPaymentProviderChargeId?.trim().isNotEmpty ?? false);
  bool get hasManagedDepositPayload =>
      usesManagedDepositProvider &&
      (depositPaymentProviderPayload?.trim().isNotEmpty ?? false);
  bool get hasManagedDepositInvoiceUrl =>
      usesManagedDepositProvider &&
      (depositPaymentProviderInvoiceUrl?.trim().isNotEmpty ?? false);
  bool get hasDepositReceipt =>
      (depositReceiptPath?.trim().isNotEmpty ?? false) &&
      depositReceiptUploadedAt != null;

  bool get requiresPresenceConfirmation {
    if (status != 'confirmed' || customerPresenceConfirmedAt != null) {
      return false;
    }

    final now = DateTime.now();
    if (!date.isAfter(now)) {
      return false;
    }

    if (customerConfirmationRequestedAt != null) {
      return true;
    }

    if (!protectionConfirmationRequired) {
      return false;
    }

    return date.isBefore(
      now.add(Duration(minutes: protectionConfirmationLeadMinutes + 5)),
    );
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
      protectionConfirmationRequired:
          map['protection_confirmation_required'] as bool? ?? true,
      protectionConfirmationLeadMinutes: _readInt(
        map['protection_confirmation_lead_minutes'],
        fallback: 30,
      ),
      protectionAutoCancelUnconfirmed:
          map['protection_auto_cancel_unconfirmed'] as bool? ?? true,
      protectionAutoCancelLeadMinutes: _readInt(
        map['protection_auto_cancel_lead_minutes'],
        fallback: 10,
      ),
      protectionAutoCancelPendingDeposit:
          map['protection_auto_cancel_pending_deposit'] as bool? ?? false,
      protectionDepositReminderLeadHours: _readInt(
        map['protection_deposit_reminder_lead_hours'],
        fallback: 6,
      ),
      depositAmount: _readDouble(map['deposit_amount']),
      depositCustomerReportedPaidAt: _readDateTime(
        map['deposit_customer_reported_paid_at'],
      ),
      depositCustomerReportedPaidVia: _readNullableString(
        map['deposit_customer_reported_paid_via'],
      ),
      depositCustomerReportedReference: _readNullableString(
        map['deposit_customer_reported_reference'],
      ),
      depositStatus:
          _readNullableString(map['deposit_status']) ?? 'not_required',
      depositPaidAt: _readDateTime(map['deposit_paid_at']),
      depositPaymentProvider: _readNullableString(
        map['deposit_payment_provider'],
      ),
      depositPaymentProviderChargeId: _readNullableString(
        map['deposit_payment_provider_charge_id'],
      ),
      depositPaymentProviderStatus: _readNullableString(
        map['deposit_payment_provider_status'],
      ),
      depositPaymentProviderPayload: _readNullableString(
        map['deposit_payment_provider_payload'],
      ),
      depositPaymentProviderInvoiceUrl: _readNullableString(
        map['deposit_payment_provider_invoice_url'],
      ),
      depositPaymentProviderLastSyncedAt: _readDateTime(
        map['deposit_payment_provider_last_synced_at'],
      ),
      depositPaymentProviderError: _readNullableString(
        map['deposit_payment_provider_error'],
      ),
      depositReceiptContentType: _readNullableString(
        map['deposit_receipt_content_type'],
      ),
      depositReceiptPath: _readNullableString(map['deposit_receipt_path']),
      depositReceiptUploadedAt: _readDateTime(
        map['deposit_receipt_uploaded_at'],
      ),
      depositNotes: _readNullableString(map['deposit_notes']),
      bookingPolicyAcknowledgedAt: _readDateTime(
        map['booking_policy_acknowledged_at'],
      ),
      bookingPolicyVersion: _readNullableString(map['booking_policy_version']),
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
    required this.totalPointsEarned,
    required this.totalCashbackEarned,
    required this.rankedCustomers,
    required this.programIsActive,
    required this.tiers,
    this.rankPosition,
    this.currentTierLabel,
    this.nextTierLabel,
    this.programTitle,
    this.programDescription,
    this.vipRewardServiceName,
    this.lastRewardAt,
  });

  final int pointsBalance;
  final double cashbackBalance;
  final int completedVisits;
  final int visitsToNextTier;
  final int totalPointsEarned;
  final double totalCashbackEarned;
  final int rankedCustomers;
  final bool programIsActive;
  final List<LoyaltyTierSummary> tiers;
  final int? rankPosition;
  final String? currentTierLabel;
  final String? nextTierLabel;
  final String? programTitle;
  final String? programDescription;
  final String? vipRewardServiceName;
  final DateTime? lastRewardAt;

  bool get hasVisibleContent =>
      programIsActive ||
      pointsBalance > 0 ||
      cashbackBalance > 0 ||
      completedVisits > 0;

  factory LoyaltySummary.fromMap(Map<String, dynamic> map) {
    final program = _asSingleMap(map['program']);
    final currentTier = _asSingleMap(map['current_tier']);
    final nextTier = _asSingleMap(map['next_tier']);

    return LoyaltySummary(
      pointsBalance: _readInt(map['points_balance']),
      cashbackBalance: _readDouble(map['cashback_balance']),
      completedVisits: _readInt(map['completed_visits']),
      visitsToNextTier: _readInt(map['visits_to_next_tier']),
      totalPointsEarned: _readInt(map['total_points_earned']),
      totalCashbackEarned: _readDouble(map['total_cashback_earned']),
      rankedCustomers: _readInt(map['ranked_customers']),
      programIsActive: (program['is_active'] ?? false) as bool,
      tiers: _readListMaps(
        program['tiers'],
      ).map(LoyaltyTierSummary.fromMap).toList(growable: false),
      rankPosition: map['rank_position'] == null
          ? null
          : _readInt(map['rank_position']),
      currentTierLabel: _readNullableString(currentTier['label']),
      nextTierLabel: _readNullableString(nextTier['label']),
      programTitle: _readNullableString(program['title']),
      programDescription: _readNullableString(program['description']),
      vipRewardServiceName: _readNullableString(
        program['vip_reward_service_name'],
      ),
      lastRewardAt: _readDateTime(map['last_reward_at']),
    );
  }
}

class LoyaltyTierSummary {
  const LoyaltyTierSummary({
    required this.label,
    required this.minVisits,
    required this.discountPercent,
    required this.isVip,
  });

  final String label;
  final int minVisits;
  final double discountPercent;
  final bool isVip;

  factory LoyaltyTierSummary.fromMap(Map<String, dynamic> map) {
    return LoyaltyTierSummary(
      label: (map['label'] ?? 'Nível') as String,
      minVisits: _readInt(map['min_visits']),
      discountPercent: _readDouble(map['discount_percent']),
      isVip: (map['is_vip'] ?? false) as bool,
    );
  }
}

class ReferralSummary {
  const ReferralSummary({
    required this.referralCode,
    required this.pendingCount,
    required this.qualifiedCount,
    required this.currentCycleProgress,
    required this.nextRewardRemaining,
    required this.unlockedRewardsCount,
    required this.availableRewardsCount,
    required this.requiredQualifiedReferrals,
    this.hasActiveProgram = false,
    this.programTitle,
    this.programDescription,
    this.rewardForReferrer,
    this.rewardForInvited,
    this.rewardServiceName,
    this.referrals = const <ReferralEventSummary>[],
    this.rewardUnlocks = const <ReferralRewardUnlockSummary>[],
  });

  final String referralCode;
  final int pendingCount;
  final int qualifiedCount;
  final int currentCycleProgress;
  final int nextRewardRemaining;
  final int unlockedRewardsCount;
  final int availableRewardsCount;
  final int requiredQualifiedReferrals;
  final bool hasActiveProgram;
  final String? programTitle;
  final String? programDescription;
  final String? rewardForReferrer;
  final String? rewardForInvited;
  final String? rewardServiceName;
  final List<ReferralEventSummary> referrals;
  final List<ReferralRewardUnlockSummary> rewardUnlocks;

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
      currentCycleProgress: _readInt(map['current_cycle_progress']),
      nextRewardRemaining: _readInt(map['next_reward_remaining']),
      unlockedRewardsCount: _readInt(map['unlocked_rewards_count']),
      availableRewardsCount: _readInt(map['available_rewards_count']),
      requiredQualifiedReferrals: _readInt(
        program['required_qualified_referrals'],
      ),
      hasActiveProgram: (program['is_active'] ?? false) as bool,
      programTitle: _readNullableString(program['title']),
      programDescription: _readNullableString(program['description']),
      rewardForReferrer: _readNullableString(program['reward_for_referrer']),
      rewardForInvited: _readNullableString(program['reward_for_invited']),
      rewardServiceName: _readNullableString(program['reward_service_name']),
      referrals: _readListMaps(
        map['referrals'],
      ).map(ReferralEventSummary.fromMap).toList(growable: false),
      rewardUnlocks: _readListMaps(
        map['reward_unlocks'],
      ).map(ReferralRewardUnlockSummary.fromMap).toList(growable: false),
    );
  }
}

class ReferralEventSummary {
  const ReferralEventSummary({
    required this.id,
    required this.customerName,
    required this.status,
    required this.createdAt,
    this.qualifiedAt,
  });

  final String id;
  final String customerName;
  final String status;
  final DateTime createdAt;
  final DateTime? qualifiedAt;

  factory ReferralEventSummary.fromMap(Map<String, dynamic> map) {
    return ReferralEventSummary(
      id: (map['id'] ?? '') as String,
      customerName: (map['customer_name'] ?? 'Cliente') as String,
      status: (map['status'] ?? 'pending') as String,
      createdAt: _readDateTime(map['created_at']) ?? DateTime.now(),
      qualifiedAt: _readDateTime(map['qualified_at']),
    );
  }
}

class ReferralRewardUnlockSummary {
  const ReferralRewardUnlockSummary({
    required this.id,
    required this.thresholdReached,
    required this.requiredQualifiedReferrals,
    required this.status,
    required this.unlockedAt,
    this.rewardDescription,
    this.rewardServiceName,
    this.redeemedAt,
  });

  final String id;
  final int thresholdReached;
  final int requiredQualifiedReferrals;
  final String status;
  final DateTime unlockedAt;
  final String? rewardDescription;
  final String? rewardServiceName;
  final DateTime? redeemedAt;

  factory ReferralRewardUnlockSummary.fromMap(Map<String, dynamic> map) {
    return ReferralRewardUnlockSummary(
      id: (map['id'] ?? '') as String,
      thresholdReached: _readInt(map['threshold_reached']),
      requiredQualifiedReferrals: _readInt(map['required_qualified_referrals']),
      status: (map['status'] ?? 'available') as String,
      unlockedAt: _readDateTime(map['unlocked_at']) ?? DateTime.now(),
      rewardDescription: _readNullableString(map['reward_description']),
      rewardServiceName: _readNullableString(map['reward_service_name']),
      redeemedAt: _readDateTime(map['redeemed_at']),
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

class OperationalIssue {
  const OperationalIssue({
    required this.scope,
    required this.title,
    required this.message,
  });

  final String scope;
  final String title;
  final String message;
}

class HomeSnapshot {
  const HomeSnapshot({
    required this.services,
    required this.teamMembers,
    required this.offers,
    this.memberships = const <CustomerMembershipPackage>[],
    required this.products,
    required this.appointments,
    required this.vacancyAlerts,
    required this.posts,
    required this.notifications,
    required this.loyaltySummary,
    required this.referralSummary,
    this.issues = const <OperationalIssue>[],
  });

  final List<ServiceItem> services;
  final List<TeamMember> teamMembers;
  final List<OfferItem> offers;
  final List<CustomerMembershipPackage> memberships;
  final List<RetailProduct> products;
  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
  final List<FeedPost> posts;
  final List<CustomerNotificationItem> notifications;
  final LoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final List<OperationalIssue> issues;

  AppointmentItem? get nextAppointment {
    final upcoming =
        appointments.where((item) => item.isUpcoming).toList(growable: false)
          ..sort((left, right) => left.date.compareTo(right.date));

    return upcoming.isEmpty ? null : upcoming.first;
  }

  List<OfferItem> get membershipOffers =>
      offers.where((item) => item.isMembership).toList(growable: false);

  List<OfferItem> get promotionOffers =>
      offers.where((item) => item.isPromotion).toList(growable: false);

  List<CustomerMembershipPackage> get activeMemberships =>
      memberships.where((item) => item.isActive).toList(growable: false);

  int get unreadNotificationsCount =>
      notifications.where((item) => !item.isRead).length;
}

class ExploreSnapshot {
  const ExploreSnapshot({
    required this.services,
    required this.teamMembers,
    required this.offers,
    required this.products,
    this.issues = const <OperationalIssue>[],
  });

  final List<ServiceItem> services;
  final List<TeamMember> teamMembers;
  final List<OfferItem> offers;
  final List<RetailProduct> products;
  final List<OperationalIssue> issues;

  List<OfferItem> get membershipOffers =>
      offers.where((item) => item.isMembership).toList(growable: false);

  List<OfferItem> get promotionOffers =>
      offers.where((item) => item.isPromotion).toList(growable: false);
}

class AppointmentsSnapshot {
  const AppointmentsSnapshot({
    required this.appointments,
    required this.vacancyAlerts,
    this.issues = const <OperationalIssue>[],
  });

  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
  final List<OperationalIssue> issues;
}

class FeedSnapshot {
  const FeedSnapshot({
    required this.posts,
    this.issues = const <OperationalIssue>[],
  });

  final List<FeedPost> posts;
  final List<OperationalIssue> issues;
}

class ProfileSnapshot {
  const ProfileSnapshot({
    required this.loyaltySummary,
    required this.referralSummary,
    required this.unreadNotificationsCount,
    this.memberships = const <CustomerMembershipPackage>[],
    this.storeOrders = const <CustomerStoreOrder>[],
    this.issues = const <OperationalIssue>[],
  });

  final LoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final int unreadNotificationsCount;
  final List<CustomerMembershipPackage> memberships;
  final List<CustomerStoreOrder> storeOrders;
  final List<OperationalIssue> issues;
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

bool _hasUsableRemoteUrl(Object? value) {
  final raw = value?.toString().trim();
  if (raw == null || raw.isEmpty) {
    return false;
  }

  final uri = Uri.tryParse(raw);
  if (uri == null || !uri.hasScheme) {
    return false;
  }

  return uri.scheme == 'http' || uri.scheme == 'https';
}
