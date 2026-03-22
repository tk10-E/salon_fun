import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';

class SalonHighlightCard extends StatelessWidget {
  const SalonHighlightCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.branding,
    this.note,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? note;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: branding.outline.withValues(alpha: 0.72)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x101A120D),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: branding.highlightBackground,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: branding.deep),
          ),
          const SizedBox(height: 18),
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: theme.textTheme.titleLarge?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
          if (note != null) ...[
            const SizedBox(height: 8),
            Text(
              note!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF7D6657),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
