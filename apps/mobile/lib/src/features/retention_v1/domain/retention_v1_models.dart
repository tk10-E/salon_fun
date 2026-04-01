import '../../../models/salon_client_app_config.dart';
import '../../growth_journey/domain/growth_journey_models.dart';

enum RetentionV1Mode {
  defaultMode,
  smartMode;

  String get analyticsValue {
    switch (this) {
      case RetentionV1Mode.defaultMode:
        return 'default';
      case RetentionV1Mode.smartMode:
        return 'smart';
    }
  }
}

enum RetentionV1Confidence {
  unknown,
  weak,
  trusted;

  String get analyticsValue {
    switch (this) {
      case RetentionV1Confidence.unknown:
        return 'unknown';
      case RetentionV1Confidence.weak:
        return 'weak';
      case RetentionV1Confidence.trusted:
        return 'trusted';
    }
  }
}

enum RetentionV1PushType {
  dueSoon('retention_due_soon'),
  abandonedBooking('retention_abandoned_booking'),
  matchedVacancy('retention_matched_vacancy');

  const RetentionV1PushType(this.notificationType);

  final String notificationType;

  static RetentionV1PushType? fromNotificationType(String? value) {
    switch (value?.trim()) {
      case 'retention_due_soon':
        return RetentionV1PushType.dueSoon;
      case 'retention_abandoned_booking':
        return RetentionV1PushType.abandonedBooking;
      case 'retention_matched_vacancy':
        return RetentionV1PushType.matchedVacancy;
      default:
        return null;
    }
  }
}

class RetentionV1FeatureFlags {
  const RetentionV1FeatureFlags({
    this.enabled = true,
    this.allowSmartMode = true,
    this.allowPushNotifications = true,
    this.allowDueSoonPush = true,
    this.allowAbandonedBookingPush = true,
    this.allowMatchedVacancyPush = true,
  });

  final bool enabled;
  final bool allowSmartMode;
  final bool allowPushNotifications;
  final bool allowDueSoonPush;
  final bool allowAbandonedBookingPush;
  final bool allowMatchedVacancyPush;

  factory RetentionV1FeatureFlags.fromClientConfig(
    SalonClientAppConfig? config,
  ) {
    final raw = config?.rawConfig ?? const <String, dynamic>{};
    final nestedValue = raw['retentionV1'];
    final nested = nestedValue is Map
        ? Map<String, dynamic>.from(nestedValue)
        : const <String, dynamic>{};

    bool readBool(String nestedKey, String flatKey, bool fallback) {
      final value = nested.containsKey(nestedKey)
          ? nested[nestedKey]
          : raw[flatKey];
      if (value is bool) {
        return value;
      }
      if (value is num) {
        return value != 0;
      }
      final text = value?.toString().trim().toLowerCase();
      if (text == null || text.isEmpty) {
        return fallback;
      }
      if (text == 'true' || text == '1') {
        return true;
      }
      if (text == 'false' || text == '0') {
        return false;
      }
      return fallback;
    }

    return RetentionV1FeatureFlags(
      enabled: readBool('enabled', 'retentionV1Enabled', true),
      allowSmartMode: readBool(
        'allowSmartMode',
        'retentionV1AllowSmartMode',
        true,
      ),
      allowPushNotifications: readBool(
        'allowPushNotifications',
        'retentionV1AllowPushNotifications',
        true,
      ),
      allowDueSoonPush: readBool(
        'allowDueSoonPush',
        'retentionV1AllowDueSoonPush',
        true,
      ),
      allowAbandonedBookingPush: readBool(
        'allowAbandonedBookingPush',
        'retentionV1AllowAbandonedBookingPush',
        true,
      ),
      allowMatchedVacancyPush: readBool(
        'allowMatchedVacancyPush',
        'retentionV1AllowMatchedVacancyPush',
        true,
      ),
    );
  }
}

class RetentionV1SafetyRails {
  const RetentionV1SafetyRails({
    this.minVisitsForSmartService = 2,
    this.minVisitsForSmartStaff = 2,
    this.minVisitsForSmartDayPart = 2,
    this.serviceLookbackDays = 180,
    this.staffLookbackDays = 120,
    this.dayPartLookbackDays = 90,
    this.urgencyWindowHours = 48,
  });

