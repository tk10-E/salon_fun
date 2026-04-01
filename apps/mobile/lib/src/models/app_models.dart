import 'salon_client_app_config.dart';

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
    this.salonClientAppConfig,
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
  final SalonClientAppConfig? salonClientAppConfig;

  CustomerProfile copyWith({
    String? id,
    String? name,
    String? salonId,
    String? salonName,
    String? phone,
    bool clearPhone = false,
    String? preferences,
    bool clearPreferences = false,
    String? allergies,
    bool clearAllergies = false,
    String? beautyProducts,
    bool clearBeautyProducts = false,
    String? salonTagline,
    String? salonBrandColor,
    String? salonBusinessSegment,
    String? salonWhatsappPhone,
    String? salonLogoUrl,
    SalonClientAppConfig? salonClientAppConfig,
  }) {
    return CustomerProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      salonId: salonId ?? this.salonId,
      salonName: salonName ?? this.salonName,
      phone: clearPhone ? null : phone ?? this.phone,
      preferences: clearPreferences ? null : preferences ?? this.preferences,
      allergies: clearAllergies ? null : allergies ?? this.allergies,
      beautyProducts: clearBeautyProducts
          ? null
          : beautyProducts ?? this.beautyProducts,
      salonTagline: salonTagline ?? this.salonTagline,
      salonBrandColor: salonBrandColor ?? this.salonBrandColor,
      salonBusinessSegment: salonBusinessSegment ?? this.salonBusinessSegment,
      salonWhatsappPhone: salonWhatsappPhone ?? this.salonWhatsappPhone,
      salonLogoUrl: salonLogoUrl ?? this.salonLogoUrl,
      salonClientAppConfig: salonClientAppConfig ?? this.salonClientAppConfig,
    );
  }

  factory CustomerProfile.fromMap(
    Map<String, dynamic> map, {
    String? salonLogoUrl,
  }) {
    final salonData = map['salons'];
    final salonMap = salonData is List
        ? (salonData.isNotEmpty
              ? Map<String, dynamic>.from(salonData.first as Map)
              : <String, dynamic>{})
        : Map<String, dynamic>.from((salonData ?? <String, dynamic>{}) as Map);

    return CustomerProfile(
      id: map['id'] as String,
      name: map['name'] as String,
      salonId: map['salon_id'] as String,
      salonName: (salonMap['name'] ?? 'Salao') as String,
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
    this.clientAppConfig,
  });

  final String salonId;
  final String name;
  final String? tagline;
  final String? brandColor;
  final String? businessSegment;
  final String? whatsappPhone;
  final String? logoUrl;
  final SalonClientAppConfig? clientAppConfig;

  factory SalonJoinPreview.fromMap(
    Map<String, dynamic> map, {
    String? salonLogoUrl,
  }) {
    return SalonJoinPreview(
      salonId: (map['salon_id'] ?? map['id']) as String,
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
    required this.sortOrder,
    this.category,
    this.description,
    this.imageUrl,
  });

  final String id;
  final String name;
  final double price;
  final int duration;
  final int sortOrder;
  final String? category;
  final String? description;
  final String? imageUrl;

  factory ServiceItem.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price'];

    return ServiceItem(
      id: map['id'] as String,
      name: map['name'] as String,
      price: rawPrice is num
          ? rawPrice.toDouble()
          : double.parse(rawPrice.toString()),
      duration: (map['duration'] as num).toInt(),
      sortOrder: ((map['sort_order'] ?? 0) as num).toInt(),
      category: _readNullableString(map['category']),
      description: _readNullableString(map['description']),
      imageUrl: _readNullableString(map['image_url']),
    );
  }
}

