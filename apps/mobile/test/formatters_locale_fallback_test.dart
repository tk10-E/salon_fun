import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/formatters.dart';

void main() {
  test('formatadores nao quebram sem inicializacao explicita do locale', () {
    final reference = DateTime(2026, 4, 5, 14, 30);

    expect(() => formatShortDate(reference), returnsNormally);
    expect(() => formatMediumDate(reference), returnsNormally);
    expect(() => formatLongDate(reference), returnsNormally);
    expect(() => formatDateTime(reference), returnsNormally);
    expect(() => formatTime(reference), returnsNormally);
    expect(() => formatOfferLifecycle(reference, reference), returnsNormally);
    expect(
      () => formatRelativeFreshness(
        DateTime.now().subtract(const Duration(days: 3)),
      ),
      returnsNormally,
    );
  });

  test('formatadores sempre devolvem texto util para o shell', () {
    final reference = DateTime(2026, 4, 5, 14, 30);

    expect(formatShortDate(reference), isNotEmpty);
    expect(formatMediumDate(reference), isNotEmpty);
    expect(formatLongDate(reference), isNotEmpty);
    expect(formatDateTime(reference), isNotEmpty);
    expect(formatTime(reference), '14:30');
    expect(formatOfferLifecycle(reference, null), isNotEmpty);
  });
}
