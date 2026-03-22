import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();

    Color background;
    Color foreground;
    String label;

    switch (normalized) {
      case 'confirmed':
        background = const Color(0x1F2E6B4B);
        foreground = const Color(0xFF2E6B4B);
        label = 'Confirmado';
        break;
      case 'completed':
        background = const Color(0x1F325F9B);
        foreground = const Color(0xFF325F9B);
        label = 'Atendido';
        break;
      case 'cancelled':
        background = const Color(0x1FA63B30);
        foreground = const Color(0xFFA63B30);
        label = 'Cancelado';
        break;
      default:
        background = const Color(0x1FA8562D);
        foreground = const Color(0xFFA8562D);
        label = 'Pendente';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
