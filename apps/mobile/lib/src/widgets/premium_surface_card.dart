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
    final borderRadius = BorderRadius.circular(radius);
    final resolvedGradient =
        gradient ??
        LinearGradient(
          colors: [
            premiumBlend(baseColor, Colors.white, theme.isDark ? 0.04 : 0.3),
            baseColor,
            premiumBlend(baseColor, theme.accent, theme.isDark ? 0.18 : 0.12),
          ],
          stops: const [0, 0.46, 1],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );

    final childContent = Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: borderRadius,
        boxShadow: theme.softShadow,
      ),
      child: ClipRRect(
        borderRadius: borderRadius,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: resolvedGradient,
            borderRadius: borderRadius,
            border: Border.all(color: theme.strokeSoft),
          ),
          child: Material(
            color: Colors.transparent,
            child: Stack(
              children: [
                Positioned(
                  top: -42,
                  right: -28,
                  child: IgnorePointer(
                    child: Container(
                      width: 128,
                      height: 128,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: theme.accent.withValues(alpha: 0.1),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: -32,
                  right: 18,
                  child: IgnorePointer(
                    child: Container(
                      width: 96,
                      height: 96,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: -18,
                  top: 22,
                  child: IgnorePointer(
                    child: Transform.rotate(
                      angle: -0.12,
                      child: Container(
                        width: 54,
                        height: 164,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(
                            PremiumRadius.pill,
                          ),
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.28),
                              Colors.white.withValues(alpha: 0.03),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: 32,
                  top: 24,
                  child: IgnorePointer(
                    child: Transform.rotate(
                      angle: 0.52,
                      child: Container(
                        width: 84,
                        height: 12,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(
                            PremiumRadius.pill,
                          ),
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: 0,
                  left: 20,
                  right: 20,
                  child: IgnorePointer(
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(PremiumRadius.pill),
                        gradient: LinearGradient(
                          colors: [
                            theme.accent.withValues(alpha: 0.0),
                            theme.accent.withValues(alpha: 0.5),
                            theme.accent.withValues(alpha: 0.0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 24,
                  top: 22,
                  child: IgnorePointer(
                    child: Container(
                      width: 54,
                      height: 8,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(PremiumRadius.pill),
                        color: Colors.white.withValues(alpha: 0.3),
                      ),
                    ),
                  ),
                ),
                Padding(padding: padding, child: child),
              ],
            ),
          ),
        ),
      ),
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
