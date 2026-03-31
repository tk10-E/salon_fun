import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

enum PremiumSurfaceTone { primary, secondary, accent, contrast }

class PremiumSurfaceCard extends StatelessWidget {
  const PremiumSurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(PremiumSpacing.lg),
    this.margin,
    this.tone = PremiumSurfaceTone.primary,
    this.gradient,
    this.onTap,
    this.radius = PremiumRadius.card,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final PremiumSurfaceTone tone;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;
    final baseColor = switch (tone) {
      PremiumSurfaceTone.primary => theme.surfacePrimary,
      PremiumSurfaceTone.secondary => theme.surfaceSecondary,
      PremiumSurfaceTone.accent => theme.surfaceAccent,
      PremiumSurfaceTone.contrast =>
        theme.isDark
            ? premiumBlend(theme.surfacePrimary, Colors.black, 0.14)
            : premiumBlend(theme.surfacePrimary, theme.accent, 0.08),
    };

    final childContent = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? baseColor : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: theme.strokeSoft),
        boxShadow: theme.softShadow,
      ),
      child: child,
    );

    if (onTap == null) {
      return childContent;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(radius),
      child: childContent,
    );
  }
}
