class AppSession {
  const AppSession({required this.customer, this.joinCode, this.landingData});

  final CustomerProfile customer;
  final String? joinCode;
  final SalonLandingData? landingData;

  AppSession copyWith({
    CustomerProfile? customer,
    String? joinCode,
    SalonLandingData? landingData,
  }) {
    return AppSession(
      customer: customer ?? this.customer,
      joinCode: joinCode ?? this.joinCode,
      landingData: landingData ?? this.landingData,
    );
  }
}

enum SessionStage { loading, signedOut, authenticated }

class CustomerProfile {
  const CustomerProfile({
    required this.id,
    required this.salonId,
    required this.authUserId,
    required this.name,
    required this.phone,
    required this.referralCode,
    required this.consentStatus,
  });

  factory CustomerProfile.fromMap(Map<String, dynamic> map) {
    return CustomerProfile(
      id: stringValue(map['id']),
      salonId: stringValue(map['salon_id']),
      authUserId: stringValue(map['auth_user_id']),
      name: stringValue(map['name']),
      phone: stringOrNull(map['phone']),
      referralCode: stringOrNull(map['referral_code']),
      consentStatus: stringOrNull(map['consent_status']) ?? 'pending',
    );
  }

  final String id;
  final String salonId;
  final String authUserId;
  final String name;
  final String? phone;
  final String? referralCode;
  final String consentStatus;
}

class SalonLandingData {
  const SalonLandingData({
    required this.preview,
    required this.featuredServices,
    required this.activeOffers,
    required this.recentPosts,
    required this.centralCampaigns,
    required this.stats,
    required this.links,
  });

  factory SalonLandingData.fromJson(Map<String, dynamic> map) {
    return SalonLandingData(
      preview: SalonPreview.fromJson(jsonMap(map['preview'])),
      featuredServices: jsonMapList(
        map['featuredServices'],
      ).map(SalonServiceHighlight.fromJson).toList(),
      activeOffers: jsonMapList(
        map['activeOffers'],
      ).map(SalonOfferHighlight.fromJson).toList(),
      recentPosts: jsonMapList(
        map['recentPosts'],
      ).map(SalonGalleryHighlight.fromJson).toList(),
      centralCampaigns: jsonMapList(
        map['centralCampaigns'],
      ).map(SalonCampaign.fromJson).toList(),
      stats: SalonStats.fromJson(jsonMap(map['stats'])),
      links: SalonLinks.fromJson(jsonMap(map['links'])),
    );
  }

  final SalonPreview preview;
  final List<SalonServiceHighlight> featuredServices;
  final List<SalonOfferHighlight> activeOffers;
  final List<SalonGalleryHighlight> recentPosts;
  final List<SalonCampaign> centralCampaigns;
  final SalonStats stats;
  final SalonLinks links;
}

class SalonPreview {
  const SalonPreview({
    required this.salonId,
    required this.joinCode,
    required this.name,
    required this.appDisplayName,
    required this.tagline,
    required this.brandColor,
    this.secondaryColor,
    this.accentColor,
    this.experienceModel,
    this.homeEmphasis,
    required this.logoUrl,
    required this.heroImageUrl,
    this.galleryCoverImageUrl,
    this.profileCoverImageUrl,
    this.shareImageUrl,
    required this.heroHeadline,
    this.heroSupportLine,
    required this.welcomeHeadline,
    required this.welcomeMessage,
    required this.primaryCtaLabel,
    this.visualStyle,
    this.themeMode,
    this.buttonStyle,
    this.cardStyle,
    this.bannerStyle,
    required this.promotionHeadline,
    required this.segmentLabel,
    required this.segmentDescription,
    this.visibleHomeModules = const [],
    required this.moduleLabels,
    required this.instagramUrl,
    required this.instagramProfileImageUrl,
    this.addressLabel,
    required this.mapUrl,
    required this.supportUrl,
    required this.supportEmail,
    required this.ratingValue,
    required this.ratingCount,
    this.bookingPolicyEnabled = false,
    this.bookingPolicyTitle,
    this.bookingPolicySummary,
    this.bookingPaymentMode,
    this.bookingRequiresDeposit = false,
    this.bookingDepositAmount,
    this.bookingPaymentInstructions,
    this.bookingPixKey,
    this.bookingPixRecipientName,
    this.bookingPixRecipientCity,
    this.bookingExternalCheckoutUrl,
  });

