import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/app_models.dart';
import '../models/client_app_config.dart';

@immutable
class SalonThemeTokens extends ThemeExtension<SalonThemeTokens> {
  const SalonThemeTokens({
    required this.brand,
    required this.brandDark,
    required this.accent,
    required this.background,
    required this.surface,
    required this.surfaceStrong,
    required this.outline,
    required this.textMuted,
    required this.success,
    required this.warning,
    required this.isDarkShell,
  });

  final Color brand;
  final Color brandDark;
  final Color accent;
  final Color background;
  final Color surface;
  final Color surfaceStrong;
  final Color outline;
  final Color textMuted;
  final Color success;
  final Color warning;
  final bool isDarkShell;

  LinearGradient get appGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: isDarkShell
        ? <Color>[const Color(0xFF140F0D), brandDark, const Color(0xFF211513)]
        : <Color>[
            background,
            Color.alphaBlend(brand.withValues(alpha: 0.09), background),
            const Color(0xFFF8F1EA),
          ],
  );

  LinearGradient get heroGradient => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[
      brand,
      Color.lerp(brandDark, accent, 0.45) ?? accent,
      brandDark,
    ],
  );

  @override
  ThemeExtension<SalonThemeTokens> copyWith({
    Color? brand,
    Color? brandDark,
    Color? accent,
    Color? background,
    Color? surface,
    Color? surfaceStrong,
    Color? outline,
    Color? textMuted,
    Color? success,
    Color? warning,
    bool? isDarkShell,
  }) {
    return SalonThemeTokens(
      brand: brand ?? this.brand,
      brandDark: brandDark ?? this.brandDark,
      accent: accent ?? this.accent,
      background: background ?? this.background,
      surface: surface ?? this.surface,
      surfaceStrong: surfaceStrong ?? this.surfaceStrong,
      outline: outline ?? this.outline,
      textMuted: textMuted ?? this.textMuted,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      isDarkShell: isDarkShell ?? this.isDarkShell,
    );
  }

  @override
  ThemeExtension<SalonThemeTokens> lerp(
    covariant ThemeExtension<SalonThemeTokens>? other,
    double t,
  ) {
    if (other is! SalonThemeTokens) {
      return this;
    }

    return SalonThemeTokens(
      brand: Color.lerp(brand, other.brand, t) ?? brand,
      brandDark: Color.lerp(brandDark, other.brandDark, t) ?? brandDark,
      accent: Color.lerp(accent, other.accent, t) ?? accent,
      background: Color.lerp(background, other.background, t) ?? background,
      surface: Color.lerp(surface, other.surface, t) ?? surface,
      surfaceStrong:
          Color.lerp(surfaceStrong, other.surfaceStrong, t) ?? surfaceStrong,
      outline: Color.lerp(outline, other.outline, t) ?? outline,
      textMuted: Color.lerp(textMuted, other.textMuted, t) ?? textMuted,
      success: Color.lerp(success, other.success, t) ?? success,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      isDarkShell: t < 0.5 ? isDarkShell : other.isDarkShell,
    );
  }
}

