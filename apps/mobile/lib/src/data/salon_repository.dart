import 'dart:convert';
import 'dart:async';
import 'dart:typed_data';

import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/auth_identity_policy.dart';
import '../core/firebase_config.dart';
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

class _SupabaseBridgeCredentials {
  const _SupabaseBridgeCredentials({
    required this.email,
    required this.password,
  });

  final String email;
  final String password;
}

class ManagedDepositChargeResult {
  const ManagedDepositChargeResult({
    required this.appointmentId,
    required this.depositStatus,
    this.depositPaidAt,
    this.providerChargeId,
    this.providerStatus,
    this.providerPayload,
    this.providerInvoiceUrl,
    this.providerLastSyncedAt,
    this.providerError,
  });

  final String appointmentId;
  final String depositStatus;
  final DateTime? depositPaidAt;
  final String? providerChargeId;
  final String? providerStatus;
  final String? providerPayload;
  final String? providerInvoiceUrl;
  final DateTime? providerLastSyncedAt;
  final String? providerError;

  factory ManagedDepositChargeResult.fromMap(Map<String, dynamic> map) {
    final providerMap = map['provider'] is Map
        ? Map<String, dynamic>.from(map['provider'] as Map)
        : const <String, dynamic>{};

    return ManagedDepositChargeResult(
      appointmentId: _readNullableString(map['appointment_id']) ?? '',
      depositStatus: _readNullableString(map['deposit_status']) ?? 'pending',
      depositPaidAt: _readNullableDateTime(map['deposit_paid_at']),
      providerChargeId: _readNullableString(providerMap['charge_id']),
      providerStatus: _readNullableString(providerMap['status']),
      providerPayload: _readNullableString(providerMap['payload']),
      providerInvoiceUrl: _readNullableString(providerMap['invoice_url']),
      providerLastSyncedAt: _readNullableDateTime(
        providerMap['last_synced_at'],
      ),
      providerError: _readNullableString(providerMap['error']),
    );
  }
}

typedef OperationalIssueReporter = void Function(OperationalIssue issue);

class SalonRepository {
  SalonRepository(this.client);

