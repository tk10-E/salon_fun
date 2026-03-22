import '../../models/app_models.dart';

class HomeData {
  const HomeData({
    required this.services,
    required this.appointments,
    required this.vacancyAlerts,
    required this.posts,
    required this.offers,
    required this.growthSuggestions,
    required this.loyaltySummary,
    required this.referralSummary,
    required this.notifications,
    required this.nextAvailableAt,
    required this.smartSchedule,
  });

  final List<ServiceItem> services;
  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
  final List<SalonPost> posts;
  final List<SalonOfferItem> offers;
  final CustomerGrowthSuggestionFeed? growthSuggestions;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final List<CustomerNotificationItem> notifications;
  final DateTime? nextAvailableAt;
  final SmartScheduleOpportunityFeed? smartSchedule;

  HomeData copyWith({
    List<ServiceItem>? services,
    List<AppointmentItem>? appointments,
    List<VacancyAlert>? vacancyAlerts,
    List<SalonPost>? posts,
    List<SalonOfferItem>? offers,
    CustomerGrowthSuggestionFeed? growthSuggestions,
    bool clearGrowthSuggestions = false,
    CustomerLoyaltySummary? loyaltySummary,
    bool clearLoyaltySummary = false,
    ReferralSummary? referralSummary,
    bool clearReferralSummary = false,
    List<CustomerNotificationItem>? notifications,
    DateTime? nextAvailableAt,
    bool clearNextAvailableAt = false,
    SmartScheduleOpportunityFeed? smartSchedule,
    bool clearSmartSchedule = false,
  }) {
    return HomeData(
      services: services ?? this.services,
      appointments: appointments ?? this.appointments,
      vacancyAlerts: vacancyAlerts ?? this.vacancyAlerts,
      posts: posts ?? this.posts,
      offers: offers ?? this.offers,
      growthSuggestions: clearGrowthSuggestions
          ? null
          : growthSuggestions ?? this.growthSuggestions,
      loyaltySummary: clearLoyaltySummary
          ? null
          : loyaltySummary ?? this.loyaltySummary,
      referralSummary: clearReferralSummary
          ? null
          : referralSummary ?? this.referralSummary,
      notifications: notifications ?? this.notifications,
      nextAvailableAt: clearNextAvailableAt
          ? null
          : nextAvailableAt ?? this.nextAvailableAt,
      smartSchedule: clearSmartSchedule ? null : smartSchedule ?? this.smartSchedule,
    );
  }
}
