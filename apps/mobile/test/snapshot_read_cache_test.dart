import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/core/network/snapshot_read_cache.dart';

void main() {
  tearDown(() {
    SnapshotReadCache.observer = null;
  });

  test('reports slow network misses through the cache observer', () async {
    final cache = SnapshotReadCache();
    final observations = <SnapshotReadObservation>[];
    SnapshotReadCache.observer = observations.add;

    final result = await cache.read<String>(
      key: 'store:catalog',
      ttl: const Duration(minutes: 1),
      loader: () async => 'ok',
    );

    expect(result, 'ok');
    expect(observations, hasLength(1));
    expect(observations.first.key, 'store:catalog');
    expect(observations.first.outcome, SnapshotReadOutcome.loaded);
  });

  test('does not report cache hits again', () async {
    final cache = SnapshotReadCache();
    final observations = <SnapshotReadObservation>[];
    SnapshotReadCache.observer = observations.add;

    await cache.read<String>(
      key: 'feed:stories',
      ttl: const Duration(minutes: 1),
      loader: () async => 'first',
    );

    await cache.read<String>(
      key: 'feed:stories',
      ttl: const Duration(minutes: 1),
      loader: () async => 'second',
    );

    expect(observations, hasLength(1));
  });
}
