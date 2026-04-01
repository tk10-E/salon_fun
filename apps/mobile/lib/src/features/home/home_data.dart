import '../../models/app_models.dart';

class HomeData {
  const HomeData({
    required this.services,
    this.teamProfiles = const <SalonTeamMemberProfile>[],
    this.retailProducts = const <SalonRetailProduct>[],
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
    this.favoriteServiceIds = const <String>{},
    this.favoriteStaffMemberIds = const <String>{},
  });

  final List<ServiceItem> services;
  final List<SalonTeamMemberProfile> teamProfiles;
  final List<SalonRetailProduct> retailProducts;
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
  final Set<String> favoriteServiceIds;
  final Set<String> favoriteStaffMemberIds;

  HomeData copyWith({
    List<ServiceItem>? services,
    List<SalonTeamMemberProfile>? teamProfiles,
    List<SalonRetailProduct>? retailProducts,
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
    Set<String>? favoriteServiceIds,
    Set<String>? favoriteStaffMemberIds,
  }) {
    return HomeData(
      services: services ?? this.services,
      teamProfiles: teamProfiles ?? this.teamProfiles,
      retailProducts: retailProducts ?? this.retailProducts,
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
      smartSchedule: clearSmartSchedule
          ? null
          : smartSchedule ?? this.smartSchedule,
      favoriteServiceIds: favoriteServiceIds ?? this.favoriteServiceIds,
      favoriteStaffMemberIds:
          favoriteStaffMemberIds ?? this.favoriteStaffMemberIds,
    );
  }
}
