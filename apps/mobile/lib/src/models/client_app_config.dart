enum SalonVisualStyle {
  auto,
  softEditorial,
  glowSignature,
  heritageDark,
  clinicalRefined,
}

enum SalonThemeMode { auto, light, dark, hybrid }

enum SalonExperienceModel {
  auto,
  beautySignature,
  nailGallery,
  barberHouse,
  browsAtelier,
  aestheticClinic,
}

enum SalonHomeEmphasis { auto, services, portfolio, schedule, benefits }

enum SalonButtonStyle { capsule, rounded, elevated }

enum SalonCardStyle { floating, outlined, glass }

enum SalonBannerStyle { immersive, editorial, spotlight }

enum SalonCentralCampaignPriority { high, medium, low }

enum SalonCentralCampaignTarget {
  explore,
  appointments,
  feed,
  profile,
  notifications,
  support,
}

enum SalonCentralCampaignAudience {
  all,
  withUpcomingAppointment,
  withoutUpcomingAppointment,
  withActiveBenefits,
  withoutActiveBenefits,
}

class SalonCentralCampaign {
  const SalonCentralCampaign({
    required this.id,
    required this.isActive,
    required this.priority,
    required this.title,
    required this.message,
    required this.ctaTarget,
    this.startsAt,
    this.endsAt,
    this.audience = SalonCentralCampaignAudience.all,
    this.eyebrow,
    this.campaignLabel,
    this.ctaLabel,
  });

  final String id;
  final bool isActive;
  final SalonCentralCampaignPriority priority;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final SalonCentralCampaignAudience audience;
  final String? eyebrow;
  final String title;
  final String message;
  final String? campaignLabel;
  final String? ctaLabel;
  final SalonCentralCampaignTarget ctaTarget;

  String get resolvedEyebrow =>
      eyebrow ??
      switch (priority) {
        SalonCentralCampaignPriority.high => 'Agora no app',
        SalonCentralCampaignPriority.medium => 'Campanha do salão',
        SalonCentralCampaignPriority.low => 'Destaque do salão',
      };

  String get resolvedActionLabel =>
      ctaLabel ??
      switch (ctaTarget) {
        SalonCentralCampaignTarget.explore => 'Reservar agora',
        SalonCentralCampaignTarget.appointments => 'Ver agenda',
        SalonCentralCampaignTarget.feed => 'Abrir central',
        SalonCentralCampaignTarget.profile => 'Ver benefícios',
        SalonCentralCampaignTarget.notifications => 'Ver avisos',
        SalonCentralCampaignTarget.support => 'Falar com o salão',
      };

  bool isVisibleFor({
    required bool hasUpcomingAppointment,
    required bool hasActiveBenefits,
    DateTime? referenceTime,
  }) {
    if (!isActive) {
      return false;
    }

    final now = referenceTime ?? DateTime.now();
    if (startsAt != null && now.isBefore(startsAt!)) {
      return false;
    }

    if (endsAt != null && now.isAfter(endsAt!)) {
      return false;
    }

    return switch (audience) {
      SalonCentralCampaignAudience.all => true,
      SalonCentralCampaignAudience.withUpcomingAppointment =>
        hasUpcomingAppointment,
      SalonCentralCampaignAudience.withoutUpcomingAppointment =>
        !hasUpcomingAppointment,
      SalonCentralCampaignAudience.withActiveBenefits => hasActiveBenefits,
      SalonCentralCampaignAudience.withoutActiveBenefits => !hasActiveBenefits,
    };
  }
}

abstract final class SalonHomeModuleId {
  static const String shortcuts = 'shortcuts';
  static const String nextBooking = 'nextBooking';
  static const String professionals = 'professionals';
  static const String gallery = 'gallery';
  static const String promotions = 'promotions';
  static const String products = 'products';
  static const String loyalty = 'loyalty';
}

