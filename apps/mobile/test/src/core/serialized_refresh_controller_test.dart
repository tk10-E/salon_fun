import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/serialized_refresh_controller.dart';

void main() {
  test('coalesces overlapping refreshes into one rerun', () async {
    final starts = <int>[];
    final completers = <Completer<void>>[];

    final controller = SerializedRefreshController(() async {
      starts.add(starts.length + 1);
      final completer = Completer<void>();
      completers.add(completer);
      await completer.future;
    });

    final firstRun = controller.run();
    final secondRun = controller.run();
    final thirdRun = controller.run();

    expect(starts, [1]);

    completers.first.complete();
    await Future<void>.delayed(Duration.zero);

    expect(starts, [1, 2]);

    completers.last.complete();
    await Future.wait([firstRun, secondRun, thirdRun]);

    expect(starts, [1, 2]);
  });
}
