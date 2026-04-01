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

    return Container(
      padding: const EdgeInsets.fromLTRB(2, 2, 2, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(PremiumSpacing.md),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.white.withValues(alpha: theme.isDark ? 0.02 : 0.5),
                    theme.surfaceSecondary.withValues(alpha: 0.94),
                  ],
                ),
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: theme.strokeSoft),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: theme.buttonGradient,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: theme.softShadow,
                    ),
                    child: Icon(
                      Icons.auto_awesome_rounded,
                      color: theme.onAccent,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: PremiumSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (eyebrow != null && eyebrow!.trim().isNotEmpty) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: PremiumSpacing.md,
                              vertical: PremiumSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: theme.surfaceAccent,
                              borderRadius: BorderRadius.circular(
                                PremiumRadius.pill,
                              ),
                              border: Border.all(color: theme.strokeSoft),
                            ),
                            child: Text(
                              eyebrow!,
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: theme.textPrimary,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.56,
                                  ),
                            ),
                          ),
                          const SizedBox(height: PremiumSpacing.sm),
                        ],
                        Text(
                          title,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: theme.textPrimary,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        if (subtitle != null &&
                            subtitle!.trim().isNotEmpty) ...[
                          const SizedBox(height: PremiumSpacing.xs),
                          Text(
                            subtitle!,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: theme.textMuted),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            Padding(
              padding: const EdgeInsets.only(left: PremiumSpacing.md),
              child: InkWell(
                onTap: onAction,
                borderRadius: BorderRadius.circular(22),
                child: Ink(
                  padding: const EdgeInsets.symmetric(
                    horizontal: PremiumSpacing.md,
                    vertical: PremiumSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    gradient: theme.buttonGradient,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: theme.softShadow,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        actionLabel!,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: theme.onAccent,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(width: PremiumSpacing.xs),
                      Icon(
                        Icons.arrow_forward_rounded,
                        color: theme.onAccent,
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
