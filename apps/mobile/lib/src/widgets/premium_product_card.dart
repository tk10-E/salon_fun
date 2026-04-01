import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumProductCard extends StatelessWidget {
  const PremiumProductCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.priceLabel,
    this.badge,
    this.imageUrl,
    this.onTap,
    this.actionLabel = 'Ver vitrine',
  });

  final String title;
  final String subtitle;
  final String priceLabel;
  final String? badge;
  final String? imageUrl;
  final VoidCallback? onTap;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return PremiumSurfaceCard(
      padding: EdgeInsets.zero,
      tone: PremiumSurfaceTone.secondary,
      onTap: onTap,
      radius: PremiumRadius.cardLarge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(PremiumRadius.cardLarge),
                ),
                child: AspectRatio(
                  aspectRatio: 1.08,
                  child: imageUrl?.trim().isNotEmpty == true
                      ? Image.network(
                          imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: theme.bannerGradient,
                            ),
                            child: Icon(
                              Icons.shopping_bag_outlined,
                              color: theme.textPrimary,
                              size: 30,
                            ),
                          ),
                        )
                      : DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: theme.bannerGradient,
                          ),
                          child: Icon(
                            Icons.shopping_bag_outlined,
                            color: theme.textPrimary,
                            size: 30,
                          ),
                        ),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(PremiumRadius.cardLarge),
                    ),
                    gradient: LinearGradient(
                      colors: [
                        Colors.black.withValues(alpha: 0.04),
                        Colors.black.withValues(alpha: 0.18),
                        Colors.black.withValues(alpha: 0.54),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
              ),
              if (badge != null)
                Positioned(
                  top: PremiumSpacing.md,
                  left: PremiumSpacing.md,
                  child: _ProductHeroBadge(label: badge!),
                ),
              Positioned(
                top: PremiumSpacing.md,
                right: PremiumSpacing.md,
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
              ),
              Positioned(
                left: PremiumSpacing.md,
                right: PremiumSpacing.md,
                bottom: PremiumSpacing.md,
                child: Container(
                  padding: const EdgeInsets.all(PremiumSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.26),
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: PremiumSpacing.xs),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Curadoria do salao para sua rotina',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.8),
                                  ),
                            ),
                          ),
                          const SizedBox(width: PremiumSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: PremiumSpacing.md,
                              vertical: PremiumSpacing.sm,
                            ),
                            decoration: BoxDecoration(
                              gradient: theme.buttonGradient,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              priceLabel,
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    color: theme.onAccent,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(PremiumSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(PremiumSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [theme.surfacePrimary, theme.surfaceSecondary],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: theme.strokeSoft),
                  ),
                  child: Text(
                    subtitle,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: theme.textMuted),
                  ),
                ),
                if (onTap != null) ...[
                  const SizedBox(height: PremiumSpacing.md),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.tonalIcon(
                      onPressed: onTap,
                      iconAlignment: IconAlignment.end,
                      icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                      label: Text(actionLabel),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductHeroBadge extends StatelessWidget {
  const _ProductHeroBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
