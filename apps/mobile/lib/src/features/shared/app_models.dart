import 'dart:convert';

const _membershipRequestPreferredScheduleMarker =
    '[salonfun_membership_preferred_schedule]';

class DecodedCustomerMembershipRequestNotes {
  const DecodedCustomerMembershipRequestNotes({
    required this.notes,
    required this.preferredStartAt,
    required this.preferredStaffMemberId,
    required this.preferredStaffMemberName,
  });

  final String? notes;
  final DateTime? preferredStartAt;
  final String? preferredStaffMemberId;
  final String? preferredStaffMemberName;
}

String? encodeLegacyMembershipRequestNotes({
  String? notes,
  DateTime? preferredStartAt,
  String? preferredStaffMemberId,
  String? preferredStaffMemberName,
}) {
  final normalizedNotes = notes?.trim().isEmpty == true ? null : notes?.trim();
  final normalizedPreferredStaffMemberId =
      preferredStaffMemberId?.trim().isEmpty == true
      ? null
      : preferredStaffMemberId?.trim();
  final normalizedPreferredStaffMemberName =
      preferredStaffMemberName?.trim().isEmpty == true
      ? null
      : preferredStaffMemberName?.trim();

  if (preferredStartAt == null || normalizedPreferredStaffMemberId == null) {
    return normalizedNotes;
  }

  final payload = <String, dynamic>{
    'preferredStartAt': preferredStartAt.toUtc().toIso8601String(),
    'preferredStaffMemberId': normalizedPreferredStaffMemberId,
    ...?switch (normalizedPreferredStaffMemberName) {
      final value? => <String, dynamic>{'preferredStaffMemberName': value},
      null => null,
    },
  };
  final encodedPayload = base64Url.encode(utf8.encode(jsonEncode(payload)));

  if (normalizedNotes == null) {
    return '$_membershipRequestPreferredScheduleMarker$encodedPayload';
  }

  return '$normalizedNotes\n\n$_membershipRequestPreferredScheduleMarker$encodedPayload';
}

DecodedCustomerMembershipRequestNotes decodeLegacyMembershipRequestNotes(
  String? rawNotes,
) {
  final normalizedNotes = rawNotes?.trim();
  if (normalizedNotes == null || normalizedNotes.isEmpty) {
    return const DecodedCustomerMembershipRequestNotes(
      notes: null,
      preferredStartAt: null,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
    );
  }

  final markerIndex = normalizedNotes.lastIndexOf(
    _membershipRequestPreferredScheduleMarker,
  );
  if (markerIndex < 0) {
    return DecodedCustomerMembershipRequestNotes(
      notes: normalizedNotes,
      preferredStartAt: null,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
    );
  }

  final visibleNotes = normalizedNotes.substring(0, markerIndex).trim();
  final encodedPayload = normalizedNotes
      .substring(markerIndex + _membershipRequestPreferredScheduleMarker.length)
      .trim();

  if (encodedPayload.isEmpty) {
    return DecodedCustomerMembershipRequestNotes(
      notes: normalizedNotes,
      preferredStartAt: null,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
    );
  }

  try {
    final decodedPayload = utf8.decode(
      base64Url.decode(base64Url.normalize(encodedPayload)),
    );
    final payload = jsonMapOrNull(jsonDecode(decodedPayload)) ?? const {};

    return DecodedCustomerMembershipRequestNotes(
      notes: visibleNotes.isEmpty ? null : visibleNotes,
      preferredStartAt: dateTimeOrNull(payload['preferredStartAt']),
      preferredStaffMemberId: stringOrNull(payload['preferredStaffMemberId']),
      preferredStaffMemberName: stringOrNull(
        payload['preferredStaffMemberName'],
      ),
    );
  } catch (_) {
    return DecodedCustomerMembershipRequestNotes(
      notes: normalizedNotes,
      preferredStartAt: null,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
    );
  }
}

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
    this.email,
    this.birthDate,
    this.profileImagePath,
    this.profileImageUrl,
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
      email: stringOrNull(map['email']),
      birthDate: dateOnlyOrNull(map['birth_date']),
      profileImagePath: stringOrNull(map['profile_image_path']),
      profileImageUrl: stringOrNull(map['profile_image_url']),
      referralCode: stringOrNull(map['referral_code']),
      consentStatus: stringOrNull(map['consent_status']) ?? 'pending',
    );
  }

  final String id;
  final String salonId;
  final String authUserId;
  final String name;
  final String? phone;
  final String? email;
  final DateTime? birthDate;
  final String? profileImagePath;
  final String? profileImageUrl;
  final String? referralCode;
  final String consentStatus;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'salon_id': salonId,
      'auth_user_id': authUserId,
      'name': name,
      'phone': phone,
      'email': email,
      'birth_date': dateOnlyToIsoString(birthDate),
      'profile_image_path': profileImagePath,
      'profile_image_url': profileImageUrl,
      'referral_code': referralCode,
      'consent_status': consentStatus,
    };
  }
}

