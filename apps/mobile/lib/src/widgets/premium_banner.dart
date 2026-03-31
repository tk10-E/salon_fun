import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumBanner extends StatelessWidget {
  const PremiumBanner({
    super.key,
    required this.title,
    required this.subtitle,
    this.eyebrow,
    this.imageUrl,
    this.tabletImageUrl,
    this.imageAlignment = Alignment.center,
    this.imageScale = 1,
    this.primaryActionLabel,
    this.onPrimaryAction,
    this.secondaryActionLabel,
    this.onSecondaryAction,
    this.leading,
    this.badges = const <Widget>[],
    this.footer,
    this.minHeight = 280,
  });

  final String title;
  final String subtitle;
  final String? eyebrow;
  final String? imageUrl;
  final String? tabletImageUrl;
  final Alignment imageAlignment;
  final double imageScale;
  final String? primaryActionLabel;
  final VoidCallback? onPrimaryAction;
  final String? secondaryActionLabel;
  final VoidCallback? onSecondaryAction;
  final Widget? leading;
  final List<Widget> badges;
  final Widget? footer;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;
    final mediaQuery = MediaQuery.sizeOf(context);
    final isTabletLayout = mediaQuery.shortestSide >= 600;
    final resolvedImageUrl = isTabletLayout
        ? (tabletImageUrl?.trim().isNotEmpty == true
              ? tabletImageUrl
              : imageUrl)
        : imageUrl;
    final hasImage = resolvedImageUrl?.trim().isNotEmpty == true;
    final leadingWidget = leading;

    return PremiumSurfaceCard(
      padding: EdgeInsets.zero,
      gradient: theme.heroGradient,
      radius: PremiumRadius.cardLarge,
      child: Stack(
        children: [
          Positioned(
            top: -72,
            right: -40,
            child: IgnorePointer(
              child: Container(
                width: 196,
                height: 196,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: hasImage ? 0.12 : 0.08),
                ),
              ),
            ),
          ),
          Positioned(
            left: -26,
            bottom: -84,
            child: IgnorePointer(
              child: Container(
                width: 176,
                height: 176,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: theme.accent.withValues(alpha: hasImage ? 0.18 : 0.1),
                ),
              ),
            ),
          ),
          if (hasImage)
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(PremiumRadius.cardLarge),
                child: Transform.scale(
                  scale: imageScale,
                  alignment: imageAlignment,
                  child: Image.network(
                    resolvedImageUrl!,
                    alignment: imageAlignment,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(PremiumRadius.cardLarge),
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withValues(alpha: hasImage ? 0.1 : 0.0),
                    Colors.black.withValues(alpha: hasImage ? 0.28 : 0.0),
                    Colors.black.withValues(alpha: hasImage ? 0.56 : 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(PremiumSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ConstrainedBox(
                  constraints: BoxConstraints(minHeight: minHeight - 48),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (leadingWidget != null || badges.isNotEmpty)
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ...?switch (leadingWidget) {
                              final Widget leading => <Widget>[leading],
                              null => null,
                            },
                            if (leadingWidget != null && badges.isNotEmpty)
                              const SizedBox(width: PremiumSpacing.sm),
                            if (badges.isNotEmpty)
                              Expanded(
                                child: Wrap(
                                  alignment: WrapAlignment.end,
                                  spacing: PremiumSpacing.xs,
                                  runSpacing: PremiumSpacing.xs,
                                  children: badges,
                                ),
                              ),
                          ],
                        ),
                      if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                        const SizedBox(height: PremiumSpacing.lg),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: PremiumSpacing.sm,
                            vertical: PremiumSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(
                              alpha: theme.isDark ? 0.12 : 0.18,
                            ),
                            borderRadius: BorderRadius.circular(
                              PremiumRadius.pill,
                            ),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.14),
                            ),
                          ),
                          child: Text(
                            eyebrow!,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: theme.isDark
                                      ? Colors.white.withValues(alpha: 0.92)
                                      : theme.onAccent.withValues(alpha: 0.88),
                                ),
                          ),
                        ),
                      ],
                      const SizedBox(height: PremiumSpacing.lg),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 420),
                        child: Text(
                          title,
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                color: theme.isDark
                                    ? Colors.white
                                    : theme.onAccent,
                                fontWeight: FontWeight.w900,
                                height: 0.98,
                              ),
                        ),
                      ),
                      const SizedBox(height: PremiumSpacing.sm),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 384),
                        child: Text(
                          subtitle,
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: theme.isDark
                                    ? Colors.white.withValues(alpha: 0.82)
                                    : theme.onAccent.withValues(alpha: 0.78),
                              ),
                        ),
                      ),
                      const SizedBox(height: PremiumSpacing.xl),
                      Wrap(
                        spacing: PremiumSpacing.sm,
                        runSpacing: PremiumSpacing.sm,
                        children: [
                          if (primaryActionLabel != null &&
                              onPrimaryAction != null)
                            FilledButton.icon(
                              onPressed: onPrimaryAction,
                              icon: const Icon(Icons.calendar_month_rounded),
                              label: Text(primaryActionLabel!),
                            ),
                          if (secondaryActionLabel != null &&
                              onSecondaryAction != null)
                            OutlinedButton.icon(
                              onPressed: onSecondaryAction,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: theme.isDark
                                    ? Colors.white
                                    : theme.textPrimary,
                                backgroundColor: theme.isDark
                                    ? Colors.white.withValues(alpha: 0.06)
                                    : Colors.white.withValues(alpha: 0.64),
                                side: BorderSide(
                                  color: theme.isDark
                                      ? Colors.white.withValues(alpha: 0.22)
                                      : theme.strokeStrong,
                                ),
                              ),
                              icon: const Icon(Icons.auto_awesome_rounded),
                              label: Text(secondaryActionLabel!),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (footer != null) ...[
                  const SizedBox(height: PremiumSpacing.md),
                  footer!,
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
