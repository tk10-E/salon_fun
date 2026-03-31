import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../models/salon_client_app_config.dart';
import 'service_category_visual.dart';

enum TenantThemeMode { light, dark, hybrid }

enum PremiumButtonStyle { capsule, rounded, elevated }

enum PremiumCardStyle { floating, outlined, glass }

enum PremiumBannerStyle { immersive, editorial, spotlight }

enum PremiumHomeModule {
  shortcuts,
  nextBooking,
  professionals,
  gallery,
  promotions,
  products,
  loyalty,
}

enum SalonBrandSegment {
  beautySalon,
  barbershop,
  nailStudio,
  browsLashes,
  hairStudio,
  aestheticsClinic,
  spaWellness,
}

class SalonBrandPalette {
  const SalonBrandPalette({
    required this.primary,
    required this.secondary,
    required this.accent,
    required this.background,
    required this.surface,
    required this.foreground,
  });

  final Color primary;
  final Color secondary;
  final Color accent;
  final Color background;
  final Color surface;
  final Color foreground;
}

class SalonBusinessHour {
  const SalonBusinessHour({required this.dayLabel, required this.hoursLabel});

  final String dayLabel;
  final String hoursLabel;
}

class PremiumProductItem {
  const PremiumProductItem({
    required this.id,
    required this.name,
    required this.subtitle,
    required this.priceLabel,
    this.imageUrl,
    this.badge,
    this.isBundle = false,
  });

  final String id;
  final String name;
  final String subtitle;
  final String priceLabel;
  final String? imageUrl;
  final String? badge;
  final bool isBundle;

  factory PremiumProductItem.fromMap(Map<String, dynamic> map) {
    return PremiumProductItem(
      id: (map['id'] ?? map['name'] ?? 'product') as String,
      name: (map['name'] ?? 'Produto premium') as String,
      subtitle: (map['subtitle'] ?? 'Selecao da marca') as String,
      priceLabel: (map['priceLabel'] ?? 'Consulte') as String,
      imageUrl: _readNullableString(map['imageUrl']),
      badge: _readNullableString(map['badge']),
      isBundle: (map['isBundle'] ?? false) as bool,
    );
  }
}

class ProfessionalHighlight {
  const ProfessionalHighlight({
    required this.id,
    required this.name,
    required this.specialty,
    required this.availabilityLabel,
    this.imageUrl,
    this.ratingLabel,
  });

  final String id;
  final String name;
  final String specialty;
  final String availabilityLabel;
  final String? imageUrl;
  final String? ratingLabel;
}

class SalonBrandConfig {
  const SalonBrandConfig({
    required this.salonName,
    required this.slogan,
    required this.segment,
    required this.themeMode,
    required this.buttonStyle,
    required this.cardStyle,
    required this.bannerStyle,
    required this.palette,
    required this.visibleModules,
    required this.welcomeHeadline,
    required this.welcomeMessage,
    required this.primaryCtaLabel,
    required this.promotionHeadline,
    required this.categoryHighlights,
    required this.businessHours,
    required this.products,
    required this.instagramUrl,
    required this.addressLabel,
    required this.mapUrl,
    required this.ratingValue,
    required this.ratingCount,
    this.logoUrl,
    this.heroImageUrl,
    this.heroImageTabletUrl,
    this.heroImageAlignment = Alignment.center,
    this.heroImageScale = 1,
    this.galleryCoverImageUrl,
    this.galleryCoverImageTabletUrl,
    this.galleryCoverImageAlignment = Alignment.center,
    this.galleryCoverImageScale = 1,
    this.profileCoverImageUrl,
    this.profileCoverImageTabletUrl,
    this.profileCoverImageAlignment = Alignment.center,
    this.profileCoverImageScale = 1,
  });

  final String salonName;
  final String slogan;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? heroImageTabletUrl;
  final Alignment heroImageAlignment;
  final double heroImageScale;
  final String? galleryCoverImageUrl;
  final String? galleryCoverImageTabletUrl;
  final Alignment galleryCoverImageAlignment;
  final double galleryCoverImageScale;
  final String? profileCoverImageUrl;
  final String? profileCoverImageTabletUrl;
  final Alignment profileCoverImageAlignment;
  final double profileCoverImageScale;
  final SalonBrandSegment segment;
  final TenantThemeMode themeMode;
  final PremiumButtonStyle buttonStyle;
  final PremiumCardStyle cardStyle;
  final PremiumBannerStyle bannerStyle;
  final SalonBrandPalette palette;
  final List<PremiumHomeModule> visibleModules;
  final String welcomeHeadline;
  final String welcomeMessage;
  final String primaryCtaLabel;
  final String promotionHeadline;
  final List<String> categoryHighlights;
  final List<SalonBusinessHour> businessHours;
  final List<PremiumProductItem> products;
  final String? instagramUrl;
  final String? addressLabel;
  final String? mapUrl;
  final double? ratingValue;
  final int? ratingCount;