  final int minVisitsForSmartService;
  final int minVisitsForSmartStaff;
  final int minVisitsForSmartDayPart;
  final int serviceLookbackDays;
  final int staffLookbackDays;
  final int dayPartLookbackDays;
  final int urgencyWindowHours;
}

class RetentionV1SafetyStatus {
  const RetentionV1SafetyStatus({
    required this.smartModeAllowed,
    required this.canUseStaffPersonalization,
    required this.canUseExactTimeRecommendation,
    required this.pushNotificationsAllowed,
    this.blockedReasons = const <String>[],
  });

  final bool smartModeAllowed;
  final bool canUseStaffPersonalization;
  final bool canUseExactTimeRecommendation;
  final bool pushNotificationsAllowed;
  final List<String> blockedReasons;
}

class RetentionV1HomePill {
  const RetentionV1HomePill(this.label);

  final String label;
}

class RetentionV1HomeModel {
  const RetentionV1HomeModel({
    required this.eyebrow,
    required this.title,
    required this.body,
    required this.primaryCtaLabel,
    this.secondaryCtaLabel,
    this.pills = const <RetentionV1HomePill>[],
    this.highlightReward = false,
  });

  final String eyebrow;
  final String title;
  final String body;
  final String primaryCtaLabel;
  final String? secondaryCtaLabel;
  final List<RetentionV1HomePill> pills;
  final bool highlightReward;
}

class RetentionV1BookingRequest {
  const RetentionV1BookingRequest({
    required this.serviceId,
    required this.serviceName,
    required this.source,
    required this.mode,
    required this.confidence,
    required this.entryMessage,
    this.initialDay,
    this.initialSlot,
    this.initialStaffMemberId,
    this.initialStaffMemberName,
  });

  final String serviceId;
  final String serviceName;
  final DateTime? initialDay;
  final DateTime? initialSlot;
  final String? initialStaffMemberId;
  final String? initialStaffMemberName;
  final String source;
  final RetentionV1Mode mode;
  final RetentionV1Confidence confidence;
  final String entryMessage;

  Map<String, Object?> analyticsPayload() {
    return <String, Object?>{
      'source': source,
      'mode': mode.analyticsValue,
      'confidence': confidence.analyticsValue,
      'service_id': serviceId,
      'service_name': serviceName,
      'has_prefilled_day': initialDay != null,
      'has_prefilled_slot': initialSlot != null,
      'staff_member_id': initialStaffMemberId,
      'staff_member_name': initialStaffMemberName,
    };
  }
}

class RetentionV1Experience {
  const RetentionV1Experience({
    required this.mode,
    required this.confidence,
    required this.urgency,
    required this.home,
    required this.bookingRequest,
    required this.safety,
    required this.flags,
  });

  final RetentionV1Mode mode;
  final RetentionV1Confidence confidence;
  final GrowthUrgency urgency;
  final RetentionV1HomeModel home;
  final RetentionV1BookingRequest bookingRequest;
  final RetentionV1SafetyStatus safety;
  final RetentionV1FeatureFlags flags;

  Map<String, Object?> analyticsPayload() {
    return <String, Object?>{
      'mode': mode.analyticsValue,
      'confidence': confidence.analyticsValue,
      'urgency': urgency.name,
      'service_id': bookingRequest.serviceId,
      'service_name': bookingRequest.serviceName,
      'has_prefilled_day': bookingRequest.initialDay != null,
      'has_prefilled_slot': bookingRequest.initialSlot != null,
      'has_staff_personalization': safety.canUseStaffPersonalization,
      'reward_highlighted': home.highlightReward,
    };
  }
}

class RetentionV1PushPlan {
  const RetentionV1PushPlan({
    required this.type,
    required this.title,
    required this.body,
    required this.payload,
  });

  final RetentionV1PushType type;
  final String title;
  final String body;
  final Map<String, String> payload;
}
