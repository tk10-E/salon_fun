part of 'salon_repository.dart';

mixin _SalonRepositoryFavoritesMixin on _SalonRepositoryBase {
  Future<Set<String>> getFavoriteServiceIds() async {
    final user = currentUser;
    if (user == null) {
      return const <String>{};
    }

    try {
      final data = await client
          .from('customer_favorite_services')
          .select('service_id')
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((item) => item['service_id'] as String?)
          .whereType<String>()
          .toSet();
    } on PostgrestException catch (error) {
      if (_isMissingFavoritesSchemaError(error)) {
        return const <String>{};
      }
      rethrow;
    }
  }

  Future<Set<String>> getFavoriteStaffMemberIds() async {
    final user = currentUser;
    if (user == null) {
      return const <String>{};
    }

    try {
      final data = await client
          .from('customer_favorite_staff_members')
          .select('staff_member_id')
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((item) => item['staff_member_id'] as String?)
          .whereType<String>()
          .toSet();
    } on PostgrestException catch (error) {
      if (_isMissingFavoritesSchemaError(error)) {
        return const <String>{};
      }
      rethrow;
    }
  }

  Future<List<FavoriteStaffMemberItem>> getFavoriteStaffMembers() async {
    final user = currentUser;
    if (user == null) {
      return const <FavoriteStaffMemberItem>[];
    }

    try {
      final data = await client
          .from('customer_favorite_staff_members')
          .select('created_at, staff_members(id, name, role)')
          .order('created_at', ascending: false);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((item) => _extractSalonMap(item['staff_members']))
          .where((staffMap) => staffMap.isNotEmpty)
          .map(FavoriteStaffMemberItem.fromMap)
          .toList();
    } on PostgrestException catch (error) {
      if (_isMissingFavoritesSchemaError(error)) {
        return const <FavoriteStaffMemberItem>[];
      }
      rethrow;
    }
  }

  Future<void> toggleFavoriteService({
    required String serviceId,
    required bool isFavorite,
  }) async {
    if (isFavorite) {
      await client.from('customer_favorite_services').upsert({
        'service_id': serviceId,
      }, onConflict: 'customer_id,service_id');
      return;
    }

    await client
        .from('customer_favorite_services')
        .delete()
        .eq('service_id', serviceId);
  }

  Future<void> toggleFavoriteStaffMember({
    required String staffMemberId,
    required bool isFavorite,
  }) async {
    if (isFavorite) {
      await client.from('customer_favorite_staff_members').upsert({
        'staff_member_id': staffMemberId,
      }, onConflict: 'customer_id,staff_member_id');
      return;
    }

    await client
        .from('customer_favorite_staff_members')
        .delete()
        .eq('staff_member_id', staffMemberId);
  }
}