  factory SalonPreview.fromJson(Map<String, dynamic> map) {
    return SalonPreview(
      salonId: stringValue(map['salonId']),
      joinCode: stringValue(map['joinCode']),
      name: stringValue(map['name']),
      appDisplayName: stringOrNull(map['appDisplayName']),
      tagline: stringOrNull(map['tagline']),
      brandColor: stringOrNull(map['brandColor']) ?? '#C15F43',
      secondaryColor: stringOrNull(map['secondaryColor']),
      accentColor: stringOrNull(map['accentColor']),
      experienceModel: stringOrNull(map['experienceModel']),
      homeEmphasis: stringOrNull(map['homeEmphasis']),
      logoUrl: stringOrNull(map['logoUrl']),
      heroImageUrl: stringOrNull(map['heroImageUrl']),
      galleryCoverImageUrl: stringOrNull(map['galleryCoverImageUrl']),
      profileCoverImageUrl: stringOrNull(map['profileCoverImageUrl']),
      shareImageUrl: stringOrNull(map['shareImageUrl']),
      heroHeadline: stringOrNull(map['heroHeadline']),
      heroSupportLine: stringOrNull(map['heroSupportLine']),
      welcomeHeadline: stringOrNull(map['welcomeHeadline']),
      welcomeMessage: stringOrNull(map['welcomeMessage']),
      primaryCtaLabel: stringOrNull(map['primaryCtaLabel']),
      visualStyle: stringOrNull(map['visualStyle']),
      themeMode: stringOrNull(map['themeMode']),
      buttonStyle: stringOrNull(map['buttonStyle']),
      cardStyle: stringOrNull(map['cardStyle']),
      bannerStyle: stringOrNull(map['bannerStyle']),
      promotionHeadline: stringOrNull(map['promotionHeadline']),
      segmentLabel: stringOrNull(map['segmentLabel']) ?? 'Salão',
      segmentDescription: stringOrNull(map['segmentDescription']) ?? '',
      visibleHomeModules: stringList(map['visibleHomeModules']),
      moduleLabels: stringList(map['moduleLabels']),
      instagramUrl: stringOrNull(map['instagramUrl']),
      instagramProfileImageUrl: stringOrNull(map['instagramProfileImageUrl']),
      addressLabel: stringOrNull(map['addressLabel']),
      mapUrl: stringOrNull(map['mapUrl']),
      supportUrl: stringOrNull(map['supportUrl']),
      supportEmail: stringOrNull(map['supportEmail']),
      ratingValue: doubleOrNull(map['ratingValue']),
      ratingCount: intOrNull(map['ratingCount']),
      bookingPolicyEnabled: map['bookingPolicyEnabled'] == true,
      bookingPolicyTitle: stringOrNull(map['bookingPolicyTitle']),
      bookingPolicySummary: stringOrNull(map['bookingPolicySummary']),
      bookingPaymentMode: stringOrNull(map['bookingPaymentMode']),
      bookingRequiresDeposit: map['bookingRequiresDeposit'] == true,
      bookingDepositAmount: doubleOrNull(map['bookingDepositAmount']),
      bookingPaymentInstructions: stringOrNull(
        map['bookingPaymentInstructions'],
      ),
      bookingPixKey: stringOrNull(map['bookingPixKey']),
      bookingPixRecipientName: stringOrNull(map['bookingPixRecipientName']),
      bookingPixRecipientCity: stringOrNull(map['bookingPixRecipientCity']),
      bookingExternalCheckoutUrl: stringOrNull(
        map['bookingExternalCheckoutUrl'],
      ),
    );
  }