class BirthdayHomeExperience {
  const BirthdayHomeExperience({
    required this.id,
    required this.title,
    required this.message,
    required this.customerName,
    required this.salonName,
    required this.birthDate,
    this.mediaKind,
    this.imageUrl,
    this.videoUrl,
    this.expiresAt,
  });

  factory BirthdayHomeExperience.fromJson(Map<String, dynamic> map) {
    return BirthdayHomeExperience(
      id: stringValue(map['id']),
      title: stringValue(map['title']),
      message: stringValue(map['message']),
      customerName: stringValue(map['customerName']),
      salonName: stringValue(map['salonName']),
      birthDate: dateOnlyOrNull(map['birthDate']) ?? DateTime.now(),
      mediaKind: stringOrNull(map['mediaKind']),
      imageUrl: stringOrNull(map['imageUrl']),
      videoUrl: stringOrNull(map['videoUrl']),
      expiresAt: dateTimeOrNull(map['expiresAt']),
    );
  }

  final String id;
  final String title;
  final String message;
  final String customerName;
  final String salonName;
  final DateTime birthDate;
  final String? mediaKind;
  final String? imageUrl;
  final String? videoUrl;
  final DateTime? expiresAt;

  bool get hasVideo => (videoUrl?.trim().isNotEmpty ?? false);

  bool get hasImage => (imageUrl?.trim().isNotEmpty ?? false);

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'title': title,
      'message': message,
      'customerName': customerName,
      'salonName': salonName,
      'birthDate': dateOnlyToIsoString(birthDate),
      'mediaKind': mediaKind,
      'imageUrl': imageUrl,
      'videoUrl': videoUrl,
      'expiresAt': expiresAt?.toUtc().toIso8601String(),
    };
  }
}

class SalonLandingData {
  const SalonLandingData({
    required this.preview,
    required this.featuredServices,
    required this.activeOffers,
    required this.recentPosts,
    this.recentReviews = const [],
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
      recentReviews: jsonMapList(
        map['recentReviews'],
      ).map(SalonReviewHighlight.fromJson).toList(),
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
  final List<SalonReviewHighlight> recentReviews;
  final List<SalonCampaign> centralCampaigns;
  final SalonStats stats;
  final SalonLinks links;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'preview': preview.toJson(),
      'featuredServices': featuredServices
          .map((service) => service.toJson())
          .toList(),
      'activeOffers': activeOffers.map((offer) => offer.toJson()).toList(),
      'recentPosts': recentPosts.map((post) => post.toJson()).toList(),
      'recentReviews': recentReviews.map((review) => review.toJson()).toList(),
      'centralCampaigns': centralCampaigns
          .map((campaign) => campaign.toJson())
          .toList(),
      'stats': stats.toJson(),
      'links': links.toJson(),
    };
  }
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
    this.addressLabel,
    this.whatsappPhone,
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
      addressLabel: stringOrNull(map['addressLabel']),
      whatsappPhone: stringOrNull(map['whatsappPhone']),
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
  final String? addressLabel;
  final String? whatsappPhone;
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

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'salonId': salonId,
      'joinCode': joinCode,
      'name': name,
      'appDisplayName': appDisplayName,
      'tagline': tagline,
      'brandColor': brandColor,
      'secondaryColor': secondaryColor,
      'accentColor': accentColor,
      'experienceModel': experienceModel,
      'homeEmphasis': homeEmphasis,
      'logoUrl': logoUrl,
      'heroImageUrl': heroImageUrl,
      'galleryCoverImageUrl': galleryCoverImageUrl,
      'profileCoverImageUrl': profileCoverImageUrl,
      'shareImageUrl': shareImageUrl,
      'heroHeadline': heroHeadline,
      'heroSupportLine': heroSupportLine,
      'welcomeHeadline': welcomeHeadline,
      'welcomeMessage': welcomeMessage,
      'primaryCtaLabel': primaryCtaLabel,
      'visualStyle': visualStyle,
      'themeMode': themeMode,
      'buttonStyle': buttonStyle,
      'cardStyle': cardStyle,
      'bannerStyle': bannerStyle,
      'promotionHeadline': promotionHeadline,
      'segmentLabel': segmentLabel,
      'segmentDescription': segmentDescription,
      'visibleHomeModules': visibleHomeModules,
      'moduleLabels': moduleLabels,
      'addressLabel': addressLabel,
      'whatsappPhone': whatsappPhone,
      'mapUrl': mapUrl,
      'supportUrl': supportUrl,
      'supportEmail': supportEmail,
      'ratingValue': ratingValue,
      'ratingCount': ratingCount,
      'bookingPolicyEnabled': bookingPolicyEnabled,
      'bookingPolicyTitle': bookingPolicyTitle,
      'bookingPolicySummary': bookingPolicySummary,
      'bookingPaymentMode': bookingPaymentMode,
      'bookingRequiresDeposit': bookingRequiresDeposit,
      'bookingDepositAmount': bookingDepositAmount,
      'bookingPaymentInstructions': bookingPaymentInstructions,
      'bookingPixKey': bookingPixKey,
      'bookingPixRecipientName': bookingPixRecipientName,
      'bookingPixRecipientCity': bookingPixRecipientCity,
      'bookingExternalCheckoutUrl': bookingExternalCheckoutUrl,
    };
  }
}

