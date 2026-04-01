part of 'salon_repository.dart';

mixin _SalonRepositoryTeamMixin on _SalonRepositoryBase {
  Future<List<SalonTeamMemberProfile>> getSalonTeamProfiles({
    int limit = 12,
  }) async {
    final todayWeekday = DateTime.now().weekday % 7;

    try {
      final data = await client
          .from('staff_members')
          .select(
            'id, name, role, staff_service_assignments(services(name, category)), staff_business_hours(weekday, is_open, opens_at, closes_at)',
          )
          .eq('is_active', true)
          .order('name')
          .limit(limit);

      return (data as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((staffMap) {
            final assignments = _readListMap(
              staffMap['staff_service_assignments'],
            );
            final serviceNames = <String>{};
            final serviceCategories = <String>{};

            for (final assignment in assignments) {
              final serviceMap = _extractSalonMap(assignment['services']);
              final serviceName = _readNullableString(serviceMap['name']);
              final serviceCategory = _readNullableString(
                serviceMap['category'],
              );

              if (serviceName != null) {
                serviceNames.add(serviceName);
              }

              if (serviceCategory != null) {
                serviceCategories.add(serviceCategory);
              }
            }

            final businessHours = _readListMap(
              staffMap['staff_business_hours'],
            );
            final todaySchedule = businessHours
                .cast<Map<String, dynamic>?>()
                .firstWhere(
                  (schedule) =>
                      schedule != null &&
                      ((schedule['weekday'] ?? -1) as num).toInt() ==
                          todayWeekday,
                  orElse: () => null,
                );

            return SalonTeamMemberProfile.fromMap({
              'id': staffMap['id'],
              'name': staffMap['name'],
              'role': staffMap['role'],
              'is_working_today': (todaySchedule?['is_open'] ?? false) as bool,
              'opens_at': todaySchedule?['opens_at'],
              'closes_at': todaySchedule?['closes_at'],
              'service_names': serviceNames.toList(growable: false),
              'service_categories': serviceCategories.toList(growable: false),
            });
          })
          .toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('staff_members') ||
          message.contains('staff_service_assignments') ||
          message.contains('staff_business_hours')) {
        return const <SalonTeamMemberProfile>[];
      }
      rethrow;
    }
  }
}
