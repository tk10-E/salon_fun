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
    this.ctaLabel = 'Agendar com este profissional',
    this.isFavorite = false,
    this.favoriteBusy = false,
    this.onToggleFavorite,
  });

  final String name;
  final String specialty;
  final String availabilityLabel;
  final String? ratingLabel;
  final String? imageUrl;
  final VoidCallback? onBook;
  final String ctaLabel;
  final bool isFavorite;
  final bool favoriteBusy;
  final VoidCallback? onToggleFavorite;

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
      padding: EdgeInsets.zero,
      radius: PremiumRadius.cardLarge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              Container(
                height: 210,
                decoration: BoxDecoration(
                  gradient: theme.bannerGradient,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(PremiumRadius.cardLarge),
                  ),
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (imageUrl?.trim().isNotEmpty == true)
                      Image.network(
                        imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const SizedBox.shrink(),
                      ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.black.withValues(alpha: 0.06),
                            Colors.black.withValues(alpha: 0.18),
                            Colors.black.withValues(alpha: 0.52),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                top: PremiumSpacing.md,
                left: PremiumSpacing.md,
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    initials,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              Positioned(
                top: PremiumSpacing.md,
                right: PremiumSpacing.md,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _ProfessionalPill(label: availabilityLabel),
                        if (ratingLabel != null) ...[
                          const SizedBox(height: PremiumSpacing.xs),
                          _ProfessionalPill(label: ratingLabel!),
                        ],
                      ],
                    ),
                    if (onToggleFavorite != null) ...[
                      const SizedBox(width: PremiumSpacing.sm),
                      _FavoriteActionPill(
                        isFavorite: isFavorite,
                        isBusy: favoriteBusy,
                        onTap: favoriteBusy ? null : onToggleFavorite,
                      ),
                    ],
                  ],
                ),
              ),
              Positioned(
                left: PremiumSpacing.md,
                right: PremiumSpacing.md,
                bottom: PremiumSpacing.md,
                child: Container(
                  padding: const EdgeInsets.all(PremiumSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.24),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: PremiumSpacing.xs),
                      Text(
                        specialty,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.84),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(PremiumSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(PremiumSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [theme.surfacePrimary, theme.surfaceSecondary],
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: theme.strokeSoft),
                  ),
                  child: Text(
                    'Especialista com presenca de marca, atendimento consultivo e agenda conectada ao painel do salao.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: theme.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(height: PremiumSpacing.md),
                Wrap(
                  spacing: PremiumSpacing.xs,
                  runSpacing: PremiumSpacing.xs,
                  children: [
                    _MetricChip(label: 'Atendimento signature'),
                    _MetricChip(label: ratingLabel ?? 'Experiencia premium'),
                  ],
                ),
                if (onBook != null) ...[
                  const SizedBox(height: PremiumSpacing.md),
                  Row(
                    children: [
                      if (onToggleFavorite != null)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: favoriteBusy ? null : onToggleFavorite,
                            icon: favoriteBusy
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Icon(
                                    isFavorite
                                        ? Icons.favorite_rounded
                                        : Icons.favorite_border_rounded,
                                    size: 18,
                                  ),
                            label: Text(isFavorite ? 'Favorito' : 'Salvar'),
                          ),
                        ),
                      if (onToggleFavorite != null)
                        const SizedBox(width: PremiumSpacing.sm),
                      Expanded(
                        flex: onToggleFavorite == null ? 1 : 2,
                        child: FilledButton.icon(
                          onPressed: onBook,
                          icon: const Icon(
                            Icons.calendar_month_rounded,
                            size: 18,
                          ),
                          label: Text(ctaLabel),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfessionalPill extends StatelessWidget {
  const _ProfessionalPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _FavoriteActionPill extends StatelessWidget {
  const _FavoriteActionPill({
    required this.isFavorite,
    required this.isBusy,
    this.onTap,
  });

  final bool isFavorite;
  final bool isBusy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: PremiumSpacing.sm,
            vertical: PremiumSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(PremiumRadius.pill),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: isBusy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  isFavorite
                      ? Icons.favorite_rounded
                      : Icons.favorite_border_rounded,
                  color: Colors.white,
                  size: 18,
                ),
        ),
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