class SalonCampaign {
  const SalonCampaign({
    required this.id,
    required this.isActive,
    required this.priority,
    required this.startsAt,
    required this.endsAt,
    required this.audience,
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
      startsAt: stringOrNull(map['startsAt']),
      endsAt: stringOrNull(map['endsAt']),
      audience: stringOrNull(map['audience']) ?? 'all',
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
  final String? startsAt;
  final String? endsAt;
  final String audience;
  final String? eyebrow;
  final String title;
  final String message;
  final String? campaignLabel;
  final String? ctaLabel;
  final String? ctaTarget;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'isActive': isActive,
      'priority': priority,
      'startsAt': startsAt,
      'endsAt': endsAt,
      'audience': audience,
      'eyebrow': eyebrow,
      'title': title,
      'message': message,
      'campaignLabel': campaignLabel,
      'ctaLabel': ctaLabel,
      'ctaTarget': ctaTarget,
    };
  }
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

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'category': category,
      'description': description,
      'duration': duration,
      'price': price,
      'imageUrl': imageUrl,
    };
  }
}

class SalonOfferHighlight {
  const SalonOfferHighlight({
    required this.id,
    required this.kind,
    required this.title,
    required this.description,
    required this.highlightText,
    this.imageUrl,
    this.bookingServiceId,
    this.bookingServiceName,
    this.actionKind,
    required this.kindLabel,
    required this.priceLabel,
    required this.lifecycleLabel,
  });

  factory SalonOfferHighlight.fromJson(Map<String, dynamic> map) {
    final kind = stringOrNull(map['kind'])?.trim().toLowerCase();
    return SalonOfferHighlight(
      id: stringValue(map['id']),
      kind: kind == 'membership' ? 'membership' : 'promotion',
      title: stringValue(map['title']),
      description: stringOrNull(map['description']),
      highlightText: stringOrNull(map['highlightText']),
      imageUrl: stringOrNull(map['imageUrl']),
      bookingServiceId: stringOrNull(map['bookingServiceId']),
      bookingServiceName: stringOrNull(map['bookingServiceName']),
      actionKind: stringOrNull(map['actionKind']),
      kindLabel: stringOrNull(map['kindLabel']) ?? 'Oferta',
      priceLabel: stringOrNull(map['priceLabel']),
      lifecycleLabel: stringOrNull(map['lifecycleLabel']) ?? 'Agora',
    );
  }

  final String id;
  final String kind;
  final String title;
  final String? description;
  final String? highlightText;
  final String? imageUrl;
  final String? bookingServiceId;
  final String? bookingServiceName;
  final String? actionKind;
  final String kindLabel;
  final String? priceLabel;
  final String lifecycleLabel;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'kind': kind,
      'title': title,
      'description': description,
      'highlightText': highlightText,
      'imageUrl': imageUrl,
      'bookingServiceId': bookingServiceId,
      'bookingServiceName': bookingServiceName,
      'actionKind': actionKind,
      'kindLabel': kindLabel,
      'priceLabel': priceLabel,
      'lifecycleLabel': lifecycleLabel,
    };
  }
}

const String membershipRequestSchedulingActionKind =
    'request_membership_schedule';

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

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'title': title,
      'caption': caption,
      'imageUrl': imageUrl,
      'badge': badge,
      'serviceName': serviceName,
      'staffLabel': staffLabel,
      'authorAvatarUrl': authorAvatarUrl,
      'sourceLabel': sourceLabel,
    };
  }
}

class SalonReviewHighlight {
  const SalonReviewHighlight({
    required this.id,
    required this.rating,
    required this.comment,
    required this.createdAt,
    required this.serviceName,
    required this.staffName,
    required this.staffImageUrl,
  });

