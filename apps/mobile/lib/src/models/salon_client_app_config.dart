import '../theme/salon_experience_preset.dart';

enum SalonClientExperienceModel {
  auto('auto'),
  beautySignature('beauty_signature'),
  nailGallery('nail_gallery'),
  barberHouse('barber_house'),
  browsAtelier('brows_atelier'),
  aestheticClinic('aesthetic_clinic');

  const SalonClientExperienceModel(this.value);

  final String value;

  static SalonClientExperienceModel fromRaw(String? value) {
    switch (value?.trim()) {
      case 'beauty_signature':
        return SalonClientExperienceModel.beautySignature;
      case 'nail_gallery':
        return SalonClientExperienceModel.nailGallery;
      case 'barber_house':
        return SalonClientExperienceModel.barberHouse;
      case 'brows_atelier':
        return SalonClientExperienceModel.browsAtelier;
      case 'aesthetic_clinic':
        return SalonClientExperienceModel.aestheticClinic;
      case 'auto':
      default:
        return SalonClientExperienceModel.auto;
    }
  }
}

enum SalonClientVisualStyle {
  auto('auto'),
  softEditorial('soft_editorial'),
  glowSignature('glow_signature'),
  heritageDark('heritage_dark'),
  clinicalRefined('clinical_refined');

  const SalonClientVisualStyle(this.value);

  final String value;

  static SalonClientVisualStyle fromRaw(String? value) {
    switch (value?.trim()) {
      case 'soft_editorial':
        return SalonClientVisualStyle.softEditorial;
      case 'glow_signature':
        return SalonClientVisualStyle.glowSignature;
      case 'heritage_dark':
        return SalonClientVisualStyle.heritageDark;
      case 'clinical_refined':
        return SalonClientVisualStyle.clinicalRefined;
      case 'auto':
      default:
        return SalonClientVisualStyle.auto;
    }
  }
}

enum SalonClientHomeEmphasis {
  auto('auto'),
  services('services'),
  portfolio('portfolio'),
  schedule('schedule'),
  benefits('benefits');

  const SalonClientHomeEmphasis(this.value);

  final String value;

  static SalonClientHomeEmphasis fromRaw(String? value) {
    switch (value?.trim()) {
      case 'services':
        return SalonClientHomeEmphasis.services;
      case 'portfolio':
        return SalonClientHomeEmphasis.portfolio;
      case 'schedule':
        return SalonClientHomeEmphasis.schedule;
      case 'benefits':
        return SalonClientHomeEmphasis.benefits;
      case 'auto':
      default:
        return SalonClientHomeEmphasis.auto;
    }
  }
}

class SalonClientAppConfig {
  const SalonClientAppConfig({
    this.experienceModel = SalonClientExperienceModel.auto,
    this.visualStyle = SalonClientVisualStyle.auto,
    this.homeEmphasis = SalonClientHomeEmphasis.auto,
    this.heroHeadline,
    this.heroSupportLine,
    this.primaryCtaLabel,
    this.rawConfig = const <String, dynamic>{},
  });

  final SalonClientExperienceModel experienceModel;
  final SalonClientVisualStyle visualStyle;
  final SalonClientHomeEmphasis homeEmphasis;
  final String? heroHeadline;
  final String? heroSupportLine;
  final String? primaryCtaLabel;
  final Map<String, dynamic> rawConfig;

  factory SalonClientAppConfig.fromDynamic(Object? value) {
    if (value is! Map) {
      return const SalonClientAppConfig();
    }

    final map = Map<String, dynamic>.from(value);

    return SalonClientAppConfig(
      experienceModel: SalonClientExperienceModel.fromRaw(
        map['experienceModel']?.toString(),
      ),
      visualStyle: SalonClientVisualStyle.fromRaw(
        map['visualStyle']?.toString(),
      ),
      homeEmphasis: SalonClientHomeEmphasis.fromRaw(
        map['homeEmphasis']?.toString(),
      ),
      heroHeadline: _readNullableString(map['heroHeadline']),
      heroSupportLine: _readNullableString(map['heroSupportLine']),
      primaryCtaLabel: _readNullableString(map['primaryCtaLabel']),
      rawConfig: Map<String, dynamic>.unmodifiable(map),
    );
  }

  SalonClientExperienceModel resolveExperienceModel(String? businessSegment) {
    if (experienceModel != SalonClientExperienceModel.auto) {
      return experienceModel;
    }

    switch (normalizeSalonBusinessSegment(businessSegment)) {
      case 'nail_studio':
        return SalonClientExperienceModel.nailGallery;
      case 'barbershop':
        return SalonClientExperienceModel.barberHouse;
      case 'brows_lashes':
        return SalonClientExperienceModel.browsAtelier;
      case 'aesthetics_clinic':
        return SalonClientExperienceModel.aestheticClinic;
      case 'beauty_salon':
      default:
        return SalonClientExperienceModel.beautySignature;
    }
  }

  SalonClientVisualStyle resolveVisualStyle(String? businessSegment) {
    if (visualStyle != SalonClientVisualStyle.auto) {
      return visualStyle;
    }

    switch (resolveExperienceModel(businessSegment)) {
      case SalonClientExperienceModel.nailGallery:
        return SalonClientVisualStyle.softEditorial;
      case SalonClientExperienceModel.barberHouse:
        return SalonClientVisualStyle.heritageDark;
      case SalonClientExperienceModel.browsAtelier:
        return SalonClientVisualStyle.softEditorial;
      case SalonClientExperienceModel.aestheticClinic:
        return SalonClientVisualStyle.clinicalRefined;
      case SalonClientExperienceModel.beautySignature:
      case SalonClientExperienceModel.auto:
        return SalonClientVisualStyle.glowSignature;
    }
  }

  SalonClientHomeEmphasis resolveHomeEmphasis(String? businessSegment) {
    if (homeEmphasis != SalonClientHomeEmphasis.auto) {
      return homeEmphasis;
    }

    switch (resolveExperienceModel(businessSegment)) {
      case SalonClientExperienceModel.nailGallery:
        return SalonClientHomeEmphasis.portfolio;
      case SalonClientExperienceModel.barberHouse:
        return SalonClientHomeEmphasis.schedule;
      case SalonClientExperienceModel.browsAtelier:
        return SalonClientHomeEmphasis.portfolio;
      case SalonClientExperienceModel.aestheticClinic:
        return SalonClientHomeEmphasis.benefits;
      case SalonClientExperienceModel.beautySignature:
      case SalonClientExperienceModel.auto:
        return SalonClientHomeEmphasis.services;
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
