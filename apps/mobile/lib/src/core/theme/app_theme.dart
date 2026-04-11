import 'package:flutter/material.dart';

import '../../features/shared/app_models.dart';

class AppTheme {
  static const Color background = Color(0xFFF7F3EE);
  static const Color panel = Color(0xFFFFFCF8);
  static const Color ink = Color(0xFF221815);
  static const Color mutedInk = Color(0xFF6D5E58);
  static const Color primary = Color(0xFFC15F43);
  static const Color secondary = Color(0xFF22443C);
  static const Color accent = Color(0xFFE7B36A);
  static const Color line = Color(0xFFE8DDD4);
  static const double panelRadius = 28;
  static const double cardRadius = 24;
  static const double insetRadius = 20;

  static ThemeData build({SalonPreview? preview}) {
    final visualStyle = preview?.visualStyle?.trim().toLowerCase() ?? 'auto';
    final explicitThemeMode = preview?.themeMode?.trim().toLowerCase();
    final resolvedPrimary = _parseHexColor(
      preview?.brandColor,
      fallback: primary,
    );
    final resolvedSecondary = _parseHexColor(
      preview?.secondaryColor,
      fallback: secondary,
    );
    final resolvedAccent = _parseHexColor(
      preview?.accentColor,
      fallback: accent,
    );
    final resolvedThemeMode =
        (explicitThemeMode?.isNotEmpty == true ? explicitThemeMode : null) ??
        switch (visualStyle) {
          'heritage_dark' => 'dark',
          'glow_signature' => 'hybrid',
          _ => 'light',
        };
    final isDark = resolvedThemeMode == 'dark';
    final resolvedBackground = isDark ? const Color(0xFF14181A) : background;
    final resolvedPanel = isDark ? const Color(0xFF1A2023) : panel;
    final resolvedInk = isDark ? const Color(0xFFF6F1EB) : ink;
    final resolvedMutedInk = isDark ? const Color(0xFFC5BDB5) : mutedInk;
    final resolvedLine = isDark ? const Color(0xFF3B3632) : line;
    final explicitButtonStyle = preview?.buttonStyle?.trim().toLowerCase();
    final buttonStyle =
        (explicitButtonStyle?.isNotEmpty == true
            ? explicitButtonStyle
            : null) ??
        switch (visualStyle) {
          'glow_signature' => 'capsule',
          'clinical_refined' => 'elevated',
          _ => 'rounded',
        };
    final explicitCardStyle = preview?.cardStyle?.trim().toLowerCase();
    final cardStyle =
        (explicitCardStyle?.isNotEmpty == true ? explicitCardStyle : null) ??
        switch (visualStyle) {
          'glow_signature' => 'glass',
          'clinical_refined' => 'outlined',
          _ => 'floating',
        };
    final explicitBannerStyle = preview?.bannerStyle?.trim().toLowerCase();
    final bannerStyle =
        (explicitBannerStyle?.isNotEmpty == true
            ? explicitBannerStyle
            : null) ??
        switch (visualStyle) {
          'heritage_dark' => 'immersive',
          'glow_signature' => 'spotlight',
          _ => 'editorial',
        };
    final uiSpec = SalonUiSpec(
      backgroundColor: resolvedBackground,
      panelColor: resolvedPanel,
      inkColor: resolvedInk,
      mutedInkColor: resolvedMutedInk,
      lineColor: resolvedLine,
      primaryColor: resolvedPrimary,
      secondaryColor: resolvedSecondary,
      accentColor: resolvedAccent,
      buttonStyle: buttonStyle,
      cardStyle: cardStyle,
      bannerStyle: bannerStyle,
    );
    final base = ThemeData(
      useMaterial3: true,
      brightness: isDark ? Brightness.dark : Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: resolvedPrimary,
        brightness: isDark ? Brightness.dark : Brightness.light,
        primary: resolvedPrimary,
        secondary: resolvedSecondary,
        tertiary: resolvedAccent,
        surface: resolvedPanel,
      ),
      scaffoldBackgroundColor: resolvedBackground,
      textTheme: TextTheme(
        displaySmall: TextStyle(
          fontSize: 35,
          fontWeight: FontWeight.w800,
          letterSpacing: -1.3,
          height: 1.02,
          color: resolvedInk,
        ),
        headlineMedium: TextStyle(
          fontSize: 25,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.85,
          height: 1.08,
          color: resolvedInk,
        ),
        titleLarge: TextStyle(
          fontSize: 21,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.45,
          height: 1.14,
          color: resolvedInk,
        ),
        titleMedium: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          height: 1.2,
          color: resolvedInk,
        ),
        titleSmall: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          height: 1.2,
          color: resolvedInk,
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          height: 1.5,
          color: resolvedInk,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          height: 1.45,
          color: resolvedInk,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          height: 1.35,
          letterSpacing: 0.12,
          color: resolvedMutedInk,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.08,
          color: resolvedInk,
        ),
        labelMedium: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.14,
          color: resolvedMutedInk,
        ),
      ),
      extensions: [uiSpec],
    );

    return base.copyWith(
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: resolvedInk,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: resolvedInk,
        ),
      ),
      cardTheme: CardThemeData(
        color: resolvedPanel,
        elevation: 0,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(panelRadius),
          side: BorderSide(color: resolvedLine),
        ),
      ),
      dividerColor: resolvedLine,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? resolvedPanel.withValues(alpha: 0.94)
            : Colors.white,
        labelStyle: TextStyle(
          color: resolvedMutedInk,
          fontWeight: FontWeight.w600,
        ),
        hintStyle: TextStyle(
          color: resolvedMutedInk.withValues(alpha: 0.85),
          fontWeight: FontWeight.w500,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          borderSide: BorderSide(color: resolvedLine),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          borderSide: BorderSide(color: resolvedLine),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(cardRadius),
          borderSide: BorderSide(color: resolvedPrimary, width: 1.4),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 17,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: resolvedPanel,
        indicatorColor: resolvedPrimary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          return TextStyle(
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
            color: states.contains(WidgetState.selected)
                ? resolvedInk
                : resolvedMutedInk,
          );
        }),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(58),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(
              _buttonRadiusForStyle(buttonStyle),
            ),
          ),
          elevation: buttonStyle == 'elevated' ? 2 : 0,
          shadowColor: resolvedPrimary.withValues(alpha: 0.24),
          backgroundColor: resolvedPrimary,
          foregroundColor: Colors.white,
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.08,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(
              _buttonRadiusForStyle(buttonStyle),
            ),
          ),
          side: BorderSide(color: resolvedLine),
          foregroundColor: resolvedInk,
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.06,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: resolvedPrimary,
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.08,
          ),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        side: BorderSide(color: resolvedLine),
        selectedColor: resolvedPrimary.withValues(alpha: 0.12),
        backgroundColor: isDark ? resolvedPanel : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(insetRadius),
        ),
      ),
    );
  }

  static SalonUiSpec spec(BuildContext context) =>
      Theme.of(context).extension<SalonUiSpec>() ??
      const SalonUiSpec.fallback();

  static double _buttonRadiusForStyle(String value) {
    switch (value.trim().toLowerCase()) {
      case 'capsule':
        return 999;
      case 'elevated':
        return 28;
      case 'rounded':
      default:
        return cardRadius;
    }
  }

  static Color _parseHexColor(String? value, {required Color fallback}) {
    final normalized = value?.trim() ?? '';
    if (normalized.isEmpty) {
      return fallback;
    }

    final hex = normalized.replaceFirst('#', '');
    if (hex.length != 6 && hex.length != 8) {
      return fallback;
    }

    final buffer = StringBuffer();
    if (hex.length == 6) {
      buffer.write('ff');
    }
    buffer.write(hex);

    return Color(
      int.tryParse(buffer.toString(), radix: 16) ?? fallback.toARGB32(),
    );
  }
}