  factory SalonReviewHighlight.fromJson(Map<String, dynamic> map) {
    return SalonReviewHighlight(
      id: stringValue(map['id']),
      rating: intValue(map['rating']),
      comment: stringOrNull(map['comment']),
      createdAt: dateTimeValue(map['createdAt']) ?? DateTime.now(),
      serviceName: stringOrNull(map['serviceName']),
      staffName: stringOrNull(map['staffName']),
      staffImageUrl: stringOrNull(map['staffImageUrl']),
    );
  }

  final String id;
  final int rating;
  final String? comment;
  final DateTime createdAt;
  final String? serviceName;
  final String? staffName;
  final String? staffImageUrl;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'rating': rating,
      'comment': comment,
      'createdAt': createdAt.toUtc().toIso8601String(),
      'serviceName': serviceName,
      'staffName': staffName,
      'staffImageUrl': staffImageUrl,
    };
  }
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

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'servicesCount': servicesCount,
      'activeOffersCount': activeOffersCount,
      'recentPostsCount': recentPostsCount,
    };
  }
}

class SalonLinks {
  const SalonLinks({
    required this.whatsappUrl,
    required this.mapUrl,
    required this.supportUrl,
    required this.supportEmail,
    required this.privacyPolicyUrl,
    required this.termsOfUseUrl,
  });

  factory SalonLinks.fromJson(Map<String, dynamic> map) {
    return SalonLinks(
      whatsappUrl: stringOrNull(map['whatsappUrl']),
      mapUrl: stringOrNull(map['mapUrl']),
      supportUrl: stringOrNull(map['supportUrl']),
      supportEmail: stringOrNull(map['supportEmail']),
      privacyPolicyUrl: stringOrNull(map['privacyPolicyUrl']),
      termsOfUseUrl: stringOrNull(map['termsOfUseUrl']),
    );
  }

  final String? whatsappUrl;
  final String? mapUrl;
  final String? supportUrl;
  final String? supportEmail;
  final String? privacyPolicyUrl;
  final String? termsOfUseUrl;

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'whatsappUrl': whatsappUrl,
      'mapUrl': mapUrl,
      'supportUrl': supportUrl,
      'supportEmail': supportEmail,
      'privacyPolicyUrl': privacyPolicyUrl,
      'termsOfUseUrl': termsOfUseUrl,
    };
  }
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
    final targetDay = dateTimeValue(map['target_day']) ?? DateTime.now();

    return DayAvailability(
      targetDay: targetDay,
      timezone: stringOrNull(map['timezone']) ?? 'UTC',
      slotStepMinutes: intValue(map['slot_step_minutes']),
      serviceDuration: intValue(map['service_duration']),
      isOpen: map['is_open'] == true,
      opensAt: dateTimeOrTimeOnDayOrNull(map['opens_at'], targetDay),
      closesAt: dateTimeOrTimeOnDayOrNull(map['closes_at'], targetDay),
      staffMembers: jsonMapList(map['staff_members'])
          .map(
            (staff) => StaffAvailability.fromJson(staff, targetDay: targetDay),
          )
          .toList(),
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
    required this.imageUrl,
    required this.isOpen,
    required this.opensAt,
    required this.closesAt,
    required this.availableSlotsCount,
    required this.nextAvailableAt,
    required this.status,
    required this.statusDetail,
  });

  factory StaffAvailability.fromJson(
    Map<String, dynamic> map, {
    DateTime? targetDay,
  }) {
    return StaffAvailability(
      id: stringValue(map['id']),
      name: stringValue(map['name']),
      role: stringOrNull(map['role']),
      imageUrl: stringOrNull(map['image_url']),
      isOpen: map['is_open'] == true,
      opensAt: dateTimeOrTimeOnDayOrNull(map['opens_at'], targetDay),
      closesAt: dateTimeOrTimeOnDayOrNull(map['closes_at'], targetDay),
      availableSlotsCount: intValue(map['available_slots_count']),
      nextAvailableAt: dateTimeOrNull(map['next_available_at']),
      status: stringOrNull(map['status']) ?? 'busy',
      statusDetail: stringOrNull(map['status_detail']) ?? '',
    );
  }

  final String id;
  final String name;
  final String? role;
  final String? imageUrl;
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
    required this.staffMemberImageUrl,
  });

  factory AppointmentSlot.fromJson(Map<String, dynamic> map) {
    return AppointmentSlot(
      startAt: dateTimeValue(map['start_at']) ?? DateTime.now(),
      endsAt: dateTimeValue(map['ends_at']) ?? DateTime.now(),
      staffMemberId: stringValue(map['staff_member_id']),
      staffMemberName: stringOrNull(map['staff_member_name']) ?? 'Equipe',
      staffMemberImageUrl: stringOrNull(map['staff_member_image_url']),
    );
  }

  final DateTime startAt;
  final DateTime endsAt;
  final String staffMemberId;
  final String staffMemberName;
  final String? staffMemberImageUrl;
}

