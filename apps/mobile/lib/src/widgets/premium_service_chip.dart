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

    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact =
            constraints.maxWidth.isFinite && constraints.maxWidth < 120;

        return InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(PremiumRadius.pill),
          child: AnimatedContainer(
            duration: PremiumMotion.normal,
            padding: const EdgeInsets.symmetric(
              horizontal: PremiumSpacing.md,
              vertical: PremiumSpacing.sm,
            ),
            decoration: BoxDecoration(
              gradient: selected
                  ? theme.buttonGradient
                  : LinearGradient(
                      colors: [
                        Colors.white.withValues(
                          alpha: theme.isDark ? 0.02 : 0.52,
                        ),
                        theme.surfaceSecondary,
                      ],
                    ),
              borderRadius: BorderRadius.circular(PremiumRadius.pill),
              border: Border.all(
                color: selected
                    ? Colors.white.withValues(alpha: 0.14)
                    : theme.strokeSoft,
              ),
              boxShadow: selected ? theme.softShadow : null,
            ),
            child: isCompact
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ChipIconBubble(icon: icon, selected: selected),
                      const SizedBox(height: PremiumSpacing.xs),
                      Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: selected ? theme.onAccent : theme.textPrimary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _ChipIconBubble(icon: icon, selected: selected),
                      const SizedBox(width: PremiumSpacing.sm),
                      Flexible(
                        child: Text(
                          label,
                          textAlign: TextAlign.left,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: selected
                                    ? theme.onAccent
                                    : theme.textPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      const SizedBox(width: PremiumSpacing.sm),
                      AnimatedContainer(
                        duration: PremiumMotion.normal,
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: selected
                              ? Colors.white.withValues(alpha: 0.16)
                              : theme.surfacePrimary,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected
                                ? Colors.white.withValues(alpha: 0.14)
                                : theme.strokeSoft,
                          ),
                        ),
                        child: Icon(
                          selected
                              ? Icons.check_rounded
                              : Icons.arrow_forward_rounded,
                          size: 16,
                          color: selected ? theme.onAccent : theme.textMuted,
                        ),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }
}

class _ChipIconBubble extends StatelessWidget {
  const _ChipIconBubble({required this.icon, required this.selected});

  final IconData icon;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: selected
            ? Colors.white.withValues(alpha: 0.14)
            : Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: selected
              ? Colors.white.withValues(alpha: 0.16)
              : theme.strokeSoft,
        ),
      ),
      child: Icon(
        icon,
        color: selected ? theme.onAccent : theme.textPrimary,
        size: 18,
      ),
    );
  }
}
