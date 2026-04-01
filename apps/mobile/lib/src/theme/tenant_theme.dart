import 'package:flutter/material.dart';

import 'design_tokens.dart';
import 'salon_brand_config.dart';
import 'salon_branding.dart';

@immutable
class PremiumTenantTheme extends ThemeExtension<PremiumTenantTheme> {
  const PremiumTenantTheme({
    required this.brand,
    required this.isDark,
    required this.backgroundBase,
    required this.backgroundRaised,
    required this.surfacePrimary,
    required this.surfaceSecondary,
    required this.surfaceAccent,
    required this.strokeSoft,
    required this.strokeStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.accent,
    required this.onAccent,
    required this.heroGradient,
    required this.bannerGradient,
    required this.buttonGradient,
    required this.appGradient,
    required this.navGradient,
    required this.softShadow,
    required this.strongShadow,
  });

  final SalonBrandConfig brand;
  final bool isDark;
  final Color backgroundBase;
  final Color backgroundRaised;
  final Color surfacePrimary;
  final Color surfaceSecondary;
  final Color surfaceAccent;
  final Color strokeSoft;
  final Color strokeStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color accent;
  final Color onAccent;
  final LinearGradient heroGradient;
  final LinearGradient bannerGradient;
  final LinearGradient buttonGradient;
  final LinearGradient appGradient;
  final LinearGradient navGradient;
  final List<BoxShadow> softShadow;
  final List<BoxShadow> strongShadow;

