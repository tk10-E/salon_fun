import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class SalonOfferCard extends StatelessWidget {
  const SalonOfferCard({
    super.key,
    required this.offer,
    required this.branding,
  });

  final SalonOfferItem offer;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final title = offer.isMembership ? 'Plano mensal' : 'Promoção';

    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: branding.outline.withValues(alpha: 0.72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: branding.highlightBackground,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  title,
                  style: theme.textTheme.labelLarge?.copyWith(
                    color: branding.deep,
                  ),
                ),
              ),
              const Spacer(),
              if (offer.price != null)
                Text(
                  currency.format(offer.price),
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w900,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            offer.title,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          if (offer.highlightText?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 10),
            Text(
              offer.highlightText!,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: branding.deep,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          if (offer.description?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            Text(
              offer.description!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF7A6658),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.72),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: branding.outline.withValues(alpha: 0.55)),
            ),
            child: Row(
              children: [
                Icon(Icons.event_available_rounded, color: branding.deep),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _buildPeriodLabel(),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w700,
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

  String _buildPeriodLabel() {
    final formatter = DateFormat('dd/MM');

    if (offer.startsOn == null && offer.endsOn == null) {
      return 'Disponível enquanto a campanha estiver ativa.';
    }

    if (offer.startsOn != null && offer.endsOn != null) {
      return 'Válida de ${formatter.format(offer.startsOn!)} até ${formatter.format(offer.endsOn!)}.';
    }

    if (offer.startsOn != null) {
      return 'Disponível a partir de ${formatter.format(offer.startsOn!)}.';
    }

    return 'Disponível até ${formatter.format(offer.endsOn!)}.';
  }
}
