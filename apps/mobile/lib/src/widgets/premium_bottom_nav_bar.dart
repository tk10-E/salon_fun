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
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: theme.strokeSoft),
        boxShadow: theme.strongShadow,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: PremiumSpacing.xs,
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
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: PremiumMotion.normal,
        padding: const EdgeInsets.symmetric(vertical: PremiumSpacing.sm),
        decoration: BoxDecoration(
          gradient: selected ? theme.buttonGradient : null,
          color: selected ? null : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
          boxShadow: selected ? theme.softShadow : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              item.icon,
              color: selected ? theme.onAccent : theme.textMuted,
              size: selected ? 23 : 21,
            ),
            const SizedBox(height: 6),
            Text(
              item.label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: selected ? theme.onAccent : theme.textMuted,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