  bool get isDarkShell => themeMode == TenantThemeMode.dark;

  factory SalonBrandConfig.fromProfile(
    CustomerProfile profile, {
    List<ServiceItem> services = const <ServiceItem>[],
    List<SalonPost> posts = const <SalonPost>[],
    List<SalonOfferItem> offers = const <SalonOfferItem>[],
  }) {
    final clientConfig =
        profile.salonClientAppConfig ?? const SalonClientAppConfig();
    final raw = clientConfig.rawConfig;
    final segment = _segmentFromValues(
      explicit: _readNullableString(raw['brandSegment']),
      legacy: profile.salonBusinessSegment,
      preset: clientConfig.resolveExperienceModel(profile.salonBusinessSegment),
    );
    final segmentDefaults = _SegmentDefaults.forSegment(segment);
    final primary =
        _parseHexColor(
          _readNullableString(raw['primaryColor']) ?? profile.salonBrandColor,
        ) ??
        segmentDefaults.palette.primary;
    final secondary =
        _parseHexColor(_readNullableString(raw['secondaryColor'])) ??
        segmentDefaults.palette.secondary;
    final accent =
        _parseHexColor(_readNullableString(raw['accentColor'])) ??
        segmentDefaults.palette.accent;
    final background =
        _parseHexColor(_readNullableString(raw['backgroundColor'])) ??
        segmentDefaults.palette.background;
    final surface =
        _parseHexColor(_readNullableString(raw['surfaceColor'])) ??
        segmentDefaults.palette.surface;
    final foreground =
        _parseHexColor(_readNullableString(raw['foregroundColor'])) ??
        segmentDefaults.palette.foreground;
    final slogan = profile.salonTagline?.trim().isNotEmpty == true
        ? profile.salonTagline!.trim()
        : _readNullableString(raw['slogan']) ?? segmentDefaults.slogan;

    return SalonBrandConfig(
      salonName: profile.salonName,
      slogan: slogan,
      logoUrl: profile.salonLogoUrl,
      heroImageUrl:
          _readNullableString(raw['heroImageVariantUrl']) ??
          _readNullableString(raw['heroImageUrl']) ??
          posts.firstOrNull?.coverImageUrl,
      heroImageTabletUrl:
          _readNullableString(raw['heroImageTabletVariantUrl']) ??
          _readNullableString(raw['heroImageVariantUrl']) ??
          _readNullableString(raw['heroImageUrl']) ??
          posts.firstOrNull?.coverImageUrl,
      heroImageAlignment: _alignmentFromRaw(
        raw['heroImageFocusX'],
        raw['heroImageFocusY'],
      ),
      heroImageScale: _scaleFromRaw(raw['heroImageZoom']),
      galleryCoverImageUrl:
          _readNullableString(raw['galleryCoverImageVariantUrl']) ??
          _readNullableString(raw['galleryCoverImageUrl']) ??
          posts.skip(1).firstOrNull?.coverImageUrl,
      galleryCoverImageTabletUrl:
          _readNullableString(raw['galleryCoverImageTabletVariantUrl']) ??
          _readNullableString(raw['galleryCoverImageVariantUrl']) ??
          _readNullableString(raw['galleryCoverImageUrl']) ??
          posts.skip(1).firstOrNull?.coverImageUrl,
      galleryCoverImageAlignment: _alignmentFromRaw(
        raw['galleryCoverImageFocusX'],
        raw['galleryCoverImageFocusY'],
      ),
      galleryCoverImageScale: _scaleFromRaw(raw['galleryCoverImageZoom']),
      profileCoverImageUrl:
          _readNullableString(raw['profileCoverImageVariantUrl']) ??
          _readNullableString(raw['profileCoverImageUrl']) ??
          _readNullableString(raw['heroImageVariantUrl']) ??
          _readNullableString(raw['heroImageUrl']) ??
          posts.firstOrNull?.coverImageUrl,
      profileCoverImageTabletUrl:
          _readNullableString(raw['profileCoverImageTabletVariantUrl']) ??
          _readNullableString(raw['profileCoverImageVariantUrl']) ??
          _readNullableString(raw['profileCoverImageUrl']) ??
          _readNullableString(raw['heroImageTabletVariantUrl']) ??
          _readNullableString(raw['heroImageVariantUrl']) ??
          _readNullableString(raw['heroImageUrl']) ??
          posts.firstOrNull?.coverImageUrl,
      profileCoverImageAlignment: _alignmentFromRaw(
        raw['profileCoverImageFocusX'],
        raw['profileCoverImageFocusY'],
      ),
      profileCoverImageScale: _scaleFromRaw(raw['profileCoverImageZoom']),
      segment: segment,
      themeMode: _themeModeFromRaw(
        _readNullableString(raw['themeMode']),
        fallback: segmentDefaults.themeMode,
      ),
      buttonStyle: _buttonStyleFromRaw(
        _readNullableString(raw['buttonStyle']),
        fallback: segmentDefaults.buttonStyle,
      ),
      cardStyle: _cardStyleFromRaw(
        _readNullableString(raw['cardStyle']),
        fallback: segmentDefaults.cardStyle,
      ),
      bannerStyle: _bannerStyleFromRaw(
        _readNullableString(raw['bannerStyle']),
        fallback: segmentDefaults.bannerStyle,
      ),
      palette: SalonBrandPalette(
        primary: primary,
        secondary: secondary,
        accent: accent,
        background: background,
        surface: surface,
        foreground: foreground,
      ),
      visibleModules: _modulesFromRaw(
        raw['visibleHomeModules'],
        fallback: segmentDefaults.modules,
      ),
      welcomeHeadline:
          _readNullableString(raw['welcomeHeadline']) ??
          clientConfig.heroHeadline ??
          segmentDefaults.welcomeHeadline,
      welcomeMessage:
          _readNullableString(raw['welcomeMessage']) ??
          clientConfig.heroSupportLine ??
          slogan,
      primaryCtaLabel:
          _readNullableString(raw['primaryCtaLabel']) ??
          clientConfig.primaryCtaLabel ??
          segmentDefaults.primaryCtaLabel,
      promotionHeadline:
          _readNullableString(raw['promotionHeadline']) ??
          _defaultPromotionHeadline(offers),
      categoryHighlights: _readStringList(raw['categoryHighlights']).isNotEmpty
          ? _readStringList(raw['categoryHighlights'])
          : _deriveCategoryHighlights(services),
      businessHours: _readBusinessHours(raw['businessHours']),
      products: _readProductHighlights(raw['featuredProducts']),
      instagramUrl: _readNullableString(raw['instagramUrl']),
      addressLabel: _readNullableString(raw['addressLabel']),
      mapUrl: _readNullableString(raw['mapUrl']),
      ratingValue: _readDoubleOrNull(raw['ratingValue']),
      ratingCount: _readIntOrNull(raw['ratingCount']),
    );
  }

