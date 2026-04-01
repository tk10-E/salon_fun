import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

class PremiumBottomNavItemData {
  const PremiumBottomNavItemData({required this.label, required this.icon});

  final String label;
  final IconData icon;
}

class PremiumBottomNavBar extends StatelessWidget {
  const PremiumBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.items,
    required this.onTap,
  });

  final int currentIndex;
  final List<PremiumBottomNavItemData> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: theme.navGradient,
        borderRadius: BorderRadius.circular(36),
        border: Border.all(color: theme.strokeSoft),
        boxShadow: theme.strongShadow,
      ),
      child: Stack(
        children: [
          Positioned(
            left: 28,
            right: 28,
            top: 0,
            child: IgnorePointer(
              child: Container(
                height: 4,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(PremiumRadius.pill),
                  gradient: LinearGradient(
                    colors: [
                      theme.accent.withValues(alpha: 0),
                      theme.accent.withValues(alpha: 0.5),
                      theme.accent.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: PremiumSpacing.sm,
              vertical: PremiumSpacing.xs,
            ),
            child: Row(
              children: [
                for (var index = 0; index < items.length; index++)
                  Expanded(
                    child: _NavItem(
                      item: items[index],
                      selected: index == currentIndex,
                      onTap: () => onTap(index),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final PremiumBottomNavItemData item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(30),
      child: AnimatedContainer(
        duration: PremiumMotion.normal,
        padding: const EdgeInsets.symmetric(
          vertical: PremiumSpacing.sm,
          horizontal: PremiumSpacing.sm,
        ),
        decoration: BoxDecoration(
          gradient: selected
              ? theme.buttonGradient
              : LinearGradient(
                  colors: [
                    Colors.transparent,
                    Colors.white.withValues(alpha: 0.04),
                  ],
                ),
          color: selected ? null : Colors.transparent,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(
            color: selected
                ? Colors.white.withValues(alpha: 0.14)
                : Colors.transparent,
          ),
          boxShadow: selected ? theme.softShadow : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: selected ? 42 : 40,
              height: selected ? 42 : 40,
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withValues(alpha: 0.14)
                    : theme.surfacePrimary.withValues(alpha: 0.88),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: selected
                      ? Colors.white.withValues(alpha: 0.16)
                      : theme.strokeSoft,
                ),
              ),
              child: Icon(
                item.icon,
                color: selected ? theme.onAccent : theme.textMuted,
                size: selected ? 22 : 20,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              item.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? theme.onAccent : theme.textMuted,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: PremiumMotion.normal,
              width: selected ? 22 : 8,
              height: 3,
              decoration: BoxDecoration(
                color: selected
                    ? Colors.white.withValues(alpha: 0.92)
                    : theme.strokeSoft,
                borderRadius: BorderRadius.circular(PremiumRadius.pill),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
