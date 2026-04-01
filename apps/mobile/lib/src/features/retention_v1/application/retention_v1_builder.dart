import 'package:intl/intl.dart';

import '../../growth_journey/application/growth_journey_builder.dart';
import '../../growth_journey/domain/growth_journey_models.dart';
import '../domain/retention_v1_models.dart';

class RetentionV1Builder {
  const RetentionV1Builder({
    this.safetyRails = const RetentionV1SafetyRails(),
    this.growthJourneyBuilder = const GrowthJourneyBuilder(),
  });

  final RetentionV1SafetyRails safetyRails;
  final GrowthJourneyBuilder growthJourneyBuilder;

  RetentionV1Experience? build(
    GrowthJourneySnapshot snapshot, {
    required RetentionV1FeatureFlags flags,
    DateTime? now,
  }) {
    if (!flags.enabled || snapshot.services.isEmpty) {
      return null;
    }

    final reference = now ?? DateTime.now();
    final visits = [...snapshot.visitHistory]
      ..sort((left, right) => right.visitedAt.compareTo(left.visitedAt));
    final serviceDecision = _selectService(snapshot, visits, reference);
    final staffDecision = _selectStaff(
      snapshot,
      visits,
      serviceDecision,
      reference,
    );
    final timeDecision = _selectTime(
      snapshot,
      visits,
      serviceDecision,
      staffDecision,
      reference,
    );
    final urgency = _resolveUrgency(snapshot, reference);
    final highlightReward =
        snapshot.loyalty.availableRewardsCount > 0 ||
        snapshot.loyalty.visitsToNextTier == 1;

    final blockedReasons = <String>[
      if (!flags.allowSmartMode) 'smart_mode_disabled',
      if (serviceDecision.confidence != RetentionV1Confidence.trusted)
        'service_confidence_low',
      if (staffDecision.confidence != RetentionV1Confidence.trusted)
        'staff_confidence_low',
      if (timeDecision.confidence != RetentionV1Confidence.trusted)
        'time_confidence_low',
    ];

    final smartModeAllowed =
        flags.allowSmartMode &&
        serviceDecision.confidence == RetentionV1Confidence.trusted &&
        (staffDecision.confidence == RetentionV1Confidence.trusted ||
            timeDecision.confidence == RetentionV1Confidence.trusted);
    final mode = smartModeAllowed
        ? RetentionV1Mode.smartMode
        : RetentionV1Mode.defaultMode;
    final confidence = smartModeAllowed
        ? RetentionV1Confidence.trusted
        : serviceDecision.confidence;
    final safety = RetentionV1SafetyStatus(
      smartModeAllowed: smartModeAllowed,
      canUseStaffPersonalization:
          staffDecision.confidence == RetentionV1Confidence.trusted,
      canUseExactTimeRecommendation:
          timeDecision.confidence == RetentionV1Confidence.trusted,
      pushNotificationsAllowed: flags.allowPushNotifications,
      blockedReasons: blockedReasons,
    );

    final bookingRequest = RetentionV1BookingRequest(
      serviceId: serviceDecision.service.id,
      serviceName: serviceDecision.service.name,
      source: 'retention_v1_home',
      mode: mode,
      confidence: confidence,
      initialDay: timeDecision.window == null
          ? null
          : _dateOnly(timeDecision.window!.startAt),
      initialSlot: mode == RetentionV1Mode.smartMode
          ? timeDecision.window?.startAt
          : null,
      initialStaffMemberId: mode == RetentionV1Mode.smartMode
          ? timeDecision.window?.staffMemberId
          : null,
      initialStaffMemberName: mode == RetentionV1Mode.smartMode
          ? timeDecision.window?.staffMemberName
          : null,
      entryMessage: _entryMessage(
        mode: mode,
        urgency: urgency,
        service: serviceDecision.service,
        timeDecision: timeDecision,
      ),
    );

    final home = RetentionV1HomeModel(
      eyebrow: smartModeAllowed
          ? 'Seu próximo horário'
          : highlightReward
          ? 'Seu benefício'
          : 'Reserva simplificada',
      title: _title(
        mode: mode,
        urgency: urgency,
        service: serviceDecision.service,
        timeDecision: timeDecision,
        highlightReward: highlightReward,
      ),
      body: _body(
        mode: mode,
        urgency: urgency,
        service: serviceDecision.service,
        staffDecision: staffDecision,
        timeDecision: timeDecision,
        highlightReward: highlightReward,
      ),
      primaryCtaLabel: _primaryCtaLabel(
        mode: mode,
        highlightReward: highlightReward,
        hasExactTime: timeDecision.confidence == RetentionV1Confidence.trusted,
      ),
      secondaryCtaLabel: timeDecision.window == null ? null : 'Ver horários',
      pills: _buildPills(
        snapshot,
        serviceDecision.service,
        timeDecision,
        highlightReward: highlightReward,
      ),
      highlightReward: highlightReward,
    );

    return RetentionV1Experience(
      mode: mode,
      confidence: confidence,
      urgency: urgency,
      home: home,
      bookingRequest: bookingRequest,
      safety: safety,
      flags: flags,
    );
  }