class CustomerAppointment {
  const CustomerAppointment({
    required this.id,
    required this.date,
    required this.endsAt,
    required this.status,
    required this.paymentPreference,
    required this.depositAmount,
    required this.depositStatus,
    required this.depositReportedPaidAt,
    required this.depositReportedPaidVia,
    required this.bookingPolicySnapshot,
    required this.serviceId,
    required this.serviceName,
    required this.serviceDuration,
    required this.servicePrice,
    required this.serviceImageUrl,
    required this.staffMemberId,
    required this.staffName,
    required this.staffRole,
    required this.staffImageUrl,
    required this.presenceConfirmedAt,
    required this.depositPaymentProvider,
    required this.depositPaymentProviderChargeId,
    required this.depositPaymentProviderStatus,
    required this.depositPaymentProviderInvoiceUrl,
    required this.depositPaymentProviderPayload,
    required this.depositPaymentProviderError,
    required this.reviewRating,
    required this.reviewComment,
    required this.reviewCreatedAt,
    required this.reviewUpdatedAt,
    required this.membershipPlanId,
    required this.membershipPlanTitle,
    required this.membershipPlanReservationStatus,
    required this.membershipSessionIndex,
    required this.membershipSessionsIncluded,
    required this.membershipPlanExpiresAt,
  });

  final String id;
  final DateTime date;
  final DateTime? endsAt;
  final String status;
  final String? paymentPreference;
  final double depositAmount;
  final String depositStatus;
  final DateTime? depositReportedPaidAt;
  final String? depositReportedPaidVia;
  final String? bookingPolicySnapshot;
  final String? serviceId;
  final String serviceName;
  final int? serviceDuration;
  final double? servicePrice;
  final String? serviceImageUrl;
  final String? staffMemberId;
  final String? staffName;
  final String? staffRole;
  final String? staffImageUrl;
  final DateTime? presenceConfirmedAt;
  final String? depositPaymentProvider;
  final String? depositPaymentProviderChargeId;
  final String? depositPaymentProviderStatus;
  final String? depositPaymentProviderInvoiceUrl;
  final String? depositPaymentProviderPayload;
  final String? depositPaymentProviderError;
  final int? reviewRating;
  final String? reviewComment;
  final DateTime? reviewCreatedAt;
  final DateTime? reviewUpdatedAt;
  final String? membershipPlanId;
  final String? membershipPlanTitle;
  final String? membershipPlanReservationStatus;
  final int? membershipSessionIndex;
  final int? membershipSessionsIncluded;
  final DateTime? membershipPlanExpiresAt;

  bool get isMembershipPlanAppointment {
    return membershipPlanId?.trim().isNotEmpty == true;
  }
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
    this.permalinkUrl,
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
  final String? permalinkUrl;
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
      permalinkUrl: permalinkUrl,
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

class FeedStory {
  const FeedStory({
    required this.id,
    required this.title,
    required this.caption,
    required this.imageUrl,
    required this.createdAt,
    required this.expiresAt,
    required this.serviceName,
    required this.staffName,
    required this.staffRole,
    this.authorAvatarUrl,
    this.authorUsername,
    this.sourceType,
    this.ownerCustomerId,
  });

  final String id;
  final String title;
  final String? caption;
  final String? imageUrl;
  final DateTime createdAt;
  final DateTime expiresAt;
  final String? serviceName;
  final String? staffName;
  final String? staffRole;
  final String? authorAvatarUrl;
  final String? authorUsername;
  final String? sourceType;
  final String? ownerCustomerId;

  bool get isActive => expiresAt.isAfter(DateTime.now());
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
    required this.program,
    required this.pointsBalance,
    required this.totalPointsEarned,
    required this.cashbackBalance,
    required this.totalCashbackEarned,
    required this.completedVisits,
    required this.rankPosition,
    required this.rankedCustomers,
    required this.currentTier,
    required this.nextTier,
    required this.visitsToNextTier,
    required this.lastRewardAt,
  });

  factory LoyaltySummary.fromJson(Map<String, dynamic> map) {
    return LoyaltySummary(
      program: LoyaltyProgramSnapshot.fromJsonOrNull(map['program']),
      pointsBalance: intValue(map['points_balance']),
      totalPointsEarned: intValue(map['total_points_earned']),
      cashbackBalance: doubleValue(map['cashback_balance']),
      totalCashbackEarned: doubleValue(map['total_cashback_earned']),
      completedVisits: intValue(map['completed_visits']),
      rankPosition: intOrNull(map['rank_position']),
      rankedCustomers: intValue(map['ranked_customers']),
      currentTier: LoyaltyTierSnapshot.fromJsonOrNull(map['current_tier']),
      nextTier: LoyaltyTierSnapshot.fromJsonOrNull(map['next_tier']),
      visitsToNextTier: intValue(map['visits_to_next_tier']),
      lastRewardAt: dateTimeOrNull(map['last_reward_at']),
    );
  }

  final LoyaltyProgramSnapshot? program;
  final int pointsBalance;
  final int totalPointsEarned;
  final double cashbackBalance;
  final double totalCashbackEarned;
  final int completedVisits;
  final int? rankPosition;
  final int rankedCustomers;
  final LoyaltyTierSnapshot? currentTier;
  final LoyaltyTierSnapshot? nextTier;
  final int visitsToNextTier;
  final DateTime? lastRewardAt;

  String? get currentTierName => currentTier?.label;

  String? get nextTierName => nextTier?.label;
}

