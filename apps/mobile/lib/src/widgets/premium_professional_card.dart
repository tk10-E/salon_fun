import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumProfessionalCard extends StatelessWidget {
  const PremiumProfessionalCard({
    super.key,
    required this.name,
    required this.specialty,
    required this.availabilityLabel,
    this.ratingLabel,
    this.imageUrl,
    this.onBook,
  });

  final String name;
  final String specialty;
  final String availabilityLabel;
  final String? ratingLabel;
  final String? imageUrl;
  final VoidCallback? onBook;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;
    final initials = name
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part.substring(0, 1).toUpperCase())
        .join();

    return PremiumSurfaceCard(
      tone: PremiumSurfaceTone.secondary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  gradient: theme.bannerGradient,
                  borderRadius: BorderRadius.circular(20),
                ),
                clipBehavior: Clip.antiAlias,
                child: imageUrl?.trim().isNotEmpty == true
                    ? Image.network(
                        imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Center(
                          child: Text(
                            initials,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: theme.textPrimary,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          initials,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: theme.textPrimary,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                      ),
              ),
              const SizedBox(width: PremiumSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: theme.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: PremiumSpacing.xs),
                    Text(
                      specialty,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: theme.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: PremiumSpacing.md),
          Wrap(
            spacing: PremiumSpacing.xs,
            runSpacing: PremiumSpacing.xs,
            children: [
              _MetricChip(label: availabilityLabel),
              if (ratingLabel != null) _MetricChip(label: ratingLabel!),
            ],
          ),
          if (onBook != null) ...[
            const SizedBox(height: PremiumSpacing.md),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onBook,
                child: const Text('Agendar com este profissional'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: theme.surfacePrimary,
        borderRadius: BorderRadius.circular(PremiumRadius.chip),
        border: Border.all(color: theme.strokeSoft),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: theme.textSecondary),
      ),
    );
  }
}