  GrowthUrgency _resolveUrgency(
    GrowthJourneySnapshot snapshot,
    DateTime reference,
  ) {
    if (snapshot.visitHistory.isEmpty) {
      return GrowthUrgency.onTrack;
    }

    try {
      return growthJourneyBuilder
          .build(snapshot, now: reference)
          .routineInsight
          .urgency;
    } catch (_) {
      return GrowthUrgency.onTrack;
    }
  }

  _ServiceDecision _selectService(
    GrowthJourneySnapshot snapshot,
    List<GrowthVisitHistoryEntry> visits,
    DateTime reference,
  ) {
    final fallbackService = snapshot.services.first;
    if (visits.isEmpty) {
      return _ServiceDecision(
        service: fallbackService,
        confidence: RetentionV1Confidence.unknown,
      );
    }

    final lastVisit = visits.first;
    final matchedService = _matchService(snapshot.services, lastVisit);
    if (matchedService != null) {
      final cutoff = reference.subtract(
        Duration(days: safetyRails.serviceLookbackDays),
      );
      final count = visits
          .where((visit) => visit.visitedAt.isAfter(cutoff))
          .where((visit) => _isSameService(visit, matchedService))
          .length;
      return _ServiceDecision(
        service: matchedService,
        confidence: count >= safetyRails.minVisitsForSmartService
            ? RetentionV1Confidence.trusted
            : RetentionV1Confidence.weak,
      );
    }

    for (final favoriteId in snapshot.preferences.favoriteServiceIds) {
      for (final service in snapshot.services) {
        if (service.id == favoriteId) {
          return _ServiceDecision(
            service: service,
            confidence: RetentionV1Confidence.weak,
          );
        }
      }
    }

    return _ServiceDecision(
      service: fallbackService,
      confidence: RetentionV1Confidence.unknown,
    );
  }

  _StaffDecision _selectStaff(
    GrowthJourneySnapshot snapshot,
    List<GrowthVisitHistoryEntry> visits,
    _ServiceDecision serviceDecision,
    DateTime reference,
  ) {
    final cutoff = reference.subtract(
      Duration(days: safetyRails.staffLookbackDays),
    );
    final relevantVisits = visits
        .where((visit) => visit.visitedAt.isAfter(cutoff))
        .where((visit) => _isSameService(visit, serviceDecision.service))
        .where((visit) => (visit.staffMemberName ?? '').trim().isNotEmpty)
        .toList();
    if (relevantVisits.isEmpty) {
      return const _StaffDecision(confidence: RetentionV1Confidence.unknown);
    }

    final counts = <String, int>{};
    final labels = <String, String>{};
    for (final visit in relevantVisits) {
      final normalized = _normalize(visit.staffMemberName!);
      counts.update(normalized, (value) => value + 1, ifAbsent: () => 1);
      labels.putIfAbsent(normalized, () => visit.staffMemberName!);
    }

    final ranking = counts.entries.toList()
      ..sort((left, right) => right.value.compareTo(left.value));
    final top = ranking.first;
    final second = ranking.length > 1 ? ranking[1].value : 0;
    final confidence =
        top.value >= safetyRails.minVisitsForSmartStaff && top.value > second
        ? RetentionV1Confidence.trusted
        : RetentionV1Confidence.weak;
    return _StaffDecision(
      staffMemberName: labels[top.key],
      confidence: confidence,
    );
  }

