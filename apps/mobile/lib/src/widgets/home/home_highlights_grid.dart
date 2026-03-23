import 'package:flutter/material.dart';

import '../../theme/salon_branding.dart';
import '../salon_highlight_card.dart';

class HomeHighlightsGrid extends StatelessWidget {
  const HomeHighlightsGrid({
    super.key,
    required this.branding,
    required this.nextAvailableLabel,
    required this.serviceCount,
    required this.todayAttendanceLabel,
  });

  final SalonBranding branding;
  final String nextAvailableLabel;
  final int serviceCount;
  final String todayAttendanceLabel;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 860
            ? 3
            : constraints.maxWidth >= 520
            ? 2
            : 1;
        final spacing = 14.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.schedule_rounded,
                label: 'Próximo horário disponível',
                value: nextAvailableLabel,
                note: 'Se fizer sentido para você, já dá para reservar pelo app',
                branding: branding,
              ),
            ),
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.auto_awesome_rounded,
                label: 'Serviços do salão',
                value: serviceCount == 1
                    ? '1 serviço'
                    : '$serviceCount serviços',
                note: 'Preço visível e escolha sem atrito',
                branding: branding,
              ),
            ),
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.today_rounded,
                label: 'Atendimento hoje',
                value: todayAttendanceLabel,
                note: 'Sua relação com o salão em um olhar',
                branding: branding,
              ),
            ),
          ],
        );
      },
    );
  }
}