class LoyaltyProgramSnapshot {
  const LoyaltyProgramSnapshot({
    required this.title,
    required this.description,
    required this.pointsPerVisit,
    required this.cashbackPercent,
    required this.isActive,
    required this.vipRewardServiceId,
    required this.vipRewardServiceName,
    required this.tiers,
  });

  factory LoyaltyProgramSnapshot.fromJson(Map<String, dynamic> map) {
    return LoyaltyProgramSnapshot(
      title: stringValue(map['title']),
      description: stringOrNull(map['description']),
      pointsPerVisit: intValue(map['points_per_visit']),
      cashbackPercent: doubleValue(map['cashback_percent']),
      isActive: map['is_active'] == true,
      vipRewardServiceId: stringOrNull(map['vip_reward_service_id']),
      vipRewardServiceName: stringOrNull(map['vip_reward_service_name']),
      tiers: jsonMapList(
        map['tiers'],
      ).map(LoyaltyTierSnapshot.fromJson).toList(growable: false),
    );
  }

  static LoyaltyProgramSnapshot? fromJsonOrNull(dynamic value) {
    final map = jsonMapOrNull(value);
    if (map == null || map.isEmpty) {
      return null;
    }

    return LoyaltyProgramSnapshot.fromJson(map);
  }

  final String title;
  final String? description;
  final int pointsPerVisit;
  final double cashbackPercent;
  final bool isActive;
  final String? vipRewardServiceId;
  final String? vipRewardServiceName;
  final List<LoyaltyTierSnapshot> tiers;
}

class LoyaltyTierSnapshot {
  const LoyaltyTierSnapshot({
    required this.label,
    required this.minVisits,
    required this.discountPercent,
    required this.isVip,
  });

  factory LoyaltyTierSnapshot.fromJson(Map<String, dynamic> map) {
    return LoyaltyTierSnapshot(
      label:
          stringOrNull(map['label']) ??
          stringOrNull(map['name']) ??
          'Nivel ativo',
      minVisits: intValue(map['min_visits']),
      discountPercent: doubleValue(map['discount_percent']),
      isVip: map['is_vip'] == true,
    );
  }

  static LoyaltyTierSnapshot? fromJsonOrNull(dynamic value) {
    final map = jsonMapOrNull(value);
    if (map == null || map.isEmpty) {
      return null;
    }

    return LoyaltyTierSnapshot.fromJson(map);
  }

  final String label;
  final int minVisits;
  final double discountPercent;
  final bool isVip;
}

class CustomerLoyaltyTransaction {
  const CustomerLoyaltyTransaction({
    required this.id,
    required this.transactionKind,
    required this.pointsDelta,
    required this.cashbackDelta,
    required this.completedVisitDelta,
    required this.description,
    required this.metadata,
    required this.createdAt,
    required this.appointmentId,
    required this.staffMemberName,
    required this.staffMemberImageUrl,
  });

  factory CustomerLoyaltyTransaction.fromJson(Map<String, dynamic> map) {
    final metadata = jsonMap(map['metadata']);
    return CustomerLoyaltyTransaction(
      id: stringValue(map['id']),
      transactionKind:
          stringOrNull(map['transaction_kind']) ?? 'manual_adjustment',
      pointsDelta: intValue(map['points_delta']),
      cashbackDelta: doubleValue(map['cashback_delta']),
      completedVisitDelta: intValue(map['completed_visit_delta']),
      description: stringOrNull(map['description']),
      metadata: metadata,
      createdAt: dateTimeOrNull(map['created_at']) ?? DateTime.now(),
      appointmentId: stringOrNull(map['appointment_id']),
      staffMemberName:
          stringOrNull(map['staff_member_name']) ??
          stringOrNull(metadata['staffMemberName']),
      staffMemberImageUrl:
          stringOrNull(map['staff_member_image_url']) ??
          stringOrNull(metadata['staffMemberImageUrl']),
    );
  }