class SalonClientAppConfig {
  const SalonClientAppConfig({
    this.experienceModel = SalonExperienceModel.auto,
    this.homeEmphasis = SalonHomeEmphasis.auto,
    this.heroHeadline,
    this.heroSupportLine,
    this.primaryCtaLabel,
    this.buttonStyle,
    this.cardStyle,
    this.bannerStyle,
    this.welcomeHeadline,
    this.welcomeMessage,
    this.promotionHeadline,
    this.secondaryColor,
    this.accentColor,
    this.heroImageUrl,
    this.heroImageVariantUrl,
    this.heroImageTabletVariantUrl,
    this.heroImageShareVariantUrl,
    this.galleryCoverImageUrl,
    this.galleryCoverImageVariantUrl,
    this.galleryCoverImageTabletVariantUrl,
    this.galleryCoverImageShareVariantUrl,
    this.profileCoverImageUrl,
    this.profileCoverImageVariantUrl,
    this.profileCoverImageTabletVariantUrl,
    this.profileCoverImageShareVariantUrl,
    this.heroImageFocusX,
    this.heroImageFocusY,
    this.heroImageZoom,
    this.galleryCoverImageFocusX,
    this.galleryCoverImageFocusY,
    this.galleryCoverImageZoom,
    this.profileCoverImageFocusX,
    this.profileCoverImageFocusY,
    this.profileCoverImageZoom,
    this.instagramUrl,
    this.addressLabel,
    this.mapUrl,
    this.privacyPolicyUrl,
    this.termsOfUseUrl,
    this.supportUrl,
    this.supportEmail,
    this.ratingValue,
    this.ratingCount,
    this.visualStyle = SalonVisualStyle.auto,
    this.themeMode = SalonThemeMode.auto,
    this.visibleHomeModules = const <String>[],
    this.centralCampaigns = const <SalonCentralCampaign>[],
    this.rawConfig = const <String, dynamic>{},
  });

  final SalonExperienceModel experienceModel;
  final SalonHomeEmphasis homeEmphasis;
  final String? heroHeadline;
  final String? heroSupportLine;
  final String? primaryCtaLabel;
  final SalonButtonStyle? buttonStyle;
  final SalonCardStyle? cardStyle;
  final SalonBannerStyle? bannerStyle;
  final String? welcomeHeadline;
  final String? welcomeMessage;
  final String? promotionHeadline;
  final String? secondaryColor;
  final String? accentColor;
  final String? heroImageUrl;
  final String? heroImageVariantUrl;
  final String? heroImageTabletVariantUrl;
  final String? heroImageShareVariantUrl;
  final String? galleryCoverImageUrl;
  final String? galleryCoverImageVariantUrl;
  final String? galleryCoverImageTabletVariantUrl;
  final String? galleryCoverImageShareVariantUrl;
  final String? profileCoverImageUrl;
  final String? profileCoverImageVariantUrl;
  final String? profileCoverImageTabletVariantUrl;
  final String? profileCoverImageShareVariantUrl;
  final double? heroImageFocusX;
  final double? heroImageFocusY;
  final double? heroImageZoom;
  final double? galleryCoverImageFocusX;
  final double? galleryCoverImageFocusY;
  final double? galleryCoverImageZoom;
  final double? profileCoverImageFocusX;
  final double? profileCoverImageFocusY;
  final double? profileCoverImageZoom;
  final String? instagramUrl;
  final String? addressLabel;
  final String? mapUrl;
  final String? privacyPolicyUrl;
  final String? termsOfUseUrl;
  final String? supportUrl;
  final String? supportEmail;
  final double? ratingValue;
  final int? ratingCount;
  final SalonVisualStyle visualStyle;
  final SalonThemeMode themeMode;
  final List<String> visibleHomeModules;
  final List<SalonCentralCampaign> centralCampaigns;
  final Map<String, dynamic> rawConfig;

  SalonButtonStyle get resolvedButtonStyle =>
      buttonStyle ?? SalonButtonStyle.rounded;
  SalonCardStyle get resolvedCardStyle => cardStyle ?? SalonCardStyle.floating;
  SalonBannerStyle get resolvedBannerStyle =>
      bannerStyle ?? SalonBannerStyle.immersive;

  bool get hasHomeModuleOverrides => visibleHomeModules.isNotEmpty;

  bool showsHomeModule(String moduleId) =>
      !hasHomeModuleOverrides || visibleHomeModules.contains(moduleId);

  List<SalonCentralCampaign> get activeCentralCampaigns => centralCampaigns
      .where((campaign) => campaign.isActive)
      .toList(growable: false);

  String? get resolvedHeroImage => heroImageVariantUrl ?? heroImageUrl;
  String? get resolvedHeroTabletImage =>
      heroImageTabletVariantUrl ?? resolvedHeroImage;
  String? get resolvedHeroShareImage =>
      heroImageShareVariantUrl ?? resolvedHeroImage;
  String? get resolvedGalleryCoverImage =>
      galleryCoverImageVariantUrl ?? galleryCoverImageUrl;
  String? get resolvedGalleryCoverTabletImage =>
      galleryCoverImageTabletVariantUrl ?? resolvedGalleryCoverImage;
  String? get resolvedGalleryCoverShareImage =>
      galleryCoverImageShareVariantUrl ?? resolvedGalleryCoverImage;
  String? get resolvedProfileCoverImage =>
      profileCoverImageVariantUrl ?? profileCoverImageUrl;
  String? get resolvedProfileCoverTabletImage =>
      profileCoverImageTabletVariantUrl ?? resolvedProfileCoverImage;
  String? get resolvedProfileCoverShareImage =>
      profileCoverImageShareVariantUrl ?? resolvedProfileCoverImage;

