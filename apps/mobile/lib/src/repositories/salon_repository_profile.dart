part of 'salon_repository.dart';

mixin _SalonRepositoryProfileMixin on _SalonRepositoryBase {
  Future<CustomerProfile?> getCustomerProfile() async {
    final user = currentUser;
    if (user == null) {
      return null;
    }

    Map<String, dynamic>? data;

    try {
      final response = await client
          .from('customers')
          .select(
            'id, name, phone, preferences, allergies, beauty_products, salon_id, salons(name, tagline, brand_color, business_segment, whatsapp_phone, logo_path)',
          )
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (response != null) {
        data = Map<String, dynamic>.from(response);
      }
    } on PostgrestException catch (error) {
      if (!_isLegacyProfileSchemaError(error)) {
        rethrow;
      }

      final legacyResponse = await client
          .from('customers')
          .select('id, name, salon_id, salons(name)')
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (legacyResponse != null) {
        data = Map<String, dynamic>.from(legacyResponse);
      }
    }

    if (data == null) {
      return null;
    }

    final salonMap = _extractSalonMap(data['salons']);
    final logoPath = _readNullableString(salonMap['logo_path']);
    final salonLogoUrl = _buildSalonLogoUrl(logoPath);

    return CustomerProfile.fromMap(data, salonLogoUrl: salonLogoUrl);
  }

  Future<SalonJoinPreview?> getSalonJoinPreview(String joinCode) async {
    final normalizedCode = joinCode.trim().toUpperCase();
    if (normalizedCode.isEmpty) {
      return null;
    }

    try {
      final data = await client.rpc(
        'get_salon_join_preview',
        params: {'input_join_code': normalizedCode},
      );

      final previewMap = switch (data) {
        final List<dynamic> list when list.isNotEmpty =>
          Map<String, dynamic>.from(list.first as Map),
        final Map<dynamic, dynamic> map => Map<String, dynamic>.from(map),
        _ => null,
      };

      if (previewMap == null) {
        return null;
      }

      final logoPath = _readNullableString(previewMap['logo_path']);
      return SalonJoinPreview.fromMap(
        previewMap,
        salonLogoUrl: _buildSalonLogoUrl(logoPath),
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_salon_join_preview')) {
        return null;
      }
      rethrow;
    }
  }

  Future<void> joinSalon({
    required String code,
    required String customerName,
    String? referralCode,
  }) async {
    final normalizedReferralCode = referralCode?.trim();

    await client.rpc(
      'join_salon',
      params: {
        'input_join_code': code.trim().toUpperCase(),
        'customer_name': customerName.trim(),
        'referral_code_input':
            normalizedReferralCode == null || normalizedReferralCode.isEmpty
            ? null
            : normalizedReferralCode.toUpperCase(),
      },
    );
  }

  Future<void> updateCustomerName({
    required String customerId,
    required String customerName,
  }) async {
    await updateCustomerProfile(
      customerId: customerId,
      customerName: customerName,
    );
  }

  Future<void> updateCustomerProfile({
    required String customerId,
    required String customerName,
    String? phone,
    String? preferences,
    String? allergies,
    String? beautyProducts,
  }) async {
    await client
        .from('customers')
        .update({
          'name': customerName.trim(),
          'phone': _readNullableString(phone),
          'preferences': _readNullableString(preferences),
          'allergies': _readNullableString(allergies),
          'beauty_products': _readNullableString(beautyProducts),
        })
        .eq('id', customerId);
  }
}
