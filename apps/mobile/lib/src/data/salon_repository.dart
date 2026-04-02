import 'dart:convert';
import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth_identity_policy.dart';
import '../core/social_auth_config.dart';
import '../core/supabase_config.dart';
import 'app_cache_store.dart';
import 'snapshot_codec.dart';
import '../models/app_models.dart';

class SignUpResult {
  const SignUpResult({
    required this.email,
    required this.requiresEmailConfirmation,
  });

  final String email;
  final bool requiresEmailConfirmation;
}

class SalonRepository {
  SalonRepository(this.client);

  final SupabaseClient client;
  final firebase_auth.FirebaseAuth _firebaseAuth =
      firebase_auth.FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: const <String>['email'],
  );
  final AppCacheStore _cacheStore = const AppCacheStore();
  static const String _cacheVersion = '2026-04-shell-v1';

  User? get currentUser => client.auth.currentUser;
  Stream<AuthState> get authChanges => client.auth.onAuthStateChange;

  Future<void> signIn({required String email, required String password}) async {
    final normalizedEmail = email.trim();

    try {
      final credentials = await _firebaseAuth.signInWithEmailAndPassword(
        email: normalizedEmail,
        password: password,
      );
      final firebaseUser = credentials.user ?? _firebaseAuth.currentUser;
      if (firebaseUser == null) {
        throw StateError(
          'O Firebase autenticou a conta, mas o app nao recebeu o usuario.',
        );
      }

      await _ensureFirebaseEmailVerifiedBeforeBridge(
        firebaseUser,
        resendIfNeeded: true,
      );
      await _bridgeFirebaseSessionToSupabase(firebaseUser, forceRefresh: true);
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } catch (error) {
      await _rollbackFirebaseSession();
      rethrow;
    }
  }

  Future<SignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim();

    try {
      final credentials = await _firebaseAuth.createUserWithEmailAndPassword(
        email: normalizedEmail,
        password: password,
      );
      final firebaseUser = credentials.user ?? _firebaseAuth.currentUser;
      if (firebaseUser == null) {
        throw StateError(
          'A conta foi criada no Firebase, mas o app nao recebeu o usuario.',
        );
      }

      await _sendEmailVerificationIfPossible(firebaseUser);
      await _firebaseAuth.signOut();

      return SignUpResult(
        email: normalizedEmail,
        requiresEmailConfirmation: true,
      );
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } catch (error) {
      await _rollbackFirebaseSession();
      rethrow;
    }
  }

  Future<void> sendPasswordResetEmail({required String email}) async {
    try {
      await _firebaseAuth.sendPasswordResetEmail(email: email.trim());
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        throw StateError('O login com Google foi cancelado.');
      }

      final googleAuth = await googleUser.authentication;
      if ((googleAuth.idToken ?? '').trim().isEmpty &&
          (googleAuth.accessToken ?? '').trim().isEmpty) {
        throw StateError(
          'Nao foi possivel confirmar a autenticacao com Google neste aparelho.',
        );
      }

      final credential = firebase_auth.GoogleAuthProvider.credential(
        idToken: googleAuth.idToken,
        accessToken: googleAuth.accessToken,
      );

      final userCredential = await _firebaseAuth.signInWithCredential(
        credential,
      );
      final firebaseUser = userCredential.user ?? _firebaseAuth.currentUser;
      if (firebaseUser == null) {
        throw StateError(
          'O login com Google foi concluido, mas o app nao recebeu o usuario.',
        );
      }

      await _bridgeFirebaseSessionToSupabase(firebaseUser, forceRefresh: true);
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } catch (error) {
      await _rollbackFirebaseSession();
      rethrow;
    }
  }

  Future<void> signInWithFacebook() async {
    if (!SocialAuthConfig.hasFacebookNativeConfig) {
      throw StateError(
        'Preencha FACEBOOK_APP_ID e FACEBOOK_CLIENT_TOKEN no .env.local para ativar o login com Facebook.',
      );
    }

    try {
      final result = await FacebookAuth.instance.login(
        permissions: const <String>['email', 'public_profile'],
      );

      switch (result.status) {
        case LoginStatus.success:
          final accessToken = result.accessToken;
          if (accessToken == null || accessToken.tokenString.trim().isEmpty) {
            throw StateError(
              'O Facebook nao retornou um token valido para autenticar.',
            );
          }

          final credential = firebase_auth.FacebookAuthProvider.credential(
            accessToken.tokenString,
          );
          final userCredential = await _firebaseAuth.signInWithCredential(
            credential,
          );
          final firebaseUser = userCredential.user ?? _firebaseAuth.currentUser;
          if (firebaseUser == null) {
            throw StateError(
              'O login com Facebook foi concluido, mas o app nao recebeu o usuario.',
            );
          }

          await _bridgeFirebaseSessionToSupabase(
            firebaseUser,
            forceRefresh: true,
          );
        case LoginStatus.cancelled:
          throw StateError('O login com Facebook foi cancelado.');
        case LoginStatus.failed:
          throw StateError(
            result.message?.trim().isNotEmpty == true
                ? result.message!.trim()
                : 'Nao foi possivel entrar com Facebook.',
          );
        case LoginStatus.operationInProgress:
          throw StateError(
            'Ja existe um login com Facebook em andamento. Aguarde um instante.',
          );
      }
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } catch (error) {
      await _rollbackFirebaseSession();
      rethrow;
    }
  }

  Future<void> bootstrapAuthSession() async {
    var firebaseUser = _firebaseAuth.currentUser;
    final supabaseUser = currentUser;

    if (firebaseUser == null) {
      if (supabaseUser != null) {
        await client.auth.signOut();
      }
      return;
    }

    final requiresConfirmedEmail = requiresConfirmedEmailForSession(
      firebaseUser.providerData.map((provider) => provider.providerId),
    );
    if (requiresConfirmedEmail) {
      await firebaseUser.reload();
      firebaseUser = _firebaseAuth.currentUser ?? firebaseUser;

      if (!firebaseUser.emailVerified) {
        if (supabaseUser != null) {
          await client.auth.signOut();
        }
        await _firebaseAuth.signOut();
        return;
      }
    }

    final firebaseEmail = firebaseUser.email?.trim().toLowerCase();
    final supabaseEmail = supabaseUser?.email?.trim().toLowerCase();
    final needsBridge =
        supabaseUser == null ||
        (firebaseEmail != null &&
            firebaseEmail.isNotEmpty &&
            supabaseEmail != null &&
            supabaseEmail.isNotEmpty &&
            firebaseEmail != supabaseEmail);

    if (needsBridge) {
      await _bridgeFirebaseSessionToSupabase(firebaseUser, forceRefresh: false);
      return;
    }

    await _linkCustomerIdentityByEmail();
  }

  Future<void> signOut() async {
    try {
      await client.auth.signOut();
    } finally {
      unawaited(_googleSignIn.signOut());
      unawaited(FacebookAuth.instance.logOut());
      await _firebaseAuth.signOut();
    }
  }

  Future<CustomerProfile?> getCustomerProfile() async {
    final user = currentUser;
    if (user == null) {
      return null;
    }

    await _linkCustomerIdentityByEmail();

    final cacheKey = _cacheKey('customer-profile', suffix: user.id);

    try {
      final response = await client
          .from('customers')
          .select(
            'id, name, phone, preferences, allergies, beauty_products, salon_id, salons(name, tagline, brand_color, business_segment, whatsapp_phone, logo_path, client_app_config)',
          )
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (response == null) {
        return null;
      }

      final data = Map<String, dynamic>.from(response);
      final salonMap = _asSingleMap(data['salons']);
      final logoPath = _readNullableString(salonMap['logo_path']);
      final salonLogoUrl = _buildStorageUrl('salon-assets', logoPath);
      final profile = CustomerProfile.fromMap(data, salonLogoUrl: salonLogoUrl);
      await _writeCachedData(cacheKey, encodeCustomerProfile(profile));
      return profile;
    } catch (_) {
      final cached = await _readCachedData(cacheKey);
      if (cached == null) {
        rethrow;
      }

      return decodeCustomerProfile(cached);
    }
  }

  Future<void> _bridgeFirebaseSessionToSupabase(
    firebase_auth.User firebaseUser, {
    required bool forceRefresh,
  }) async {
    final idToken = await firebaseUser.getIdToken(forceRefresh);
    final normalizedToken = idToken?.trim() ?? '';
    if (normalizedToken.isEmpty) {
      throw StateError(
        'Nao foi possivel ler o token do Firebase para abrir a sessao do app.',
      );
    }

    final response = await http.post(
      Uri.parse('${SupabaseConfig.url}/auth/v1/token?grant_type=id_token'),
      headers: <String, String>{
        ...client.auth.headers,
        'apikey': SupabaseConfig.anonKey,
        'content-type': 'application/json',
      },
      body: jsonEncode(<String, dynamic>{
        'provider': 'firebase',
        'id_token': normalizedToken,
      }),
    );

    final decodedBody = jsonDecode(response.body);
    final responseMap = decodedBody is Map
        ? Map<String, dynamic>.from(decodedBody)
        : <String, dynamic>{};

    if (response.statusCode >= 400) {
      throw StateError(_supabaseFirebaseBridgeError(responseMap));
    }
    if (responseMap['access_token'] == null || responseMap['user'] == null) {
      throw StateError(
        'O Supabase nao retornou uma sessao valida apos validar o Firebase.',
      );
    }

    await client.auth.recoverSession(jsonEncode(responseMap));
    await _linkCustomerIdentityByEmail();
  }

  Future<void> _rollbackFirebaseSession() async {
    if (_firebaseAuth.currentUser == null) {
      return;
    }

    if (currentUser == null) {
      await _firebaseAuth.signOut();
    }
  }

  Future<void> _ensureFirebaseEmailVerifiedBeforeBridge(
    firebase_auth.User firebaseUser, {
    required bool resendIfNeeded,
  }) async {
    final requiresConfirmedEmail = requiresConfirmedEmailForSession(
      firebaseUser.providerData.map((provider) => provider.providerId),
    );
    if (!requiresConfirmedEmail) {
      return;
    }

    await firebaseUser.reload();
    final refreshedUser = _firebaseAuth.currentUser ?? firebaseUser;
    if (refreshedUser.emailVerified) {
      return;
    }

    final verificationEmailSent = resendIfNeeded
        ? await _sendEmailVerificationIfPossible(refreshedUser)
        : false;

    if (currentUser != null) {
      await client.auth.signOut();
    }
    await _firebaseAuth.signOut();

    throw StateError(
      buildEmailVerificationRequiredMessage(
        verificationEmailSent: verificationEmailSent,
      ),
    );
  }

  Future<bool> _sendEmailVerificationIfPossible(
    firebase_auth.User firebaseUser,
  ) async {
    try {
      await firebaseUser.sendEmailVerification();
      return true;
    } on firebase_auth.FirebaseAuthException {
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> _linkCustomerIdentityByEmail() async {
    if (currentUser == null) {
      return;
    }

    final firebaseUser = _firebaseAuth.currentUser;
    if (!hasVerifiedEmailIdentity(
      email: firebaseUser?.email,
      emailVerified: firebaseUser?.emailVerified ?? false,
    )) {
      return;
    }

    try {
      await client.rpc('link_customer_identity_by_email');
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('link_customer_identity_by_email') &&
          message.contains('does not exist')) {
        return;
      }
      rethrow;
    }
  }

  String _firebaseAuthMessage(firebase_auth.FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
      case 'invalid-email':
        return 'E-mail ou senha invalidos.';
      case 'account-exists-with-different-credential':
        return 'Esta conta ja existe com outro provedor. Entre com o metodo original e vincule depois.';
      case 'email-already-in-use':
        return 'Este e-mail ja esta em uso.';
      case 'weak-password':
        return 'Use uma senha mais forte para criar a conta.';
      case 'too-many-requests':
        return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
      case 'network-request-failed':
        return 'Falha de rede. Confira sua conexao e tente de novo.';
      case 'web-context-cancelled':
        return 'O login social foi fechado antes da confirmacao.';
      default:
        return error.message?.trim().isNotEmpty == true
            ? error.message!.trim()
            : 'Nao foi possivel autenticar com o Firebase.';
    }
  }

  String _supabaseFirebaseBridgeError(Map<String, dynamic> payload) {
    final rawMessage =
        payload['msg']?.toString() ??
        payload['message']?.toString() ??
        payload['error_description']?.toString() ??
        payload['error']?.toString();
    final normalizedMessage = rawMessage?.trim();

    if (normalizedMessage != null && normalizedMessage.isNotEmpty) {
      return normalizedMessage;
    }

    return 'O Firebase autenticou a conta, mas o Supabase nao aceitou o token. Confirme se o provedor Firebase esta ativo no Supabase Auth.';
  }

  Future<SalonJoinPreview?> getSalonJoinPreview(String joinCode) async {
    final normalizedCode = joinCode.trim().toUpperCase();
    if (normalizedCode.isEmpty) {
      return null;
    }

    try {
      final response = await client.rpc(
        'get_salon_join_preview',
        params: {'input_join_code': normalizedCode},
      );

      final previewMap = switch (response) {
        final Map<dynamic, dynamic> map => Map<String, dynamic>.from(map),
        final List<dynamic> list when list.isNotEmpty =>
          Map<String, dynamic>.from(list.first as Map),
        _ => null,
      };

      if (previewMap == null) {
        return null;
      }

      final logoPath = _readNullableString(previewMap['logo_path']);
      return SalonJoinPreview.fromMap(
        previewMap,
        salonLogoUrl: _buildStorageUrl('salon-assets', logoPath),
      );
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('get_salon_join_preview')) {
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
    final normalizedReferral = referralCode?.trim().toUpperCase();

    await client.rpc(
      'join_salon',
      params: {
        'input_join_code': code.trim().toUpperCase(),
        'customer_name': customerName.trim(),
        'referral_code_input':
            normalizedReferral == null || normalizedReferral.isEmpty
            ? null
            : normalizedReferral,
      },
    );
  }

  Future<void> registerPushToken({
    required String token,
    required String platform,
    String? deviceLabel,
  }) async {
    await client.rpc(
      'register_customer_push_token',
      params: {
        'input_token': token.trim(),
        'device_platform_input': platform.trim().toLowerCase(),
        'device_label_input': deviceLabel?.trim(),
      },
    );
  }

  Future<void> deactivatePushToken({required String token}) async {
    await client.rpc(
      'deactivate_customer_push_token',
      params: {'input_token': token.trim()},
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

    await _invalidateCacheScopes(const <String>[
      'customer-profile',
      'profile-hub',
      'home',
    ]);
  }

  Future<List<ServiceItem>> getServices() async {
    final response = await client
        .from('services')
        .select(
          'id, category, name, description, price, duration, sort_order, image_path',
        )
        .order('sort_order')
        .order('category')
        .order('name');

    return (response as List)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map((serviceMap) {
          final imagePath = _readNullableString(serviceMap['image_path']);

          return ServiceItem.fromMap({
            ...serviceMap,
            'image_url': _buildStorageUrl('salon-assets', imagePath),
          });
        })
        .toList(growable: false);
  }

  Future<List<TeamMember>> getTeamMembers({int limit = 12}) async {
    final weekday = DateTime.now().weekday % 7;

    try {
      final response = await client
          .from('staff_members')
          .select(
            'id, name, role, staff_service_assignments(services(name, category)), staff_business_hours(weekday, is_open, opens_at, closes_at)',
          )
          .eq('is_active', true)
          .order('name')
          .limit(limit);

      return (response as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((staffMap) {
            final assignments = _readListMaps(
              staffMap['staff_service_assignments'],
            );
            final serviceNames = <String>{};
            final serviceCategories = <String>{};

            for (final assignment in assignments) {
              final service = _asSingleMap(assignment['services']);
              final name = _readNullableString(service['name']);
              final category = _readNullableString(service['category']);

              if (name != null) {
                serviceNames.add(name);
              }
              if (category != null) {
                serviceCategories.add(category);
              }
            }

            final hours = _readListMaps(staffMap['staff_business_hours']);
            final todaySchedule = hours
                .cast<Map<String, dynamic>?>()
                .firstWhere(
                  (entry) =>
                      entry != null &&
                      ((entry['weekday'] ?? -1) as num).toInt() == weekday,
                  orElse: () => null,
                );

            return TeamMember.fromMap({
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
        return const <TeamMember>[];
      }
      rethrow;
    }
  }

  Future<List<OfferItem>> getOffers() async {
    try {
      final response = await client
          .from('salon_offers')
          .select(
            'id, kind, title, description, highlight_text, price, starts_on, ends_on, is_active, sort_order',
          )
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at', ascending: false);

      return (response as List)
          .map((item) => OfferItem.fromMap(Map<String, dynamic>.from(item)))
          .toList(growable: false);
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_offers')) {
        return const <OfferItem>[];
      }
      rethrow;
    }
  }

  Future<List<RetailProduct>> getRetailProducts({int limit = 24}) async {
    try {
      final response = await client.rpc(
        'get_customer_product_catalog',
        params: {'limit_count': limit},
      );

      if (response is! List) {
        return const <RetailProduct>[];
      }

      return response
          .map(
            (item) =>
                RetailProduct.fromMap(Map<String, dynamic>.from(item as Map)),
          )
          .toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_product_catalog') ||
          message.contains('inventory_products')) {
        return const <RetailProduct>[];
      }
      rethrow;
    }
  }

  Future<List<AppointmentItem>> getAppointments() async {
    final response = await client
        .from('appointments')
        .select(
          'id, date, ends_at, status, completed_at, cancelled_at, cancelled_by, cancellation_reason, customer_confirmation_requested_at, customer_presence_confirmed_at, services(name, price, duration), staff_members(name)',
        )
        .order('date', ascending: false);

    return (response as List)
        .map((item) => AppointmentItem.fromMap(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<VacancyAlert>> getVacancyAlerts() async {
    try {
      final response = await client
          .from('salon_vacancy_alerts')
          .select(
            'id, service_id, staff_member_id, headline, body, starts_at, ends_at, created_at',
          )
          .gte('ends_at', DateTime.now().toUtc().toIso8601String())
          .order('created_at', ascending: false)
          .limit(6);

      return (response as List)
          .map((item) => VacancyAlert.fromMap(Map<String, dynamic>.from(item)))
          .toList(growable: false);
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_vacancy_alerts')) {
        return const <VacancyAlert>[];
      }
      rethrow;
    }
  }

  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final response = await client.rpc(
      'get_day_availability',
      params: {
        'service_uuid': serviceId,
        'target_day': DateFormat('yyyy-MM-dd').format(day),
      },
    );

    return DayAvailability.fromMap(Map<String, dynamic>.from(response as Map));
  }

  Future<CachedView<DayAvailability>> loadDayAvailability({
    required String serviceId,
    required DateTime day,
  }) {
    final normalizedDay = DateTime(day.year, day.month, day.day);
    final dayKey = DateFormat('yyyyMMdd').format(normalizedDay);

    return _loadCachedView(
      cacheKey: _cacheKey('day-availability', suffix: '$serviceId:$dayKey'),
      fetcher: () =>
          getDayAvailability(serviceId: serviceId, day: normalizedDay),
      encode: encodeDayAvailability,
      decode: decodeDayAvailability,
    );
  }

  Future<void> warmDayAvailabilityCache({
    required String serviceId,
    required Iterable<DateTime> days,
  }) async {
    final normalizedDays = days
        .map((day) => DateTime(day.year, day.month, day.day))
        .toSet()
        .toList(growable: false);

    for (final day in normalizedDays) {
      try {
        final availability = await getDayAvailability(
          serviceId: serviceId,
          day: day,
        );
        final dayKey = DateFormat('yyyyMMdd').format(day);
        await _writeCachedData(
          _cacheKey('day-availability', suffix: '$serviceId:$dayKey'),
          encodeDayAvailability(availability),
        );
      } catch (_) {
        // Warm-up should never block the booking flow.
      }
    }
  }

  Future<void> createAppointment({
    required String serviceId,
    required DateTime startAt,
    String? preferredStaffMemberId,
  }) async {
    await client.rpc(
      'create_appointment',
      params: {
        'service_uuid': serviceId,
        'requested_date': startAt.toUtc().toIso8601String(),
        'preferred_staff_member_uuid': preferredStaffMemberId,
      },
    );

    final day = DateTime(startAt.year, startAt.month, startAt.day);
    await _invalidateCacheScopes(const <String>['home', 'appointments']);
    await _invalidateDayAvailability(serviceId: serviceId, day: day);
  }

  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
  }) async {
    await client.rpc(
      'cancel_appointment',
      params: {
        'appointment_uuid': appointmentId,
        'cancellation_reason_input': reason.trim(),
      },
    );

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<void> confirmUpcomingAppointmentPresence({
    required String appointmentId,
  }) async {
    await client.rpc(
      'confirm_upcoming_appointment_presence',
      params: {'appointment_uuid': appointmentId},
    );

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<void> claimVacancyAlert({required String alertId}) async {
    await client.rpc(
      'claim_vacancy_alert',
      params: {'vacancy_alert_uuid': alertId},
    );

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<List<FeedPost>> getFeedPosts({required String customerId}) async {
    try {
      final response = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,post_type,video_path,created_at,services(id,name,price,duration),staff_members(name,role),salon_post_images(image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
          )
          .order('created_at', ascending: false);

      return (response as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((postMap) {
            final imagePath = _readNullableString(postMap['image_path']);
            final galleryMaps = _readListMaps(postMap['salon_post_images'])
              ..sort(
                (left, right) => ((left['sort_order'] ?? 0) as num).compareTo(
                  ((right['sort_order'] ?? 0) as num),
                ),
              );

            final imageUrls = galleryMaps.isNotEmpty
                ? galleryMaps
                      .map(
                        (image) => _buildStorageUrl(
                          'salon-posts',
                          image['image_path']?.toString(),
                        ),
                      )
                      .whereType<String>()
                      .toList(growable: false)
                : <String>[
                    if (imagePath != null)
                      _buildStorageUrl('salon-posts', imagePath)!,
                  ];

            final videoPath = _readNullableString(postMap['video_path']);

            return FeedPost.fromMap(
              {
                ...postMap,
                'video_url': _buildStorageUrl('salon-posts', videoPath),
              },
              currentCustomerId: customerId,
              imageUrls: imageUrls,
            );
          })
          .where((post) => post.imageUrls.isNotEmpty)
          .toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('salon_posts') ||
          message.contains('salon_post_likes') ||
          message.contains('salon_post_comments')) {
        return const <FeedPost>[];
      }
      rethrow;
    }
  }

  Future<void> likePost({required String postId}) {
    return client.from('salon_post_likes').insert({'post_id': postId});
  }

  Future<void> unlikePost({
    required String postId,
    required String customerId,
  }) {
    return client
        .from('salon_post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('customer_id', customerId);
  }

  Future<void> addPostComment({required String postId, required String body}) {
    return client.from('salon_post_comments').insert({
      'post_id': postId,
      'body': body.trim(),
    });
  }

  Future<LoyaltySummary?> getLoyaltySummary() async {
    try {
      final response = await client.rpc('get_customer_loyalty_summary');
      final summary = LoyaltySummary.fromMap(
        Map<String, dynamic>.from(response as Map),
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

  Future<ReferralSummary?> getReferralSummary() async {
    try {
      final response = await client.rpc('get_customer_referral_summary');
      final summary = ReferralSummary.fromMap(
        Map<String, dynamic>.from(response as Map),
      );

      return summary.hasVisibleContent ? summary : null;
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_referral_summary') ||
          message.contains('salon_referral_') ||
          message.contains('referral_code')) {
        return null;
      }
      rethrow;
    }
  }

  Future<List<CustomerNotificationItem>> getCustomerNotifications() async {
    try {
      final response = await client
          .from('salon_customer_notifications')
          .select('id, notification_type, title, body, created_at, payload')
          .order('created_at', ascending: false)
          .limit(30);

      return (response as List)
          .map(
            (item) => CustomerNotificationItem.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(growable: false);
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'salon_customer_notifications',
      )) {
        return const <CustomerNotificationItem>[];
      }
      rethrow;
    }
  }

  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() async {
    try {
      final response = await client
          .from('customer_notification_receipts')
          .select('source_type, source_id, archived_at');

      final readKeys = <String>{};
      final archivedKeys = <String>{};

      for (final item in response as List) {
        final map = Map<String, dynamic>.from(item as Map);
        final key =
            '${map['source_type']?.toString() ?? 'salon_notification'}:${map['source_id']}';
        readKeys.add(key);
        if (map['archived_at'] != null) {
          archivedKeys.add(key);
        }
      }

      return NotificationReceiptSnapshot(
        readKeys: readKeys,
        archivedKeys: archivedKeys,
      );
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'customer_notification_receipts',
      )) {
        return const NotificationReceiptSnapshot(
          readKeys: <String>{},
          archivedKeys: <String>{},
        );
      }
      rethrow;
    }
  }

  Future<void> markNotificationsRead(
    List<CustomerNotificationItem> notifications,
  ) async {
    if (notifications.isEmpty) {
      return;
    }

    await client.rpc(
      'mark_customer_notifications_read',
      params: {
        'salon_notification_ids': notifications
            .where((item) => item.sourceType == 'salon_notification')
            .map((item) => item.id)
            .toList(),
        'vacancy_alert_ids': notifications
            .where((item) => item.sourceType == 'vacancy_alert')
            .map((item) => item.id)
            .toList(),
      },
    );

    await _invalidateCacheScopes(const <String>['home', 'profile-hub']);
  }

  Future<CachedView<HomeSnapshot>> loadHomeSnapshot({
    required String customerId,
  }) {
    return _loadCachedView(
      cacheKey: _cacheKey('home', suffix: customerId),
      fetcher: () async {
        final results = await Future.wait<Object?>([
          getServices(),
          getTeamMembers(limit: 8),
          getOffers(),
          getRetailProducts(limit: 8),
          getAppointments(),
          getVacancyAlerts(),
          getFeedPosts(customerId: customerId),
          getCustomerNotifications(),
          getLoyaltySummary(),
          getReferralSummary(),
          getNotificationReceiptSnapshot(),
        ]);

        final notifications = results[7] as List<CustomerNotificationItem>;
        final receipts = results[10] as NotificationReceiptSnapshot;
        final hydratedNotifications = notifications
            .where((item) => !receipts.archivedKeys.contains(item.readKey))
            .map(
              (item) => item.copyWith(
                isRead: receipts.readKeys.contains(item.readKey),
              ),
            )
            .toList(growable: false);

        return HomeSnapshot(
          services: results[0] as List<ServiceItem>,
          teamMembers: results[1] as List<TeamMember>,
          offers: results[2] as List<OfferItem>,
          products: results[3] as List<RetailProduct>,
          appointments: results[4] as List<AppointmentItem>,
          vacancyAlerts: results[5] as List<VacancyAlert>,
          posts: results[6] as List<FeedPost>,
          notifications: hydratedNotifications,
          loyaltySummary: results[8] as LoyaltySummary?,
          referralSummary: results[9] as ReferralSummary?,
        );
      },
      encode: encodeHomeSnapshot,
      decode: decodeHomeSnapshot,
    );
  }

  Future<CachedView<ExploreSnapshot>> loadExploreSnapshot() {
    return _loadCachedView(
      cacheKey: _cacheKey('explore'),
      fetcher: () async {
        final results = await Future.wait<Object?>([
          getServices(),
          getTeamMembers(),
          getOffers(),
          getRetailProducts(limit: 12),
        ]);

        return ExploreSnapshot(
          services: results[0] as List<ServiceItem>,
          teamMembers: results[1] as List<TeamMember>,
          offers: results[2] as List<OfferItem>,
          products: results[3] as List<RetailProduct>,
        );
      },
      encode: encodeExploreSnapshot,
      decode: decodeExploreSnapshot,
    );
  }

  Future<CachedView<AppointmentsSnapshot>> loadAppointmentsSnapshot() {
    return _loadCachedView(
      cacheKey: _cacheKey('appointments'),
      fetcher: () async {
        final results = await Future.wait<Object?>([
          getAppointments(),
          getVacancyAlerts(),
        ]);

        return AppointmentsSnapshot(
          appointments: results[0] as List<AppointmentItem>,
          vacancyAlerts: results[1] as List<VacancyAlert>,
        );
      },
      encode: encodeAppointmentsSnapshot,
      decode: decodeAppointmentsSnapshot,
    );
  }

  Future<CachedView<FeedSnapshot>> loadFeedSnapshot({
    required String customerId,
  }) {
    return _loadCachedView(
      cacheKey: _cacheKey('feed', suffix: customerId),
      fetcher: () async {
        final posts = await getFeedPosts(customerId: customerId);
        return FeedSnapshot(posts: posts);
      },
      encode: encodeFeedSnapshot,
      decode: decodeFeedSnapshot,
    );
  }

  Future<CachedView<ProfileSnapshot>> loadProfileSnapshot() {
    return _loadCachedView(
      cacheKey: _cacheKey('profile-hub'),
      fetcher: () async {
        final results = await Future.wait<Object?>([
          getLoyaltySummary(),
          getReferralSummary(),
          getCustomerNotifications(),
          getNotificationReceiptSnapshot(),
        ]);

        final notifications = results[2] as List<CustomerNotificationItem>;
        final receipts = results[3] as NotificationReceiptSnapshot;
        final unreadCount = notifications
            .where((item) => !receipts.readKeys.contains(item.readKey))
            .length;

        return ProfileSnapshot(
          loyaltySummary: results[0] as LoyaltySummary?,
          referralSummary: results[1] as ReferralSummary?,
          unreadNotificationsCount: unreadCount,
        );
      },
      encode: encodeProfileSnapshot,
      decode: decodeProfileSnapshot,
    );
  }

  Future<CachedView<T>> _loadCachedView<T>({
    required String cacheKey,
    required Future<T> Function() fetcher,
    required Map<String, dynamic> Function(T data) encode,
    required T Function(Map<String, dynamic> payload) decode,
  }) async {
    try {
      final data = await fetcher();
      await _writeCachedData(cacheKey, encode(data));
      return CachedView<T>(
        data: data,
        isFromCache: false,
        cachedAt: DateTime.now(),
      );
    } catch (error) {
      final cachedEntry = await _cacheStore.read(cacheKey);
      final cachedPayload = _cachedPayload(cachedEntry);
      if (cachedPayload == null) {
        rethrow;
      }

      return CachedView<T>(
        data: decode(cachedPayload),
        isFromCache: true,
        cachedAt: _cachedAt(cachedEntry),
        fallbackReason: error.toString(),
      );
    }
  }

  Future<void> _writeCachedData(
    String cacheKey,
    Map<String, dynamic> payload,
  ) async {
    await _cacheStore.write(cacheKey, <String, dynamic>{
      'cached_at': DateTime.now().toUtc().toIso8601String(),
      'payload': payload,
    });
  }

  Future<Map<String, dynamic>?> _readCachedData(String cacheKey) async {
    final cachedEntry = await _cacheStore.read(cacheKey);
    return _cachedPayload(cachedEntry);
  }

  Map<String, dynamic>? _cachedPayload(Map<String, dynamic>? entry) {
    final payload = entry?['payload'];
    if (payload is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(payload);
  }

  DateTime? _cachedAt(Map<String, dynamic>? entry) {
    final raw = entry?['cached_at']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  String _cacheKey(String scope, {String? suffix}) {
    final userId = currentUser?.id ?? 'guest';
    if (suffix == null || suffix.isEmpty) {
      return '$_cacheVersion:$scope:$userId';
    }

    return '$_cacheVersion:$scope:$userId:$suffix';
  }

  Future<void> _invalidateDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final dayKey = DateFormat('yyyyMMdd').format(day);
    await _cacheStore.remove(
      _cacheKey('day-availability', suffix: '$serviceId:$dayKey'),
    );
  }

  Future<void> _invalidateCacheScopes(List<String> scopes) async {
    final userId = currentUser?.id ?? 'guest';
    final prefixes = scopes
        .map((scope) => '$_cacheVersion:$scope:$userId')
        .toList(growable: false);

    await _cacheStore.removeWhere((key) {
      for (final prefix in prefixes) {
        if (key.startsWith(prefix)) {
          return true;
        }
      }

      return false;
    });
  }

  String? _buildStorageUrl(String bucket, String? path) {
    if (path == null || path.isEmpty) {
      return null;
    }

    return client.storage.from(bucket).getPublicUrl(path);
  }
}

Map<String, dynamic> _asSingleMap(Object? value) {
  if (value is List && value.isNotEmpty && value.first is Map) {
    return Map<String, dynamic>.from(value.first as Map);
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }

  return <String, dynamic>{};
}

List<Map<String, dynamic>> _readListMaps(Object? value) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList(growable: false);
}

String? _readNullableString(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return text;
}
