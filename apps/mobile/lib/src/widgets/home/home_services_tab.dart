import 'package:flutter/material.dart';

import '../../features/home/home_data.dart';
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
    required this.busyVacancyAlertIds,
    required this.bookedVacancyAlertIds,
    required this.onBookVacancyAlert,
    required this.onCopyReferral,
    required this.onBook,
    required this.onBookGrowthSuggestion,
    required this.onBookSuggested,
    required this.heroSubtitle,
    required this.nextAvailableLabel,
    required this.todayAttendanceLabel,
    required this.favoriteServiceIds,
    required this.busyFavoriteServiceIds,
    required this.onToggleFavoriteService,
    this.onOpenProfessionals,
    this.onOpenProducts,
    this.onOpenServiceDetails,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final HomeData data;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final VoidCallback onOpenAgenda;
  final VoidCallback onOpenGallery;
  final Set<String> busyVacancyAlertIds;
  final Set<String> bookedVacancyAlertIds;
  final Future<void> Function(VacancyAlert alert) onBookVacancyAlert;
  final Future<void> Function(String code) onCopyReferral;
  final Future<void> Function(ServiceItem service) onBook;
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
  final VoidCallback? onOpenProfessionals;
  final VoidCallback? onOpenProducts;
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
      busyVacancyAlertIds: busyVacancyAlertIds,
      bookedVacancyAlertIds: bookedVacancyAlertIds,
      onBookVacancyAlert: onBookVacancyAlert,
      onCopyReferral: onCopyReferral,
      onBook: onBook,
      onBookGrowthSuggestion: onBookGrowthSuggestion,
      onBookSuggested: onBookSuggested,
      heroSubtitle: heroSubtitle,
      nextAvailableLabel: nextAvailableLabel,
      todayAttendanceLabel: todayAttendanceLabel,
      favoriteServiceIds: favoriteServiceIds,
      busyFavoriteServiceIds: busyFavoriteServiceIds,
      onToggleFavoriteService: onToggleFavoriteService,
      onOpenServiceDetails: onOpenServiceDetails,
      onOpenProfessionals: onOpenProfessionals,
      onOpenProducts: onOpenProducts,
    );
  }
}