  final String salonId;
  final String joinCode;
  final String name;
  final String? appDisplayName;
  final String? tagline;
  final String brandColor;
  final String? secondaryColor;
  final String? accentColor;
  final String? experienceModel;
  final String? homeEmphasis;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? galleryCoverImageUrl;
  final String? profileCoverImageUrl;
  final String? shareImageUrl;
  final String? heroHeadline;
  final String? heroSupportLine;
  final String? welcomeHeadline;
  final String? welcomeMessage;
  final String? primaryCtaLabel;
  final String? visualStyle;
  final String? themeMode;
  final String? buttonStyle;
  final String? cardStyle;
  final String? bannerStyle;
  final String? promotionHeadline;
  final String segmentLabel;
  final String segmentDescription;
  final List<String> visibleHomeModules;
  final List<String> moduleLabels;
  final String? instagramUrl;
  final String? instagramProfileImageUrl;
  final String? addressLabel;
  final String? mapUrl;
  final String? supportUrl;
  final String? supportEmail;
  final double? ratingValue;
  final int? ratingCount;
  final bool bookingPolicyEnabled;
  final String? bookingPolicyTitle;
  final String? bookingPolicySummary;
  final String? bookingPaymentMode;
  final bool bookingRequiresDeposit;
  final double? bookingDepositAmount;
  final String? bookingPaymentInstructions;
  final String? bookingPixKey;
  final String? bookingPixRecipientName;
  final String? bookingPixRecipientCity;
  final String? bookingExternalCheckoutUrl;
}

class SalonCampaign {
  const SalonCampaign({
    required this.id,
    required this.isActive,
    required this.priority,
    required this.eyebrow,
    required this.title,
    required this.message,
    required this.campaignLabel,
    required this.ctaLabel,
    required this.ctaTarget,
  });

  factory SalonCampaign.fromJson(Map<String, dynamic> map) {
    return SalonCampaign(
      id: stringValue(map['id']),
      isActive: map['isActive'] == true,
      priority: stringOrNull(map['priority']) ?? 'medium',
      eyebrow: stringOrNull(map['eyebrow']),
      title: stringValue(map['title']),
      message: stringValue(map['message']),
      campaignLabel: stringOrNull(map['campaignLabel']),
      ctaLabel: stringOrNull(map['ctaLabel']),
      ctaTarget: stringOrNull(map['ctaTarget']),
    );
  }

  final String id;
  final bool isActive;
  final String priority;
  final String? eyebrow;
  final String title;
  final String message;
  final String? campaignLabel;
  final String? ctaLabel;
  final String? ctaTarget;
}

class SalonServiceHighlight {
  const SalonServiceHighlight({
    required this.id,
    required this.name,
    required this.category,
    required this.description,
    required this.duration,
    required this.price,
    required this.imageUrl,
  });

  factory SalonServiceHighlight.fromJson(Map<String, dynamic> map) {
    return SalonServiceHighlight(
      id: stringValue(map['id']),
      name: stringValue(map['name']),
      category: stringOrNull(map['category']),
      description: stringOrNull(map['description']),
      duration: intValue(map['duration']),
      price: doubleValue(map['price']),
      imageUrl: stringOrNull(map['imageUrl']),
    );
  }

  final String id;
  final String name;
  final String? category;
  final String? description;
  final int duration;
  final double price;
  final String? imageUrl;
}

class SalonOfferHighlight {
  const SalonOfferHighlight({
    required this.id,
    required this.title,
    required this.description,
    required this.highlightText,
    required this.kindLabel,
    required this.priceLabel,
    required this.lifecycleLabel,
  });

  factory SalonOfferHighlight.fromJson(Map<String, dynamic> map) {
    return SalonOfferHighlight(
      id: stringValue(map['id']),
      title: stringValue(map['title']),
      description: stringOrNull(map['description']),
      highlightText: stringOrNull(map['highlightText']),
      kindLabel: stringOrNull(map['kindLabel']) ?? 'Oferta',
      priceLabel: stringOrNull(map['priceLabel']),
      lifecycleLabel: stringOrNull(map['lifecycleLabel']) ?? 'Agora',
    );
  }

  final String id;
  final String title;
  final String? description;
  final String? highlightText;
  final String kindLabel;
  final String? priceLabel;
  final String lifecycleLabel;
}