  String? resolveHeroImageForLayout({required bool prefersTabletVariant}) =>
      prefersTabletVariant ? resolvedHeroTabletImage : resolvedHeroImage;

  String? resolveGalleryCoverImageForLayout({
    required bool prefersTabletVariant,
  }) => prefersTabletVariant
      ? resolvedGalleryCoverTabletImage
      : resolvedGalleryCoverImage;

  String? resolveProfileCoverImageForLayout({
    required bool prefersTabletVariant,
  }) => prefersTabletVariant
      ? resolvedProfileCoverTabletImage
      : resolvedProfileCoverImage;

  double get resolvedHeroImageZoom => _normalizeZoom(heroImageZoom);
  double get resolvedGalleryCoverImageZoom =>
      _normalizeZoom(galleryCoverImageZoom);
  double get resolvedProfileCoverImageZoom =>
      _normalizeZoom(profileCoverImageZoom);

  double get normalizedHeroImageAlignmentX =>
      _normalizeAlignment(heroImageFocusX);
  double get normalizedHeroImageAlignmentY =>
      _normalizeAlignment(heroImageFocusY);
  double get normalizedGalleryCoverAlignmentX =>
      _normalizeAlignment(galleryCoverImageFocusX);
  double get normalizedGalleryCoverAlignmentY =>
      _normalizeAlignment(galleryCoverImageFocusY);
  double get normalizedProfileCoverAlignmentX =>
      _normalizeAlignment(profileCoverImageFocusX);
  double get normalizedProfileCoverAlignmentY =>
      _normalizeAlignment(profileCoverImageFocusY);

  factory SalonClientAppConfig.fromDynamic(Object? value) {
    if (value is! Map) {
      return const SalonClientAppConfig();
    }

    final map = Map<String, dynamic>.from(value);

    return SalonClientAppConfig(
      experienceModel: _parseExperienceModel(
        map['experienceModel']?.toString(),
      ),
      homeEmphasis: _parseHomeEmphasis(map['homeEmphasis']?.toString()),
      heroHeadline: _readNullableString(map['heroHeadline']),
      heroSupportLine: _readNullableString(map['heroSupportLine']),
      primaryCtaLabel: _readNullableString(map['primaryCtaLabel']),
      buttonStyle: _parseButtonStyle(map['buttonStyle']?.toString()),
      cardStyle: _parseCardStyle(map['cardStyle']?.toString()),
      bannerStyle: _parseBannerStyle(map['bannerStyle']?.toString()),
      welcomeHeadline: _readNullableString(map['welcomeHeadline']),
      welcomeMessage: _readNullableString(map['welcomeMessage']),
      promotionHeadline: _readNullableString(map['promotionHeadline']),
      secondaryColor: _readNullableString(map['secondaryColor']),
      accentColor: _readNullableString(map['accentColor']),
      heroImageUrl: _readNullableString(map['heroImageUrl']),
      heroImageVariantUrl: _readNullableString(map['heroImageVariantUrl']),
      heroImageTabletVariantUrl: _readNullableString(
        map['heroImageTabletVariantUrl'],
      ),
      heroImageShareVariantUrl: _readNullableString(
        map['heroImageShareVariantUrl'],
      ),
      galleryCoverImageUrl: _readNullableString(map['galleryCoverImageUrl']),
      galleryCoverImageVariantUrl: _readNullableString(
        map['galleryCoverImageVariantUrl'],
      ),
      galleryCoverImageTabletVariantUrl: _readNullableString(
        map['galleryCoverImageTabletVariantUrl'],
      ),
      galleryCoverImageShareVariantUrl: _readNullableString(
        map['galleryCoverImageShareVariantUrl'],
      ),
      profileCoverImageUrl: _readNullableString(map['profileCoverImageUrl']),
      profileCoverImageVariantUrl: _readNullableString(
        map['profileCoverImageVariantUrl'],
      ),
      profileCoverImageTabletVariantUrl: _readNullableString(
        map['profileCoverImageTabletVariantUrl'],
      ),
      profileCoverImageShareVariantUrl: _readNullableString(
        map['profileCoverImageShareVariantUrl'],
      ),
      heroImageFocusX: _readDoubleOrNull(map['heroImageFocusX']),
      heroImageFocusY: _readDoubleOrNull(map['heroImageFocusY']),
      heroImageZoom: _readDoubleOrNull(map['heroImageZoom']),
      galleryCoverImageFocusX: _readDoubleOrNull(
        map['galleryCoverImageFocusX'],
      ),
      galleryCoverImageFocusY: _readDoubleOrNull(
        map['galleryCoverImageFocusY'],
      ),
      galleryCoverImageZoom: _readDoubleOrNull(map['galleryCoverImageZoom']),
      profileCoverImageFocusX: _readDoubleOrNull(
        map['profileCoverImageFocusX'],
      ),
      profileCoverImageFocusY: _readDoubleOrNull(
        map['profileCoverImageFocusY'],
      ),
      profileCoverImageZoom: _readDoubleOrNull(map['profileCoverImageZoom']),
      instagramUrl: _readNullableString(map['instagramUrl']),
      addressLabel: _readNullableString(map['addressLabel']),
      mapUrl: _readNullableString(map['mapUrl']),
      privacyPolicyUrl: _readNullableString(map['privacyPolicyUrl']),
      termsOfUseUrl: _readNullableString(map['termsOfUseUrl']),
      supportUrl: _readNullableString(map['supportUrl']),
      supportEmail: _readNullableString(map['supportEmail']),
      ratingValue: _readDoubleOrNull(map['ratingValue']),
      ratingCount: _readIntOrNull(map['ratingCount']),
      visualStyle: _parseVisualStyle(map['visualStyle']?.toString()),
      themeMode: _parseThemeMode(map['themeMode']?.toString()),
      visibleHomeModules: _readStringList(map['visibleHomeModules']),
      centralCampaigns: _readCentralCampaigns(map['centralCampaigns']),
      rawConfig: Map<String, dynamic>.unmodifiable(map),
    );
  }