  List<ProfessionalHighlight> buildProfessionalHighlights({
    List<SalonPost> posts = const <SalonPost>[],
    List<AppointmentItem> appointments = const <AppointmentItem>[],
  }) {
    final grouped = <String, ProfessionalHighlight>{};

    for (final post in posts) {
      final name = post.staffMemberName?.trim();
      if (name == null || name.isEmpty) {
        continue;
      }

      grouped.putIfAbsent(
        name,
        () => ProfessionalHighlight(
          id: name.toLowerCase().replaceAll(' ', '-'),
          name: name,
          specialty: post.staffMemberRole?.trim().isNotEmpty == true
              ? post.staffMemberRole!
              : 'Especialista da marca',
          availabilityLabel: 'Atendendo no app',
        ),
      );
    }

    for (final appointment in appointments) {
      final name = appointment.staffMemberName?.trim();
      if (name == null || name.isEmpty) {
        continue;
      }

      grouped.putIfAbsent(
        name,
        () => ProfessionalHighlight(
          id: name.toLowerCase().replaceAll(' ', '-'),
          name: name,
          specialty: 'Profissional em destaque',
          availabilityLabel: 'Disponivel para agendamento',
        ),
      );
    }

    return grouped.values.take(6).toList(growable: false);
  }

  IconData iconForService(ServiceItem service) {
    return resolveServiceCategoryVisual(
      category: service.category,
      name: service.name,
    ).icon;
  }
}