  _TimeDecision _selectTime(
    GrowthJourneySnapshot snapshot,
    List<GrowthVisitHistoryEntry> visits,
    _ServiceDecision serviceDecision,
    _StaffDecision staffDecision,
    DateTime reference,
  ) {
    final windows =
        snapshot.availableWindows
            .where((window) => window.startAt.isAfter(reference))
            .toList()
          ..sort((left, right) => left.startAt.compareTo(right.startAt));
    if (windows.isEmpty) {
      return const _TimeDecision(confidence: RetentionV1Confidence.unknown);
    }

    final cutoff = reference.subtract(
      Duration(days: safetyRails.dayPartLookbackDays),
    );
    final relevantVisits = visits
        .where((visit) => visit.visitedAt.isAfter(cutoff))
        .where((visit) => _isSameService(visit, serviceDecision.service))
        .toList();
    final counts = <GrowthDayPart, int>{};
    for (final visit in relevantVisits) {
      final dayPart = GrowthDayPart.fromHour(visit.visitedAt.hour);
      counts.update(dayPart, (value) => value + 1, ifAbsent: () => 1);
    }

    GrowthDayPart? trustedDayPart;
    if (counts.isNotEmpty) {
      final ranking = counts.entries.toList()
        ..sort((left, right) => right.value.compareTo(left.value));
      final top = ranking.first;
      final second = ranking.length > 1 ? ranking[1].value : 0;
      if (top.value >= safetyRails.minVisitsForSmartDayPart &&
          top.value > second) {
        trustedDayPart = top.key;
      }
    }

    var candidateWindows = windows;
    if ((staffDecision.staffMemberName ?? '').trim().isNotEmpty) {
      final byStaff = candidateWindows
          .where(
            (window) =>
                _normalize(window.staffMemberName) ==
                _normalize(staffDecision.staffMemberName!),
          )
          .toList();
      if (byStaff.isNotEmpty) {
        candidateWindows = byStaff;
      }
    }

    GrowthAvailableWindow? selectedWindow;
    var confidence = RetentionV1Confidence.weak;
    if (trustedDayPart != null) {
      final byDayPart = candidateWindows
          .where((window) => window.dayPart == trustedDayPart)
          .toList();
      if (byDayPart.isNotEmpty) {
        selectedWindow = byDayPart.first;
        confidence = RetentionV1Confidence.trusted;
      }
    }

    selectedWindow ??= candidateWindows.isNotEmpty
        ? candidateWindows.first
        : windows.first;
    if (selectedWindow != null &&
        confidence != RetentionV1Confidence.trusted &&
        staffDecision.confidence == RetentionV1Confidence.trusted) {
      confidence = RetentionV1Confidence.trusted;
    }

    final liveWindow =
        selectedWindow != null &&
        selectedWindow.startAt.isBefore(
          reference.add(Duration(hours: safetyRails.urgencyWindowHours)),
        );
    if (confidence == RetentionV1Confidence.trusted && !liveWindow) {
      confidence = RetentionV1Confidence.weak;
    }

    return _TimeDecision(window: selectedWindow, confidence: confidence);
  }

  List<RetentionV1HomePill> _buildPills(
    GrowthJourneySnapshot snapshot,
    GrowthServiceSummary service,
    _TimeDecision timeDecision, {
    required bool highlightReward,
  }) {
    final pills = <RetentionV1HomePill>[RetentionV1HomePill(service.name)];
    if (timeDecision.window != null) {
      pills.add(
        RetentionV1HomePill(
          DateFormat('dd/MM • HH:mm').format(timeDecision.window!.startAt),
        ),
      );
    }
    if (highlightReward) {
      if (snapshot.loyalty.availableRewardsCount > 0) {
        pills.add(const RetentionV1HomePill('Benefício disponível'));
      } else if (snapshot.loyalty.visitsToNextTier == 1) {
        pills.add(const RetentionV1HomePill('1 visita para o próximo nível'));
      }
    }
    return pills.take(3).toList(growable: false);
  }

  String _title({
    required RetentionV1Mode mode,
    required GrowthUrgency urgency,
    required GrowthServiceSummary service,
    required _TimeDecision timeDecision,
    required bool highlightReward,
  }) {
    if (highlightReward) {
      return 'Seu benefício já pode entrar na próxima reserva.';
    }

    if (mode == RetentionV1Mode.smartMode && timeDecision.window != null) {
      final label = DateFormat(
        'dd/MM • HH:mm',
      ).format(timeDecision.window!.startAt);
      return '$label é um bom momento para repetir ${service.name}.';
    }

    switch (urgency) {
      case GrowthUrgency.lapsed:
        return 'Seu próximo horário pode ficar simples de novo.';
      case GrowthUrgency.dueNow:
        return 'Seu próximo horário pode ficar resolvido agora.';
      case GrowthUrgency.dueSoon:
        return 'Vale deixar o próximo horário encaminhado hoje.';
      case GrowthUrgency.onTrack:
        return 'Seu próximo horário pode ficar protegido em segundos.';
    }
  }

