import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class VacancyAlertCard extends StatelessWidget {
  const VacancyAlertCard({
    super.key,
    required this.alert,
    required this.branding,
    this.onBook,
    this.isBooking = false,
    this.isBooked = false,
  });

  final VacancyAlert alert;
  final SalonBranding branding;
  final VoidCallback? onBook;
  final bool isBooking;
  final bool isBooked;

  @override
  Widget build(BuildContext context) {
    final scheduleLabel =
        '${DateFormat('dd/MM').format(alert.startsAt)} • ${DateFormat('HH:mm').format(alert.startsAt)}';

    return SoftCard(
      borderColor: branding.outline.withValues(alpha: 0.7),
      gradient: LinearGradient(
        colors: [branding.soft.withValues(alpha: 0.26), Colors.white],
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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: branding.highlightBackground,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.notifications_active_rounded,
                  color: branding.deep,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.headline,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      alert.body,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _VacancyMetaChip(
                icon: Icons.event_available_rounded,
                label: scheduleLabel,
                backgroundColor: branding.highlightBackground,
                foregroundColor: branding.deep,
              ),
              _VacancyMetaChip(
                icon: Icons.bolt_rounded,
                label: 'Vaga liberada agora',
                backgroundColor: const Color(0xFFF7F0E7),
                foregroundColor: const Color(0xFF7A4A2B),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (isBooked)
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: null,
                icon: const Icon(Icons.check_circle_rounded),
                label: const Text('Horário marcado'),
                style: FilledButton.styleFrom(
                  disabledBackgroundColor: const Color(0xFF5D8B69),
                  disabledForegroundColor: Colors.white,
                ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isBooking ? null : onBook,
                icon: isBooking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.event_available_rounded),
                label: Text(
                  isBooking ? 'Marcando horário...' : 'Marcar esse horário',
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _VacancyMetaChip extends StatelessWidget {
  const _VacancyMetaChip({
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: foregroundColor),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
