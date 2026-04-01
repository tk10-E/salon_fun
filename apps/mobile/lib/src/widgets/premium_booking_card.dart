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
      radius: PremiumRadius.cardLarge,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 72,
            margin: const EdgeInsets.only(top: PremiumSpacing.xs),
            child: Column(
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    gradient: theme.buttonGradient,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: theme.softShadow,
                  ),
                  child: Icon(icon, color: theme.onAccent),
                ),
                const SizedBox(height: PremiumSpacing.sm),
                Container(
                  width: 4,
                  height: 86,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(PremiumRadius.pill),
                    gradient: LinearGradient(
                      colors: [
                        theme.accent.withValues(alpha: 0.42),
                        theme.accent.withValues(alpha: 0.0),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: PremiumSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (eyebrow != null &&
                              eyebrow!.trim().isNotEmpty) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: PremiumSpacing.sm,
                                vertical: PremiumSpacing.xs,
                              ),
                              decoration: BoxDecoration(
                                color: theme.surfaceAccent,
                                borderRadius: BorderRadius.circular(
                                  PremiumRadius.pill,
                                ),
                              ),
                              child: Text(
                                eyebrow!,
                                style: Theme.of(context).textTheme.labelSmall
                                    ?.copyWith(
                                      color: theme.textPrimary,
                                      fontWeight: FontWeight.w800,
                                    ),
                              ),
                            ),
                            const SizedBox(height: PremiumSpacing.xs),
                          ],
                          Text(
                            title,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: theme.textPrimary,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: PremiumSpacing.xs),
                          Text(
                            subtitle,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: theme.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    if (onTap != null)
                      InkWell(
                        onTap: onTap,
                        borderRadius: BorderRadius.circular(18),
                        child: Ink(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: theme.surfacePrimary,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: theme.strokeSoft),
                          ),
                          child: Icon(
                            Icons.arrow_forward_rounded,
                            color: theme.textPrimary,
                            size: 20,
                          ),
                        ),
                      ),
                  ],
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: PremiumSpacing.md),
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
                  const SizedBox(height: PremiumSpacing.md),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(PremiumSpacing.md),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [theme.surfacePrimary, theme.surfaceSecondary],
                      ),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: theme.strokeSoft),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            gradient: theme.buttonGradient,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            Icons.flash_on_rounded,
                            color: theme.onAccent,
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: PremiumSpacing.sm),
                        Expanded(
                          child: Text(
                            highlightLabel!,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: theme.textPrimary,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (trailingLabel != null) ...[
                  const SizedBox(height: PremiumSpacing.md),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton.tonalIcon(
                      onPressed: onTap,
                      iconAlignment: IconAlignment.end,
                      icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                      label: Text(trailingLabel!),
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
