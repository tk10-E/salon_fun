import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/service_category_visual.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class PremiumServiceCard extends StatelessWidget {
  const PremiumServiceCard({
    super.key,
    required this.service,
    required this.branding,
    required this.onBook,
    this.isFavorite = false,
    this.favoriteBusy = false,
    this.onToggleFavorite,
  });

  final ServiceItem service;
  final SalonBranding branding;
  final VoidCallback onBook;
  final bool isFavorite;
  final bool favoriteBusy;
  final VoidCallback? onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final serviceVisual = resolveServiceCategoryVisual(
      category: service.category,
      name: service.name,
    );

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline.withValues(alpha: 0.74),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
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
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(serviceVisual.icon, color: branding.deep),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (service.category != null &&
                              service.category!.trim().isNotEmpty) ...[
                            Text(
                              service.category!,
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: branding.deep.withValues(alpha: 0.74),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                          ],
                          Text(
                            service.name,
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (onToggleFavorite != null)
                      IconButton(
                        onPressed: favoriteBusy ? null : onToggleFavorite,
                        tooltip: isFavorite
                            ? 'Remover dos favoritos'
                            : 'Salvar nos favoritos',
                        icon: favoriteBusy
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(
                                isFavorite
                                    ? Icons.favorite_rounded
                                    : Icons.favorite_border_rounded,
                                color: isFavorite
                                    ? const Color(0xFFC56B43)
                                    : branding.deep,
                              ),
                      ),
                  ],
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _ServiceMetaChip(
                      icon: Icons.schedule_rounded,
                      label: '${service.duration} min',
                      backgroundColor: branding.highlightBackground,
                      foregroundColor: branding.deep,
                    ),
                    _ServiceMetaChip(
                      icon: Icons.sell_rounded,
                      label: currency.format(service.price),
                      backgroundColor: const Color(0xFFF9F4EE),
                      foregroundColor: const Color(0xFF7A4A2B),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  service.description?.trim().isNotEmpty == true
                      ? service.description!
                      : serviceVisual.fallbackDescription,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF7D6657),
                  ),
                ),
                if (isFavorite) ...[
                  const SizedBox(height: 10),
                  Text(
                    'Salvo nos seus favoritos para facilitar o próximo agendamento.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF8E441F),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onBook,
                    style: FilledButton.styleFrom(
                      backgroundColor: branding.primary,
                    ),
                    icon: const Icon(Icons.calendar_month_rounded, size: 18),
                    label: const Text('Agendar'),
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

class _ServiceVisualFallback extends StatelessWidget {
  const _ServiceVisualFallback({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foregroundColor.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: foregroundColor),
          const SizedBox(width: 8),
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
