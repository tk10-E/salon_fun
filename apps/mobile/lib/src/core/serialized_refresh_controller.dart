import 'dart:async';

class SerializedRefreshController {
  SerializedRefreshController(this._task);

  final Future<void> Function() _task;

  Future<void>? _activeRun;
  bool _rerunRequested = false;
  bool _isDisposed = false;

  Future<void> run() {
    if (_isDisposed) {
      return Future.value();
    }

    if (_activeRun != null) {
      _rerunRequested = true;
      return _activeRun!;
    }

    final run = _runLoop();
    _activeRun = run;
    return run;
  }

  void dispose() {
    _isDisposed = true;
  }

  Future<void> _runLoop() async {
    try {
      do {
        _rerunRequested = false;
        await _task();
      } while (_rerunRequested && !_isDisposed);
    } finally {
      _activeRun = null;
    }
  }
}