  final String id;
  final String transactionKind;
  final int pointsDelta;
  final double cashbackDelta;
  final int completedVisitDelta;
  final String? description;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final String? appointmentId;
  final String? staffMemberName;
  final String? staffMemberImageUrl;

  String? get serviceName => stringOrNull(metadata['serviceName']);

  DateTime get occurredAt {
    return dateTimeOrNull(metadata['completedAt']) ?? createdAt;
  }

  bool get isVisitReward => transactionKind == 'visit_reward';

  bool get isCashbackRedemption => transactionKind == 'cashback_redemption';

  bool get isManualAdjustment => transactionKind == 'manual_adjustment';
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

class CustomerMembershipOverview {
  const CustomerMembershipOverview({
    required this.memberships,
    required this.pendingRequests,
  });

  const CustomerMembershipOverview.empty()
    : memberships = const <CustomerMembershipPlan>[],
      pendingRequests = const <CustomerMembershipRequest>[];

  final List<CustomerMembershipPlan> memberships;
  final List<CustomerMembershipRequest> pendingRequests;

  CustomerMembershipPlan? activePlanForOffer(String offerId, {DateTime? now}) {
    final normalizedOfferId = offerId.trim();
    for (final membership in memberships) {
      if (membership.offerId == normalizedOfferId &&
          membership.isActiveOn(now ?? DateTime.now())) {
        return membership;
      }
    }

    return null;
  }

  CustomerMembershipPlan? upcomingPlanForOffer(
    String offerId, {
    DateTime? now,
  }) {
    final normalizedOfferId = offerId.trim();
    final referenceDate = now ?? DateTime.now();
    CustomerMembershipPlan? upcomingPlan;

    for (final membership in memberships) {
      if (membership.offerId != normalizedOfferId ||
          !membership.startsInFuture(referenceDate)) {
        continue;
      }

      if (upcomingPlan == null ||
          membership.startedAt!.isBefore(upcomingPlan.startedAt!)) {
        upcomingPlan = membership;
      }
    }

    return upcomingPlan;
  }

  CustomerMembershipRequest? pendingRequestForOffer(String offerId) {
    final normalizedOfferId = offerId.trim();
    for (final request in pendingRequests) {
      if (request.offerId == normalizedOfferId && request.isPending) {
        return request;
      }
    }

    return null;
  }

  CustomerMembershipRequest? openRequestForOffer(String offerId) {
    final normalizedOfferId = offerId.trim();
    for (final request in pendingRequests) {
      if (request.offerId == normalizedOfferId && request.isOpen) {
        return request;
      }
    }

    return null;
  }
}

class CustomerMembershipPlan {
  const CustomerMembershipPlan({
    required this.id,
    required this.offerId,
    required this.title,
    required this.serviceId,
    required this.serviceName,
    required this.status,
    required this.sessionsIncluded,
    required this.sessionsUsed,
    required this.startedAt,
    required this.expiresAt,
    required this.priceSnapshot,
  });

  factory CustomerMembershipPlan.fromJson(Map<String, dynamic> map) {
    return CustomerMembershipPlan(
      id: stringValue(map['id']),
      offerId: stringOrNull(map['offer_id']),
      title: stringValue(map['title']),
      serviceId: stringOrNull(map['service_id']),
      serviceName: stringOrNull(map['service_name_snapshot']),
      status: stringOrNull(map['status']) ?? 'active',
      sessionsIncluded: intValue(map['sessions_included']),
      sessionsUsed: intValue(map['sessions_used']),
      startedAt: dateTimeOrNull(map['started_at']),
      expiresAt: dateTimeValue(map['expires_at']) ?? DateTime.now(),
      priceSnapshot: doubleOrNull(map['price_snapshot']),
    );
  }

  final String id;
  final String? offerId;
  final String title;
  final String? serviceId;
  final String? serviceName;
  final String status;
  final int sessionsIncluded;
  final int sessionsUsed;
  final DateTime? startedAt;
  final DateTime expiresAt;
  final double? priceSnapshot;

  int get sessionsRemaining {
    final remaining = sessionsIncluded - sessionsUsed;
    if (remaining <= 0) {
      return 0;
    }

    return remaining > sessionsIncluded ? sessionsIncluded : remaining;
  }

  int? get validityDays {
    final startsAt = startedAt;
    if (startsAt == null) {
      return null;
    }

    final localStart = DateTime(startsAt.year, startsAt.month, startsAt.day);
    final localExpiry = DateTime(
      expiresAt.year,
      expiresAt.month,
      expiresAt.day,
    );
    return localExpiry.difference(localStart).inDays + 1;
  }

  bool get isCurrentlyActive {
    return isActiveOn(DateTime.now());
  }

