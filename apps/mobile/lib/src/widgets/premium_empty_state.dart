import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumEmptyState extends StatelessWidget {
  const PremiumEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.eyebrow,
    this.icon = Icons.auto_awesome_rounded,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String message;
  final String? eyebrow;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return PremiumSurfaceCard(
      tone: PremiumSurfaceTone.secondary,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              gradient: theme.buttonGradient,
              borderRadius: BorderRadius.circular(26),
              boxShadow: theme.softShadow,
            ),
            child: Icon(icon, color: theme.onAccent, size: 34),
          ),
          if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: PremiumSpacing.sm,
                vertical: PremiumSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: theme.surfacePrimary,
                borderRadius: BorderRadius.circular(PremiumRadius.pill),
                border: Border.all(color: theme.strokeSoft),
              ),
              child: Text(
                eyebrow!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: theme.textMuted,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
          const SizedBox(height: PremiumSpacing.sm),
          Container(
            width: 56,
            height: 4,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(PremiumRadius.pill),
              gradient: theme.buttonGradient,
            ),
          ),
          const SizedBox(height: PremiumSpacing.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: theme.textPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: PremiumSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: theme.textMuted),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: PremiumSpacing.lg),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}
