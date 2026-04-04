import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/pix_payload.dart';

void main() {
  group('Pix payload', () {
    test('gera um copia e cola com os campos essenciais', () {
      final payload = buildPixCopyPaste(
        pixKey: 'pix@studio.com',
        merchantName: 'Studio Centro',
        merchantCity: 'São Paulo',
        amount: 40,
        description: 'Sinal reserva',
        transactionId: 'appointment-123',
      );

      expect(payload.startsWith('000201'), isTrue);
      expect(payload.contains('BR.GOV.BCB.PIX'), isTrue);
      expect(payload.contains('5303986'), isTrue);
      expect(payload.contains('540540.00'), isTrue);
      expect(payload.contains('5913STUDIO CENTRO'), isTrue);
      expect(payload.contains('6009SAO PAULO'), isTrue);
      expect(payload.substring(payload.length - 8, payload.length - 4), '6304');
      expect(payload.length, greaterThan(40));
    });

    test('normaliza um txid curto e legivel', () {
      expect(buildPixTransactionId('appointment-123'), 'SFAPPOINTMENT123');
    });
  });
}
