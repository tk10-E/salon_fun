enum HighRetentionSectionTone { hero, accent, reward, urgency, quiet }

class HighRetentionAction {
  const HighRetentionAction({required this.label, required this.intent});

  final String label;
  final String intent;
}

class HighRetentionSectionModel {
  const HighRetentionSectionModel({
    required this.id,
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.primaryAction,
    this.secondaryAction,
    this.chips = const <String>[],
    this.meta,
    this.tone = HighRetentionSectionTone.quiet,
  });

  final String id;
  final String eyebrow;
  final String title;
  final String body;
  final HighRetentionAction primaryAction;
  final HighRetentionAction? secondaryAction;
  final List<String> chips;
  final String? meta;
  final HighRetentionSectionTone tone;
}

class HighRetentionHomeModel {
  const HighRetentionHomeModel({
    required this.greeting,
    required this.headerTitle,
    required this.headerBody,
    required this.sections,
    required this.stickyCta,
  });

  final String greeting;
  final String headerTitle;
  final String headerBody;
  final List<HighRetentionSectionModel> sections;
  final HighRetentionAction stickyCta;
}

class RankedBookingSlot {
  const RankedBookingSlot({
    required this.title,
    required this.reason,
    required this.isBest,
  });

  final String title;
  final String reason;
  final bool isBest;
}

class HighRetentionBookingFlowModel {
  const HighRetentionBookingFlowModel({
    required this.headline,
    required this.serviceLabel,
    required this.professionalLabel,
    required this.slots,
    required this.summaryTitle,
    required this.summaryBody,
    required this.confirmAction,
  });

  final String headline;
  final String serviceLabel;
  final String professionalLabel;
  final List<RankedBookingSlot> slots;
  final String summaryTitle;
  final String summaryBody;
  final HighRetentionAction confirmAction;
}

class HighRetentionExperienceModel {
  const HighRetentionExperienceModel({
    required this.home,
    required this.booking,
    required this.emotionalMessages,
  });

  final HighRetentionHomeModel home;
  final HighRetentionBookingFlowModel booking;
  final List<String> emotionalMessages;
}
