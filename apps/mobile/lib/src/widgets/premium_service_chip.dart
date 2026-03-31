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
          vertical: PremiumSpacing.sm,
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
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: theme.isDark
                    ? Colors.white.withValues(alpha: 0.06)
                    : Colors.white.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: theme.textPrimary, size: 20),
            ),
            const SizedBox(height: PremiumSpacing.xs),
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
          ],
        ),
      ),
    );
  }
}
