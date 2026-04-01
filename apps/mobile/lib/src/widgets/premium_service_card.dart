import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import '../theme/tenant_theme.dart';
import 'premium_surface_card.dart';

class PremiumServiceCard extends StatelessWidget {
  const PremiumServiceCard({
    super.key,
    required this.service,
    required this.branding,
    required this.onBook,
    this.isFavorite = false,
    this.favoriteBusy = false,
    this.onToggleFavorite,
    this.onExplore,
  });

  final ServiceItem service;
  final SalonBranding branding;
  final VoidCallback onBook;
  final bool isFavorite;
  final bool favoriteBusy;
  final VoidCallback? onToggleFavorite;
  final VoidCallback? onExplore;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;
    final materialTheme = Theme.of(context);
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final serviceVisual = resolveServiceCategoryVisual(
      category: service.category,
      name: service.name,
    );

    return PremiumSurfaceCard(
      padding: EdgeInsets.zero,
      tone: PremiumSurfaceTone.secondary,
      onTap: onExplore,
      radius: PremiumRadius.cardLarge,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(PremiumRadius.cardLarge),
                ),
                child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: service.imageUrl?.trim().isNotEmpty == true
                      ? Image.network(
                          service.imageUrl!,
                          fit: BoxFit.cover,
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) {
                              return child;
                            }

                            return _ServiceVisualFallback(branding: branding);
                          },
                          errorBuilder: (_, _, _) =>
                              _ServiceVisualFallback(branding: branding),
                        )
                      : _ServiceVisualFallback(branding: branding),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(PremiumRadius.cardLarge),
                    ),
                    gradient: LinearGradient(
                      colors: [
                        Colors.black.withValues(alpha: 0.04),
                        Colors.black.withValues(alpha: 0.22),
                        Colors.black.withValues(alpha: 0.62),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
              ),
              if (service.category?.trim().isNotEmpty == true)
                Positioned(
                  top: PremiumSpacing.md,
                  left: PremiumSpacing.md,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: PremiumSpacing.sm,
                      vertical: PremiumSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(PremiumRadius.pill),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.14),
                      ),
                    ),
                    child: Text(
                      service.category!,
                      style: materialTheme.textTheme.labelSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              if (onToggleFavorite != null)
                Positioned(
                  top: PremiumSpacing.sm,
                  right: PremiumSpacing.sm,
                  child: IconButton.filledTonal(
                    onPressed: favoriteBusy ? null : onToggleFavorite,
                    tooltip: isFavorite
                        ? 'Remover dos favoritos'
                        : 'Salvar nos favoritos',
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.16),
                      foregroundColor: Colors.white,
                    ),
                    icon: favoriteBusy
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Icon(
                            isFavorite
                                ? Icons.favorite_rounded
                                : Icons.favorite_border_rounded,
                          ),
                  ),
                ),
              Positioned(
                left: PremiumSpacing.md,
                right: PremiumSpacing.md,
                bottom: PremiumSpacing.md,
                child: Container(
                  padding: const EdgeInsets.all(PremiumSpacing.md),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.26),
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.14),
                              ),
                            ),
                            child: Icon(
                              serviceVisual.icon,
                              color: Colors.white,
                              size: 26,
                            ),
                          ),
                          const SizedBox(width: PremiumSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  service.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: materialTheme.textTheme.titleLarge
                                      ?.copyWith(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                      ),
                                ),
                                const SizedBox(height: PremiumSpacing.xs),
                                Text(
                                  service.description?.trim().isNotEmpty == true
                                      ? service.description!
                                      : serviceVisual.fallbackDescription,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: materialTheme.textTheme.bodySmall
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.8,
                                        ),
                                      ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: PremiumSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: PremiumSpacing.md,
                              vertical: PremiumSpacing.sm,
                            ),
                            decoration: BoxDecoration(
                              gradient: theme.buttonGradient,
                              borderRadius: BorderRadius.circular(22),
                              boxShadow: theme.softShadow,
                            ),
                            child: Text(
                              currency.format(service.price),
                              style: materialTheme.textTheme.labelLarge
                                  ?.copyWith(
                                    color: theme.onAccent,
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: PremiumSpacing.sm),
                      Wrap(
                        spacing: PremiumSpacing.sm,
                        runSpacing: PremiumSpacing.sm,
                        children: [
                          _ServiceSpotlightChip(
                            icon: Icons.schedule_rounded,
                            label: '${service.duration} min',
                          ),
                          _ServiceSpotlightChip(
                            icon: Icons.auto_awesome_rounded,
                            label: service.category?.trim().isNotEmpty == true
                                ? service.category!
                                : 'Experiencia premium',
                          ),
                        ],
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
                          color: theme.surfaceAccent,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: theme.strokeSoft),
                        ),
                        child: Icon(
                          serviceVisual.icon,
                          color: theme.textPrimary,
                        ),
                      ),
                      const SizedBox(width: PremiumSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Ritual selecionado',
                              style: materialTheme.textTheme.labelMedium
                                  ?.copyWith(
                                    color: theme.textMuted,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const SizedBox(height: PremiumSpacing.xs),
                            Text(
                              'Atendimento pensado para encaixar no seu ritmo, com tempo reservado e experiencia mais premium.',
                              style: materialTheme.textTheme.bodyMedium
                                  ?.copyWith(color: theme.textSecondary),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: PremiumSpacing.lg),
                Wrap(
                  spacing: PremiumSpacing.sm,
                  runSpacing: PremiumSpacing.sm,
                  children: [
                    _ServiceMetaChip(
                      icon: Icons.schedule_rounded,
                      label: '${service.duration} min',
                      backgroundColor: theme.surfacePrimary,
                      foregroundColor: theme.textPrimary,
                    ),
                    _ServiceMetaChip(
                      icon: Icons.workspace_premium_rounded,
                      label: isFavorite
                          ? 'Favorito do seu perfil'
                          : 'Agenda inteligente',
                      backgroundColor: theme.surfacePrimary,
                      foregroundColor: theme.textPrimary,
                    ),
                  ],
                ),
                if (isFavorite) ...[
                  const SizedBox(height: PremiumSpacing.sm),
                  Text(
                    'Salvo nos seus favoritos para acelerar a proxima reserva.',
                    style: materialTheme.textTheme.bodySmall?.copyWith(
                      color: theme.textMuted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: PremiumSpacing.lg),
                Row(
                  children: [
                    if (onExplore != null) ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: onExplore,
                          icon: const Icon(Icons.visibility_outlined, size: 18),
                          label: const Text('Ver ritual'),
                        ),
                      ),
                      const SizedBox(width: PremiumSpacing.sm),
                    ],
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onBook,
                        icon: const Icon(
                          Icons.calendar_month_rounded,
                          size: 18,
                        ),
                        label: const Text('Reservar horario'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceSpotlightChip extends StatelessWidget {
  const _ServiceSpotlightChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: PremiumSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ServiceVisualFallback extends StatelessWidget {
  const _ServiceVisualFallback({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [branding.deep, branding.primary, branding.soft],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Container(
          width: 68,
          height: 68,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Icon(
            Icons.auto_awesome_rounded,
            color: Colors.white,
            size: 34,
          ),
        ),
      ),
    );
  }
}

class _ServiceMetaChip extends StatelessWidget {
  const _ServiceMetaChip({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: foregroundColor.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: foregroundColor),
          const SizedBox(width: PremiumSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