class SalonGalleryHighlight {
  const SalonGalleryHighlight({
    required this.id,
    required this.title,
    required this.caption,
    required this.imageUrl,
    required this.badge,
    required this.serviceName,
    required this.staffLabel,
    required this.authorAvatarUrl,
    required this.sourceLabel,
  });

  factory SalonGalleryHighlight.fromJson(Map<String, dynamic> map) {
    return SalonGalleryHighlight(
      id: stringValue(map['id']),
      title: stringValue(map['title']),
      caption: stringOrNull(map['caption']),
      imageUrl: stringOrNull(map['imageUrl']),
      badge: stringOrNull(map['badge']),
      serviceName: stringOrNull(map['serviceName']),
      staffLabel: stringOrNull(map['staffLabel']),
      authorAvatarUrl: stringOrNull(map['authorAvatarUrl']),
      sourceLabel: stringOrNull(map['sourceLabel']),
    );
  }

  final String id;
  final String title;
  final String? caption;
  final String? imageUrl;
  final String? badge;
  final String? serviceName;
  final String? staffLabel;
  final String? authorAvatarUrl;
  final String? sourceLabel;
}

class SalonStats {
  const SalonStats({
    required this.servicesCount,
    required this.activeOffersCount,
    required this.recentPostsCount,
  });

  factory SalonStats.fromJson(Map<String, dynamic> map) {
    return SalonStats(
      servicesCount: intValue(map['servicesCount']),
      activeOffersCount: intValue(map['activeOffersCount']),
      recentPostsCount: intValue(map['recentPostsCount']),
    );
  }

  final int servicesCount;
  final int activeOffersCount;
  final int recentPostsCount;
}

class SalonLinks {
  const SalonLinks({
    required this.whatsappUrl,
    required this.instagramUrl,
    required this.mapUrl,
    required this.supportUrl,
    required this.supportEmail,
    required this.privacyPolicyUrl,
    required this.termsOfUseUrl,
  });

  factory SalonLinks.fromJson(Map<String, dynamic> map) {
    return SalonLinks(
      whatsappUrl: stringOrNull(map['whatsappUrl']),
      instagramUrl: stringOrNull(map['instagramUrl']),
      mapUrl: stringOrNull(map['mapUrl']),
      supportUrl: stringOrNull(map['supportUrl']),
      supportEmail: stringOrNull(map['supportEmail']),
      privacyPolicyUrl: stringOrNull(map['privacyPolicyUrl']),
      termsOfUseUrl: stringOrNull(map['termsOfUseUrl']),
    );
  }

  final String? whatsappUrl;
  final String? instagramUrl;
  final String? mapUrl;
  final String? supportUrl;
  final String? supportEmail;
  final String? privacyPolicyUrl;
  final String? termsOfUseUrl;
}

class ServiceOption {
  const ServiceOption({
    required this.id,
    required this.name,
    required this.description,
    required this.durationMinutes,
    required this.price,
    required this.imageUrl,
  });

  final String id;
  final String name;
  final String? description;
  final int durationMinutes;
  final double price;
  final String? imageUrl;
}

class DayAvailability {
  const DayAvailability({
    required this.targetDay,
    required this.timezone,
    required this.slotStepMinutes,
    required this.serviceDuration,
    required this.isOpen,
    required this.opensAt,
    required this.closesAt,
    required this.staffMembers,
    required this.availableSlots,
  });

  factory DayAvailability.fromJson(Map<String, dynamic> map) {
    return DayAvailability(
      targetDay: dateTimeValue(map['target_day']) ?? DateTime.now(),
      timezone: stringOrNull(map['timezone']) ?? 'UTC',
      slotStepMinutes: intValue(map['slot_step_minutes']),
      serviceDuration: intValue(map['service_duration']),
      isOpen: map['is_open'] == true,
      opensAt: dateTimeOrNull(map['opens_at']),
      closesAt: dateTimeOrNull(map['closes_at']),
      staffMembers: jsonMapList(
        map['staff_members'],
      ).map(StaffAvailability.fromJson).toList(),
      availableSlots: jsonMapList(
        map['available_slots'],
      ).map(AppointmentSlot.fromJson).toList(),
    );
  }

