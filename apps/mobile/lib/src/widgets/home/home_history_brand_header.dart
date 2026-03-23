import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../salon_brand_mark.dart';
import '../soft_card.dart';

class HomeHistoryBrandHeader extends StatelessWidget {
  const HomeHistoryBrandHeader({
    super.key,
    required this.profile,
    required this.branding,
    required this.appointmentCount,
    this.collectionLabel,
    this.fallbackMessage,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final int appointmentCount;
  final String? collectionLabel;
  final String? fallbackMessage;

  @override
  Widget build(BuildContext context) {
    final upcomingCount = appointmentCount;
    final summaryLabel =
        collectionLabel ??
        (upcomingCount == 1
            ? '1 horário salvo no seu histórico'
            : '$upcomingCount horários salvos no seu histórico');

    return SoftCard(
      padding: const EdgeInsets.all(20),
      gradient: LinearGradient(
        colors: [
          branding.surface,
          Color.lerp(branding.soft, Colors.white, 0.2)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SalonBrandMark(
            salonName: profile.salonName,
            logoUrl: profile.salonLogoUrl,
            branding: branding,
            size: 58,
            borderRadius: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.salonName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: branding.deep),
                ),
                const SizedBox(height: 6),
                Text(
                  profile.salonTagline?.trim().isNotEmpty == true
                      ? profile.salonTagline!
                      : fallbackMessage ??
                            'Seu histórico de cuidados fica salvo aqui, com a cara do seu salão.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: branding.deep.withValues(alpha: 0.82),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.74),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: branding.outline.withValues(alpha: 0.9),
                    ),
                  ),
                  child: Text(
                    summaryLabel,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w800,
                    ),
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
