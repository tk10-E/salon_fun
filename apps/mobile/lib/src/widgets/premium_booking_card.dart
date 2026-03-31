import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumBookingCard extends StatelessWidget {
  const PremiumBookingCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.meta,
    this.eyebrow,
    this.icon = Icons.event_available_rounded,
    this.highlightLabel,
    this.trailingLabel,
    this.onTap,
    this.tone = PremiumSurfaceTone.contrast,
  });

  final String title;
  final String subtitle;
  final List<String> meta;
  final String? eyebrow;
  final IconData icon;
  final String? highlightLabel;
  final String? trailingLabel;
  final VoidCallback? onTap;
  final PremiumSurfaceTone tone;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return PremiumSurfaceCard(
      tone: tone,
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              gradient: theme.buttonGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(icon, color: theme.onAccent),
          ),
          const SizedBox(width: PremiumSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                  Text(
                    eyebrow!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: theme.textMuted,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: PremiumSpacing.xs),
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
                  ).textTheme.bodyMedium?.copyWith(color: theme.textSecondary),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: PremiumSpacing.sm),
                  Wrap(
                    spacing: PremiumSpacing.xs,
                    runSpacing: PremiumSpacing.xs,
                    children: meta
                        .map(
                          (item) => Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: PremiumSpacing.sm,
                              vertical: PremiumSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: theme.surfacePrimary,
                              borderRadius: BorderRadius.circular(
                                PremiumRadius.pill,
                              ),
                              border: Border.all(color: theme.strokeSoft),
                            ),
                            child: Text(
                              item,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(color: theme.textSecondary),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                if (highlightLabel != null &&
                    highlightLabel!.trim().isNotEmpty) ...[
                  const SizedBox(height: PremiumSpacing.sm),
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
                      highlightLabel!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: theme.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailingLabel != null)
            Padding(
              padding: const EdgeInsets.only(left: PremiumSpacing.sm),
              child: TextButton.icon(
                onPressed: onTap,
                iconAlignment: IconAlignment.end,
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: Text(trailingLabel!),
              ),
            ),
        ],
      ),
    );
  }
}
