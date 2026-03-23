import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../premium_service_card.dart';

class HomeServicesGrid extends StatelessWidget {
  const HomeServicesGrid({
    super.key,
    required this.branding,
    required this.services,
    required this.onBook,
    this.favoriteServiceIds = const <String>{},
    this.busyFavoriteServiceIds = const <String>{},
    this.onToggleFavorite,
  });

  final SalonBranding branding;
  final List<ServiceItem> services;
  final Future<void> Function(ServiceItem service) onBook;
  final Set<String> favoriteServiceIds;
  final Set<String> busyFavoriteServiceIds;
  final Future<void> Function(ServiceItem service)? onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1080
            ? 3
            : constraints.maxWidth >= 720
            ? 2
            : 1;
        final spacing = 16.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: services
              .map(
                (service) => SizedBox(
                  width: width,
                  child: PremiumServiceCard(
                    service: service,
                    branding: branding,
                    onBook: () => onBook(service),
                    isFavorite: favoriteServiceIds.contains(service.id),
                    favoriteBusy: busyFavoriteServiceIds.contains(service.id),
                    onToggleFavorite: onToggleFavorite == null
                        ? null
                        : () => onToggleFavorite!(service),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}