  final DateTime targetDay;
  final String timezone;
  final int slotStepMinutes;
  final int serviceDuration;
  final bool isOpen;
  final DateTime? opensAt;
  final DateTime? closesAt;
  final List<StaffAvailability> staffMembers;
  final List<AppointmentSlot> availableSlots;
}

class StaffAvailability {
  const StaffAvailability({
    required this.id,
    required this.name,
    required this.role,
    required this.isOpen,
    required this.opensAt,
    required this.closesAt,
    required this.availableSlotsCount,
    required this.nextAvailableAt,
    required this.status,
    required this.statusDetail,
  });

  factory StaffAvailability.fromJson(Map<String, dynamic> map) {
    return StaffAvailability(
      id: stringValue(map['id']),
      name: stringValue(map['name']),
      role: stringOrNull(map['role']),
      isOpen: map['is_open'] == true,
      opensAt: dateTimeOrNull(map['opens_at']),
      closesAt: dateTimeOrNull(map['closes_at']),
      availableSlotsCount: intValue(map['available_slots_count']),
      nextAvailableAt: dateTimeOrNull(map['next_available_at']),
      status: stringOrNull(map['status']) ?? 'busy',
      statusDetail: stringOrNull(map['status_detail']) ?? '',
    );
  }

  final String id;
  final String name;
  final String? role;
  final bool isOpen;
  final DateTime? opensAt;
  final DateTime? closesAt;
  final int availableSlotsCount;
  final DateTime? nextAvailableAt;
  final String status;
  final String statusDetail;
}

class AppointmentSlot {
  const AppointmentSlot({
    required this.startAt,
    required this.endsAt,
    required this.staffMemberId,
    required this.staffMemberName,
  });

  factory AppointmentSlot.fromJson(Map<String, dynamic> map) {
    return AppointmentSlot(
      startAt: dateTimeValue(map['start_at']) ?? DateTime.now(),
      endsAt: dateTimeValue(map['ends_at']) ?? DateTime.now(),
      staffMemberId: stringValue(map['staff_member_id']),
      staffMemberName: stringOrNull(map['staff_member_name']) ?? 'Equipe',
    );
  }

  final DateTime startAt;
  final DateTime endsAt;
  final String staffMemberId;
  final String staffMemberName;
}

class CustomerAppointment {
  const CustomerAppointment({
    required this.id,
    required this.date,
    required this.endsAt,
    required this.status,
    required this.depositAmount,
    required this.depositStatus,
    required this.depositReportedPaidAt,
    required this.depositReportedPaidVia,
    required this.bookingPolicySnapshot,
    required this.serviceName,
    required this.serviceDuration,
    required this.servicePrice,
    required this.serviceImageUrl,
    required this.staffName,
    required this.staffRole,
    required this.presenceConfirmedAt,
    required this.depositPaymentProvider,
    required this.depositPaymentProviderChargeId,
    required this.depositPaymentProviderStatus,
    required this.depositPaymentProviderInvoiceUrl,
    required this.depositPaymentProviderPayload,
    required this.depositPaymentProviderError,
  });

  final String id;
  final DateTime date;
  final DateTime? endsAt;
  final String status;
  final double depositAmount;
  final String depositStatus;
  final DateTime? depositReportedPaidAt;
  final String? depositReportedPaidVia;
  final String? bookingPolicySnapshot;
  final String serviceName;
  final int? serviceDuration;
  final double? servicePrice;
  final String? serviceImageUrl;
  final String? staffName;
  final String? staffRole;
  final DateTime? presenceConfirmedAt;
  final String? depositPaymentProvider;
  final String? depositPaymentProviderChargeId;
  final String? depositPaymentProviderStatus;
  final String? depositPaymentProviderInvoiceUrl;
  final String? depositPaymentProviderPayload;
  final String? depositPaymentProviderError;
}

class AppointmentDepositCharge {
  const AppointmentDepositCharge({
    required this.appointmentId,
    required this.depositStatus,
    required this.depositPaidAt,
    required this.providerName,
    required this.providerChargeId,
    required this.providerStatus,
    required this.providerPayload,
    required this.providerInvoiceUrl,
    required this.providerLastSyncedAt,
    required this.providerError,
  });

