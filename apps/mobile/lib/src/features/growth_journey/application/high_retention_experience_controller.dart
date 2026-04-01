import 'package:flutter/foundation.dart';

import '../domain/growth_journey_models.dart';
import '../domain/high_retention_experience_models.dart';
import 'high_retention_experience_builder.dart';

abstract class HighRetentionSnapshotSource {
  Future<GrowthJourneySnapshot> load();
}

sealed class HighRetentionExperienceState {
  const HighRetentionExperienceState();
}

class HighRetentionExperienceLoading extends HighRetentionExperienceState {
  const HighRetentionExperienceLoading();
}

class HighRetentionExperienceReady extends HighRetentionExperienceState {
  const HighRetentionExperienceReady(this.model);

  final HighRetentionExperienceModel model;
}

class HighRetentionExperienceError extends HighRetentionExperienceState {
  const HighRetentionExperienceError(this.message);

  final String message;
}

class HighRetentionExperienceController extends ChangeNotifier {
  HighRetentionExperienceController({
    required this.source,
    this.builder = const HighRetentionExperienceBuilder(),
  }) : _state = const HighRetentionExperienceLoading();

  final HighRetentionSnapshotSource source;
  final HighRetentionExperienceBuilder builder;

  HighRetentionExperienceState _state;

  HighRetentionExperienceState get state => _state;

  Future<void> load() async {
    _state = const HighRetentionExperienceLoading();
    notifyListeners();

    try {
      final snapshot = await source.load();
      _state = HighRetentionExperienceReady(builder.build(snapshot));
    } catch (error) {
      _state = HighRetentionExperienceError(error.toString());
    }

    notifyListeners();
  }
}
