import 'dart:async';

typedef SnapshotReadCacheObserver =
    void Function(SnapshotReadObservation observation);

class SnapshotReadCache {
  static SnapshotReadCacheObserver? observer;

  final Map<String, _SnapshotReadCacheEntry<Object?>> _entries =
      <String, _SnapshotReadCacheEntry<Object?>>{};
  final Map<String, Future<Object?>> _inFlight = <String, Future<Object?>>{};

  Future<T> read<T>({
    required String key,
    required Future<T> Function() loader,
    required Duration ttl,
    bool bypassCache = false,
  }) async {
    final now = DateTime.now();

    if (!bypassCache) {
      final cachedEntry = _entries[key];
      if (cachedEntry != null && cachedEntry.expiresAt.isAfter(now)) {
        return cachedEntry.value as T;
      }

      final inFlight = _inFlight[key];
      if (inFlight != null) {
        return await inFlight as T;
      }
    }

    final stopwatch = Stopwatch()..start();
    final future = loader()
        .then<Object?>((value) {
          stopwatch.stop();
          if (ttl > Duration.zero) {
            _entries[key] = _SnapshotReadCacheEntry<Object?>(
              expiresAt: DateTime.now().add(ttl),
              value: value,
            );
          } else {
            _entries.remove(key);
          }

          observer?.call(
            SnapshotReadObservation(
              bypassCache: bypassCache,
              duration: stopwatch.elapsed,
              key: key,
              outcome: SnapshotReadOutcome.loaded,
            ),
          );
          return value;
        })
        .catchError((Object error) {
          stopwatch.stop();
          observer?.call(
            SnapshotReadObservation(
              bypassCache: bypassCache,
              duration: stopwatch.elapsed,
              errorType: error.runtimeType.toString(),
              key: key,
              outcome: SnapshotReadOutcome.failed,
            ),
          );
          throw error;
        });

    _inFlight[key] = future;

    try {
      return await future as T;
    } finally {
      if (identical(_inFlight[key], future)) {
        _inFlight.remove(key);
      }
    }
  }

  void invalidate(String key) {
    _entries.remove(key);
  }

  void invalidatePrefix(String prefix) {
    final matchingKeys = _entries.keys
        .where((key) => key.startsWith(prefix))
        .toList(growable: false);
    for (final key in matchingKeys) {
      _entries.remove(key);
    }
  }

  void clear() {
    _entries.clear();
  }
}

enum SnapshotReadOutcome { loaded, failed }

class SnapshotReadObservation {
  const SnapshotReadObservation({
    required this.bypassCache,
    required this.duration,
    this.errorType,
    required this.key,
    required this.outcome,
  });

  final bool bypassCache;
  final Duration duration;
  final String? errorType;
  final String key;
  final SnapshotReadOutcome outcome;
}

class _SnapshotReadCacheEntry<T> {
  const _SnapshotReadCacheEntry({required this.expiresAt, required this.value});

  final DateTime expiresAt;
  final T value;
}