  static SalonExperienceModel _parseExperienceModel(String? value) {
    switch (value?.trim()) {
      case 'beauty_signature':
        return SalonExperienceModel.beautySignature;
      case 'nail_gallery':
        return SalonExperienceModel.nailGallery;
      case 'barber_house':
        return SalonExperienceModel.barberHouse;
      case 'brows_atelier':
        return SalonExperienceModel.browsAtelier;
      case 'aesthetic_clinic':
        return SalonExperienceModel.aestheticClinic;
      default:
        return SalonExperienceModel.auto;
    }
  }

  static SalonHomeEmphasis _parseHomeEmphasis(String? value) {
    switch (value?.trim()) {
      case 'services':
        return SalonHomeEmphasis.services;
      case 'portfolio':
        return SalonHomeEmphasis.portfolio;
      case 'schedule':
        return SalonHomeEmphasis.schedule;
      case 'benefits':
        return SalonHomeEmphasis.benefits;
      default:
        return SalonHomeEmphasis.auto;
    }
  }

  static SalonVisualStyle _parseVisualStyle(String? value) {
    switch (value?.trim()) {
      case 'soft_editorial':
        return SalonVisualStyle.softEditorial;
      case 'glow_signature':
        return SalonVisualStyle.glowSignature;
      case 'heritage_dark':
        return SalonVisualStyle.heritageDark;
      case 'clinical_refined':
        return SalonVisualStyle.clinicalRefined;
      default:
        return SalonVisualStyle.auto;
    }
  }

  static SalonThemeMode _parseThemeMode(String? value) {
    switch (value?.trim()) {
      case 'light':
        return SalonThemeMode.light;
      case 'dark':
        return SalonThemeMode.dark;
      case 'hybrid':
        return SalonThemeMode.hybrid;
      default:
        return SalonThemeMode.auto;
    }
  }

  static SalonButtonStyle? _parseButtonStyle(String? value) {
    switch (value?.trim()) {
      case 'capsule':
        return SalonButtonStyle.capsule;
      case 'rounded':
        return SalonButtonStyle.rounded;
      case 'elevated':
        return SalonButtonStyle.elevated;
      default:
        return null;
    }
  }

  static SalonCardStyle? _parseCardStyle(String? value) {
    switch (value?.trim()) {
      case 'floating':
        return SalonCardStyle.floating;
      case 'outlined':
        return SalonCardStyle.outlined;
      case 'glass':
        return SalonCardStyle.glass;
      default:
        return null;
    }
  }