class SalonOfferItem {
  const SalonOfferItem({
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
  bool get isPromotion => kind == 'promotion';

  factory SalonOfferItem.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price'];

    return SalonOfferItem(
      id: map['id'] as String,
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
      sortOrder: ((map['sort_order'] ?? 0) as num).toInt(),
    );
  }
}

class SalonRetailProduct {
  const SalonRetailProduct({
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

  String get subtitle {
    final brandLabel = brand?.trim();
    if (brandLabel != null && brandLabel.isNotEmpty) {
      return brandLabel;
    }

    return 'Selecao disponivel no salao';
  }

  factory SalonRetailProduct.fromMap(Map<String, dynamic> map) {
    final rawRetailPrice = map['retail_price'];

    return SalonRetailProduct(
      id: map['id'] as String,
      name: (map['name'] ?? 'Produto do salao') as String,
      brand: _readNullableString(map['brand']),
      retailPrice: rawRetailPrice == null
          ? null
          : rawRetailPrice is num
          ? rawRetailPrice.toDouble()
          : double.tryParse(rawRetailPrice.toString()),
      updatedAt: map['updated_at'] == null
          ? null
          : DateTime.tryParse(map['updated_at'].toString())?.toLocal(),
    );
  }
}

class SalonTeamMemberProfile {
  const SalonTeamMemberProfile({
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
    final roleLabel = role?.trim();
    if (roleLabel != null && roleLabel.isNotEmpty) {
      return roleLabel;
    }

    if (serviceCategories.isNotEmpty) {
      return serviceCategories.first;
    }

    if (serviceNames.isNotEmpty) {
      return serviceNames.first;
    }

    return 'Profissional do salão';
  }

  factory SalonTeamMemberProfile.fromMap(Map<String, dynamic> map) {
    return SalonTeamMemberProfile(
      id: map['id'] as String,
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

class ReferralProgramInfo {
  const ReferralProgramInfo({
    required this.title,
    required this.rewardForReferrer,
    required this.requiredQualifiedReferrals,
    required this.isActive,
    this.description,
    this.rewardForInvited,
    this.rewardServiceId,
    this.rewardServiceName,
  });

  final String title;
  final String? description;
  final String rewardForReferrer;
  final String? rewardForInvited;
  final int requiredQualifiedReferrals;
  final String? rewardServiceId;
  final String? rewardServiceName;
  final bool isActive;

  factory ReferralProgramInfo.fromMap(Map<String, dynamic> map) {
    return ReferralProgramInfo(
      title: (map['title'] ?? 'Indique e ganhe') as String,
      description: _readNullableString(map['description']),
      rewardForReferrer:
          (map['reward_for_referrer'] ??
                  'A recompensa é liberada quando a meta de indicações validadas é atingida.')
              as String,
      rewardForInvited: _readNullableString(map['reward_for_invited']),
      requiredQualifiedReferrals: _readInt(
        map['required_qualified_referrals'],
        fallback: 10,
      ),
      rewardServiceId: _readNullableString(map['reward_service_id']),
      rewardServiceName: _readNullableString(map['reward_service_name']),
      isActive: (map['is_active'] ?? false) as bool,
    );
  }
}

class ReferralRewardUnlockItem {
  const ReferralRewardUnlockItem({
    required this.id,
    required this.thresholdReached,
    required this.requiredQualifiedReferrals,
    required this.rewardDescription,
    required this.status,
    required this.unlockedAt,
    this.rewardServiceName,
    this.redeemedAt,
  });

  final String id;
  final int thresholdReached;
  final int requiredQualifiedReferrals;
  final String rewardDescription;
  final String? rewardServiceName;
  final String status;
  final DateTime unlockedAt;
  final DateTime? redeemedAt;

  factory ReferralRewardUnlockItem.fromMap(Map<String, dynamic> map) {
    return ReferralRewardUnlockItem(
      id: map['id'] as String,
      thresholdReached: _readInt(map['threshold_reached']),
      requiredQualifiedReferrals: _readInt(
        map['required_qualified_referrals'],
        fallback: 10,
      ),
      rewardDescription:
          (map['reward_description'] ?? 'Recompensa liberada no salão')
              as String,
      rewardServiceName: _readNullableString(map['reward_service_name']),
      status: (map['status'] ?? 'available') as String,
      unlockedAt: DateTime.parse(map['unlocked_at'] as String).toLocal(),
      redeemedAt: map['redeemed_at'] == null
          ? null
          : DateTime.parse(map['redeemed_at'] as String).toLocal(),
    );
  }
}

class ReferralProgressItem {
  const ReferralProgressItem({
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

  factory ReferralProgressItem.fromMap(Map<String, dynamic> map) {
    return ReferralProgressItem(
      id: map['id'] as String,
      customerName: (map['customer_name'] ?? 'Cliente') as String,
      status: (map['status'] ?? 'pending') as String,
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
      qualifiedAt: map['qualified_at'] == null
          ? null
          : DateTime.parse(map['qualified_at'] as String).toLocal(),
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
    required this.referrals,
    required this.rewardUnlocks,
    this.program,
  });

  final String referralCode;
  final int pendingCount;
  final int qualifiedCount;
  final int currentCycleProgress;
  final int nextRewardRemaining;
  final int unlockedRewardsCount;
  final int availableRewardsCount;
  final ReferralProgramInfo? program;
  final List<ReferralProgressItem> referrals;
  final List<ReferralRewardUnlockItem> rewardUnlocks;

  bool get hasActiveProgram => program?.isActive == true;
  int get requiredQualifiedReferrals =>
      program?.requiredQualifiedReferrals ?? 10;
  bool get hasVisibleContent =>
      hasActiveProgram ||
      referralCode.trim().isNotEmpty ||
      pendingCount > 0 ||
      qualifiedCount > 0 ||
      unlockedRewardsCount > 0 ||
      availableRewardsCount > 0 ||
      referrals.isNotEmpty ||
      rewardUnlocks.isNotEmpty;

  factory ReferralSummary.fromMap(Map<String, dynamic> map) {
    final referralCode = _readNullableString(map['referral_code']) ?? '';
    final programMap = map['program'] is Map
        ? Map<String, dynamic>.from(map['program'] as Map)
        : null;

    return ReferralSummary(
      referralCode: referralCode,
      pendingCount: ((map['pending_count'] ?? 0) as num).toInt(),
      qualifiedCount: ((map['qualified_count'] ?? 0) as num).toInt(),
      currentCycleProgress: ((map['current_cycle_progress'] ?? 0) as num)
          .toInt(),
      nextRewardRemaining: ((map['next_reward_remaining'] ?? 0) as num).toInt(),
      unlockedRewardsCount: ((map['unlocked_rewards_count'] ?? 0) as num)
          .toInt(),
      availableRewardsCount: ((map['available_rewards_count'] ?? 0) as num)
          .toInt(),
      program: programMap == null
          ? null
          : ReferralProgramInfo.fromMap(programMap),
      referrals: _readListMap(
        map['referrals'],
      ).map(ReferralProgressItem.fromMap).toList(),
      rewardUnlocks: _readListMap(
        map['reward_unlocks'],
      ).map(ReferralRewardUnlockItem.fromMap).toList(),
    );
  }
}

class LoyaltyTierBenefit {
  const LoyaltyTierBenefit({
    required this.label,
    required this.minVisits,
    required this.discountPercent,
    required this.isVip,
  });

  final String label;
  final int minVisits;
  final double discountPercent;
  final bool isVip;

  factory LoyaltyTierBenefit.fromMap(Map<String, dynamic> map) {
    return LoyaltyTierBenefit(
      label: (map['label'] ?? 'Beneficio') as String,
      minVisits: _readInt(map['min_visits']),
      discountPercent: _readDouble(map['discount_percent']),
      isVip: (map['is_vip'] ?? false) as bool,
    );
  }
}

class LoyaltyProgramInfo {
  const LoyaltyProgramInfo({
    required this.title,
    required this.pointsPerVisit,
    required this.cashbackPercent,
    required this.isActive,
    required this.tiers,
    this.description,
    this.vipRewardServiceId,
    this.vipRewardServiceName,
  });

  final String title;
  final String? description;
  final int pointsPerVisit;
  final double cashbackPercent;
  final bool isActive;
  final List<LoyaltyTierBenefit> tiers;
  final String? vipRewardServiceId;
  final String? vipRewardServiceName;

  factory LoyaltyProgramInfo.fromMap(Map<String, dynamic> map) {
    return LoyaltyProgramInfo(
      title: (map['title'] ?? 'Clube de fidelidade') as String,
      description: _readNullableString(map['description']),
      pointsPerVisit: _readInt(map['points_per_visit'], fallback: 0),
      cashbackPercent: _readDouble(map['cashback_percent']),
      isActive: (map['is_active'] ?? false) as bool,
      vipRewardServiceId: _readNullableString(map['vip_reward_service_id']),
      vipRewardServiceName: _readNullableString(map['vip_reward_service_name']),
      tiers: _readListMap(
        map['tiers'],
      ).map(LoyaltyTierBenefit.fromMap).toList(),
    );
  }
}

class CustomerLoyaltySummary {
  const CustomerLoyaltySummary({
    required this.pointsBalance,
    required this.totalPointsEarned,
    required this.cashbackBalance,
    required this.totalCashbackEarned,
    required this.completedVisits,
    required this.rankedCustomers,
    required this.visitsToNextTier,
    this.program,
    this.rankPosition,
    this.currentTier,
    this.nextTier,
    this.lastRewardAt,
  });

  final LoyaltyProgramInfo? program;
  final int pointsBalance;
  final int totalPointsEarned;
  final double cashbackBalance;
  final double totalCashbackEarned;
  final int completedVisits;
  final int? rankPosition;
  final int rankedCustomers;
  final LoyaltyTierBenefit? currentTier;
  final LoyaltyTierBenefit? nextTier;
  final int visitsToNextTier;
  final DateTime? lastRewardAt;

  bool get isVip => currentTier?.isVip == true;
  bool get hasVisibleContent =>
      program?.isActive == true ||
      pointsBalance > 0 ||
      cashbackBalance > 0 ||
      completedVisits > 0;

  factory CustomerLoyaltySummary.fromMap(Map<String, dynamic> map) {
    final programMap = map['program'] is Map
        ? Map<String, dynamic>.from(map['program'] as Map)
        : null;
    final currentTierMap = map['current_tier'] is Map
        ? Map<String, dynamic>.from(map['current_tier'] as Map)
        : null;
    final nextTierMap = map['next_tier'] is Map
        ? Map<String, dynamic>.from(map['next_tier'] as Map)
        : null;

    return CustomerLoyaltySummary(
      program: programMap == null
          ? null
          : LoyaltyProgramInfo.fromMap(programMap),
      pointsBalance: _readInt(map['points_balance']),
      totalPointsEarned: _readInt(map['total_points_earned']),
      cashbackBalance: _readDouble(map['cashback_balance']),
      totalCashbackEarned: _readDouble(map['total_cashback_earned']),
      completedVisits: _readInt(map['completed_visits']),
      rankPosition: map['rank_position'] == null
          ? null
          : _readInt(map['rank_position']),
      rankedCustomers: _readInt(map['ranked_customers']),
      currentTier: currentTierMap == null
          ? null
          : LoyaltyTierBenefit.fromMap(currentTierMap),
      nextTier: nextTierMap == null
          ? null
          : LoyaltyTierBenefit.fromMap(nextTierMap),
      visitsToNextTier: _readInt(map['visits_to_next_tier']),
      lastRewardAt: map['last_reward_at'] == null
          ? null
          : DateTime.parse(map['last_reward_at'] as String).toLocal(),
    );
  }
}

class LoyaltyTransactionItem {
  const LoyaltyTransactionItem({
    required this.id,
    required this.transactionKind,
    required this.pointsDelta,
    required this.cashbackDelta,
    required this.completedVisitDelta,
    required this.createdAt,
    this.description,
    this.metadata = const {},
  });

  final String id;
  final String transactionKind;
  final int pointsDelta;
  final double cashbackDelta;
  final int completedVisitDelta;
  final DateTime createdAt;
  final String? description;
  final Map<String, dynamic> metadata;

  bool get isRedemption => transactionKind == 'cashback_redemption';
  bool get isVisitReward => transactionKind == 'visit_reward';

  String get kindLabel {
    switch (transactionKind) {
      case 'cashback_redemption':
        return 'Resgate de cashback';
      case 'manual_adjustment':
        return 'Ajuste manual';
      case 'visit_reward':
      default:
        return 'Visita concluída';
    }
  }

  String get title {
    final normalizedDescription = _readNullableString(description);
    if (normalizedDescription != null) {
      return normalizedDescription;
    }

    return kindLabel;
  }

  factory LoyaltyTransactionItem.fromMap(Map<String, dynamic> map) {
    final metadataValue = map['metadata'];
    final metadata = metadataValue is Map
        ? Map<String, dynamic>.from(metadataValue)
        : <String, dynamic>{};

    return LoyaltyTransactionItem(
      id: map['id'] as String,
      transactionKind: (map['transaction_kind'] ?? 'visit_reward') as String,
      pointsDelta: _readInt(map['points_delta']),
      cashbackDelta: _readDouble(map['cashback_delta']),
      completedVisitDelta: _readInt(map['completed_visit_delta']),
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
      description: _readNullableString(map['description']),
      metadata: metadata,
    );
  }
}

class CustomerGrowthSuggestionItem {
  const CustomerGrowthSuggestionItem({
    required this.id,
    required this.type,
    required this.serviceId,
    required this.serviceName,
    required this.basedOnServiceName,
    required this.lastVisitAt,
    required this.urgency,
    this.serviceCategory,
    this.servicePrice,
    this.serviceDuration,
    this.recommendedIntervalDays,
    this.recommendedBookingDate,
    this.inactiveDays,
    this.incentivePercent,
    this.habitWeekday,
    this.habitPeriod,
    this.habitConfidence,
  });

  final String id;
  final String type;
  final String serviceId;
  final String serviceName;
  final String basedOnServiceName;
  final String? serviceCategory;
  final double? servicePrice;
  final int? serviceDuration;
  final DateTime lastVisitAt;
  final int? recommendedIntervalDays;
  final DateTime? recommendedBookingDate;
  final String urgency;
  final int? inactiveDays;
  final int? incentivePercent;
  final String? habitWeekday;
  final String? habitPeriod;
  final String? habitConfidence;

  bool get isRebooking => type == 'rebooking';
  bool get isCombo => type == 'combo';
  bool get hasIncentive => (incentivePercent ?? 0) > 0;
  bool get isHabitBased => habitWeekday != null && habitWeekday!.isNotEmpty;

  factory CustomerGrowthSuggestionItem.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['service_price'];

    return CustomerGrowthSuggestionItem(
      id: (map['id'] ?? '') as String,
      type: (map['type'] ?? 'rebooking') as String,
      serviceId: (map['service_id'] ?? '') as String,
      serviceName: (map['service_name'] ?? 'Serviço') as String,
      basedOnServiceName:
          (map['based_on_service_name'] ?? map['service_name'] ?? 'serviço')
              as String,
      serviceCategory: _readNullableString(map['service_category']),
      servicePrice: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
      serviceDuration: map['service_duration'] == null
          ? null
          : _readInt(map['service_duration']),
      lastVisitAt: DateTime.parse(map['last_visit_at'] as String).toLocal(),
      recommendedIntervalDays: map['recommended_interval_days'] == null
          ? null
          : _readInt(map['recommended_interval_days']),
      recommendedBookingDate: map['recommended_booking_date'] == null
          ? null
          : DateTime.parse(map['recommended_booking_date'] as String).toLocal(),
      urgency: (map['urgency'] ?? 'plan_ahead') as String,
      inactiveDays: map['inactive_days'] == null
          ? null
          : _readInt(map['inactive_days']),
      incentivePercent: map['incentive_percent'] == null
          ? null
          : _readInt(map['incentive_percent']),
      habitWeekday: _readNullableString(map['habit_weekday']),
      habitPeriod: _readNullableString(map['habit_period']),
      habitConfidence: _readNullableString(map['habit_confidence']),
    );
  }
}

class CustomerGrowthSuggestionFeed {
  const CustomerGrowthSuggestionFeed({
    required this.suggestions,
    this.generatedAt,
    this.lastVisitAt,
    this.lastVisitServiceName,
    this.inactiveDays,
  });

  final List<CustomerGrowthSuggestionItem> suggestions;
  final DateTime? generatedAt;
  final DateTime? lastVisitAt;
  final String? lastVisitServiceName;
  final int? inactiveDays;

  bool get hasVisibleContent => suggestions.isNotEmpty;

  factory CustomerGrowthSuggestionFeed.fromMap(Map<String, dynamic> map) {
    return CustomerGrowthSuggestionFeed(
      suggestions: _readListMap(
        map['suggestions'],
      ).map(CustomerGrowthSuggestionItem.fromMap).toList(),
      generatedAt: map['generated_at'] == null
          ? null
          : DateTime.parse(map['generated_at'] as String).toLocal(),
      lastVisitAt: map['last_visit_at'] == null
          ? null
          : DateTime.parse(map['last_visit_at'] as String).toLocal(),
      lastVisitServiceName: _readNullableString(map['last_visit_service_name']),
      inactiveDays: map['inactive_days'] == null
          ? null
          : _readInt(map['inactive_days']),
    );
  }
}

class CustomerNotificationItem {
  const CustomerNotificationItem({
    required this.id,
    required this.sourceType,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.isRead = false,
    this.payload = const {},
  });

  final String id;
  final String sourceType;
  final String type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool isRead;
  final Map<String, dynamic> payload;

  String get readKey => '$sourceType:$id';

  CustomerNotificationItem copyWith({bool? isRead}) {
    return CustomerNotificationItem(
      id: id,
      sourceType: sourceType,
      type: type,
      title: title,
      body: body,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
      payload: payload,
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
      id: map['id'] as String,
      sourceType: 'salon_notification',
      type: (map['notification_type'] ?? 'salon_update') as String,
      title: (map['title'] ?? 'Atualização do salão') as String,
      body: (map['body'] ?? '') as String,
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
      isRead: isRead,
      payload: payload,
    );
  }

  factory CustomerNotificationItem.fromVacancyAlert(
    VacancyAlert alert, {
    bool isRead = false,
  }) {
    return CustomerNotificationItem(
      id: alert.id,
      sourceType: 'vacancy_alert',
      type: 'vacancy_alert',
      title: alert.headline,
      body: alert.body,
      createdAt: alert.createdAt,
      isRead: isRead,
      payload: {
        'startsAt': alert.startsAt.toIso8601String(),
        'endsAt': alert.endsAt.toIso8601String(),
        'serviceId': alert.serviceId,
        'staffMemberId': alert.staffMemberId,
      },
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

class StaffMemberItem {
  const StaffMemberItem({
    required this.id,
    required this.name,
    this.role,
    this.isOpen = true,
    this.opensAt,
    this.closesAt,
    this.availableSlotsCount = 0,
    this.nextAvailableAt,
    this.status,
    this.statusDetail,
    this.blockedRanges = const [],
  });

  final String id;
  final String name;
  final String? role;
  final bool isOpen;
  final String? opensAt;
  final String? closesAt;
  final int availableSlotsCount;
  final DateTime? nextAvailableAt;
  final String? status;
  final String? statusDetail;
  final List<StaffBlockedRange> blockedRanges;

  String? get opensAtLabel => _trimTime(opensAt);
  String? get closesAtLabel => _trimTime(closesAt);
  bool get hasBlockedRanges => blockedRanges.isNotEmpty;

  factory StaffMemberItem.fromMap(Map<String, dynamic> map) {
    return StaffMemberItem(
      id: map['id'] as String,
      name: (map['name'] ?? 'Profissional') as String,
      role: _readNullableString(map['role']),
      isOpen: (map['is_open'] ?? true) as bool,
      opensAt: _readNullableString(map['opens_at']),
      closesAt: _readNullableString(map['closes_at']),
      availableSlotsCount: ((map['available_slots_count'] ?? 0) as num).toInt(),
      nextAvailableAt: map['next_available_at'] == null
          ? null
          : DateTime.parse(map['next_available_at'] as String).toLocal(),
      status: _readNullableString(map['status']),
      statusDetail: _readNullableString(map['status_detail']),
      blockedRanges: _readListMap(
        map['blocked_ranges'],
      ).map(StaffBlockedRange.fromMap).toList(),
    );
  }
}

class FavoriteStaffMemberItem {
  const FavoriteStaffMemberItem({
    required this.id,
    required this.name,
    this.role,
  });

  final String id;
  final String name;
  final String? role;

  factory FavoriteStaffMemberItem.fromMap(Map<String, dynamic> map) {
    return FavoriteStaffMemberItem(
      id: map['id'] as String,
      name: (map['name'] ?? 'Profissional') as String,
      role: _readNullableString(map['role']),
    );
  }
}

class StaffBlockedRange {
  const StaffBlockedRange({
    required this.startsAt,
    required this.endsAt,
    this.reason,
  });

  final DateTime startsAt;
  final DateTime endsAt;
  final String? reason;

  factory StaffBlockedRange.fromMap(Map<String, dynamic> map) {
    return StaffBlockedRange(
      startsAt: DateTime.parse(map['starts_at'] as String).toLocal(),
      endsAt: DateTime.parse(map['ends_at'] as String).toLocal(),
      reason: _readNullableString(map['reason']),
    );
  }
}

class AppointmentItem {
  const AppointmentItem({
    this.cancellationReason,
    this.cancelledAt,
    this.cancelledBy,
    this.completedAt,
    this.customerConfirmationRequestedAt,
    this.customerPresenceConfirmedAt,
    required this.id,
    required this.date,
    required this.endsAt,
    required this.status,
    required this.serviceName,
    required this.serviceDuration,
    required this.servicePrice,
    this.staffMemberName,
  });

  final String id;
  final DateTime date;
  final DateTime endsAt;
  final String status;
  final DateTime? cancelledAt;
  final String? cancelledBy;
  final String? cancellationReason;
  final DateTime? completedAt;
  final DateTime? customerConfirmationRequestedAt;
  final DateTime? customerPresenceConfirmedAt;
  final String serviceName;
  final int serviceDuration;
  final double servicePrice;
  final String? staffMemberName;

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

  AppointmentItem copyWith({
    String? status,
    DateTime? cancelledAt,
    bool clearCancelledAt = false,
    String? cancelledBy,
    bool clearCancelledBy = false,
    String? cancellationReason,
    bool clearCancellationReason = false,
    DateTime? completedAt,
    bool clearCompletedAt = false,
    DateTime? customerConfirmationRequestedAt,
    bool clearCustomerConfirmationRequestedAt = false,
    DateTime? customerPresenceConfirmedAt,
    bool clearCustomerPresenceConfirmedAt = false,
  }) {
    return AppointmentItem(
      id: id,
      date: date,
      endsAt: endsAt,
      status: status ?? this.status,
      cancellationReason: clearCancellationReason
          ? null
          : cancellationReason ?? this.cancellationReason,
      cancelledAt: clearCancelledAt ? null : cancelledAt ?? this.cancelledAt,
      cancelledBy: clearCancelledBy ? null : cancelledBy ?? this.cancelledBy,
      completedAt: clearCompletedAt ? null : completedAt ?? this.completedAt,
      customerConfirmationRequestedAt: clearCustomerConfirmationRequestedAt
          ? null
          : customerConfirmationRequestedAt ??
                this.customerConfirmationRequestedAt,
      customerPresenceConfirmedAt: clearCustomerPresenceConfirmedAt
          ? null
          : customerPresenceConfirmedAt ?? this.customerPresenceConfirmedAt,
      serviceName: serviceName,
      serviceDuration: serviceDuration,
      servicePrice: servicePrice,
      staffMemberName: staffMemberName,
    );
  }

  factory AppointmentItem.fromMap(Map<String, dynamic> map) {
    final serviceData = map['services'];
    final serviceMap = serviceData is List
        ? (serviceData.isNotEmpty
              ? Map<String, dynamic>.from(serviceData.first as Map)
              : <String, dynamic>{})
        : Map<String, dynamic>.from(
            (serviceData ?? <String, dynamic>{}) as Map,
          );
    final rawPrice = serviceMap['price'] ?? 0;
    final staffData = map['staff_members'];
    final staffMap = staffData is List
        ? (staffData.isNotEmpty
              ? Map<String, dynamic>.from(staffData.first as Map)
              : <String, dynamic>{})
        : Map<String, dynamic>.from((staffData ?? <String, dynamic>{}) as Map);

    return AppointmentItem(
      cancellationReason: _readNullableString(map['cancellation_reason']),
      cancelledAt: map['cancelled_at'] == null
          ? null
          : DateTime.parse(map['cancelled_at'] as String).toLocal(),
      cancelledBy: _readNullableString(map['cancelled_by']),
      completedAt: map['completed_at'] == null
          ? null
          : DateTime.parse(map['completed_at'] as String).toLocal(),
      customerConfirmationRequestedAt:
          map['customer_confirmation_requested_at'] == null
          ? null
          : DateTime.parse(
              map['customer_confirmation_requested_at'] as String,
            ).toLocal(),
      customerPresenceConfirmedAt: map['customer_presence_confirmed_at'] == null
          ? null
          : DateTime.parse(
              map['customer_presence_confirmed_at'] as String,
            ).toLocal(),
      id: map['id'] as String,
      date: DateTime.parse(map['date'] as String).toLocal(),
      endsAt: DateTime.parse(map['ends_at'] as String).toLocal(),
      status: map['status'] as String,
      serviceName: (serviceMap['name'] ?? 'Servico') as String,
      serviceDuration: ((serviceMap['duration'] ?? 0) as num).toInt(),
      servicePrice: rawPrice is num
          ? rawPrice.toDouble()
          : double.parse(rawPrice.toString()),
      staffMemberName: _readNullableString(staffMap['name']),
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
    required this.createdBy,
    required this.serviceId,
    this.staffMemberId,
  });

  final String id;
  final String headline;
  final String body;
  final DateTime startsAt;
  final DateTime endsAt;
  final DateTime createdAt;
  final String createdBy;
  final String serviceId;
  final String? staffMemberId;

  factory VacancyAlert.fromMap(Map<String, dynamic> map) {
    return VacancyAlert(
      id: map['id'] as String,
      headline: (map['headline'] ?? 'Horário liberado') as String,
      body: (map['body'] ?? '') as String,
      startsAt: DateTime.parse(map['starts_at'] as String).toLocal(),
      endsAt: DateTime.parse(map['ends_at'] as String).toLocal(),
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
      createdBy: (map['created_by'] ?? 'salon') as String,
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
      startAt: DateTime.parse(map['start_at'] as String).toLocal(),
      endsAt: DateTime.parse(map['ends_at'] as String).toLocal(),
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
    required this.staffMembers,
    required this.availableSlots,
    this.opensAt,
    this.closesAt,
  });

  final DateTime day;
  final String timezone;
  final int slotStepMinutes;
  final int serviceDuration;
  final bool isOpen;
  final String? opensAt;
  final String? closesAt;
  final List<StaffMemberItem> staffMembers;
  final List<AvailableSlot> availableSlots;

  String? get opensAtLabel => _trimTime(opensAt);
  String? get closesAtLabel => _trimTime(closesAt);

  factory DayAvailability.fromMap(Map<String, dynamic> map) {
    return DayAvailability(
      day: DateTime.parse(map['target_day'] as String),
      timezone: (map['timezone'] ?? 'America/Sao_Paulo') as String,
      slotStepMinutes: ((map['slot_step_minutes'] ?? 30) as num).toInt(),
      serviceDuration: ((map['service_duration'] ?? 0) as num).toInt(),
      isOpen: (map['is_open'] ?? false) as bool,
      opensAt: _readNullableString(map['opens_at']),
      closesAt: _readNullableString(map['closes_at']),
      staffMembers: _readListMap(
        map['staff_members'],
      ).map(StaffMemberItem.fromMap).toList(),
      availableSlots: _readListMap(
        map['available_slots'],
      ).map(AvailableSlot.fromMap).toList(),
    );
  }
}

class SmartScheduleSuggestionService {
  const SmartScheduleSuggestionService({
    required this.id,
    required this.name,
    required this.duration,
    this.category,
    this.price,
  });

  final String id;
  final String name;
  final String? category;
  final int duration;
  final double? price;

  factory SmartScheduleSuggestionService.fromMap(Map<String, dynamic> map) {
    final rawPrice = map['price'];

    return SmartScheduleSuggestionService(
      id: (map['id'] ?? '') as String,
      name: (map['name'] ?? 'Serviço') as String,
      category: _readNullableString(map['category']),
      duration: ((map['duration'] ?? 0) as num).toInt(),
      price: rawPrice == null
          ? null
          : rawPrice is num
          ? rawPrice.toDouble()
          : double.tryParse(rawPrice.toString()),
    );
  }
}

class SmartScheduleSuggestionItem {
  const SmartScheduleSuggestionItem({
    required this.staffMemberId,
    required this.staffMemberName,
    required this.gapKind,
    required this.gapStart,
    required this.gapEnd,
    required this.gapMinutes,
    required this.suggestedStart,
    required this.suggestedEnd,
    required this.headline,
    required this.detail,
    required this.compatibleServiceCount,
    required this.compatibleServices,
    required this.suggestedService,
  });

  final String staffMemberId;
  final String staffMemberName;
  final String gapKind;
  final DateTime gapStart;
  final DateTime gapEnd;
  final int gapMinutes;
  final DateTime suggestedStart;
  final DateTime suggestedEnd;
  final String headline;
  final String detail;
  final int compatibleServiceCount;
  final List<SmartScheduleSuggestionService> compatibleServices;
  final SmartScheduleSuggestionService suggestedService;

  String get suggestedStartLabel => _timeLabel(suggestedStart);
  String get suggestedEndLabel => _timeLabel(suggestedEnd);
  String get gapEndLabel => _timeLabel(gapEnd);
  String get gapStartLabel => _timeLabel(gapStart);

  bool get isBetweenAppointments => gapKind == 'between_appointments';

  factory SmartScheduleSuggestionItem.fromMap(Map<String, dynamic> map) {
    final suggestedServiceMap = map['suggested_service'] is Map
        ? Map<String, dynamic>.from(map['suggested_service'] as Map)
        : <String, dynamic>{};

    return SmartScheduleSuggestionItem(
      staffMemberId: (map['staff_member_id'] ?? '') as String,
      staffMemberName: (map['staff_member_name'] ?? 'Profissional') as String,
      gapKind: (map['gap_kind'] ?? 'open_day') as String,
      gapStart: DateTime.parse(map['gap_start'] as String).toLocal(),
      gapEnd: DateTime.parse(map['gap_end'] as String).toLocal(),
      gapMinutes: ((map['gap_minutes'] ?? 0) as num).toInt(),
      suggestedStart: DateTime.parse(
        map['suggested_start'] as String,
      ).toLocal(),
      suggestedEnd: DateTime.parse(map['suggested_end'] as String).toLocal(),
      headline: (map['headline'] ?? 'Encaixe sugerido') as String,
      detail: (map['detail'] ?? '') as String,
      compatibleServiceCount: ((map['compatible_service_count'] ?? 0) as num)
          .toInt(),
      compatibleServices: _readListMap(
        map['compatible_services'],
      ).map(SmartScheduleSuggestionService.fromMap).toList(),
      suggestedService: SmartScheduleSuggestionService.fromMap(
        suggestedServiceMap,
      ),
    );
  }
}

class SmartScheduleOpportunityFeed {
  const SmartScheduleOpportunityFeed({
    required this.targetDay,
    required this.timezone,
    required this.slotStepMinutes,
    required this.suggestions,
  });

  final DateTime targetDay;
  final String timezone;
  final int slotStepMinutes;
  final List<SmartScheduleSuggestionItem> suggestions;

  bool get hasSuggestions => suggestions.isNotEmpty;

  factory SmartScheduleOpportunityFeed.fromMap(Map<String, dynamic> map) {
    return SmartScheduleOpportunityFeed(
      targetDay: DateTime.parse(map['target_day'] as String),
      timezone: (map['timezone'] ?? 'America/Sao_Paulo') as String,
      slotStepMinutes: ((map['slot_step_minutes'] ?? 30) as num).toInt(),
      suggestions: _readListMap(
        map['suggestions'],
      ).map(SmartScheduleSuggestionItem.fromMap).toList(),
    );
  }
}

enum SalonPostType {
  standard,
  beforeAfter,
  reel;

  static SalonPostType fromRaw(String? value) {
    switch (value) {
      case 'before_after':
        return SalonPostType.beforeAfter;
      case 'reel':
        return SalonPostType.reel;
      default:
        return SalonPostType.standard;
    }
  }

  String get label {
    switch (this) {
      case SalonPostType.beforeAfter:
        return 'Antes e depois';
      case SalonPostType.reel:
        return 'Vídeo curto';
      case SalonPostType.standard:
        return 'Foto';
    }
  }
}

class SalonPost {
  const SalonPost({
    required this.id,
    required this.title,
    required this.caption,
    required this.imageUrls,
    required this.createdAt,
    required this.likeCount,
    required this.commentCount,
    required this.likedByMe,
    required this.comments,
    this.postType = SalonPostType.standard,
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
  final List<SalonPostComment> comments;
  final SalonPostType postType;
  final String? videoUrl;
  final String? staffMemberName;
  final String? staffMemberRole;
  final ServiceItem? linkedService;

  String get coverImageUrl => imageUrls.first;
  bool get isBeforeAfter => postType == SalonPostType.beforeAfter;
  bool get isReel => postType == SalonPostType.reel;

  SalonPost copyWith({
    int? likeCount,
    int? commentCount,
    bool? likedByMe,
    List<SalonPostComment>? comments,
  }) {
    return SalonPost(
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

  factory SalonPost.fromMap(
    Map<String, dynamic> map, {
    required String currentCustomerId,
    required List<String> imageUrls,
  }) {
    final likes = _readListMap(map['salon_post_likes']);
    final comments =
        _readListMap(
            map['salon_post_comments'],
          ).map(SalonPostComment.fromMap).toList()
          ..sort((left, right) => right.createdAt.compareTo(left.createdAt));
    final serviceData = map['services'];
    final serviceMap = serviceData is List
        ? (serviceData.isNotEmpty
              ? Map<String, dynamic>.from(serviceData.first as Map)
              : <String, dynamic>{})
        : Map<String, dynamic>.from(
            (serviceData ?? <String, dynamic>{}) as Map,
          );
    final staffData = map['staff_members'];
    final staffMap = staffData is List
        ? (staffData.isNotEmpty
              ? Map<String, dynamic>.from(staffData.first as Map)
              : <String, dynamic>{})
        : Map<String, dynamic>.from((staffData ?? <String, dynamic>{}) as Map);

    return SalonPost(
      id: map['id'] as String,
      title: (map['title'] ?? 'Publicacao') as String,
      caption: _readNullableString(map['caption']),
      imageUrls: imageUrls,
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
      likeCount: likes.length,
      commentCount: comments.length,
      likedByMe: likes.any((like) => like['customer_id'] == currentCustomerId),
      comments: comments,
      postType: SalonPostType.fromRaw(_readNullableString(map['post_type'])),
      videoUrl: _readNullableString(map['video_url']),
      staffMemberName: _readNullableString(staffMap['name']),
      staffMemberRole: _readNullableString(staffMap['role']),
      linkedService: serviceMap.isEmpty
          ? null
          : ServiceItem.fromMap(serviceMap),
    );
  }
}

class SalonPostComment {
  const SalonPostComment({
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

  factory SalonPostComment.fromMap(Map<String, dynamic> map) {
    return SalonPostComment(
      id: map['id'] as String,
      customerId: (map['customer_id'] ?? '') as String,
      customerName: (map['customer_name'] ?? 'Cliente') as String,
      body: (map['body'] ?? '') as String,
      createdAt: DateTime.parse(map['created_at'] as String).toLocal(),
    );
  }
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

List<Map<String, dynamic>> _readListMap(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

String? _trimTime(String? value) {
  if (value == null || value.length < 5) {
    return value;
  }

  return value.substring(0, 5);
}

DateTime? _parseDateOnly(Object? value) {
  final text = _readNullableString(value);
  if (text == null) {
    return null;
  }

  return DateTime.tryParse(text);
}

String _timeLabel(DateTime value) {
  final hour = value.hour.toString().padLeft(2, '0');
  final minute = value.minute.toString().padLeft(2, '0');
  return '$hour:$minute';
}