  factory AppointmentDepositCharge.fromJson(Map<String, dynamic> map) {
    final provider = jsonMapOrNull(map['provider']);
    return AppointmentDepositCharge(
      appointmentId: stringValue(map['appointment_id']),
      depositStatus: stringOrNull(map['deposit_status']) ?? 'pending',
      depositPaidAt: dateTimeOrNull(map['deposit_paid_at']),
      providerName: stringOrNull(provider?['name']),
      providerChargeId: stringOrNull(provider?['charge_id']),
      providerStatus: stringOrNull(provider?['status']),
      providerPayload: stringOrNull(provider?['payload']),
      providerInvoiceUrl: stringOrNull(provider?['invoice_url']),
      providerLastSyncedAt: dateTimeOrNull(provider?['last_synced_at']),
      providerError: stringOrNull(provider?['error']),
    );
  }

  final String appointmentId;
  final String depositStatus;
  final DateTime? depositPaidAt;
  final String? providerName;
  final String? providerChargeId;
  final String? providerStatus;
  final String? providerPayload;
  final String? providerInvoiceUrl;
  final DateTime? providerLastSyncedAt;
  final String? providerError;
}

class FeedPost {
  const FeedPost({
    required this.id,
    required this.title,
    required this.caption,
    required this.postType,
    required this.createdAt,
    required this.imageUrls,
    required this.authorAvatarUrl,
    required this.authorUsername,
    required this.sourceType,
    required this.serviceName,
    required this.staffName,
    required this.staffRole,
    required this.likesCount,
    required this.comments,
    required this.isLikedByCustomer,
  });

  final String id;
  final String title;
  final String? caption;
  final String postType;
  final DateTime createdAt;
  final List<String> imageUrls;
  final String? authorAvatarUrl;
  final String? authorUsername;
  final String? sourceType;
  final String? serviceName;
  final String? staffName;
  final String? staffRole;
  final int likesCount;
  final List<FeedComment> comments;
  final bool isLikedByCustomer;

  int get commentsCount => comments.length;

  FeedPost copyWith({
    int? likesCount,
    List<FeedComment>? comments,
    bool? isLikedByCustomer,
  }) {
    return FeedPost(
      id: id,
      title: title,
      caption: caption,
      postType: postType,
      createdAt: createdAt,
      imageUrls: imageUrls,
      authorAvatarUrl: authorAvatarUrl,
      authorUsername: authorUsername,
      sourceType: sourceType,
      serviceName: serviceName,
      staffName: staffName,
      staffRole: staffRole,
      likesCount: likesCount ?? this.likesCount,
      comments: comments ?? this.comments,
      isLikedByCustomer: isLikedByCustomer ?? this.isLikedByCustomer,
    );
  }
}