  static SalonBannerStyle? _parseBannerStyle(String? value) {
    switch (value?.trim()) {
      case 'immersive':
        return SalonBannerStyle.immersive;
      case 'editorial':
        return SalonBannerStyle.editorial;
      case 'spotlight':
        return SalonBannerStyle.spotlight;
      default:
        return null;
    }
  }

  static int campaignPriorityWeight(SalonCentralCampaignPriority value) {
    switch (value) {
      case SalonCentralCampaignPriority.high:
        return 0;
      case SalonCentralCampaignPriority.medium:
        return 1;
      case SalonCentralCampaignPriority.low:
        return 2;
    }
  }

  static double _normalizeAlignment(double? value) {
    if (value == null) {
      return 0;
    }

    final clamped = value.clamp(0, 100);
    return ((clamped - 50) / 50).toDouble();
  }

  static double _normalizeZoom(double? value) {
    if (value == null) {
      return 1;
    }

    return value.clamp(1, 2.5).toDouble();
  }
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}

double? _readDoubleOrNull(Object? value) {
  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse(value?.toString() ?? '');
}

DateTime? _readDateTimeOrNull(Object? value) {
  final normalized = value?.toString().trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  return DateTime.tryParse(normalized);
}

int? _readIntOrNull(Object? value) {
  if (value is num) {
    return value.toInt();
  }

  return int.tryParse(value?.toString() ?? '');
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

List<SalonCentralCampaign> _readCentralCampaigns(Object? value) {
  if (value is! List) {
    return const <SalonCentralCampaign>[];
  }

  final campaigns = <SalonCentralCampaign>[];
  for (var index = 0; index < value.length; index += 1) {
    final item = value[index];
    if (item is! Map) {
      continue;
    }

    final map = Map<String, dynamic>.from(item);
    final title = _readNullableString(map['title']);
    final message = _readNullableString(map['message']);
    if (title == null || message == null) {
      continue;
    }

    campaigns.add(
      SalonCentralCampaign(
        id: _readNullableString(map['id']) ?? 'campaign-${index + 1}',
        isActive: map['isActive'] != false,
        priority: _parseCentralCampaignPriority(map['priority']?.toString()),
        startsAt: _readDateTimeOrNull(map['startsAt']),
        endsAt: _readDateTimeOrNull(map['endsAt']),
        audience: _parseCentralCampaignAudience(map['audience']?.toString()),
        eyebrow: _readNullableString(map['eyebrow']),
        title: title,
        message: message,
        campaignLabel: _readNullableString(map['campaignLabel']),
        ctaLabel: _readNullableString(map['ctaLabel']),
        ctaTarget: _parseCentralCampaignTarget(map['ctaTarget']?.toString()),
      ),
    );
  }

  campaigns.sort((left, right) {
    final priorityOrder = SalonClientAppConfig.campaignPriorityWeight(
      left.priority,
    ).compareTo(SalonClientAppConfig.campaignPriorityWeight(right.priority));
    if (priorityOrder != 0) {
      return priorityOrder;
    }

    return left.title.toLowerCase().compareTo(right.title.toLowerCase());
  });

  return List<SalonCentralCampaign>.unmodifiable(campaigns);
}

SalonCentralCampaignPriority _parseCentralCampaignPriority(String? value) {
  switch (value?.trim()) {
    case 'high':
      return SalonCentralCampaignPriority.high;
    case 'low':
      return SalonCentralCampaignPriority.low;
    default:
      return SalonCentralCampaignPriority.medium;
  }
}

SalonCentralCampaignTarget _parseCentralCampaignTarget(String? value) {
  switch (value?.trim()) {
    case 'appointments':
      return SalonCentralCampaignTarget.appointments;
    case 'feed':
      return SalonCentralCampaignTarget.feed;
    case 'profile':
      return SalonCentralCampaignTarget.profile;
    case 'notifications':
      return SalonCentralCampaignTarget.notifications;
    case 'support':
      return SalonCentralCampaignTarget.support;
    case 'explore':
    default:
      return SalonCentralCampaignTarget.explore;
  }
}

SalonCentralCampaignAudience _parseCentralCampaignAudience(String? value) {
  switch (value?.trim()) {
    case 'with_upcoming_appointment':
      return SalonCentralCampaignAudience.withUpcomingAppointment;
    case 'without_upcoming_appointment':
      return SalonCentralCampaignAudience.withoutUpcomingAppointment;
    case 'with_active_benefits':
      return SalonCentralCampaignAudience.withActiveBenefits;
    case 'without_active_benefits':
      return SalonCentralCampaignAudience.withoutActiveBenefits;
    case 'all':
    default:
      return SalonCentralCampaignAudience.all;
  }
}