class _SegmentDefaults {
  const _SegmentDefaults({
    required this.slogan,
    required this.themeMode,
    required this.buttonStyle,
    required this.cardStyle,
    required this.bannerStyle,
    required this.palette,
    required this.modules,
    required this.welcomeHeadline,
    required this.primaryCtaLabel,
  });

  final String slogan;
  final TenantThemeMode themeMode;
  final PremiumButtonStyle buttonStyle;
  final PremiumCardStyle cardStyle;
  final PremiumBannerStyle bannerStyle;
  final SalonBrandPalette palette;
  final List<PremiumHomeModule> modules;
  final String welcomeHeadline;
  final String primaryCtaLabel;

  static _SegmentDefaults forSegment(SalonBrandSegment segment) {
    switch (segment) {
      case SalonBrandSegment.barbershop:
        return _SegmentDefaults(
          slogan: 'Presenca, rotina e acabamento premium.',
          themeMode: TenantThemeMode.dark,
          buttonStyle: PremiumButtonStyle.elevated,
          cardStyle: PremiumCardStyle.glass,
          bannerStyle: PremiumBannerStyle.immersive,
          palette: const SalonBrandPalette(
            primary: Color(0xFF7B4B2A),
            secondary: Color(0xFF2C1B14),
            accent: Color(0xFFD0A05B),
            background: Color(0xFF120C09),
            surface: Color(0xFF241711),
            foreground: Color(0xFFF7E5D0),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.nextBooking,
            PremiumHomeModule.professionals,
            PremiumHomeModule.gallery,
            PremiumHomeModule.promotions,
            PremiumHomeModule.products,
          ],
          welcomeHeadline: 'Seu proximo trato comeca aqui',
          primaryCtaLabel: 'Agendar corte',
        );
      case SalonBrandSegment.nailStudio:
        return _SegmentDefaults(
          slogan: 'Delicadeza, brilho e acabamento de alto padrao.',
          themeMode: TenantThemeMode.light,
          buttonStyle: PremiumButtonStyle.capsule,
          cardStyle: PremiumCardStyle.floating,
          bannerStyle: PremiumBannerStyle.editorial,
          palette: const SalonBrandPalette(
            primary: Color(0xFFD897A8),
            secondary: Color(0xFFF4D9DE),
            accent: Color(0xFFC88D73),
            background: Color(0xFFFFFBFA),
            surface: Color(0xFFFFF6F4),
            foreground: Color(0xFF4F3640),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.gallery,
            PremiumHomeModule.nextBooking,
            PremiumHomeModule.promotions,
            PremiumHomeModule.loyalty,
          ],
          welcomeHeadline: 'Seu proximo design favorito pode sair daqui',
          primaryCtaLabel: 'Agendar agora',
        );
      case SalonBrandSegment.browsLashes:
        return _SegmentDefaults(
          slogan: 'Olhar editorial com tecnica e leveza.',
          themeMode: TenantThemeMode.light,
          buttonStyle: PremiumButtonStyle.rounded,
          cardStyle: PremiumCardStyle.outlined,
          bannerStyle: PremiumBannerStyle.spotlight,
          palette: const SalonBrandPalette(
            primary: Color(0xFFAD846D),
            secondary: Color(0xFFE9D4C6),
            accent: Color(0xFFC78779),
            background: Color(0xFFFFFBF7),
            surface: Color(0xFFF8EFE8),
            foreground: Color(0xFF4A362D),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.gallery,
            PremiumHomeModule.professionals,
            PremiumHomeModule.promotions,
          ],
          welcomeHeadline: 'Seu proximo retoque merece leitura premium',
          primaryCtaLabel: 'Agendar agora',
        );
      case SalonBrandSegment.hairStudio:
        return _SegmentDefaults(
          slogan: 'Glamour, moda e transformacao com assinatura.',
          themeMode: TenantThemeMode.hybrid,
          buttonStyle: PremiumButtonStyle.rounded,
          cardStyle: PremiumCardStyle.floating,
          bannerStyle: PremiumBannerStyle.immersive,
          palette: const SalonBrandPalette(
            primary: Color(0xFF8F74C6),
            secondary: Color(0xFFF0E8FF),
            accent: Color(0xFFD7B46A),
            background: Color(0xFFFFFBFF),
            surface: Color(0xFFF6F0FB),
            foreground: Color(0xFF342846),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.nextBooking,
            PremiumHomeModule.gallery,
            PremiumHomeModule.professionals,
            PremiumHomeModule.promotions,
            PremiumHomeModule.products,
          ],
          welcomeHeadline: 'Transforme a vontade em agendamento',
          primaryCtaLabel: 'Agendar agora',
        );
      case SalonBrandSegment.aestheticsClinic:
      case SalonBrandSegment.spaWellness:
        return _SegmentDefaults(
          slogan: 'Bem-estar sofisticado com leitura calma e confiante.',
          themeMode: TenantThemeMode.hybrid,
          buttonStyle: PremiumButtonStyle.capsule,
          cardStyle: PremiumCardStyle.outlined,
          bannerStyle: PremiumBannerStyle.editorial,
          palette: const SalonBrandPalette(
            primary: Color(0xFF6D9082),
            secondary: Color(0xFFDDE9E2),
            accent: Color(0xFFD2B180),
            background: Color(0xFFFAF8F2),
            surface: Color(0xFFF3EFE5),
            foreground: Color(0xFF33453F),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.nextBooking,
            PremiumHomeModule.promotions,
            PremiumHomeModule.loyalty,
            PremiumHomeModule.products,
          ],
          welcomeHeadline: 'Seu proximo cuidado pode ser mais simples',
          primaryCtaLabel: 'Reservar protocolo',
        );
      case SalonBrandSegment.beautySalon:
        return _SegmentDefaults(
          slogan: 'Sua marca no app com desejo, clareza e exclusividade.',
          themeMode: TenantThemeMode.hybrid,
          buttonStyle: PremiumButtonStyle.rounded,
          cardStyle: PremiumCardStyle.floating,
          bannerStyle: PremiumBannerStyle.immersive,
          palette: const SalonBrandPalette(
            primary: Color(0xFFC56B43),
            secondary: Color(0xFFF1D4C5),
            accent: Color(0xFFB35D77),
            background: Color(0xFFFFFBF8),
            surface: Color(0xFFF9F1EB),
            foreground: Color(0xFF3E2A22),
          ),
          modules: const <PremiumHomeModule>[
            PremiumHomeModule.shortcuts,
            PremiumHomeModule.nextBooking,
            PremiumHomeModule.gallery,
            PremiumHomeModule.promotions,
            PremiumHomeModule.products,
            PremiumHomeModule.loyalty,
          ],
          welcomeHeadline: 'Seu proximo visual pode comecar agora',
          primaryCtaLabel: 'Agendar agora',
        );
    }
  }
}

