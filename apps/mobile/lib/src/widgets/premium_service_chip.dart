import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

class PremiumServiceChip extends StatelessWidget {
  const PremiumServiceChip({
    super.key,
    required this.label,
    required this.icon,
    this.onTap,
    this.selected = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(PremiumRadius.card),
      child: AnimatedContainer(
        duration: PremiumMotion.normal,
        padding: const EdgeInsets.symmetric(
          horizontal: PremiumSpacing.md,
          vertical: PremiumSpacing.md,
        ),
        decoration: BoxDecoration(
          color: selected ? theme.surfaceAccent : theme.surfacePrimary,
          borderRadius: BorderRadius.circular(PremiumRadius.card),
          border: Border.all(
            color: selected ? theme.strokeStrong : theme.strokeSoft,
          ),
          boxShadow: selected ? theme.softShadow : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                gradient: selected ? theme.buttonGradient : null,
                color: selected
                    ? null
                    : theme.isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.white.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                icon,
                color: selected ? theme.onAccent : theme.textPrimary,
                size: 20,
              ),
            ),
            const SizedBox(height: PremiumSpacing.sm),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: theme.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (selected) ...[
              const SizedBox(height: PremiumSpacing.xs),
              Container(
                width: 18,
                height: 3,
                decoration: BoxDecoration(
                  color: theme.accent.withValues(alpha: 0.82),
                  borderRadius: BorderRadius.circular(PremiumRadius.pill),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
