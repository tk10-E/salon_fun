import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../soft_card.dart';
import '../status_badge.dart';

class HomeAppointmentCard extends StatelessWidget {
  const HomeAppointmentCard({
    super.key,
    required this.appointment,
    required this.branding,
    required this.onCancelAppointment,
    required this.onConfirmAppointmentPresence,
  });

  final AppointmentItem appointment;
  final SalonBranding branding;
  final Future<void> Function(AppointmentItem appointment) onCancelAppointment;
  final Future<void> Function(AppointmentItem appointment)
  onConfirmAppointmentPresence;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm');
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final timelineLabel =
        '${dateFormat.format(appointment.date)} • ${timeFormat.format(appointment.date)}';
    final accentColor = switch (appointment.status) {
      'completed' => const Color(0xFF2E6B4B),
      'cancelled' => const Color(0xFF8F5A47),
      _ => branding.primary.withValues(alpha: 0.84),
    };

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline.withValues(alpha: 0.58),
      backgroundColor: const Color(0xFFFFFEFC),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
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
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            appointment.serviceName,
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7EFE7),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.34),
                              ),
                            ),
                            child: Text(
                              timelineLabel,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: branding.deep,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    StatusBadge(status: appointment.status),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _HomeHistoryMetaChip(
                      icon: Icons.schedule_rounded,
                      label: '${appointment.serviceDuration} min',
                      backgroundColor: branding.highlightBackground.withValues(
                        alpha: 0.8,
                      ),
                      foregroundColor: branding.deep,
                    ),
                    _HomeHistoryMetaChip(
                      icon: Icons.sell_rounded,
                      label: currency.format(appointment.servicePrice),
                      backgroundColor: const Color(0xFFF8F1E8),
                      foregroundColor: const Color(0xFF7D4E30),
                    ),
                    if (appointment.staffMemberName != null)
                      _HomeHistoryMetaChip(
                        icon: Icons.person_rounded,
                        label: appointment.staffMemberName!,
                        backgroundColor: const Color(0xFFF8F2EC),
                        foregroundColor: const Color(0xFF6F4A32),
                      ),
                  ],
                ),
                if (appointment.status == 'cancelled' &&
                    appointment.cancellationReason != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    'Motivo informado: ${appointment.cancellationReason}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF7D6657),
                    ),
                  ),
                ],
                if (appointment.status == 'cancelled' &&
                    appointment.cancelledBy != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    appointment.cancelledBy == 'customer'
                        ? 'Cancelamento enviado por você ao salão.'
                        : appointment.cancelledBy == 'system'
                        ? 'Esse horário foi liberado automaticamente porque a presença não foi confirmada a tempo.'
                        : 'Esse horário foi cancelado pelo salão.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF8B7366),
                    ),
                  ),
                ],
                if (appointment.status == 'completed' &&
                    appointment.completedAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Atendimento concluído em ${dateFormat.format(appointment.completedAt!)} às ${timeFormat.format(appointment.completedAt!)}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF587091),
                    ),
                  ),
                ],
                if (appointment.customerPresenceConfirmedAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Presença confirmada em ${dateFormat.format(appointment.customerPresenceConfirmedAt!)} às ${timeFormat.format(appointment.customerPresenceConfirmedAt!)}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF2E6B4B),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if (appointment.requiresPresenceConfirmation) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F1E8),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE7D6C4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Confirme sua presença para manter esse horário',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF2F231C),
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'O salão pediu sua confirmação final. Se você não puder comparecer, cancele agora para liberar a agenda.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: const Color(0xFF765E4E)),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            FilledButton.icon(
                              onPressed: () =>
                                  onConfirmAppointmentPresence(appointment),
                              icon: const Icon(Icons.verified_user_rounded),
                              label: const Text('Confirmar presença'),
                            ),
                            OutlinedButton.icon(
                              onPressed: () => onCancelAppointment(appointment),
                              icon: const Icon(Icons.event_busy_rounded),
                              label: const Text('Cancelar horário'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ] else if (appointment.canBeCancelled) ...[
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => onCancelAppointment(appointment),
                      icon: const Icon(Icons.event_busy_rounded, size: 18),
                      label: const Text('Desmarcar horário'),
                    ),
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

class _HomeHistoryMetaChip extends StatelessWidget {
  const _HomeHistoryMetaChip({
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