  bool startsInFuture(DateTime date) {
    final startsAt = startedAt;
    if (startsAt == null) {
      return false;
    }

    final localToday = DateTime(date.year, date.month, date.day);
    final localStart = DateTime(startsAt.year, startsAt.month, startsAt.day);
    return localStart.isAfter(localToday);
  }

  bool isActiveOn(DateTime date) {
    if (status == 'cancelled' || status == 'completed') {
      return false;
    }

    final localToday = DateTime(date.year, date.month, date.day);
    final startsAt = startedAt;
    if (startsAt != null) {
      final localStart = DateTime(startsAt.year, startsAt.month, startsAt.day);
      if (localToday.isBefore(localStart)) {
        return false;
      }
    }

    final localExpiry = DateTime(
      expiresAt.year,
      expiresAt.month,
      expiresAt.day,
    );
    return !localExpiry.isBefore(localToday);
  }
}

class CustomerMembershipRequest {
  const CustomerMembershipRequest({
    required this.id,
    required this.offerId,
    required this.offerTitle,
    required this.status,
    required this.requestedAt,
    required this.priceSnapshot,
    required this.notes,
    this.approvedStartsOn,
    this.decidedAt,
    this.membershipId,
    this.preferredStartAt,
    this.preferredStaffMemberId,
    this.preferredStaffMemberName,
  });

  factory CustomerMembershipRequest.fromJson(Map<String, dynamic> map) {
    final parsedNotes = decodeLegacyMembershipRequestNotes(
      stringOrNull(map['notes']),
    );

    return CustomerMembershipRequest(
      id: stringValue(map['id']),
      offerId: stringValue(map['offer_id']),
      offerTitle:
          stringOrNull(map['offer_title_snapshot']) ??
          stringOrNull(map['title']) ??
          'Plano do salão',
      status: stringOrNull(map['status']) ?? 'pending',
      requestedAt: dateTimeOrNull(map['requested_at']) ?? DateTime.now(),
      priceSnapshot: doubleOrNull(map['price_snapshot']),
      notes: parsedNotes.notes,
      approvedStartsOn: dateOnlyOrNull(map['approved_starts_on']),
      decidedAt: dateTimeOrNull(map['decided_at']),
      membershipId: stringOrNull(map['membership_id']),
      preferredStartAt:
          dateTimeOrNull(map['preferred_start_at']) ??
          parsedNotes.preferredStartAt,
      preferredStaffMemberId:
          stringOrNull(map['preferred_staff_member_id']) ??
          parsedNotes.preferredStaffMemberId,
      preferredStaffMemberName:
          stringOrNull(map['preferred_staff_member_name_snapshot']) ??
          parsedNotes.preferredStaffMemberName,
    );
  }

  final String id;
  final String offerId;
  final String offerTitle;
  final String status;
  final DateTime requestedAt;
  final double? priceSnapshot;
  final String? notes;
  final DateTime? approvedStartsOn;
  final DateTime? decidedAt;
  final String? membershipId;
  final DateTime? preferredStartAt;
  final String? preferredStaffMemberId;
  final String? preferredStaffMemberName;

  bool get isPending => status == 'pending';

  bool get isAwaitingPayment =>
      status == 'approved' && (membershipId?.trim().isEmpty ?? true);

  bool get isOpen => isPending || isAwaitingPayment;
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

DateTime? dateOnlyOrNull(dynamic value) {
  final raw = stringOrNull(value);
  if (raw == null) {
    return null;
  }

  final normalized = raw.length == 10 ? '${raw}T12:00:00' : raw;
  return DateTime.tryParse(normalized);
}

String? dateOnlyToIsoString(DateTime? value) {
  if (value == null) {
    return null;
  }

  final year = value.year.toString().padLeft(4, '0');
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '$year-$month-$day';
}

DateTime? dateTimeValue(dynamic value) => dateTimeOrNull(value);

DateTime? dateTimeOrTimeOnDayOrNull(dynamic value, [DateTime? targetDay]) {
  final parsed = dateTimeOrNull(value);
  if (parsed != null) {
    return parsed;
  }

  final raw = stringOrNull(value);
  if (raw == null) {
    return null;
  }

  final match = RegExp(
    r'^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$',
  ).firstMatch(raw);
  if (match == null) {
    return null;
  }

  final hours = int.tryParse(match.group(1) ?? '');
  final minutes = int.tryParse(match.group(2) ?? '');
  final seconds = int.tryParse(match.group(3) ?? '0');

  if (hours == null ||
      minutes == null ||
      seconds == null ||
      hours > 23 ||
      minutes > 59 ||
      seconds > 59) {
    return null;
  }

  final referenceDay = targetDay?.toLocal() ?? DateTime.now();
  return DateTime(
    referenceDay.year,
    referenceDay.month,
    referenceDay.day,
    hours,
    minutes,
    seconds,
  );
}
