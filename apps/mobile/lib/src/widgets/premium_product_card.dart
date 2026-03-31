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
      tone: PremiumSurfaceTone.secondary,
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: AspectRatio(
              aspectRatio: 1.15,
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
                          size: 28,
                        ),
                      ),
                    )
                  : DecoratedBox(
                      decoration: BoxDecoration(gradient: theme.bannerGradient),
                      child: Icon(
                        Icons.shopping_bag_outlined,
                        color: theme.textPrimary,
                        size: 28,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: PremiumSpacing.md),
          if (badge != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: PremiumSpacing.sm,
                vertical: PremiumSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: theme.surfaceAccent,
                borderRadius: BorderRadius.circular(PremiumRadius.pill),
              ),
              child: Text(
                badge!,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: theme.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: PremiumSpacing.sm),
          ],
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: theme.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: PremiumSpacing.xs),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: theme.textMuted),
          ),
          const SizedBox(height: PremiumSpacing.md),
          Text(
            priceLabel,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: theme.textPrimary,
              fontWeight: FontWeight.w900,
            ),
          ),
          if (onTap != null) ...[
            const SizedBox(height: PremiumSpacing.md),
            TextButton.icon(
              onPressed: onTap,
              iconAlignment: IconAlignment.end,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(actionLabel),
            ),
          ],
        ],
      ),
    );
  }
}