class FeedComment {
  const FeedComment({
    required this.id,
    required this.customerName,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String customerName;
  final String body;
  final DateTime createdAt;
}

class StoreProduct {
  const StoreProduct({
    required this.id,
    required this.name,
    required this.brand,
    required this.description,
    required this.price,
    required this.stock,
    required this.unit,
    required this.maxPurchaseQuantity,
    required this.imageUrl,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String? brand;
  final String? description;
  final double price;
  final double stock;
  final String unit;
  final int maxPurchaseQuantity;
  final String? imageUrl;
  final DateTime? updatedAt;
}

class StoreOrder {
  const StoreOrder({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.totalItems,
    required this.subtotalAmount,
    required this.createdAt,
    required this.confirmedAt,
    required this.readyAt,
    required this.completedAt,
    required this.cancelledAt,
    required this.cancellationReason,
    required this.notes,
    required this.items,
  });

  final String id;
  final int orderNumber;
  final String status;
  final int totalItems;
  final double subtotalAmount;
  final DateTime createdAt;
  final DateTime? confirmedAt;
  final DateTime? readyAt;
  final DateTime? completedAt;
  final DateTime? cancelledAt;
  final String? cancellationReason;
  final String? notes;
  final List<StoreOrderItem> items;
}

class StoreOrderItem {
  const StoreOrderItem({
    required this.id,
    required this.productName,
    required this.brand,
    required this.imageUrl,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final String id;
  final String productName;
  final String? brand;
  final String? imageUrl;
  final int quantity;
  final double unitPrice;
  final double lineTotal;
}

class CartLine {
  const CartLine({required this.product, required this.quantity});

  final StoreProduct product;
  final int quantity;

  double get subtotal => product.price * quantity;
}

class LoyaltySummary {
  const LoyaltySummary({
    required this.pointsBalance,
    required this.cashbackBalance,
    required this.completedVisits,
    required this.currentTierName,
    required this.nextTierName,
    required this.visitsToNextTier,
  });

  factory LoyaltySummary.fromJson(Map<String, dynamic> map) {
    final currentTier = jsonMapOrNull(map['current_tier']);
    final nextTier = jsonMapOrNull(map['next_tier']);
    return LoyaltySummary(
      pointsBalance: intValue(map['points_balance']),
      cashbackBalance: doubleValue(map['cashback_balance']),
      completedVisits: intValue(map['completed_visits']),
      currentTierName: stringOrNull(currentTier?['name']),
      nextTierName: stringOrNull(nextTier?['name']),
      visitsToNextTier: intValue(map['visits_to_next_tier']),
    );
  }

  final int pointsBalance;
  final double cashbackBalance;
  final int completedVisits;
  final String? currentTierName;
  final String? nextTierName;
  final int visitsToNextTier;
}

class ReferralSummary {
  const ReferralSummary({
    required this.referralCode,
    required this.pendingCount,
    required this.qualifiedCount,
    required this.availableRewardsCount,
    required this.programTitle,
    required this.rewardLabel,
  });

  factory ReferralSummary.fromJson(Map<String, dynamic> map) {
    final program = jsonMapOrNull(map['program']);
    return ReferralSummary(
      referralCode: stringOrNull(map['referral_code']),
      pendingCount: intValue(map['pending_count']),
      qualifiedCount: intValue(map['qualified_count']),
      availableRewardsCount: intValue(map['available_rewards_count']),
      programTitle: stringOrNull(program?['title']),
      rewardLabel: stringOrNull(program?['reward_for_referrer']),
    );
  }

  final String? referralCode;
  final int pendingCount;
  final int qualifiedCount;
  final int availableRewardsCount;
  final String? programTitle;
  final String? rewardLabel;
}

Map<String, dynamic> jsonMap(dynamic value) {
  final map = jsonMapOrNull(value);
  return map ?? <String, dynamic>{};
}

Map<String, dynamic>? jsonMapOrNull(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }

  if (value is Map) {
    return value.map(
      (key, currentValue) => MapEntry(key.toString(), currentValue),
    );
  }

  if (value is List && value.isNotEmpty) {
    return jsonMapOrNull(value.first);
  }

  return null;
}

List<Map<String, dynamic>> jsonMapList(dynamic value) {
  if (value is List) {
    return value.map(jsonMapOrNull).whereType<Map<String, dynamic>>().toList();
  }

  final single = jsonMapOrNull(value);
  if (single == null) {
    return const [];
  }

  return [single];
}

List<String> stringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => '$item'.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  return const [];
}

String stringValue(dynamic value) => stringOrNull(value) ?? '';

String? stringOrNull(dynamic value) {
  if (value == null) {
    return null;
  }

  final normalized = '$value'.trim();
  return normalized.isEmpty ? null : normalized;
}

int intValue(dynamic value) => intOrNull(value) ?? 0;

int? intOrNull(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is int) {
    return value;
  }
  if (value is double) {
    return value.round();
  }
  return int.tryParse('$value');
}

double doubleValue(dynamic value) => doubleOrNull(value) ?? 0;

double? doubleOrNull(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse('$value');
}

DateTime? dateTimeOrNull(dynamic value) {
  final raw = stringOrNull(value);
  if (raw == null) {
    return null;
  }
  return DateTime.tryParse(raw)?.toLocal();
}

DateTime? dateTimeValue(dynamic value) => dateTimeOrNull(value);
