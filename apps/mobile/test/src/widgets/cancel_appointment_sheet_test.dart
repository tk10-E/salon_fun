import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/widgets/cancel_appointment_sheet.dart';

void main() {
  group('CancelAppointmentSheet', () {
    testWidgets('requires a cancellation reason before submitting', (
      tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: CancelAppointmentSheet(serviceName: 'Hidratação premium'),
          ),
        ),
      );

      await tester.tap(find.text('Confirmar cancelamento'));
      await tester.pump();

      expect(find.text('Informe o motivo para continuar.'), findsOneWidget);
    });

    testWidgets('returns the trimmed cancellation reason to the caller', (
      tester,
    ) async {
      final resultCompleter = Completer<String?>();

      await tester.pumpWidget(
        MaterialApp(home: _CancelSheetHost(onResult: resultCompleter.complete)),
      );
      await tester.pump();
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextField),
        '  Tive um imprevisto no trabalho.  ',
      );
      await tester.tap(find.text('Confirmar cancelamento'));
      await tester.pumpAndSettle();

      expect(await resultCompleter.future, 'Tive um imprevisto no trabalho.');
      expect(find.text('Host route'), findsOneWidget);
    });
  });
}

class _CancelSheetHost extends StatefulWidget {
  const _CancelSheetHost({required this.onResult});

  final ValueChanged<String?> onResult;

  @override
  State<_CancelSheetHost> createState() => _CancelSheetHostState();
}

class _CancelSheetHostState extends State<_CancelSheetHost> {
  bool _didOpen = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didOpen) {
      return;
    }

    _didOpen = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final result = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (context) =>
            const CancelAppointmentSheet(serviceName: 'Hidratação premium'),
      );
      widget.onResult(result);
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Host route')));
  }
}