ThemeData buildSalonTheme(CustomerProfile? profile) {
  final config = profile?.salonClientAppConfig ?? const SalonClientAppConfig();
  final brand =
      _parseHexColor(profile?.salonBrandColor) ?? const Color(0xFFC56B43);
  final accent =
      _parseHexColor(config.accentColor) ??
      _fallbackAccent(config.visualStyle, brand);
  final isDarkShell =
      config.themeMode == SalonThemeMode.dark ||
      config.visualStyle == SalonVisualStyle.heritageDark;
  final background = isDarkShell
      ? const Color(0xFF120D0B)
      : const Color(0xFFF7F1EB);
  final surface = isDarkShell
      ? const Color(0xFF211815)
      : const Color(0xFFFDF9F5);
  final surfaceStrong = isDarkShell ? const Color(0xFF2A1E1B) : Colors.white;
  final outline = isDarkShell
      ? const Color(0xFF46322C)
      : const Color(0xFFE6D8CD);
  final text = isDarkShell ? Colors.white : const Color(0xFF2C1F1A);
  final textMuted = isDarkShell
      ? const Color(0xFFC7B5AD)
      : const Color(0xFF775F55);

  final tokens = SalonThemeTokens(
    brand: brand,
    brandDark: Color.lerp(brand, Colors.black, 0.42) ?? brand,
    accent: accent,
    background: background,
    surface: surface,
    surfaceStrong: surfaceStrong,
    outline: outline,
    textMuted: textMuted,
    success: const Color(0xFF2D9C75),
    warning: const Color(0xFFDA8A32),
    isDarkShell: isDarkShell,
  );

  final textTheme = GoogleFonts.plusJakartaSansTextTheme().copyWith(
    displayLarge: GoogleFonts.fraunces(
      fontSize: 42,
      fontWeight: FontWeight.w700,
      color: text,
      letterSpacing: -1.1,
    ),
    displayMedium: GoogleFonts.fraunces(
      fontSize: 32,
      fontWeight: FontWeight.w700,
      color: text,
      letterSpacing: -0.8,
    ),
    displaySmall: GoogleFonts.fraunces(
      fontSize: 24,
      fontWeight: FontWeight.w700,
      color: text,
      letterSpacing: -0.5,
    ),
    headlineMedium: GoogleFonts.fraunces(
      fontSize: 20,
      fontWeight: FontWeight.w700,
      color: text,
    ),
    titleLarge: GoogleFonts.plusJakartaSans(
      fontSize: 17,
      fontWeight: FontWeight.w700,
      color: text,
    ),
    titleMedium: GoogleFonts.plusJakartaSans(
      fontSize: 15,
      fontWeight: FontWeight.w700,
      color: text,
    ),
    bodyLarge: GoogleFonts.plusJakartaSans(
      fontSize: 15,
      height: 1.45,
      color: text,
    ),
    bodyMedium: GoogleFonts.plusJakartaSans(
      fontSize: 14,
      height: 1.5,
      color: text,
    ),
    bodySmall: GoogleFonts.plusJakartaSans(
      fontSize: 12,
      height: 1.45,
      color: textMuted,
    ),
    labelLarge: GoogleFonts.plusJakartaSans(
      fontSize: 14,
      fontWeight: FontWeight.w700,
      color: isDarkShell ? const Color(0xFF180F0C) : Colors.white,
    ),
    labelMedium: GoogleFonts.plusJakartaSans(
      fontSize: 12,
      fontWeight: FontWeight.w700,
      color: textMuted,
    ),
  );

  final scheme = ColorScheme(
    brightness: isDarkShell ? Brightness.dark : Brightness.light,
    primary: brand,
    onPrimary: isDarkShell ? const Color(0xFFFDF7F1) : Colors.white,
    secondary: accent,
    onSecondary: isDarkShell ? const Color(0xFF140F0D) : Colors.white,
    error: const Color(0xFFB84C4C),
    onError: Colors.white,
    surface: surface,
    onSurface: text,
    surfaceTint: brand,
    outline: outline,
    shadow: const Color(0x24000000),
    tertiary: accent,
    onTertiary: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: background,
    textTheme: textTheme,
    extensions: <ThemeExtension<dynamic>>[tokens],
    cardColor: surfaceStrong,
    dividerColor: outline,
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: surfaceStrong,
      contentTextStyle: textTheme.bodyMedium,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    cardTheme: CardThemeData(
      color: surfaceStrong,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
        side: BorderSide(color: outline),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceStrong,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: BorderSide(color: outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: BorderSide(color: outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: BorderSide(color: brand, width: 1.3),
      ),
      hintStyle: textTheme.bodyMedium?.copyWith(color: textMuted),
      labelStyle: textTheme.bodyMedium?.copyWith(color: textMuted),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surfaceStrong,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(999),
        side: BorderSide(color: outline),
      ),
      labelStyle: textTheme.bodySmall?.copyWith(
        color: text,
        fontWeight: FontWeight.w700,
      ),
      side: BorderSide(color: outline),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: brand,
        foregroundColor: scheme.onPrimary,
        textStyle: textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: text,
        textStyle: textTheme.titleMedium,
        side: BorderSide(color: outline),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Color.alphaBlend(
        surfaceStrong.withValues(alpha: isDarkShell ? 0.92 : 0.88),
        background,
      ),
      indicatorColor: Color.alphaBlend(
        brand.withValues(alpha: 0.18),
        surfaceStrong,
      ),
      labelTextStyle: WidgetStatePropertyAll(
        textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? brand : textMuted);
      }),
    ),
  );
}

extension SalonThemeContext on BuildContext {
  SalonThemeTokens get salonTheme =>
      Theme.of(this).extension<SalonThemeTokens>()!;
}

Color _fallbackAccent(SalonVisualStyle style, Color brand) {
  switch (style) {
    case SalonVisualStyle.softEditorial:
      return const Color(0xFFD98E9D);
    case SalonVisualStyle.heritageDark:
      return const Color(0xFF8F6A52);
    case SalonVisualStyle.clinicalRefined:
      return const Color(0xFF74A8B7);
    case SalonVisualStyle.glowSignature:
    case SalonVisualStyle.auto:
      return Color.lerp(brand, const Color(0xFFF0B48D), 0.45) ??
          const Color(0xFFDE916B);
  }
}

Color? _parseHexColor(String? value) {
  if (value == null) {
    return null;
  }

  final normalized = value.replaceAll('#', '').trim();
  if (normalized.length != 6 && normalized.length != 8) {
    return null;
  }

  final buffer = StringBuffer();
  if (normalized.length == 6) {
    buffer.write('FF');
  }
  buffer.write(normalized);

  return Color(int.parse(buffer.toString(), radix: 16));
}
