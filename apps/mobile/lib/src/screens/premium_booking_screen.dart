import '../models/app_models.dart';
import 'book_appointment_screen.dart';

class PremiumBookingScreen extends BookAppointmentScreen {
  const PremiumBookingScreen({
    super.key,
    required super.repository,
    required super.service,
    required super.profile,
    super.initialLoyaltySummary,
    super.activeOffers = const <SalonOfferItem>[],
    super.initialDay,
    super.initialSlot,
    super.initialStaffMemberId,
    super.entryMessage,
  });
}
