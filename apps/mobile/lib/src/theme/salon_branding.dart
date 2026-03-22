import 'package:flutter/material.dart';

class SalonBranding {
  const SalonBranding({
    required this.primary,
    required this.deep,
    required this.soft,
    required this.surface,
    required this.outline,
    required this.onPrimary,
  });

  final Color primary;
  final Color deep;
  final Color soft;
  final Color surface;
  final Color outline;
  final Color onPrimary;

  factory SalonBranding.fromName(String salonName, {String? overrideHexColor}) {
    const tones = <_SalonTone>[
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
    );
  }

  LinearGradient get heroGradient => LinearGradient(
    colors: [deep, primary, Color.lerp(primary, Colors.white, 0.1)!],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  Color get chipBackground => Color.lerp(primary, Colors.white, 0.86)!;
  Color get mutedText => Color.lerp(deep, Colors.white, 0.32)!;
  Color get highlightBackground => Color.lerp(primary, Colors.white, 0.92)!;
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
