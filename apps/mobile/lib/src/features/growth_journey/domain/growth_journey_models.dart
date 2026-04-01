enum GrowthDayPart {
  morning,
  afternoon,
  evening;

  static GrowthDayPart fromHour(int hour) {
    if (hour < 12) {
      return GrowthDayPart.morning;
    }
    if (hour < 18) {
      return GrowthDayPart.afternoon;
    }
    return GrowthDayPart.evening;
  }

  String get label {
    switch (this) {
      case GrowthDayPart.morning:
        return 'Manha';
      case GrowthDayPart.afternoon:
        return 'Tarde';
      case GrowthDayPart.evening:
        return 'Noite';
    }
  }
}

enum GrowthUrgency {
  onTrack,
  dueSoon,
  dueNow,
  lapsed;

  String get label {
    switch (this) {
      case GrowthUrgency.onTrack:
        return 'No ritmo';
      case GrowthUrgency.dueSoon:
        return 'Em breve';
      case GrowthUrgency.dueNow:
        return 'Hora de voltar';
      case GrowthUrgency.lapsed:
        return 'Winback';
    }
  }
}

class GrowthFrequencyRule {
  const GrowthFrequencyRule({
    required this.key,
    required this.keywords,
    required this.revisitEveryDays,
    required this.rebookLeadDays,
    required this.lapseAfterDays,
  });

  final String key;
  final List<String> keywords;
  final int revisitEveryDays;
  final int rebookLeadDays;
  final int lapseAfterDays;
}

class GrowthServiceSummary {
  const GrowthServiceSummary({
    required this.id,
    required this.name,
    required this.price,
    required this.durationMinutes,
    this.category,
  });

  final String id;
  final String name;
  final double price;
  final int durationMinutes;
  final String? category;
}

class GrowthUserPreferences {
  const GrowthUserPreferences({
    this.favoriteServiceIds = const <String>{},
    this.favoriteStaffMemberIds = const <String>{},
    this.preferredWeekdays = const <int>{},
    this.preferredDayParts = const <GrowthDayPart>{},
    this.allowPush = true,
    this.allowWhatsApp = true,
    this.allowPromotionalOffers = true,
  });

  final Set<String> favoriteServiceIds;
  final Set<String> favoriteStaffMemberIds;
  final Set<int> preferredWeekdays;
  final Set<GrowthDayPart> preferredDayParts;
  final bool allowPush;
  final bool allowWhatsApp;
  final bool allowPromotionalOffers;
}

class GrowthVisitHistoryEntry {
  const GrowthVisitHistoryEntry({
    required this.id,
    required this.serviceName,
    required this.visitedAt,
    required this.ticketAmount,
    required this.durationMinutes,
    this.serviceId,
    this.serviceCategory,
    this.staffMemberId,
    this.staffMemberName,
    this.status = 'completed',
  });

  final String id;
  final String? serviceId;
  final String serviceName;
  final String? serviceCategory;
  final DateTime visitedAt;
  final double ticketAmount;
  final int durationMinutes;
  final String? staffMemberId;
  final String? staffMemberName;
  final String status;
}

class GrowthAvailableWindow {
  const GrowthAvailableWindow({
    required this.startAt,
    required this.endAt,
    required this.staffMemberName,
    this.staffMemberId,
  });

  final DateTime startAt;
  final DateTime endAt;
  final String? staffMemberId;
  final String staffMemberName;

  GrowthDayPart get dayPart => GrowthDayPart.fromHour(startAt.hour);
}

class GrowthLoyaltySnapshot {
  const GrowthLoyaltySnapshot({
    this.cashbackBalance = 0,
    this.pointsBalance = 0,
    this.completedVisits = 0,
    this.visitsToNextTier = 0,
    this.availableRewardsCount = 0,
    this.qualifiedReferralCount = 0,
  });

  final double cashbackBalance;
  final int pointsBalance;
  final int completedVisits;
  final int visitsToNextTier;
  final int availableRewardsCount;
  final int qualifiedReferralCount;
}

class GrowthJourneySnapshot {
  const GrowthJourneySnapshot({
    required this.customerName,
    required this.salonName,
    required this.preferences,
    required this.services,
    required this.visitHistory,
    this.availableWindows = const <GrowthAvailableWindow>[],
    this.loyalty = const GrowthLoyaltySnapshot(),
  });

  final String customerName;
  final String salonName;
  final GrowthUserPreferences preferences;
  final List<GrowthServiceSummary> services;
  final List<GrowthVisitHistoryEntry> visitHistory;
  final List<GrowthAvailableWindow> availableWindows;
  final GrowthLoyaltySnapshot loyalty;
}

class GrowthRoutineInsight {
  const GrowthRoutineInsight({
    required this.lastVisit,
    required this.rule,
    required this.urgency,
    required this.daysSinceLastVisit,
    required this.recommendedBookingDate,
  });

  final GrowthVisitHistoryEntry lastVisit;
  final GrowthFrequencyRule rule;
  final GrowthUrgency urgency;
  final int daysSinceLastVisit;
  final DateTime recommendedBookingDate;
}
