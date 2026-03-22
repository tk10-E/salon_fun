import 'package:flutter/material.dart';

class CancelAppointmentSheet extends StatefulWidget {
  const CancelAppointmentSheet({super.key, required this.serviceName});

  final String serviceName;

  @override
  State<CancelAppointmentSheet> createState() => _CancelAppointmentSheetState();
}

class _CancelAppointmentSheetState extends State<CancelAppointmentSheet> {
  final _controller = TextEditingController();
  bool _submitted = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    final reason = _controller.text.trim();
    setState(() => _submitted = true);

    if (reason.isEmpty) {
      return;
    }

    Navigator.of(context).pop(reason);
  }

  @override
  Widget build(BuildContext context) {
    final hasError = _submitted && _controller.text.trim().isEmpty;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 8,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Desmarcar horário',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Conte ao salão por que você não vai conseguir comparecer ao atendimento de ${widget.serviceName}.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _controller,
              maxLength: 300,
              maxLines: 4,
              decoration: InputDecoration(
                labelText: 'Motivo do cancelamento',
                hintText:
                    'Ex.: tive um imprevisto no trabalho e não vou conseguir chegar a tempo.',
                errorText: hasError ? 'Informe o motivo para continuar.' : null,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _submit,
                child: const Text('Confirmar cancelamento'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