  factory PremiumTenantTheme.resolve({
    required SalonBranding branding,
    required SalonBrandConfig brand,
  }) {
    final isDark =
        brand.themeMode == TenantThemeMode.dark || branding.usesDarkShell;
    final backgroundBase = isDark
        ? premiumBlend(brand.palette.background, Colors.black, 0.18)
        : premiumBlend(brand.palette.background, Colors.white, 0.2);
    final backgroundRaised = isDark
        ? premiumBlend(brand.palette.surface, Colors.white, 0.04)
        : premiumBlend(brand.palette.surface, Colors.white, 0.46);
    final surfacePrimary = isDark
        ? premiumBlend(brand.palette.surface, Colors.black, 0.12)
        : premiumBlend(brand.palette.surface, Colors.white, 0.72);
    final surfaceSecondary = isDark
        ? premiumBlend(brand.palette.secondary, Colors.black, 0.2)
        : premiumBlend(brand.palette.secondary, Colors.white, 0.48);
    final surfaceAccent = isDark
        ? premiumBlend(brand.palette.accent, Colors.black, 0.16)
        : premiumBlend(brand.palette.accent, Colors.white, 0.72);
    final strokeSoft = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : premiumBlend(
            brand.palette.foreground,
            Colors.white,
            0.72,
          ).withValues(alpha: 0.32);
    final strokeStrong = isDark
        ? Colors.white.withValues(alpha: 0.14)
        : premiumBlend(
            brand.palette.primary,
            Colors.white,
            0.4,
          ).withValues(alpha: 0.5);
    final textPrimary = isDark
        ? brand.palette.foreground
        : premiumBlend(brand.palette.foreground, Colors.black, 0.04);
    final textSecondary = isDark
        ? brand.palette.foreground.withValues(alpha: 0.82)
        : premiumBlend(brand.palette.foreground, Colors.white, 0.16);
    final textMuted = isDark
        ? brand.palette.foreground.withValues(alpha: 0.64)
        : premiumBlend(brand.palette.foreground, Colors.white, 0.24);

    return PremiumTenantTheme(
      brand: brand,
      isDark: isDark,
      backgroundBase: backgroundBase,
      backgroundRaised: backgroundRaised,
      surfacePrimary: surfacePrimary,
      surfaceSecondary: surfaceSecondary,
      surfaceAccent: surfaceAccent,
      strokeSoft: strokeSoft,
      strokeStrong: strokeStrong,
      textPrimary: textPrimary,
      textSecondary: textSecondary,
      textMuted: textMuted,
      accent: brand.palette.primary,
      onAccent:
          ThemeData.estimateBrightnessForColor(brand.palette.primary) ==
              Brightness.dark
          ? Colors.white
          : const Color(0xFF241711),
      heroGradient: LinearGradient(
        colors: isDark
            ? <Color>[
                premiumBlend(brand.palette.secondary, Colors.black, 0.24),
                premiumBlend(brand.palette.primary, Colors.black, 0.22),
                premiumBlend(brand.palette.accent, Colors.black, 0.08),
              ]
            : <Color>[
                premiumBlend(brand.palette.secondary, Colors.white, 0.18),
                brand.palette.primary,
                premiumBlend(brand.palette.accent, Colors.white, 0.24),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      bannerGradient: LinearGradient(
        colors: isDark
            ? <Color>[
                Colors.black.withValues(alpha: 0.08),
                premiumBlend(brand.palette.surface, Colors.black, 0.08),
                premiumBlend(brand.palette.primary, Colors.black, 0.24),
              ]
            : <Color>[
                premiumBlend(brand.palette.surface, Colors.white, 0.18),
                premiumBlend(brand.palette.secondary, Colors.white, 0.06),
                premiumBlend(brand.palette.accent, Colors.white, 0.46),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      buttonGradient: LinearGradient(
        colors: <Color>[
          premiumTint(brand.palette.primary, lightness: isDark ? 0.02 : -0.02),
          premiumBlend(brand.palette.primary, brand.palette.accent, 0.28),
        ],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ),
      appGradient: LinearGradient(
        colors: isDark
            ? <Color>[
                premiumBlend(brand.palette.background, Colors.black, 0.14),
                premiumBlend(brand.palette.secondary, Colors.black, 0.22),
                premiumBlend(brand.palette.background, Colors.black, 0.08),
              ]
            : <Color>[
                premiumBlend(brand.palette.background, Colors.white, 0.2),
                premiumBlend(brand.palette.secondary, Colors.white, 0.52),
                premiumBlend(brand.palette.surface, Colors.white, 0.28),
              ],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ),
      navGradient: LinearGradient(
        colors: isDark
            ? <Color>[
                premiumBlend(brand.palette.surface, Colors.black, 0.12),
                premiumBlend(brand.palette.secondary, Colors.black, 0.04),
              ]
            : <Color>[
                Colors.white.withValues(alpha: 0.94),
                premiumBlend(brand.palette.surface, Colors.white, 0.28),
              ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      softShadow: PremiumShadow.soft(
        premiumBlend(brand.palette.foreground, Colors.black, 0.1),
        dark: isDark,
      ),
      strongShadow: PremiumShadow.strong(
        premiumBlend(brand.palette.foreground, Colors.black, 0.14),
        dark: isDark,
      ),
    );
  }

  factory PremiumTenantTheme.fallback(ThemeData theme) {
    final isDark = theme.brightness == Brightness.dark;
    final scheme = theme.colorScheme;
    final primary = scheme.primary;
    final surface = theme.cardTheme.color ?? scheme.surface;
    final surfaceSecondary = premiumBlend(
      surface,
      primary,
      isDark ? 0.12 : 0.06,
    );
    final foreground = scheme.onSurface;
    final fallbackBrand = SalonBrandConfig(
      salonName: 'Salon Fun',
      slogan: 'Experiencia premium white-label',
      segment: SalonBrandSegment.beautySalon,
      themeMode: isDark ? TenantThemeMode.dark : TenantThemeMode.light,
      buttonStyle: PremiumButtonStyle.rounded,
      cardStyle: PremiumCardStyle.floating,
      bannerStyle: PremiumBannerStyle.immersive,
      palette: SalonBrandPalette(
        primary: primary,
        secondary: surfaceSecondary,
        accent: scheme.secondary,
        background: theme.scaffoldBackgroundColor,
        surface: surface,
        foreground: foreground,
      ),
      visibleModules: const <PremiumHomeModule>[
        PremiumHomeModule.shortcuts,
        PremiumHomeModule.nextBooking,
        PremiumHomeModule.gallery,
      ],
      welcomeHeadline: 'Seu app premium',
      welcomeMessage: 'Base white-label pronta para varias marcas.',
      primaryCtaLabel: 'Agendar agora',
      promotionHeadline: 'Conteudo promocional da marca',
      categoryHighlights: const <String>[],
      businessHours: const <SalonBusinessHour>[],
      products: const <PremiumProductItem>[],
      instagramUrl: null,
      addressLabel: null,
      mapUrl: null,
      ratingValue: null,
      ratingCount: null,
    );

    return PremiumTenantTheme(
      brand: fallbackBrand,
      isDark: isDark,
      backgroundBase: theme.scaffoldBackgroundColor,
      backgroundRaised: premiumBlend(
        surface,
        Colors.white,
        isDark ? 0.04 : 0.42,
      ),
      surfacePrimary: surface,
      surfaceSecondary: surfaceSecondary,
      surfaceAccent: premiumBlend(
        scheme.secondary,
        Colors.white,
        isDark ? 0.08 : 0.38,
      ),
      strokeSoft: isDark
          ? Colors.white.withValues(alpha: 0.08)
          : foreground.withValues(alpha: 0.08),
      strokeStrong: isDark
          ? Colors.white.withValues(alpha: 0.16)
          : foreground.withValues(alpha: 0.16),
      textPrimary: foreground,
      textSecondary: foreground.withValues(alpha: 0.82),
      textMuted: foreground.withValues(alpha: 0.6),
      accent: primary,
      onAccent: scheme.onPrimary,
      heroGradient: LinearGradient(
        colors: <Color>[
          premiumBlend(primary, scheme.secondary, 0.36),
          primary,
          premiumBlend(primary, Colors.white, isDark ? 0.08 : 0.22),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      bannerGradient: LinearGradient(
        colors: <Color>[
          premiumBlend(surfaceSecondary, Colors.white, isDark ? 0.04 : 0.18),
          premiumBlend(surface, primary, isDark ? 0.14 : 0.08),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      buttonGradient: LinearGradient(
        colors: <Color>[primary, premiumBlend(primary, scheme.secondary, 0.28)],
      ),
      appGradient: LinearGradient(
        colors: <Color>[
          theme.scaffoldBackgroundColor,
          premiumBlend(theme.scaffoldBackgroundColor, surfaceSecondary, 0.42),
        ],
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
      ),
      navGradient: LinearGradient(
        colors: <Color>[
          premiumBlend(surface, Colors.white, isDark ? 0.04 : 0.18),
          surfaceSecondary,
        ],
      ),
      softShadow: PremiumShadow.soft(foreground, dark: isDark),
      strongShadow: PremiumShadow.strong(foreground, dark: isDark),
    );
  }

  static ThemeData buildTheme({
    required SalonBranding branding,
    required SalonBrandConfig brand,
  }) {
    final extension = PremiumTenantTheme.resolve(
      branding: branding,
      brand: brand,
    );
    final brightness = extension.isDark ? Brightness.dark : Brightness.light;
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(
        seedColor: brand.palette.primary,
        brightness: brightness,
      ),
    );

    final textTheme = base.textTheme.copyWith(
      displaySmall: base.textTheme.displaySmall?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w700,
        letterSpacing: -1.2,
      ),
      headlineMedium: base.textTheme.headlineMedium?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w800,
        letterSpacing: -1,
        height: 1.02,
      ),
      headlineSmall: base.textTheme.headlineSmall?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.9,
      ),
      titleLarge: base.textTheme.titleLarge?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.4,
      ),
      titleMedium: base.textTheme.titleMedium?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: base.textTheme.bodyLarge?.copyWith(
        color: extension.textSecondary,
        height: 1.45,
      ),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(
        color: extension.textSecondary,
        height: 1.45,
      ),
      bodySmall: base.textTheme.bodySmall?.copyWith(
        color: extension.textMuted,
        height: 1.4,
      ),
      labelLarge: base.textTheme.labelLarge?.copyWith(
        color: extension.textPrimary,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.24,
      ),
      labelMedium: base.textTheme.labelMedium?.copyWith(
        color: extension.textSecondary,
        fontWeight: FontWeight.w600,
      ),
      labelSmall: base.textTheme.labelSmall?.copyWith(
        color: extension.textMuted,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.18,
      ),
    );

    final buttonShape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(switch (brand.buttonStyle) {
        PremiumButtonStyle.capsule => PremiumRadius.pill,
        PremiumButtonStyle.rounded => 24,
        PremiumButtonStyle.elevated => 20,
      }),
    );

    return base.copyWith(
      textTheme: textTheme,
      scaffoldBackgroundColor: extension.backgroundBase,
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: extension.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardThemeData(
        color: extension.surfacePrimary,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PremiumRadius.card),
          side: BorderSide(color: extension.strokeSoft),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: extension.accent,
          foregroundColor: extension.onAccent,
          disabledBackgroundColor: extension.strokeStrong.withValues(
            alpha: 0.38,
          ),
          disabledForegroundColor: extension.textMuted,
          minimumSize: const Size.fromHeight(58),
          elevation: 0,
          shadowColor: Colors.transparent,
          shape: buttonShape,
          padding: const EdgeInsets.symmetric(
            horizontal: PremiumSpacing.xl,
            vertical: PremiumSpacing.md,
          ),
          textStyle: textTheme.labelLarge?.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: extension.textPrimary,
          minimumSize: const Size.fromHeight(56),
          backgroundColor: extension.backgroundRaised.withValues(alpha: 0.72),
          side: BorderSide(color: extension.strokeStrong),
          shape: buttonShape,
          padding: const EdgeInsets.symmetric(
            horizontal: PremiumSpacing.xl,
            vertical: PremiumSpacing.md,
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: extension.textPrimary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(PremiumRadius.chip),
          ),
          textStyle: textTheme.labelLarge,
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: extension.surfaceSecondary,
        selectedColor: extension.surfaceAccent,
        side: BorderSide(color: extension.strokeSoft),
        labelStyle: textTheme.labelMedium,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PremiumRadius.chip),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: extension.surfacePrimary,
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: extension.textPrimary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PremiumRadius.card),
          side: BorderSide(color: extension.strokeSoft),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: extension.backgroundRaised,
        hintStyle: textTheme.bodyMedium?.copyWith(color: extension.textMuted),
        labelStyle: textTheme.bodyMedium?.copyWith(
          color: extension.textSecondary,
        ),
        floatingLabelStyle: textTheme.labelLarge?.copyWith(
          color: extension.accent,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: PremiumSpacing.lg,
          vertical: PremiumSpacing.md,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(color: extension.strokeSoft),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: BorderSide(color: extension.strokeStrong, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(color: Color(0xFFCF6A62), width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(24),
          borderSide: const BorderSide(color: Color(0xFFCF6A62), width: 1.4),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: extension.backgroundBase,
        modalBackgroundColor: extension.backgroundBase,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
      ),
      extensions: <ThemeExtension<dynamic>>[extension],
    );
  }

  @override
  PremiumTenantTheme copyWith({
    SalonBrandConfig? brand,
    bool? isDark,
    Color? backgroundBase,
    Color? backgroundRaised,
    Color? surfacePrimary,
    Color? surfaceSecondary,
    Color? surfaceAccent,
    Color? strokeSoft,
    Color? strokeStrong,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? accent,
    Color? onAccent,
    LinearGradient? heroGradient,
    LinearGradient? bannerGradient,
    LinearGradient? buttonGradient,
    LinearGradient? appGradient,
    LinearGradient? navGradient,
    List<BoxShadow>? softShadow,
    List<BoxShadow>? strongShadow,
  }) {
    return PremiumTenantTheme(
      brand: brand ?? this.brand,
      isDark: isDark ?? this.isDark,
      backgroundBase: backgroundBase ?? this.backgroundBase,
      backgroundRaised: backgroundRaised ?? this.backgroundRaised,
      surfacePrimary: surfacePrimary ?? this.surfacePrimary,
      surfaceSecondary: surfaceSecondary ?? this.surfaceSecondary,
      surfaceAccent: surfaceAccent ?? this.surfaceAccent,
      strokeSoft: strokeSoft ?? this.strokeSoft,
      strokeStrong: strokeStrong ?? this.strokeStrong,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      accent: accent ?? this.accent,
      onAccent: onAccent ?? this.onAccent,
      heroGradient: heroGradient ?? this.heroGradient,
      bannerGradient: bannerGradient ?? this.bannerGradient,
      buttonGradient: buttonGradient ?? this.buttonGradient,
      appGradient: appGradient ?? this.appGradient,
      navGradient: navGradient ?? this.navGradient,
      softShadow: softShadow ?? this.softShadow,
      strongShadow: strongShadow ?? this.strongShadow,
    );
  }

  @override
  PremiumTenantTheme lerp(
    covariant ThemeExtension<PremiumTenantTheme>? other,
    double t,
  ) {
    if (other is! PremiumTenantTheme) {
      return this;
    }

    return PremiumTenantTheme(
      brand: t < 0.5 ? brand : other.brand,
      isDark: t < 0.5 ? isDark : other.isDark,
      backgroundBase: Color.lerp(backgroundBase, other.backgroundBase, t)!,
      backgroundRaised: Color.lerp(
        backgroundRaised,
        other.backgroundRaised,
        t,
      )!,
      surfacePrimary: Color.lerp(surfacePrimary, other.surfacePrimary, t)!,
      surfaceSecondary: Color.lerp(
        surfaceSecondary,
        other.surfaceSecondary,
        t,
      )!,
      surfaceAccent: Color.lerp(surfaceAccent, other.surfaceAccent, t)!,
      strokeSoft: Color.lerp(strokeSoft, other.strokeSoft, t)!,
      strokeStrong: Color.lerp(strokeStrong, other.strokeStrong, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      onAccent: Color.lerp(onAccent, other.onAccent, t)!,
      heroGradient: t < 0.5 ? heroGradient : other.heroGradient,
      bannerGradient: t < 0.5 ? bannerGradient : other.bannerGradient,
      buttonGradient: t < 0.5 ? buttonGradient : other.buttonGradient,
      appGradient: t < 0.5 ? appGradient : other.appGradient,
      navGradient: t < 0.5 ? navGradient : other.navGradient,
      softShadow: t < 0.5 ? softShadow : other.softShadow,
      strongShadow: t < 0.5 ? strongShadow : other.strongShadow,
    );
  }
}

extension PremiumTenantThemeContext on BuildContext {
  PremiumTenantTheme get premiumTheme =>
      Theme.of(this).extension<PremiumTenantTheme>() ??
      PremiumTenantTheme.fallback(Theme.of(this));
}
