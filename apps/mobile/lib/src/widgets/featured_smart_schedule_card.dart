import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class FeaturedSmartScheduleCard extends StatelessWidget {
  const FeaturedSmartScheduleCard({
    super.key,
    required this.suggestion,
    required this.branding,
    required this.onBook,
  });

  final SmartScheduleSuggestionItem suggestion;
  final SalonBranding branding;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final suggestedService = suggestion.suggestedService;

    return SoftCard(
      padding: const EdgeInsets.all(22),
      borderColor: branding.outline.withValues(alpha: 0.78),
      gradient: LinearGradient(
        colors: [
          branding.primary.withValues(alpha: 0.18),
          branding.primary.withValues(alpha: 0.08),
          Colors.white.withValues(alpha: 0.98),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(Icons.bolt_rounded, color: branding.deep),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Melhor horário para hoje',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      suggestion.headline,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF2F231C),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            suggestion.detail,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.5,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _FeaturedInfoChip(
                icon: Icons.schedule_rounded,
                label:
                    '${suggestion.suggestedStartLabel} às ${suggestion.suggestedEndLabel}',
                branding: branding,
              ),
              _FeaturedInfoChip(
                icon: Icons.person_outline_rounded,
                label: suggestion.staffMemberName,
                branding: branding,
              ),
              _FeaturedInfoChip(
                icon: Icons.timer_outlined,
                label: '${suggestion.gapMinutes} min livres',
                branding: branding,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.56),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestedService.name,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  [
                    if ((suggestedService.category ?? '').trim().isNotEmpty)
                      suggestedService.category!,
                    '${suggestedService.duration} min',
                    if (suggestedService.price != null)
                      currency.format(suggestedService.price),
                  ].join(' • '),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onBook,
              icon: const Icon(Icons.event_available_rounded),
              label: const Text('Agendar esse horário'),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeaturedInfoChip extends StatelessWidget {
  const _FeaturedInfoChip({
    required this.icon,
    required this.label,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: branding.outline.withValues(alpha: 0.48)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
