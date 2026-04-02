enum SalonVisualStyle {
  auto,
  softEditorial,
  glowSignature,
  heritageDark,
  clinicalRefined,
}

enum SalonThemeMode { auto, light, dark, hybrid }

class SalonClientAppConfig {
  const SalonClientAppConfig({
    this.heroHeadline,
    this.heroSupportLine,
    this.primaryCtaLabel,
    this.welcomeHeadline,
    this.welcomeMessage,
    this.promotionHeadline,
    this.secondaryColor,
    this.accentColor,
    this.heroImageUrl,
    this.heroImageVariantUrl,
    this.galleryCoverImageUrl,
    this.galleryCoverImageVariantUrl,
    this.profileCoverImageUrl,
    this.profileCoverImageVariantUrl,
    this.instagramUrl,
    this.addressLabel,
    this.mapUrl,
    this.ratingValue,
    this.ratingCount,
    this.visualStyle = SalonVisualStyle.auto,
    this.themeMode = SalonThemeMode.auto,
    this.visibleHomeModules = const <String>[],
    this.rawConfig = const <String, dynamic>{},
  });

  final String? heroHeadline;
  final String? heroSupportLine;
  final String? primaryCtaLabel;
  final String? welcomeHeadline;
  final String? welcomeMessage;
  final String? promotionHeadline;
  final String? secondaryColor;
  final String? accentColor;
  final String? heroImageUrl;
  final String? heroImageVariantUrl;
  final String? galleryCoverImageUrl;
  final String? galleryCoverImageVariantUrl;
  final String? profileCoverImageUrl;
  final String? profileCoverImageVariantUrl;
  final String? instagramUrl;
  final String? addressLabel;
  final String? mapUrl;
  final double? ratingValue;
  final int? ratingCount;
  final SalonVisualStyle visualStyle;
  final SalonThemeMode themeMode;
  final List<String> visibleHomeModules;
  final Map<String, dynamic> rawConfig;

  String? get resolvedHeroImage => heroImageVariantUrl ?? heroImageUrl;
  String? get resolvedGalleryCoverImage =>
      galleryCoverImageVariantUrl ?? galleryCoverImageUrl;
  String? get resolvedProfileCoverImage =>
      profileCoverImageVariantUrl ?? profileCoverImageUrl;

  factory SalonClientAppConfig.fromDynamic(Object? value) {
    if (value is! Map) {
      return const SalonClientAppConfig();
    }

    final map = Map<String, dynamic>.from(value);

    return SalonClientAppConfig(
      heroHeadline: _readNullableString(map['heroHeadline']),
      heroSupportLine: _readNullableString(map['heroSupportLine']),
      primaryCtaLabel: _readNullableString(map['primaryCtaLabel']),
      welcomeHeadline: _readNullableString(map['welcomeHeadline']),
      welcomeMessage: _readNullableString(map['welcomeMessage']),
      promotionHeadline: _readNullableString(map['promotionHeadline']),
      secondaryColor: _readNullableString(map['secondaryColor']),
      accentColor: _readNullableString(map['accentColor']),
      heroImageUrl: _readNullableString(map['heroImageUrl']),
      heroImageVariantUrl: _readNullableString(map['heroImageVariantUrl']),
      galleryCoverImageUrl: _readNullableString(map['galleryCoverImageUrl']),
      galleryCoverImageVariantUrl: _readNullableString(
        map['galleryCoverImageVariantUrl'],
      ),
      profileCoverImageUrl: _readNullableString(map['profileCoverImageUrl']),
      profileCoverImageVariantUrl: _readNullableString(
        map['profileCoverImageVariantUrl'],
      ),
      instagramUrl: _readNullableString(map['instagramUrl']),
      addressLabel: _readNullableString(map['addressLabel']),
      mapUrl: _readNullableString(map['mapUrl']),
      ratingValue: _readDoubleOrNull(map['ratingValue']),
      ratingCount: _readIntOrNull(map['ratingCount']),
      visualStyle: _parseVisualStyle(map['visualStyle']?.toString()),
      themeMode: _parseThemeMode(map['themeMode']?.toString()),
      visibleHomeModules: _readStringList(map['visibleHomeModules']),
      rawConfig: Map<String, dynamic>.unmodifiable(map),
    );
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
