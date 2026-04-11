import 'package:supabase_flutter/supabase_flutter.dart';

import '../shared/app_models.dart';

class ProfileRepository {
  ProfileRepository({required this.client});

  final SupabaseClient? client;

  bool get isConfigured => client != null;

  Future<CustomerProfile?> fetchCurrentCustomer() async {
    final safeClient = client;
    final authUser = safeClient?.auth.currentUser;
    if (safeClient == null || authUser == null) {
      return null;
    }

    final result = await safeClient
        .from('customers')
        .select(
          'id, salon_id, auth_user_id, name, phone, referral_code, consent_status',
        )
        .eq('auth_user_id', authUser.id)
        .maybeSingle();

    if (result == null) {
      return null;
    }

    return CustomerProfile.fromMap(result);
  }

  Future<LoyaltySummary?> fetchLoyaltySummary() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    final data = await safeClient.rpc('get_customer_loyalty_summary');
    return LoyaltySummary.fromJson(jsonMap(data));
  }

  Future<ReferralSummary?> fetchReferralSummary() async {
    final safeClient = client;
    if (safeClient == null) {
      return null;
    }

    final data = await safeClient.rpc('get_customer_referral_summary');
    return ReferralSummary.fromJson(jsonMap(data));
  }
}