  final SupabaseClient client;
  final firebase_auth.FirebaseAuth _firebaseAuth =
      firebase_auth.FirebaseAuth.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: const <String>['email'],
  );
  final AppCacheStore _cacheStore = const AppCacheStore();
  static const String _cacheVersion = '2026-04-shell-v3-store-orders';

  User? get currentUser => client.auth.currentUser;
  Stream<AuthState> get authChanges => client.auth.onAuthStateChange;

  void _reportOperationalIssue(
    OperationalIssueReporter? onIssue, {
    required String scope,
    required String title,
    required String message,
  }) {
    onIssue?.call(
      OperationalIssue(scope: scope, title: title, message: message),
    );
  }

  OperationalIssueReporter _dedupeIssues(List<OperationalIssue> issues) {
    return (issue) {
      final alreadyIncluded = issues.any((item) => item.scope == issue.scope);
      if (!alreadyIncluded) {
        issues.add(issue);
      }
    };
  }

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
      await _signInToSupabaseWithFirebaseIdentity(firebaseUser);
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } on AuthException catch (error) {
      throw StateError(_supabaseEmailAuthMessage(error));
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

      await _signInToSupabaseWithFirebaseIdentity(firebaseUser);
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw StateError(_firebaseAuthMessage(error));
    } on AuthException catch (error) {
      throw StateError(_supabaseEmailAuthMessage(error));
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

          await _signInToSupabaseWithFirebaseIdentity(firebaseUser);
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
    } on AuthException catch (error) {
      throw StateError(_supabaseEmailAuthMessage(error));
    } catch (error) {
      await _rollbackFirebaseSession();
      rethrow;
    }
  }

  Future<void> bootstrapAuthSession() async {
    final supabaseUser = currentUser;
    var firebaseUser = _firebaseAuth.currentUser;

    if (supabaseUser != null && firebaseUser == null) {
      await _linkCustomerIdentityByEmail();
      return;
    }

    if (firebaseUser == null) {
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
      await _signInToSupabaseWithFirebaseIdentity(firebaseUser);
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
      final response = await _getCurrentCustomerRow(user.id);

      if (response == null) {
        return null;
      }

      final data = Map<String, dynamic>.from(response);
      final salonId = _readNullableString(data['salon_id']);
      final salonMap = salonId == null
          ? <String, dynamic>{}
          : await _getSalonProfileMap(salonId);
      final logoPath = _readNullableString(salonMap['logo_path']);
      final salonLogoUrl = _buildStorageUrl('salon-assets', logoPath);
      final profile = CustomerProfile.fromMap({
        ...data,
        'salons': salonMap,
      }, salonLogoUrl: salonLogoUrl);
      await _writeCachedData(cacheKey, encodeCustomerProfile(profile));
      return profile;
    } catch (error) {
      final cached = await _readCachedData(cacheKey);
      if (cached == null) {
        throw StateError('Falha ao carregar o perfil do cliente: $error');
      }

      return decodeCustomerProfile(cached);
    }
  }

  Future<Map<String, dynamic>?> _getCurrentCustomerRow(
    String authUserId,
  ) async {
    for (var attempt = 0; attempt < 10; attempt += 1) {
      final directResponse = await _fetchCustomerRowByAuthUserId(authUserId);
      if (directResponse != null) {
        return directResponse;
      }

      final currentCustomerId = await _getCurrentCustomerId();
      if (currentCustomerId != null) {
        final customerById = await _fetchCustomerRowById(currentCustomerId);
        if (customerById != null) {
          final currentSalonId = await _getCurrentCustomerSalonId();
          if (_readNullableString(customerById['salon_id']) == null &&
              currentSalonId != null) {
            return <String, dynamic>{
              ...customerById,
              'salon_id': currentSalonId,
            };
          }

          return customerById;
        }
      }

      if (attempt < 9) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
      }
    }

    return null;
  }

  Future<Map<String, dynamic>?> _fetchCustomerRowByAuthUserId(
    String authUserId,
  ) async {
    final response = await client
        .from('customers')
        .select(
          'id, name, phone, preferences, allergies, beauty_products, consent_status, consent_signed_at, consent_version, salon_id',
        )
        .eq('auth_user_id', authUserId)
        .limit(1);

    if (response.isNotEmpty) {
      return Map<String, dynamic>.from(response.first);
    }

    return null;
  }

  Future<Map<String, dynamic>?> _fetchCustomerRowById(String customerId) async {
    final response = await client
        .from('customers')
        .select(
          'id, name, phone, preferences, allergies, beauty_products, consent_status, consent_signed_at, consent_version, salon_id',
        )
        .eq('id', customerId)
        .limit(1);

    if (response.isNotEmpty) {
      return Map<String, dynamic>.from(response.first);
    }

    return null;
  }

  Future<String?> _getCurrentCustomerId() async {
    try {
      final response = await client.rpc('current_customer_id');
      return _readNullableString(response);
    } catch (_) {
      return null;
    }
  }

  Future<String?> _getCurrentCustomerSalonId() async {
    try {
      final response = await client.rpc('current_customer_salon_id');
      return _readNullableString(response);
    } catch (_) {
      return null;
    }
  }

  Future<void> waitForCurrentCustomerLink() async {
    final user = currentUser;
    if (user == null) {
      return;
    }

    for (var attempt = 0; attempt < 12; attempt += 1) {
      final row = await _getCurrentCustomerRow(user.id);
      if (row != null && _readNullableString(row['salon_id']) != null) {
        return;
      }

      if (attempt < 11) {
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
    }
  }

  Future<Map<String, dynamic>> _getSalonProfileMap(String salonId) async {
    try {
      final response = await client
          .from('salons')
          .select(
            'name, tagline, brand_color, business_segment, whatsapp_phone, logo_path, client_app_config, booking_policy_enabled, booking_policy_title, booking_policy_summary, booking_policy_cancellation_window_hours, booking_policy_confirmation_required, booking_policy_confirmation_lead_minutes, booking_policy_auto_cancel_unconfirmed, booking_policy_auto_cancel_lead_minutes, booking_policy_auto_cancel_pending_deposit, booking_policy_deposit_reminder_lead_hours, booking_policy_requires_deposit, booking_policy_deposit_amount, booking_policy_payment_mode, booking_policy_pix_key, booking_policy_pix_recipient_name, booking_policy_pix_recipient_city, booking_policy_external_checkout_url, booking_policy_payment_instructions, booking_policy_version',
          )
          .eq('id', salonId)
          .limit(1);

      if (response.isNotEmpty) {
        return Map<String, dynamic>.from(response.first);
      }

      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<void> _signInToSupabaseWithFirebaseIdentity(
    firebase_auth.User firebaseUser,
  ) async {
    final bridgeCredentials = await _provisionSupabaseBridgeCredentials(
      firebaseUser,
    );
    if (currentUser != null) {
      await client.auth.signOut();
    }

    final response = await client.auth.signInWithPassword(
      email: bridgeCredentials.email,
      password: bridgeCredentials.password,
    );
    if (response.user == null || response.session == null) {
      throw StateError(
        'O Supabase nao retornou uma sessao valida depois de sincronizar a conta.',
      );
    }

    await _linkCustomerIdentityByEmail();
  }

  Future<_SupabaseBridgeCredentials> _provisionSupabaseBridgeCredentials(
    firebase_auth.User firebaseUser,
  ) async {
    final firebaseApiKey = FirebaseConfig.apiKey.trim();
    if (firebaseApiKey.isEmpty) {
      throw StateError(
        'Preencha FIREBASE_API_KEY no .env.local para sincronizar o login com o Supabase.',
      );
    }

    final firebaseIdToken = await firebaseUser.getIdToken(true);
    final normalizedIdToken = firebaseIdToken?.trim() ?? '';
    if (normalizedIdToken.isEmpty) {
      throw StateError(
        'Nao foi possivel confirmar a sessao do Firebase para entrar no app.',
      );
    }

    final response = await http.post(
      Uri.parse('${SupabaseConfig.url}/functions/v1/firebase-auth-bridge'),
      headers: <String, String>{
        'apikey': SupabaseConfig.anonKey,
        'authorization': 'Bearer ${SupabaseConfig.anonKey}',
        'content-type': 'application/json',
      },
      body: jsonEncode(<String, dynamic>{
        'firebase_api_key': firebaseApiKey,
        'firebase_id_token': normalizedIdToken,
      }),
    );

    final decodedBody = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : null;
    final responseMap = decodedBody is Map
        ? Map<String, dynamic>.from(decodedBody)
        : <String, dynamic>{};

    if (response.statusCode >= 400) {
      throw StateError(
        _firebaseSupabaseProvisioningError(
          payload: responseMap,
          statusCode: response.statusCode,
        ),
      );
    }

    final email =
        _readNullableString(responseMap['email']) ?? firebaseUser.email?.trim();
    final password = _readNullableString(responseMap['supabase_password']);

    if (email == null ||
        email.isEmpty ||
        password == null ||
        password.isEmpty) {
      throw StateError(
        'A funcao de sincronizacao respondeu sem credenciais validas do Supabase.',
      );
    }

    return _SupabaseBridgeCredentials(email: email, password: password);
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
    final supabaseUser = currentUser;
    if (supabaseUser == null) {
      return;
    }

    final firebaseUser = _firebaseAuth.currentUser;
    final hasTrustedEmailIdentity =
        hasVerifiedEmailIdentity(
          email: firebaseUser?.email,
          emailVerified: firebaseUser?.emailVerified ?? false,
        ) ||
        hasConfirmedSupabaseEmailIdentity(
          email: supabaseUser.email,
          emailConfirmedAt: supabaseUser.emailConfirmedAt,
        );
    if (!hasTrustedEmailIdentity) {
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

  String _supabaseEmailAuthMessage(AuthException error) {
    return error.message.trim().isNotEmpty
        ? error.message.trim()
        : 'Nao foi possivel abrir a sessao do app no Supabase.';
  }

  String _firebaseSupabaseProvisioningError({
    required Map<String, dynamic> payload,
    required int statusCode,
  }) {
    final errorCode = payload['error']?.toString().trim().toLowerCase();
    final detail = payload['detail']?.toString().trim();
    final message = payload['message']?.toString().trim();

    switch (errorCode) {
      case 'email_not_verified':
        return 'Confirme o e-mail antes de entrar para liberar sua conta no app.';
      case 'missing_server_secrets':
        return 'A funcao de login do app ainda nao foi configurada no Supabase. Publique a Edge Function firebase-auth-bridge e tente de novo.';
      case 'missing_firebase_context':
      case 'invalid_payload':
        return 'A configuracao atual do app nao conseguiu validar sua conta do Firebase.';
      case 'invalid_firebase_session':
      case 'firebase_lookup_failed':
        return detail?.isNotEmpty == true
            ? detail!
            : 'O Firebase autenticou a conta, mas o app nao conseguiu sincronizar a sessao com o Supabase.';
      case 'email_missing':
        return 'A conta autenticada precisa ter um e-mail valido para continuar.';
      case 'email_mismatch':
        return 'O e-mail validado pelo Firebase nao bate com a conta que o app tentou sincronizar.';
      case 'user_lookup_failed':
      case 'user_sync_failed':
        return detail?.isNotEmpty == true
            ? detail!
            : 'Nao foi possivel preparar sua conta no Supabase.';
      default:
        if (message != null && message.isNotEmpty) {
          return message;
        }
        if (detail != null && detail.isNotEmpty) {
          return detail;
        }
        if (statusCode == 404) {
          return 'A Edge Function firebase-auth-bridge ainda nao foi publicada no Supabase.';
        }
        return 'Nao foi possivel sincronizar o login do Firebase com o Supabase.';
    }
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

  Future<CustomerProfile> joinSalon({
    required String code,
    required String customerName,
    String? referralCode,
  }) async {
    final normalizedReferral = referralCode?.trim().toUpperCase();

    final response = await client.rpc(
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

    final joinedCustomerMap = switch (response) {
      final Map<dynamic, dynamic> map => Map<String, dynamic>.from(map),
      final List<dynamic> list when list.isNotEmpty =>
        Map<String, dynamic>.from(list.first as Map),
      _ => null,
    };

    if (joinedCustomerMap == null) {
      throw StateError(
        'O salão confirmou o vínculo, mas o app não recebeu o perfil do cliente.',
      );
    }

    await _invalidateCacheScopes(const <String>[
      'customer-profile',
      'home',
      'explore',
      'appointments',
      'feed',
      'profile-hub',
      'notifications',
      'notification-receipts',
    ]);

    final salonId = _readNullableString(joinedCustomerMap['salon_id']);
    final salonMap = salonId == null
        ? <String, dynamic>{}
        : await _getSalonProfileMap(salonId);
    final logoPath = _readNullableString(salonMap['logo_path']);
    final profile = CustomerProfile.fromMap({
      ...joinedCustomerMap,
      'salons': salonMap,
    }, salonLogoUrl: _buildStorageUrl('salon-assets', logoPath));

    final user = currentUser;
    if (user != null) {
      final cacheKey = _cacheKey('customer-profile', suffix: user.id);
      await _writeCachedData(cacheKey, encodeCustomerProfile(profile));
    }

    return profile;
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

  Future<void> acceptOperationalConsent({
    String consentVersion = '2026-04-prontuario-v1',
  }) async {
    await client.rpc(
      'accept_customer_operational_consent',
      params: {'consent_version_input': consentVersion},
    );

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

  Future<List<TeamMember>> getTeamMembers({
    int limit = 12,
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'team_members',
          title: 'Equipe indisponível',
          message:
              'O painel não conseguiu sincronizar profissionais, especialidades ou horários agora.',
        );
        return const <TeamMember>[];
      }
      rethrow;
    }
  }

  Future<List<OfferItem>> getOffers({OperationalIssueReporter? onIssue}) async {
    try {
      final response = await client
          .from('salon_offers')
          .select(
            'id, kind, title, description, highlight_text, price, starts_on, ends_on, is_active, sort_order',
          )
          .eq('is_active', true)
          .order('sort_order')
          .order('created_at', ascending: false);

      final offers = (response as List)
          .map((item) => OfferItem.fromMap(Map<String, dynamic>.from(item)))
          .toList(growable: true);

      offers.sort((left, right) {
        final kindComparison = (left.isMembership ? 0 : 1).compareTo(
          right.isMembership ? 0 : 1,
        );
        if (kindComparison != 0) {
          return kindComparison;
        }

        final sortOrderComparison = left.sortOrder.compareTo(right.sortOrder);
        if (sortOrderComparison != 0) {
          return sortOrderComparison;
        }

        final leftReferenceDate =
            left.startsOn ??
            left.endsOn ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final rightReferenceDate =
            right.startsOn ??
            right.endsOn ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return rightReferenceDate.compareTo(leftReferenceDate);
      });

      return offers.toList(growable: false);
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains('salon_offers')) {
        _reportOperationalIssue(
          onIssue,
          scope: 'offers',
          title: 'Campanhas indisponíveis',
          message:
              'Promoções e memberships do painel não chegaram ao app nesta atualização.',
        );
        return const <OfferItem>[];
      }
      rethrow;
    }
  }

  Future<List<CustomerMembershipPackage>> getCustomerMembershipPackages({
    OperationalIssueReporter? onIssue,
  }) async {
    final customerId = await _getCurrentCustomerId();
    if (customerId == null) {
      return const <CustomerMembershipPackage>[];
    }

    try {
      final response = await client
          .from('customer_memberships')
          .select(
            'id, title, service_name_snapshot, price_snapshot, sessions_included, sessions_used, started_at, expires_at, status, notes, created_at',
          )
          .eq('customer_id', customerId)
          .order('created_at', ascending: false);

      final memberships = (response as List)
          .map(
            (item) => CustomerMembershipPackage.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(growable: true);

      memberships.sort((left, right) {
        final leftPriority = left.isActive
            ? 0
            : left.isCompleted
            ? 1
            : left.isExpired
            ? 2
            : 3;
        final rightPriority = right.isActive
            ? 0
            : right.isCompleted
            ? 1
            : right.isExpired
            ? 2
            : 3;

        if (leftPriority != rightPriority) {
          return leftPriority.compareTo(rightPriority);
        }

        return left.expiresAt.compareTo(right.expiresAt);
      });

      return memberships.toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('customer_memberships')) {
        _reportOperationalIssue(
          onIssue,
          scope: 'memberships',
          title: 'Pacotes indisponíveis',
          message:
              'Os pacotes ativos da sua conta não puderam ser sincronizados agora.',
        );
        return const <CustomerMembershipPackage>[];
      }
      rethrow;
    }
  }

  Future<List<RetailProduct>> getRetailProducts({
    int limit = 24,
    OperationalIssueReporter? onIssue,
  }) async {
    try {
      final response = await client.rpc(
        'get_customer_product_catalog',
        params: {'limit_count': limit},
      );

      if (response is! List) {
        return const <RetailProduct>[];
      }

      return response
          .map((item) {
            final productMap = Map<String, dynamic>.from(item as Map);
            final rawImagePaths = productMap['image_paths'];
            final imagePaths = rawImagePaths is List
                ? rawImagePaths
                      .map((entry) => entry?.toString().trim())
                      .whereType<String>()
                      .where((entry) => entry.isNotEmpty)
                      .toList(growable: false)
                : const <String>[];

            productMap['image_urls'] = imagePaths
                .map((path) => _buildStorageUrl('inventory-products', path))
                .whereType<String>()
                .toList(growable: false);

            return RetailProduct.fromMap(productMap);
          })
          .toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('get_customer_product_catalog') ||
          message.contains('inventory_products')) {
        _reportOperationalIssue(
          onIssue,
          scope: 'products',
          title: 'Produtos indisponíveis',
          message:
              'O catálogo consultivo do salão não pôde ser sincronizado agora.',
        );
        return const <RetailProduct>[];
      }
      rethrow;
    }
  }

  Future<StoreOrderSubmissionResult> submitStoreOrder({
    required List<StoreOrderLineInput> items,
    String? notes,
  }) async {
    if (items.isEmpty) {
      throw StateError(
        'Adicione pelo menos um produto antes de fechar o pedido.',
      );
    }

    try {
      final response = await client.rpc(
        'create_customer_product_order',
        params: {
          'items_input': items
              .map((item) => item.toMap())
              .toList(growable: false),
          'notes_input': _readNullableString(notes),
        },
      );

      Map<String, dynamic>? orderMap;
      if (response is List && response.isNotEmpty && response.first is Map) {
        orderMap = Map<String, dynamic>.from(response.first as Map);
      } else if (response is Map) {
        orderMap = Map<String, dynamic>.from(response);
      }

      if (orderMap == null) {
        throw StateError('Nao foi possivel confirmar o pedido da loja agora.');
      }

      await _invalidateCacheScopes(const <String>[
        'home',
        'explore',
        'profile-hub',
      ]);
      return StoreOrderSubmissionResult.fromMap(orderMap);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('inventory_product_purchase_limit_exceeded')) {
        throw StateError(
          'Um dos produtos passou do limite permitido por pedido.',
        );
      }
      if (message.contains('inventory_product_insufficient_stock')) {
        throw StateError(
          'Um dos produtos ficou sem estoque suficiente enquanto voce montava o carrinho.',
        );
      }
      if (message.contains('inventory_product_not_found')) {
        throw StateError(
          'Um dos produtos nao esta mais disponivel na loja do salao.',
        );
      }
      if (message.contains('empty_product_order') ||
          message.contains('invalid_product_order_item') ||
          message.contains('invalid_product_order_payload')) {
        throw StateError('Revise o carrinho antes de enviar o pedido.');
      }
      if (message.contains('product_order_notes_too_long')) {
        throw StateError(
          'As observacoes do pedido podem ter no maximo 500 caracteres.',
        );
      }
      rethrow;
    }
  }

  Future<List<CustomerStoreOrder>> getCustomerStoreOrders({
    int limit = 12,
    OperationalIssueReporter? onIssue,
  }) async {
    try {
      final response = await client
          .from('customer_product_orders')
          .select(
            'id,order_number,status,total_items,subtotal_amount,notes,cancellation_reason,created_at,confirmed_at,ready_at,completed_at,cancelled_at,customer_product_order_items(id,product_name_snapshot,product_brand_snapshot,unit_snapshot,quantity,unit_price_snapshot,line_total_amount,product_image_path)',
          )
          .order('created_at', ascending: false)
          .limit(limit);

      return (response as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map((orderMap) {
            final itemMaps =
                _readListMaps(orderMap['customer_product_order_items'])
                    .map((item) {
                      final mutableItem = Map<String, dynamic>.from(item);
                      mutableItem['image_url'] = _buildStorageUrl(
                        'inventory-products',
                        _readNullableString(item['product_image_path']),
                      );
                      return mutableItem;
                    })
                    .toList(growable: false);

            return CustomerStoreOrder.fromMap(<String, dynamic>{
              ...orderMap,
              'customer_product_order_items': itemMaps,
            });
          })
          .toList(growable: false);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('customer_product_orders')) {
        _reportOperationalIssue(
          onIssue,
          scope: 'store-orders',
          title: 'Pedidos da loja indisponiveis',
          message: 'Os pedidos da loja nao puderam ser sincronizados agora.',
        );
        return const <CustomerStoreOrder>[];
      }
      rethrow;
    }
  }

  Future<List<AppointmentItem>> getAppointments() async {
    final response = await client
        .from('appointments')
        .select(
          'id, date, ends_at, status, completed_at, cancelled_at, cancelled_by, cancellation_reason, customer_confirmation_requested_at, customer_presence_confirmed_at, protection_confirmation_required, protection_confirmation_lead_minutes, protection_auto_cancel_unconfirmed, protection_auto_cancel_lead_minutes, protection_auto_cancel_pending_deposit, protection_deposit_reminder_lead_hours, deposit_amount, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, deposit_customer_reported_reference, deposit_status, deposit_paid_at, deposit_payment_provider, deposit_payment_provider_charge_id, deposit_payment_provider_status, deposit_payment_provider_payload, deposit_payment_provider_invoice_url, deposit_payment_provider_last_synced_at, deposit_payment_provider_error, deposit_receipt_content_type, deposit_receipt_path, deposit_receipt_uploaded_at, deposit_notes, booking_policy_acknowledged_at, booking_policy_version, services(name, price, duration), staff_members(name)',
        )
        .order('date', ascending: false);

    return (response as List)
        .map((item) => AppointmentItem.fromMap(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

  Future<List<VacancyAlert>> getVacancyAlerts({
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'vacancy_alerts',
          title: 'Encaixes indisponíveis',
          message:
              'Os alertas de vaga liberada do painel não puderam ser carregados agora.',
        );
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

  Future<String> createAppointment({
    required String serviceId,
    required DateTime startAt,
    String? preferredStaffMemberId,
    String? bookingPolicyVersion,
  }) async {
    Map<String, dynamic>? appointmentMap;

    try {
      final response = await client.rpc(
        'create_appointment',
        params: {
          'service_uuid': serviceId,
          'requested_date': startAt.toUtc().toIso8601String(),
          'preferred_staff_member_uuid': preferredStaffMemberId,
          'booking_policy_version_input': bookingPolicyVersion,
        },
      );

      appointmentMap = switch (response) {
        final Map<dynamic, dynamic> map => Map<String, dynamic>.from(map),
        final List<dynamic> list when list.isNotEmpty =>
          Map<String, dynamic>.from(list.first as Map),
        _ => null,
      };
    } on PostgrestException catch (error) {
      if (error.message.contains('booking_policy_version_stale')) {
        throw StateError(
          'A politica de reserva mudou enquanto voce navegava. Abra de novo a reserva para revisar a regra atual.',
        );
      }
      rethrow;
    }

    final day = DateTime(startAt.year, startAt.month, startAt.day);
    await _invalidateCacheScopes(const <String>['home', 'appointments']);
    await _invalidateDayAvailability(serviceId: serviceId, day: day);

    final appointmentId = _readNullableString(appointmentMap?['id']);
    if (appointmentId == null || appointmentId.isEmpty) {
      throw StateError(
        'O horario foi criado, mas o app nao recebeu o identificador da reserva.',
      );
    }

    return appointmentId;
  }

  Future<ManagedDepositChargeResult> createManagedDepositCharge({
    required String appointmentId,
    bool forceRefresh = false,
  }) async {
    final session = client.auth.currentSession;
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw StateError(
        'Sua sessao expirou antes de gerar o Pix do sinal. Entre novamente e tente de novo.',
      );
    }

    final response = await http.post(
      Uri.parse(
        '${SupabaseConfig.url}/functions/v1/asaas-create-deposit-charge',
      ),
      headers: <String, String>{
        'apikey': SupabaseConfig.anonKey,
        'authorization': 'Bearer $accessToken',
        'content-type': 'application/json',
      },
      body: jsonEncode(<String, dynamic>{
        'appointment_id': appointmentId,
        'force_refresh': forceRefresh,
      }),
    );

    final decodedBody = response.body.isNotEmpty
        ? jsonDecode(response.body)
        : null;
    final responseMap = decodedBody is Map
        ? Map<String, dynamic>.from(decodedBody)
        : <String, dynamic>{};

    if (response.statusCode >= 400) {
      final detail = _readNullableString(responseMap['detail']);
      final errorCode = _readNullableString(responseMap['error']);

      throw StateError(
        detail ??
            (errorCode == 'managed_pix_not_enabled'
                ? 'O salão ainda não ativou a cobrança Pix automática para esse sinal.'
                : errorCode == 'deposit_not_required'
                ? 'Este horário não precisa de sinal.'
                : errorCode == 'appointment_not_collectable'
                ? 'Este horário não aceita mais cobrança automática de sinal.'
                : 'Nao foi possivel gerar o Pix automatico do sinal agora.'),
      );
    }

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
    return ManagedDepositChargeResult.fromMap(responseMap);
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

  Future<void> reportAppointmentDepositPaid({
    required String appointmentId,
    required String paymentMethod,
    String? paymentReference,
  }) async {
    try {
      await client.rpc(
        'report_appointment_deposit_paid',
        params: {
          'appointment_uuid': appointmentId,
          'payment_method_input': paymentMethod.trim(),
          'payment_reference_input': _readNullableString(paymentReference),
        },
      );
    } on PostgrestException catch (error) {
      if (error.message.contains('deposit_not_required')) {
        throw StateError('Este horário não precisa de sinal.');
      }
      if (error.message.contains('appointment_not_collectable')) {
        throw StateError(
          'Este horário não aceita mais confirmação de pagamento pelo app.',
        );
      }
      rethrow;
    }

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<void> submitAppointmentDepositReceipt({
    required String appointmentId,
    required Uint8List receiptBytes,
    required String contentType,
    required String fileExtension,
    required String paymentMethod,
    String? paymentReference,
  }) async {
    final customerId = await _getCurrentCustomerId();
    final salonId = await _getCurrentCustomerSalonId();

    if (customerId == null || salonId == null) {
      throw StateError(
        'Nao foi possivel identificar sua conta para anexar o comprovante.',
      );
    }

    final normalizedContentType = _normalizeDepositReceiptContentType(
      contentType,
    );
    final normalizedExtension = _normalizeDepositReceiptExtension(
      fileExtension,
      normalizedContentType,
    );
    final uploadPath =
        '$salonId/$customerId/$appointmentId/receipt.$normalizedExtension';

    try {
      await client.storage
          .from('appointment-deposit-proofs')
          .uploadBinary(
            uploadPath,
            receiptBytes,
            fileOptions: FileOptions(
              contentType: normalizedContentType,
              upsert: true,
            ),
          );

      await client.rpc(
        'attach_appointment_deposit_receipt',
        params: {
          'appointment_uuid': appointmentId,
          'receipt_path_input': uploadPath,
          'receipt_content_type_input': normalizedContentType,
        },
      );

      await client.rpc(
        'report_appointment_deposit_paid',
        params: {
          'appointment_uuid': appointmentId,
          'payment_method_input': paymentMethod.trim(),
          'payment_reference_input': _readNullableString(paymentReference),
        },
      );
    } on StorageException catch (error) {
      throw StateError(
        'Nao foi possivel enviar o comprovante agora. ${error.message}',
      );
    } on PostgrestException catch (error) {
      if (error.message.contains('deposit_not_required')) {
        throw StateError('Este horário não precisa de sinal.');
      }
      if (error.message.contains('appointment_not_collectable')) {
        throw StateError('Este horário não aceita mais comprovante pelo app.');
      }
      if (error.message.contains('invalid_receipt_path') ||
          error.message.contains('invalid_receipt_content_type')) {
        throw StateError(
          'O comprovante precisa ser uma imagem valida desse agendamento.',
        );
      }
      rethrow;
    }

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<void> claimVacancyAlert({required String alertId}) async {
    await client.rpc(
      'claim_vacancy_alert',
      params: {'vacancy_alert_uuid': alertId},
    );

    await _invalidateCacheScopes(const <String>['home', 'appointments']);
  }

  Future<List<FeedPost>> getFeedPosts({
    required String customerId,
    OperationalIssueReporter? onIssue,
  }) async {
    try {
      final response = await client
          .from('salon_posts')
          .select(
            'id,title,caption,image_path,post_type,video_path,created_at,source_type,external_platform,external_permalink,external_author_username,services(id,name,price,duration),staff_members(name,role),salon_post_images(image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_id,customer_name,body,created_at)',
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
        _reportOperationalIssue(
          onIssue,
          scope: 'feed',
          title: 'Feed indisponível',
          message:
              'As publicações do salão não puderam ser sincronizadas nesta atualização.',
        );
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

  Future<LoyaltySummary?> getLoyaltySummary({
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'loyalty',
          title: 'Fidelidade indisponível',
          message:
              'O programa de pontos e cashback do painel não pôde ser lido agora.',
        );
        return null;
      }
      rethrow;
    }
  }

  Future<ReferralSummary?> getReferralSummary({
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'referrals',
          title: 'Indicações indisponíveis',
          message:
              'O programa de indicação do salão não pôde ser sincronizado agora.',
        );
        return null;
      }
      rethrow;
    }
  }

  Future<List<CustomerNotificationItem>> getCustomerNotifications({
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'notifications',
          title: 'Notificações indisponíveis',
          message:
              'A central de notificações não conseguiu sincronizar novos avisos do salão agora.',
        );
        return const <CustomerNotificationItem>[];
      }
      rethrow;
    }
  }

  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot({
    OperationalIssueReporter? onIssue,
  }) async {
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
        _reportOperationalIssue(
          onIssue,
          scope: 'notification_receipts',
          title: 'Leitura de notificações indisponível',
          message:
              'O app não conseguiu sincronizar recibos de leitura e arquivamento nesta atualização.',
        );
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
        final issues = <OperationalIssue>[];
        final reportIssue = _dedupeIssues(issues);
        final results = await Future.wait<Object?>([
          getServices(),
          getTeamMembers(limit: 8, onIssue: reportIssue),
          getOffers(onIssue: reportIssue),
          getCustomerMembershipPackages(onIssue: reportIssue),
          getRetailProducts(limit: 8, onIssue: reportIssue),
          getAppointments(),
          getVacancyAlerts(onIssue: reportIssue),
          getFeedPosts(customerId: customerId, onIssue: reportIssue),
          getCustomerNotifications(onIssue: reportIssue),
          getLoyaltySummary(onIssue: reportIssue),
          getReferralSummary(onIssue: reportIssue),
          getNotificationReceiptSnapshot(onIssue: reportIssue),
        ]);

        final notifications = results[8] as List<CustomerNotificationItem>;
        final receipts = results[11] as NotificationReceiptSnapshot;
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
          memberships: results[3] as List<CustomerMembershipPackage>,
          products: results[4] as List<RetailProduct>,
          appointments: results[5] as List<AppointmentItem>,
          vacancyAlerts: results[6] as List<VacancyAlert>,
          posts: results[7] as List<FeedPost>,
          notifications: hydratedNotifications,
          loyaltySummary: results[9] as LoyaltySummary?,
          referralSummary: results[10] as ReferralSummary?,
          issues: issues,
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
        final issues = <OperationalIssue>[];
        final reportIssue = _dedupeIssues(issues);
        final results = await Future.wait<Object?>([
          getServices(),
          getTeamMembers(onIssue: reportIssue),
          getOffers(onIssue: reportIssue),
          getRetailProducts(limit: 12, onIssue: reportIssue),
        ]);

        return ExploreSnapshot(
          services: results[0] as List<ServiceItem>,
          teamMembers: results[1] as List<TeamMember>,
          offers: results[2] as List<OfferItem>,
          products: results[3] as List<RetailProduct>,
          issues: issues,
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
        final issues = <OperationalIssue>[];
        final reportIssue = _dedupeIssues(issues);
        final results = await Future.wait<Object?>([
          getAppointments(),
          getVacancyAlerts(onIssue: reportIssue),
        ]);

        return AppointmentsSnapshot(
          appointments: results[0] as List<AppointmentItem>,
          vacancyAlerts: results[1] as List<VacancyAlert>,
          issues: issues,
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
        final issues = <OperationalIssue>[];
        final posts = await getFeedPosts(
          customerId: customerId,
          onIssue: _dedupeIssues(issues),
        );
        return FeedSnapshot(posts: posts, issues: issues);
      },
      encode: encodeFeedSnapshot,
      decode: decodeFeedSnapshot,
    );
  }

  Future<CachedView<ProfileSnapshot>> loadProfileSnapshot() {
    return _loadCachedView(
      cacheKey: _cacheKey('profile-hub'),
      fetcher: () async {
        final issues = <OperationalIssue>[];
        final reportIssue = _dedupeIssues(issues);
        final results = await Future.wait<Object?>([
          getLoyaltySummary(onIssue: reportIssue),
          getReferralSummary(onIssue: reportIssue),
          getCustomerMembershipPackages(onIssue: reportIssue),
          getCustomerStoreOrders(onIssue: reportIssue),
          getCustomerNotifications(onIssue: reportIssue),
          getNotificationReceiptSnapshot(onIssue: reportIssue),
        ]);

        final notifications = results[4] as List<CustomerNotificationItem>;
        final receipts = results[5] as NotificationReceiptSnapshot;
        final unreadCount = notifications
            .where((item) => !receipts.readKeys.contains(item.readKey))
            .length;

        return ProfileSnapshot(
          loyaltySummary: results[0] as LoyaltySummary?,
          referralSummary: results[1] as ReferralSummary?,
          memberships: results[2] as List<CustomerMembershipPackage>,
          storeOrders: results[3] as List<CustomerStoreOrder>,
          unreadNotificationsCount: unreadCount,
          issues: issues,
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

String _normalizeDepositReceiptExtension(
  String input,
  String normalizedContentType,
) {
  final sanitized = input.trim().toLowerCase().replaceAll(
    RegExp(r'[^a-z0-9]'),
    '',
  );

  if (sanitized == 'png') {
    return 'png';
  }
  if (sanitized == 'webp') {
    return 'webp';
  }
  if (sanitized == 'heic') {
    return 'heic';
  }
  if (sanitized == 'heif') {
    return 'heif';
  }
  if (sanitized == 'jpeg' || sanitized == 'jpg') {
    return 'jpg';
  }

  if (normalizedContentType == 'image/png') {
    return 'png';
  }
  if (normalizedContentType == 'image/webp') {
    return 'webp';
  }
  if (normalizedContentType == 'image/heic') {
    return 'heic';
  }
  if (normalizedContentType == 'image/heif') {
    return 'heif';
  }

  return 'jpg';
}

String _normalizeDepositReceiptContentType(String input) {
  final normalized = input.trim().toLowerCase();

  switch (normalized) {
    case 'image/png':
      return 'image/png';
    case 'image/webp':
      return 'image/webp';
    case 'image/heic':
      return 'image/heic';
    case 'image/heif':
      return 'image/heif';
    case 'image/jpg':
    case 'image/jpeg':
    default:
      return 'image/jpeg';
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

DateTime? _readNullableDateTime(Object? value) {
  final text = value?.toString().trim();
  if (text == null || text.isEmpty) {
    return null;
  }

  return DateTime.tryParse(text)?.toLocal();
}