SalonBrandSegment _segmentFromValues({
  required String? explicit,
  required String? legacy,
  required SalonClientExperienceModel preset,
}) {
  switch ((explicit ?? legacy)?.trim()) {
    case 'barbershop':
      return SalonBrandSegment.barbershop;
    case 'nail_studio':
      return SalonBrandSegment.nailStudio;
    case 'brows_lashes':
      return SalonBrandSegment.browsLashes;
    case 'hair_studio':
      return SalonBrandSegment.hairStudio;
    case 'spa':
    case 'spa_wellness':
      return SalonBrandSegment.spaWellness;
    case 'aesthetics_clinic':
      return SalonBrandSegment.aestheticsClinic;
  }

  switch (preset) {
    case SalonClientExperienceModel.barberHouse:
      return SalonBrandSegment.barbershop;
    case SalonClientExperienceModel.nailGallery:
      return SalonBrandSegment.nailStudio;
    case SalonClientExperienceModel.browsAtelier:
      return SalonBrandSegment.browsLashes;
    case SalonClientExperienceModel.aestheticClinic:
      return SalonBrandSegment.aestheticsClinic;
    case SalonClientExperienceModel.beautySignature:
    case SalonClientExperienceModel.auto:
      return SalonBrandSegment.beautySalon;
  }
}

TenantThemeMode _themeModeFromRaw(
  String? value, {
  required TenantThemeMode fallback,
}) {
  switch (value) {
    case 'light':
      return TenantThemeMode.light;
    case 'dark':
      return TenantThemeMode.dark;
    case 'hybrid':
      return TenantThemeMode.hybrid;
    default:
      return fallback;
  }
}