@immutable
class SalonUiSpec extends ThemeExtension<SalonUiSpec> {
  const SalonUiSpec({
    required this.backgroundColor,
    required this.panelColor,
    required this.inkColor,
    required this.mutedInkColor,
    required this.lineColor,
    required this.primaryColor,
    required this.secondaryColor,
    required this.accentColor,
    required this.buttonStyle,
    required this.cardStyle,
    required this.bannerStyle,
  });

  const SalonUiSpec.fallback()
    : backgroundColor = AppTheme.background,
      panelColor = AppTheme.panel,
      inkColor = AppTheme.ink,
      mutedInkColor = AppTheme.mutedInk,
      lineColor = AppTheme.line,
      primaryColor = AppTheme.primary,
      secondaryColor = AppTheme.secondary,
      accentColor = AppTheme.accent,
      buttonStyle = 'rounded',
      cardStyle = 'floating',
      bannerStyle = 'editorial';

  final Color backgroundColor;
  final Color panelColor;
  final Color inkColor;
  final Color mutedInkColor;
  final Color lineColor;
  final Color primaryColor;
  final Color secondaryColor;
  final Color accentColor;
  final String buttonStyle;
  final String cardStyle;
  final String bannerStyle;

  @override
  ThemeExtension<SalonUiSpec> copyWith({
    Color? backgroundColor,
    Color? panelColor,
    Color? inkColor,
    Color? mutedInkColor,
    Color? lineColor,
    Color? primaryColor,
    Color? secondaryColor,
    Color? accentColor,
    String? buttonStyle,
    String? cardStyle,
    String? bannerStyle,
  }) {
    return SalonUiSpec(
      backgroundColor: backgroundColor ?? this.backgroundColor,
      panelColor: panelColor ?? this.panelColor,
      inkColor: inkColor ?? this.inkColor,
      mutedInkColor: mutedInkColor ?? this.mutedInkColor,
      lineColor: lineColor ?? this.lineColor,
      primaryColor: primaryColor ?? this.primaryColor,
      secondaryColor: secondaryColor ?? this.secondaryColor,
      accentColor: accentColor ?? this.accentColor,
      buttonStyle: buttonStyle ?? this.buttonStyle,
      cardStyle: cardStyle ?? this.cardStyle,
      bannerStyle: bannerStyle ?? this.bannerStyle,
    );
  }

  @override
  ThemeExtension<SalonUiSpec> lerp(
    covariant ThemeExtension<SalonUiSpec>? other,
    double t,
  ) {
    if (other is! SalonUiSpec) {
      return this;
    }

    return SalonUiSpec(
      backgroundColor: Color.lerp(backgroundColor, other.backgroundColor, t)!,
      panelColor: Color.lerp(panelColor, other.panelColor, t)!,
      inkColor: Color.lerp(inkColor, other.inkColor, t)!,
      mutedInkColor: Color.lerp(mutedInkColor, other.mutedInkColor, t)!,
      lineColor: Color.lerp(lineColor, other.lineColor, t)!,
      primaryColor: Color.lerp(primaryColor, other.primaryColor, t)!,
      secondaryColor: Color.lerp(secondaryColor, other.secondaryColor, t)!,
      accentColor: Color.lerp(accentColor, other.accentColor, t)!,
      buttonStyle: t < 0.5 ? buttonStyle : other.buttonStyle,
      cardStyle: t < 0.5 ? cardStyle : other.cardStyle,
      bannerStyle: t < 0.5 ? bannerStyle : other.bannerStyle,
    );
  }
}
