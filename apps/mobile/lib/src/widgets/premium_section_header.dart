import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

class PremiumSectionHeader extends StatelessWidget {
  const PremiumSectionHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? eyebrow;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: PremiumSpacing.sm,
                    vertical: PremiumSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: theme.surfaceSecondary,
                    borderRadius: BorderRadius.circular(PremiumRadius.pill),
                    border: Border.all(color: theme.strokeSoft),
                  ),
                  child: Text(
                    eyebrow!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: theme.textMuted,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.32,
                    ),
                  ),
                ),
                const SizedBox(height: PremiumSpacing.sm),
              ],
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: theme.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                const SizedBox(height: PremiumSpacing.xs),
                Text(
                  subtitle!,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: theme.textMuted),
                ),
              ],
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          Padding(
            padding: const EdgeInsets.only(left: PremiumSpacing.md),
            child: TextButton.icon(
              onPressed: onAction,
              iconAlignment: IconAlignment.end,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(actionLabel!),
            ),
          ),
      ],
    );
  }
}
