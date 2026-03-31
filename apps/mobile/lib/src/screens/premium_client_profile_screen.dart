import '../models/app_models.dart';
import 'profile_screen.dart';

class PremiumClientProfileScreen extends ProfileScreen {
  const PremiumClientProfileScreen({
    super.key,
    required super.repository,
    required super.profile,
    required super.onSignOut,
    required super.onWhatsApp,
    super.userEmail,
    super.initialLoyaltySummary,
    super.initialReferralSummary,
    super.initialAppointments = const <AppointmentItem>[],
    super.initialServices = const <ServiceItem>[],
    super.initialFavoriteServiceIds = const <String>{},
    super.onProfileChanged,
  });
}
