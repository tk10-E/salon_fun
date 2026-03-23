import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/home/home_data_loader.dart';
import '../models/app_models.dart';
import '../services/push_token_sync_service.dart';

part 'salon_repository_appointments.dart';
part 'salon_repository_auth.dart';
part 'salon_repository_benefits.dart';
part 'salon_repository_feed.dart';
part 'salon_repository_favorites.dart';
part 'salon_repository_notifications.dart';
part 'salon_repository_profile.dart';
part 'salon_repository_push_tokens.dart';

class SignUpResult {
  const SignUpResult({
    required this.email,
    required this.requiresEmailConfirmation,
  });

  final String email;
  final bool requiresEmailConfirmation;
}

abstract class _SalonRepositoryBase {
  SupabaseClient get client;
  User? get currentUser;

  String? _emailRedirectTo() {
    if (!kIsWeb) {
      return null;
    }

    final base = Uri.base;
    if (base.hasAuthority) {
      return '${base.origin}/';
    }

    return null;
  }

  String? _buildSalonLogoUrl(String? logoPath) {
    if (logoPath == null) {
      return null;
    }

    return client.storage.from('salon-assets').getPublicUrl(logoPath);
  }

  String _buildSalonPostImageUrl(String imagePath) {
    return client.storage.from('salon-posts').getPublicUrl(imagePath);
  }

  bool _isLegacyProfileSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return message.contains('tagline') ||
        message.contains('brand_color') ||
        message.contains('whatsapp_phone') ||
        message.contains('logo_path') ||
        message.contains('phone') ||
        message.contains('preferences') ||
        message.contains('allergies') ||
        message.contains('beauty_products');
  }

  bool _isMissingFeedSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return message.contains('salon_posts') ||
        message.contains('salon_post_likes') ||
        message.contains('salon_post_comments');
  }

  bool _isLegacyFeedSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return _isMissingFeedSchemaError(error) ||
        message.contains('salon_post_images') ||
        message.contains('service_id');
  }

  bool _isMissingFavoritesSchemaError(PostgrestException error) {
    final message = error.message.toLowerCase();
    return message.contains('customer_favorite_services') ||
        message.contains('customer_favorite_staff_members');
  }
}

class SalonRepository extends _SalonRepositoryBase
    with
        _SalonRepositoryAuthMixin,
        _SalonRepositoryProfileMixin,
        _SalonRepositoryBenefitsMixin,
        _SalonRepositoryAppointmentsMixin,
        _SalonRepositoryNotificationsMixin,
        _SalonRepositoryFavoritesMixin,
        _SalonRepositoryFeedMixin,
        _SalonRepositoryPushTokensMixin
    implements HomeDataRepository, PushTokenSyncRepository {
  SalonRepository(this.client);

  @override
  final SupabaseClient client;

  Stream<AuthState> get authChanges => client.auth.onAuthStateChange;

  @override
  User? get currentUser => client.auth.currentUser;
}

Map<String, dynamic> _extractSalonMap(Object? salonData) {
  if (salonData is List) {
    if (salonData.isEmpty) {
      return <String, dynamic>{};
    }

    return Map<String, dynamic>.from(salonData.first as Map);
  }

  if (salonData is Map) {
    return Map<String, dynamic>.from(salonData);
  }

  return <String, dynamic>{};
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}

List<Map<String, dynamic>> _readListMap(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}
