import 'package:flutter/material.dart';

import '../../features/home/home_data.dart';
import '../../features/retention_v1/domain/retention_v1_models.dart';
import '../../models/app_models.dart';
import '../../screens/premium_home_screen.dart';
import '../../theme/salon_branding.dart';

class HomeServicesTab extends StatelessWidget {
  const HomeServicesTab({
    super.key,
    required this.profile,
    required this.branding,
    required this.data,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.onOpenAgenda,
    required this.onOpenGallery,
    required this.onOpenWallet,
    required this.busyVacancyAlertIds,
    required this.bookedVacancyAlertIds,
    required this.onBookVacancyAlert,
    required this.onCopyReferral,
    required this.onBook,
    required this.onBookRetention,
    required this.onBookGrowthSuggestion,
    required this.onBookSuggested,
    required this.heroSubtitle,
    required this.nextAvailableLabel,
    required this.todayAttendanceLabel,
    required this.favoriteServiceIds,
    required this.busyFavoriteServiceIds,
    required this.onToggleFavoriteService,
    this.onOpenProfile,
    this.onTrackExperienceEvent,
    this.onOpenProfessionals,
    this.onOpenProducts,
    this.onOpenPromotions,
    this.onOpenServiceDetails,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final HomeData data;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final VoidCallback onOpenAgenda;
  final VoidCallback onOpenGallery;
  final VoidCallback onOpenWallet;
  final Set<String> busyVacancyAlertIds;
  final Set<String> bookedVacancyAlertIds;
  final Future<void> Function(VacancyAlert alert) onBookVacancyAlert;
  final Future<void> Function(String code) onCopyReferral;
  final Future<void> Function(ServiceItem service) onBook;
  final Future<void> Function(
    ServiceItem service,
    RetentionV1BookingRequest request,
  )
  onBookRetention;
  final Future<void> Function(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion,
  )
  onBookGrowthSuggestion;
  final Future<void> Function(
    ServiceItem service,
    SmartScheduleSuggestionItem suggestion,
  )
  onBookSuggested;
  final String heroSubtitle;
  final String nextAvailableLabel;
  final String todayAttendanceLabel;
  final Set<String> favoriteServiceIds;
  final Set<String> busyFavoriteServiceIds;
  final Future<void> Function(ServiceItem service) onToggleFavoriteService;
  final VoidCallback? onOpenProfile;
  final void Function(String event, Map<String, Object?> payload)?
  onTrackExperienceEvent;
  final VoidCallback? onOpenProfessionals;
  final VoidCallback? onOpenProducts;
  final VoidCallback? onOpenPromotions;
  final Future<void> Function(ServiceItem service)? onOpenServiceDetails;

  @override
  Widget build(BuildContext context) {
    return PremiumHomeScreen(
      profile: profile,
      branding: branding,
      data: data,
      onRefresh: onRefresh,
      onWhatsApp: onWhatsApp,
      onOpenAgenda: onOpenAgenda,
      onOpenGallery: onOpenGallery,
      onOpenWallet: onOpenWallet,
      busyVacancyAlertIds: busyVacancyAlertIds,
      bookedVacancyAlertIds: bookedVacancyAlertIds,
      onBookVacancyAlert: onBookVacancyAlert,
      onCopyReferral: onCopyReferral,
      onBook: onBook,
      onBookRetention: onBookRetention,
      onBookGrowthSuggestion: onBookGrowthSuggestion,
      onBookSuggested: onBookSuggested,
      heroSubtitle: heroSubtitle,
      nextAvailableLabel: nextAvailableLabel,
      todayAttendanceLabel: todayAttendanceLabel,
      favoriteServiceIds: favoriteServiceIds,
      busyFavoriteServiceIds: busyFavoriteServiceIds,
      onToggleFavoriteService: onToggleFavoriteService,
      onOpenProfile: onOpenProfile,
      onTrackExperienceEvent: onTrackExperienceEvent,
      onOpenServiceDetails: onOpenServiceDetails,
      onOpenProfessionals: onOpenProfessionals,
      onOpenProducts: onOpenProducts,
      onOpenPromotions: onOpenPromotions,
    );
  }
}
