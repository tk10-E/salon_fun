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

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;
    final mediaQuery = MediaQuery.sizeOf(context);
    final isTabletLayout = mediaQuery.shortestSide >= 600;
    final resolvedImageUrl = isTabletLayout
        ? (tabletImageUrl?.trim().isNotEmpty == true ? tabletImageUrl : imageUrl)
        : imageUrl;
    final hasImage = resolvedImageUrl?.trim().isNotEmpty == true;
    final leadingWidget = leading;

    return PremiumSurfaceCard(
      padding: EdgeInsets.zero,
      gradient: theme.heroGradient,
      radius: PremiumRadius.cardLarge,
      child: Stack(
        children: [
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
                    Colors.black.withValues(alpha: hasImage ? 0.08 : 0.0),
                    Colors.black.withValues(alpha: hasImage ? 0.34 : 0.0),
                  ],
                  begin: Alignment.topCenter,
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
                if (leading != null || badges.isNotEmpty)
                  Row(
                    children: [
                      ...?(leadingWidget == null
                          ? null
                          : <Widget>[leadingWidget]),
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
                  Text(
                    eyebrow!,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: theme.isDark
                          ? Colors.white.withValues(alpha: 0.86)
                          : theme.onAccent.withValues(alpha: 0.84),
                    ),
                  ),
                ],
                const SizedBox(height: PremiumSpacing.sm),
                Text(
                  title,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: theme.isDark ? Colors.white : theme.onAccent,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: PremiumSpacing.sm),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 360),
                  child: Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: theme.isDark
                          ? Colors.white.withValues(alpha: 0.82)
                          : theme.onAccent.withValues(alpha: 0.76),
                    ),
                  ),
                ),
                const SizedBox(height: PremiumSpacing.lg),
                Wrap(
                  spacing: PremiumSpacing.sm,
                  runSpacing: PremiumSpacing.sm,
                  children: [
                    if (primaryActionLabel != null && onPrimaryAction != null)
                      FilledButton(
                        onPressed: onPrimaryAction,
                        child: Text(primaryActionLabel!),
                      ),
                    if (secondaryActionLabel != null &&
                        onSecondaryAction != null)
                      OutlinedButton(
                        onPressed: onSecondaryAction,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: theme.isDark
                              ? Colors.white
                              : theme.textPrimary,
                          side: BorderSide(
                            color: theme.isDark
                                ? Colors.white.withValues(alpha: 0.22)
                                : theme.strokeStrong,
                          ),
                        ),
                        child: Text(secondaryActionLabel!),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
