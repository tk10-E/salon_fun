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
    this.compact = false,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final int appointmentCount;
  final String? collectionLabel;
  final String? fallbackMessage;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final upcomingCount = appointmentCount;
    final summaryLabel =
        collectionLabel ??
        (upcomingCount == 1
            ? '1 horário salvo no seu histórico'
            : '$upcomingCount horários salvos no seu histórico');
    final padding = compact ? 16.0 : 20.0;
    final markSize = compact ? 48.0 : 58.0;
    final markRadius = compact ? 16.0 : 20.0;
    final summaryBackground = compact
        ? branding.primary.withValues(alpha: 0.09)
        : Colors.white.withValues(alpha: 0.74);

    return SoftCard(
      padding: EdgeInsets.all(padding),
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
            size: markSize,
            borderRadius: markRadius,
          ),
          SizedBox(width: compact ? 12 : 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.salonName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: compact ? 4 : 6),
                Text(
                  profile.salonTagline?.trim().isNotEmpty == true
                      ? profile.salonTagline!
                      : fallbackMessage ??
                            'Seu histórico de cuidados fica salvo aqui, com a cara do seu salão.',
                  maxLines: compact ? 2 : 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: branding.deep.withValues(alpha: 0.82),
                  ),
                ),
                SizedBox(height: compact ? 10 : 12),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: compact ? 10 : 12,
                    vertical: compact ? 6 : 8,
                  ),
                  decoration: BoxDecoration(
                    color: summaryBackground,
                    borderRadius: BorderRadius.circular(compact ? 999 : 14),
                    border: Border.all(
                      color: branding.outline.withValues(
                        alpha: compact ? 0.56 : 0.9,
                      ),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.auto_awesome_rounded,
                        size: compact ? 14 : 16,
                        color: branding.deep.withValues(
                          alpha: compact ? 0.72 : 0.9,
                        ),
                      ),
                      SizedBox(width: compact ? 6 : 8),
                      Flexible(
                        child: Text(
                          summaryLabel,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
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
          ),
        ],
      ),
    );
  }
}