PremiumButtonStyle _buttonStyleFromRaw(
  String? value, {
  required PremiumButtonStyle fallback,
}) {
  switch (value) {
    case 'capsule':
      return PremiumButtonStyle.capsule;
    case 'rounded':
      return PremiumButtonStyle.rounded;
    case 'elevated':
      return PremiumButtonStyle.elevated;
    default:
      return fallback;
  }
}

PremiumCardStyle _cardStyleFromRaw(
  String? value, {
  required PremiumCardStyle fallback,
}) {
  switch (value) {
    case 'outlined':
      return PremiumCardStyle.outlined;
    case 'glass':
      return PremiumCardStyle.glass;
    case 'floating':
      return PremiumCardStyle.floating;
    default:
      return fallback;
  }
}

PremiumBannerStyle _bannerStyleFromRaw(
  String? value, {
  required PremiumBannerStyle fallback,
}) {
  switch (value) {
    case 'editorial':
      return PremiumBannerStyle.editorial;
    case 'spotlight':
      return PremiumBannerStyle.spotlight;
    case 'immersive':
      return PremiumBannerStyle.immersive;
    default:
      return fallback;
  }
}

List<PremiumHomeModule> _modulesFromRaw(
  Object? value, {
  required List<PremiumHomeModule> fallback,
}) {
  final rawItems = _readStringList(value);
  if (rawItems.isEmpty) {
    return fallback;
  }

  final modules = <PremiumHomeModule>[];
  for (final item in rawItems) {
    switch (item) {
      case 'shortcuts':
        modules.add(PremiumHomeModule.shortcuts);
      case 'nextBooking':
        modules.add(PremiumHomeModule.nextBooking);
      case 'professionals':
        modules.add(PremiumHomeModule.professionals);
      case 'gallery':
        modules.add(PremiumHomeModule.gallery);
      case 'promotions':
        modules.add(PremiumHomeModule.promotions);
      case 'products':
        modules.add(PremiumHomeModule.products);
      case 'loyalty':
        modules.add(PremiumHomeModule.loyalty);
    }
  }

  return modules.isEmpty ? fallback : modules;
}

Alignment _alignmentFromRaw(Object? rawX, Object? rawY) {
  final x = (_readDoubleOrNull(rawX) ?? 50).clamp(0, 100).toDouble();
  final y = (_readDoubleOrNull(rawY) ?? 50).clamp(0, 100).toDouble();

  return Alignment((x / 50) - 1, (y / 50) - 1);
}

double _scaleFromRaw(Object? value) {
  return (_readDoubleOrNull(value) ?? 1).clamp(1, 1.8).toDouble();
}

List<String> _deriveCategoryHighlights(List<ServiceItem> services) {
  final items = <String>[];
  for (final service in services) {
    final label = service.category?.trim().isNotEmpty == true
        ? service.category!.trim()
        : service.name.trim();
    if (label.isEmpty || items.contains(label)) {
      continue;
    }
    items.add(label);
    if (items.length == 4) {
      break;
    }
  }

  return items;
}

String _defaultPromotionHeadline(List<SalonOfferItem> offers) {
  if (offers.any((offer) => offer.isMembership)) {
    return 'Clube, pacotes e recorrencia com acabamento premium';
  }

  if (offers.isNotEmpty) {
    return 'Oportunidades ativas para sua proxima visita';
  }

  return 'Experiencia de marca com conversao e desejo';
}

List<SalonBusinessHour> _readBusinessHours(Object? value) {
  if (value is! List) {
    return const <SalonBusinessHour>[];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .map(
        (item) => SalonBusinessHour(
          dayLabel: (item['dayLabel'] ?? 'Seg a Sex') as String,
          hoursLabel: (item['hoursLabel'] ?? '09:00 - 19:00') as String,
        ),
      )
      .toList(growable: false);
}

List<PremiumProductItem> _readProductHighlights(Object? value) {
  if (value is! List) {
    return const <PremiumProductItem>[];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .map(PremiumProductItem.fromMap)
      .toList(growable: false);
}

List<String> _readStringList(Object? value) {
  if (value is! List) {
    return const <String>[];
  }

  return value
      .map((item) => item.toString().trim())
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}

double? _readDoubleOrNull(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString());
}

int? _readIntOrNull(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString());
}

Color? _parseHexColor(String? value) {
  final hex = value?.trim();
  if (hex == null || !RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(hex)) {
    return null;
  }

  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
