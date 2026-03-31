import 'package:flutter/material.dart';

final class PremiumSpacing {
  const PremiumSpacing._();

  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double hero = 40;
}

final class PremiumRadius {
  const PremiumRadius._();

  static const double chip = 18;
  static const double card = 28;
  static const double cardLarge = 36;
  static const double pill = 999;
}

final class PremiumMotion {
  const PremiumMotion._();

  static const Duration fast = Duration(milliseconds: 160);
  static const Duration normal = Duration(milliseconds: 220);
  static const Duration slow = Duration(milliseconds: 320);
}

final class PremiumShadow {
  const PremiumShadow._();

  static List<BoxShadow> soft(Color color, {bool dark = false}) {
    return <BoxShadow>[
      BoxShadow(
        color: color.withValues(alpha: dark ? 0.18 : 0.08),
        blurRadius: dark ? 28 : 22,
        offset: const Offset(0, 10),
      ),
      BoxShadow(
        color: color.withValues(alpha: dark ? 0.1 : 0.04),
        blurRadius: dark ? 54 : 42,
        offset: const Offset(0, 18),
      ),
    ];
  }

  static List<BoxShadow> strong(Color color, {bool dark = false}) {
    return <BoxShadow>[
      BoxShadow(
        color: color.withValues(alpha: dark ? 0.28 : 0.12),
        blurRadius: dark ? 34 : 28,
        offset: const Offset(0, 14),
      ),
      BoxShadow(
        color: color.withValues(alpha: dark ? 0.16 : 0.08),
        blurRadius: dark ? 64 : 48,
        offset: const Offset(0, 24),
      ),
    ];
  }
}

Color premiumBlend(Color base, Color target, double amount) {
  return Color.lerp(base, target, amount) ?? base;
}

Color premiumTint(Color color, {double lightness = 0, double saturation = 0}) {
  final hsl = HSLColor.fromColor(color);
  return hsl
      .withLightness((hsl.lightness + lightness).clamp(0.0, 1.0))
      .withSaturation((hsl.saturation + saturation).clamp(0.0, 1.0))
      .toColor();
}
