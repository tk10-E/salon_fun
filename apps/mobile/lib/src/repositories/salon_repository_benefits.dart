part of 'salon_repository.dart';

mixin _SalonRepositoryBenefitsMixin on _SalonRepositoryBase {
  Future<List<ServiceItem>> getServices() async {
    final data = await client
        .from('services')
        .select(
          'id, category, name, description, price, duration, sort_order, image_path',
        )
        .order('sort_order')
        .order('category')
        .order('name');

    return (data as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map((serviceMap) {
          final imagePath = _readNullableString(serviceMap['image_path']);
          return ServiceItem.fromMap({
            ...serviceMap,
            'image_url': imagePath == null
                ? null
                : _buildSalonLogoUrl(imagePath),
          });
        })
        .toList();
  }

  Future<List<SalonOfferItem>> getSalonOffers() async {
    try {
      final data = await client
          .from('salon_offers')
          .select(
            'id, kind, title, description, highlight_text, price, starts_on, ends_on, is_active, sort_order',
          )
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at', ascending: false);

      final today = DateTime.now();
      final startOfToday = DateTime(today.year, today.month, today.day);

      return (data as List)
          .map(
            (item) => SalonOfferItem.fromMap(Map<String, dynamic>.from(item)),
          )
          .where((offer) {
            final startsOn = offer.startsOn;
            final endsOn = offer.endsOn;

            if (startsOn != null &&
                DateTime(
                  startsOn.year,
                  startsOn.month,
                  startsOn.day,
                ).isAfter(startOfToday)) {
              return false;
            }

            if (endsOn != null &&
                DateTime(
                  endsOn.year,
                  endsOn.month,
                  endsOn.day,
                ).isBefore(startOfToday)) {
              return false;
            }

            return true;
          })
          .toList();
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_offers')) {
        return const [];
      }
      rethrow;
    }
  }

  Future<List<SalonRetailProduct>> getRetailProducts({int limit = 24}) async {
    try {
      final data = await client.rpc(
        'get_customer_product_catalog',
        params: {'limit_count': limit},
      );

      if (data is! List) {
        return const [];
      }

      return data
          .map(
            (item) => SalonRetailProduct.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_product_catalog') ||
          message.contains('inventory_products')) {
        return const [];
      }
      rethrow;
    }
  }

  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions() async {
    try {
      final data = await client.rpc('get_customer_growth_suggestions');
      if (data == null) {
        return null;
      }

      final feed = CustomerGrowthSuggestionFeed.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      return feed.hasVisibleContent ? feed : null;
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_growth_suggestions') ||
          message.contains('customer_growth_automation_runs')) {
        return null;
      }
      rethrow;
    }
  }

  Future<CustomerLoyaltySummary?> getLoyaltySummary() async {
    try {
      final data = await client.rpc('get_customer_loyalty_summary');
      final summary = CustomerLoyaltySummary.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      return summary.hasVisibleContent ? summary : null;
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_loyalty_summary') ||
          message.contains('salon_loyalty_programs') ||
          message.contains('customer_loyalty_transactions')) {
        return null;
      }
      rethrow;
    }
  }

  Future<List<LoyaltyTransactionItem>> getLoyaltyTransactions({
    int limit = 20,
  }) async {
    try {
      final data = await client
          .from('customer_loyalty_transactions')
          .select(
            'id, transaction_kind, points_delta, cashback_delta, completed_visit_delta, description, metadata, created_at',
          )
          .order('created_at', ascending: false)
          .limit(limit);

      return (data as List)
          .map(
            (item) => LoyaltyTransactionItem.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('customer_loyalty_transactions')) {
        return const [];
      }
      rethrow;
    }
  }

  Future<ReferralSummary?> getReferralSummary() async {
    try {
      final data = await client.rpc('get_customer_referral_summary');
      final summary = ReferralSummary.fromMap(
        Map<String, dynamic>.from(data as Map),
      );

      if (summary.hasActiveProgram || summary.referralCode.isNotEmpty) {
        return summary;
      }

      return _getReferralSummaryFallback();
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_referral_summary') ||
          message.contains('salon_referral_') ||
          message.contains('referral_code')) {
        return _getReferralSummaryFallback();
      }
      rethrow;
    }
  }

  Future<ReferralSummary?> _getReferralSummaryFallback() async {
    final user = currentUser;
    if (user == null) {
      return null;
    }

    final customerResponse = await client
        .from('customers')
        .select('id, salon_id, referral_code')
        .eq('auth_user_id', user.id)
        .maybeSingle();

    if (customerResponse == null) {
      return null;
    }

    final customer = Map<String, dynamic>.from(customerResponse);
    final customerId = customer['id'] as String?;
    final salonId = customer['salon_id'] as String?;

    if (customerId == null || salonId == null) {
      return null;
    }

    final activeProgramResponse = await client
        .from('salon_referral_programs')
        .select('*')
        .eq('salon_id', salonId)
        .eq('is_active', true)
        .order('updated_at', ascending: false)
        .limit(1)
        .maybeSingle();

    final referralEventsResponse = await client
        .from('salon_referral_events')
        .select('id, invited_customer_id, status, qualified_at, created_at')
        .eq('referrer_customer_id', customerId)
        .order('created_at', ascending: false);

    final referralEvents = (referralEventsResponse as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();

    final invitedCustomerIds = referralEvents
        .map((item) => item['invited_customer_id'] as String?)
        .whereType<String>()
        .toSet()
        .toList();

    final invitedCustomerNames = <String, String>{};
    if (invitedCustomerIds.isNotEmpty) {
      final invitedCustomersResponse = await client
          .from('customers')
          .select('id, name')
          .inFilter('id', invitedCustomerIds);

      for (final item in invitedCustomersResponse as List) {
        final map = Map<String, dynamic>.from(item as Map);
        final invitedId = map['id'] as String?;
        final invitedName = _readNullableString(map['name']);
        if (invitedId != null && invitedName != null) {
          invitedCustomerNames[invitedId] = invitedName;
        }
      }
    }

    final referrals = referralEvents
        .map(
          (item) => ReferralProgressItem.fromMap({
            ...item,
            'customer_name':
                invitedCustomerNames[item['invited_customer_id']] ?? 'Cliente',
          }),
        )
        .toList();

    final pendingCount = referralEvents
        .where((item) => item['status'] == 'pending')
        .length;
    final qualifiedCount = referralEvents
        .where((item) => item['status'] == 'qualified')
        .length;
    final rewardUnlocks = await (() async {
      try {
        final response = await client
            .from('salon_referral_reward_unlocks')
            .select(
              'id, threshold_reached, required_qualified_referrals, reward_description, reward_service_name, status, unlocked_at, redeemed_at',
            )
            .eq('referrer_customer_id', customerId)
            .order('unlocked_at', ascending: false)
            .limit(5);

        return (response as List)
            .map(
              (item) => ReferralRewardUnlockItem.fromMap(
                Map<String, dynamic>.from(item as Map),
              ),
            )
            .toList();
      } on PostgrestException catch (error) {
        if (error.message.toLowerCase().contains(
          'salon_referral_reward_unlocks',
        )) {
          return const <ReferralRewardUnlockItem>[];
        }
        rethrow;
      }
    })();
    final availableRewardsCount = rewardUnlocks
        .where((reward) => reward.status == 'available')
        .length;
    final programInfo = activeProgramResponse == null
        ? null
        : ReferralProgramInfo.fromMap(
            Map<String, dynamic>.from(activeProgramResponse),
          );
    final requiredQualifiedReferrals =
        programInfo?.requiredQualifiedReferrals ?? 10;
    final currentCycleProgress = requiredQualifiedReferrals > 0
        ? qualifiedCount % requiredQualifiedReferrals
        : qualifiedCount;
    final nextRewardRemaining = requiredQualifiedReferrals <= 0
        ? 0
        : qualifiedCount == 0
        ? requiredQualifiedReferrals
        : currentCycleProgress == 0
        ? requiredQualifiedReferrals
        : requiredQualifiedReferrals - currentCycleProgress;

    return ReferralSummary(
      referralCode: _readNullableString(customer['referral_code']) ?? '',
      pendingCount: pendingCount,
      qualifiedCount: qualifiedCount,
      currentCycleProgress: currentCycleProgress,
      nextRewardRemaining: nextRewardRemaining,
      unlockedRewardsCount: rewardUnlocks.length,
      availableRewardsCount: availableRewardsCount,
      referrals: referrals,
      rewardUnlocks: rewardUnlocks,
      program: programInfo,
    );
  }
}
