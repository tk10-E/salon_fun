import 'package:flutter/material.dart';

import '../models/salon_client_app_config.dart';
import 'salon_experience_preset.dart';

class SalonBranding {
  const SalonBranding({
    required this.primary,
    required this.deep,
    required this.soft,
    required this.surface,
    required this.outline,
    required this.onPrimary,
    required this.visualStyle,
  });

  final Color primary;
  final Color deep;
  final Color soft;
  final Color surface;
  final Color outline;
  final Color onPrimary;
  final SalonClientVisualStyle visualStyle;

  factory SalonBranding.fromName(
    String salonName, {
    String? overrideHexColor,
    String? businessSegment,
    SalonClientAppConfig? clientAppConfig,
  }) {
    const beautyTones = <_SalonTone>[
      _SalonTone(
        primary: Color(0xFFC56B43),
        deep: Color(0xFF7B3F26),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFFB35D77),
        deep: Color(0xFF6D3145),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF6D8B74),
        deep: Color(0xFF385042),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF8D6CCF),
        deep: Color(0xFF4D3E7E),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF4E8E94),
        deep: Color(0xFF27525A),
        onPrimary: Colors.white,
      ),
    ];
    const nailStudioTones = <_SalonTone>[
      _SalonTone(
        primary: Color(0xFFB35D77),
        deep: Color(0xFF6D3145),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFFCB7F97),
        deep: Color(0xFF7E4258),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF9E6A83),
        deep: Color(0xFF5D384B),
        onPrimary: Colors.white,
      ),
    ];
    const barbershopTones = <_SalonTone>[
      _SalonTone(
        primary: Color(0xFF6D8B74),
        deep: Color(0xFF385042),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF7D8C61),
        deep: Color(0xFF455036),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF60786C),
        deep: Color(0xFF30443D),
        onPrimary: Colors.white,
      ),
    ];
    const browsLashesTones = <_SalonTone>[
      _SalonTone(
        primary: Color(0xFF8A6A5A),
        deep: Color(0xFF4C362E),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF9B7B66),
        deep: Color(0xFF5A4135),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF7E665B),
        deep: Color(0xFF453933),
        onPrimary: Colors.white,
      ),
    ];
    const aestheticsTones = <_SalonTone>[
      _SalonTone(
        primary: Color(0xFF4E8E94),
        deep: Color(0xFF27525A),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF4D90A2),
        deep: Color(0xFF265564),
        onPrimary: Colors.white,
      ),
      _SalonTone(
        primary: Color(0xFF6D95A0),
        deep: Color(0xFF3B5961),
        onPrimary: Colors.white,
      ),
    ];

    final tones = switch (normalizeSalonBusinessSegment(businessSegment)) {
      'nail_studio' => nailStudioTones,
      'barbershop' => barbershopTones,
      'brows_lashes' => browsLashesTones,
      'aesthetics_clinic' => aestheticsTones,
      _ => beautyTones,
    };
    final visualStyle = (clientAppConfig ?? const SalonClientAppConfig())
        .resolveVisualStyle(businessSegment);

    final customPrimary = _parseHexColor(overrideHexColor);
    final tone = customPrimary != null
        ? _SalonTone.fromColor(customPrimary)
        : tones[_stableHash(salonName) % tones.length];

    return SalonBranding(
      primary: tone.primary,
      deep: tone.deep,
      soft: Color.lerp(tone.primary, Colors.white, 0.72)!,
      surface: Color.lerp(tone.primary, Colors.white, 0.9)!,
      outline: Color.lerp(tone.primary, Colors.white, 0.55)!,
      onPrimary: tone.onPrimary,
      visualStyle: visualStyle,
    );
  }

  LinearGradient get heroGradient {
    switch (visualStyle) {
      case SalonClientVisualStyle.softEditorial:
        return LinearGradient(
          colors: [
            Color.lerp(primary, const Color(0xFFFBE1EA), 0.24)!,
            primary,
            Color.lerp(primary, Colors.white, 0.18)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case SalonClientVisualStyle.glowSignature:
        return LinearGradient(
          colors: [
            Color.lerp(primary, const Color(0xFF7458C7), 0.42)!,
            primary,
            Color.lerp(primary, Colors.white, 0.08)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case SalonClientVisualStyle.heritageDark:
        return LinearGradient(
          colors: [
            const Color(0xFF1F130F),
            Color.lerp(deep, primary, 0.38)!,
            Color.lerp(primary, const Color(0xFFB9805B), 0.36)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case SalonClientVisualStyle.clinicalRefined:
        return LinearGradient(
          colors: [
            Color.lerp(primary, const Color(0xFF184F61), 0.46)!,
            primary,
            Color.lerp(primary, Colors.white, 0.14)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case SalonClientVisualStyle.auto:
        return LinearGradient(
          colors: [deep, primary, Color.lerp(primary, Colors.white, 0.1)!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
    }
  }

  Color get chipBackground => Color.lerp(primary, Colors.white, 0.86)!;
  Color get mutedText => Color.lerp(deep, Colors.white, 0.32)!;
  Color get highlightBackground => Color.lerp(primary, Colors.white, 0.92)!;
  bool get usesDarkShell => visualStyle == SalonClientVisualStyle.heritageDark;
  Color get shellForeground => usesDarkShell ? const Color(0xFFF8EAD9) : deep;
  Color get shellMutedForeground =>
      usesDarkShell ? const Color(0xFFD9C0AE) : mutedText;
  Color get shellNavigationBackground => usesDarkShell
      ? const Color(0xFF231611).withValues(alpha: 0.94)
      : Colors.white.withValues(alpha: 0.84);
  Color get shellNavigationBorder => usesDarkShell
      ? Colors.white.withValues(alpha: 0.08)
      : outline.withValues(alpha: 0.48);
  List<Color> get shellBackgroundGradient {
    switch (visualStyle) {
      case SalonClientVisualStyle.softEditorial:
        return [
          const Color(0xFFFFFBFD),
          Color.lerp(soft, Colors.white, 0.16)!,
          Color.lerp(surface, Colors.white, 0.1)!,
        ];
      case SalonClientVisualStyle.glowSignature:
        return [
          const Color(0xFFFFFBFF),
          Color.lerp(primary, Colors.white, 0.78)!,
          Color.lerp(surface, const Color(0xFFF3EEFF), 0.48)!,
        ];
      case SalonClientVisualStyle.heritageDark:
        return const [Color(0xFF140D0A), Color(0xFF241712), Color(0xFF1A110D)];
      case SalonClientVisualStyle.clinicalRefined:
        return [
          const Color(0xFFF8FEFF),
          Color.lerp(surface, Colors.white, 0.08)!,
          Color.lerp(soft, const Color(0xFFEAF6F7), 0.34)!,
        ];
      case SalonClientVisualStyle.auto:
        return [
          Color.lerp(surface, Colors.white, 0.18)!,
          Color.lerp(soft, Colors.white, 0.34)!,
          Color.lerp(surface, Colors.white, 0.52)!,
        ];
    }
  }

  Color get shellGlassBackground => usesDarkShell
      ? Colors.white.withValues(alpha: 0.08)
      : Colors.white.withValues(alpha: 0.82);
  Color get shellCardBackground => usesDarkShell
      ? const Color(0xFF231611).withValues(alpha: 0.84)
      : Colors.white.withValues(alpha: 0.94);
  Color get shellCardSoftBackground => usesDarkShell
      ? const Color(0xFF2C1B15).withValues(alpha: 0.82)
      : highlightBackground;
  Color get shellCardBorder => usesDarkShell
      ? Colors.white.withValues(alpha: 0.1)
      : outline.withValues(alpha: 0.56);
  Color get shellIconSurface => usesDarkShell
      ? Colors.white.withValues(alpha: 0.08)
      : Colors.white.withValues(alpha: 0.8);
  Color get shellBadgeBackground => usesDarkShell
      ? Colors.white.withValues(alpha: 0.1)
      : Colors.white.withValues(alpha: 0.72);
}

class _SalonTone {
  const _SalonTone({
    required this.primary,
    required this.deep,
    required this.onPrimary,
  });

  factory _SalonTone.fromColor(Color primary) {
    final hsl = HSLColor.fromColor(primary);
    final deep = hsl
        .withSaturation((hsl.saturation + 0.08).clamp(0.3, 0.92))
        .withLightness((hsl.lightness * 0.46).clamp(0.18, 0.36))
        .toColor();
    final onPrimary =
        ThemeData.estimateBrightnessForColor(primary) == Brightness.dark
        ? Colors.white
        : const Color(0xFF2E1B12);

    return _SalonTone(primary: primary, deep: deep, onPrimary: onPrimary);
  }

  final Color primary;
  final Color deep;
  final Color onPrimary;
}

int _stableHash(String value) {
  var hash = 0;

  for (final unit in value.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }

  return hash.abs();
}

Color? _parseHexColor(String? value) {
  final hex = value?.trim();
  if (hex == null || !RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(hex)) {
    return null;
  }

  return Color(int.parse('FF${hex.substring(1)}', radix: 16));
}