  String _body({
    required RetentionV1Mode mode,
    required GrowthUrgency urgency,
    required GrowthServiceSummary service,
    required _StaffDecision staffDecision,
    required _TimeDecision timeDecision,
    required bool highlightReward,
  }) {
    if (highlightReward) {
      return 'Deixamos ${service.name} pronto para você reservar sem recomeçar tudo. Se fizer sentido, o benefício já entra nessa volta.';
    }

    if (mode == RetentionV1Mode.smartMode && timeDecision.window != null) {
      final staffLabel = (staffDecision.staffMemberName ?? '').trim().isEmpty
          ? timeDecision.window!.staffMemberName
          : staffDecision.staffMemberName!;
      return 'Carregamos ${service.name}${staffLabel.trim().isEmpty ? '' : ' com $staffLabel'} e o horário mais confiável para reduzir atrito sem adivinhar demais.';
    }

    switch (urgency) {
      case GrowthUrgency.lapsed:
        return 'Sem exagerar na personalização: seu último serviço já está separado para você voltar pelo caminho mais simples.';
      case GrowthUrgency.dueNow:
      case GrowthUrgency.dueSoon:
        return 'Seu último serviço foi ${service.name}. A gente deixou esse retorno mais leve, sem depender de escolhas demais.';
      case GrowthUrgency.onTrack:
        return 'Você ainda está no ritmo. Se quiser, já dá para encaminhar ${service.name} sem começar do zero.';
    }
  }

  String _primaryCtaLabel({
    required RetentionV1Mode mode,
    required bool highlightReward,
    required bool hasExactTime,
  }) {
    if (highlightReward) {
      return 'Reservar com benefício';
    }
    if (mode == RetentionV1Mode.smartMode && hasExactTime) {
      return 'Quero esse horário';
    }
    return 'Repetir último serviço';
  }

  String _entryMessage({
    required RetentionV1Mode mode,
    required GrowthUrgency urgency,
    required GrowthServiceSummary service,
    required _TimeDecision timeDecision,
  }) {
    if (mode == RetentionV1Mode.smartMode && timeDecision.window != null) {
      return 'Seu serviço e o horário mais confiável já foram preparados para você confirmar sem ruído.';
    }
    if (urgency == GrowthUrgency.lapsed) {
      return 'Seu último serviço já foi carregado para facilitar sua volta sem apostar em personalização excessiva.';
    }
    return 'Seu último serviço já foi separado para você continuar sem recomeçar tudo.';
  }

  GrowthServiceSummary? _matchService(
    List<GrowthServiceSummary> services,
    GrowthVisitHistoryEntry visit,
  ) {
    for (final service in services) {
      if (visit.serviceId != null && service.id == visit.serviceId) {
        return service;
      }
    }

    for (final service in services) {
      if (_normalize(service.name) == _normalize(visit.serviceName)) {
        return service;
      }
    }

    for (final service in services) {
      if (visit.serviceCategory != null &&
          service.category != null &&
          _normalize(service.category!) == _normalize(visit.serviceCategory!)) {
        return service;
      }
    }

    return null;
  }

  bool _isSameService(
    GrowthVisitHistoryEntry visit,
    GrowthServiceSummary service,
  ) {
    if (visit.serviceId != null && visit.serviceId == service.id) {
      return true;
    }
    if (_normalize(visit.serviceName) == _normalize(service.name)) {
      return true;
    }
    return visit.serviceCategory != null &&
        service.category != null &&
        _normalize(visit.serviceCategory!) == _normalize(service.category!);
  }

  DateTime _dateOnly(DateTime value) {
    return DateTime(value.year, value.month, value.day);
  }
}

class _ServiceDecision {
  const _ServiceDecision({required this.service, required this.confidence});

  final GrowthServiceSummary service;
  final RetentionV1Confidence confidence;
}

class _StaffDecision {
  const _StaffDecision({this.staffMemberName, required this.confidence});

  final String? staffMemberName;
  final RetentionV1Confidence confidence;
}

class _TimeDecision {
  const _TimeDecision({this.window, required this.confidence});

  final GrowthAvailableWindow? window;
  final RetentionV1Confidence confidence;
}

String _normalize(String value) {
  return value
      .toLowerCase()
      .replaceAll('á', 'a')
      .replaceAll('à', 'a')
      .replaceAll('ã', 'a')
      .replaceAll('â', 'a')
      .replaceAll('é', 'e')
      .replaceAll('ê', 'e')
      .replaceAll('í', 'i')
      .replaceAll('ó', 'o')
      .replaceAll('ô', 'o')
      .replaceAll('õ', 'o')
      .replaceAll('ú', 'u')
      .replaceAll('ç', 'c')
      .trim();
}

String _capitalize(String value) {
  if (value.isEmpty) {
    return value;
  }
  return '${value[0].toUpperCase()}${value.substring(1)}';
}
