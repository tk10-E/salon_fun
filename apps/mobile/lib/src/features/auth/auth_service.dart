import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter/services.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
import '../../core/network/network_guard.dart';
import '../../core/security/password_policy.dart';
import '../../core/utils/formatters.dart';
import '../shared/app_models.dart';

class AuthService {
  AuthService({
    required this.environment,
    required this.client,
    required this.supabaseClient,
  });

  final AppEnvironment environment;
  final http.Client client;
  final SupabaseClient? supabaseClient;
  Future<void>? _googleInitFuture;
  static const _trustedFederatedProviders = <String>{    'google.com',
    'apple.com',
  };

  bool get isConfigured =>
      environment.hasFirebase &&
      environment.hasSupabase &&
      environment.resolvedBridgeUrl.isNotEmpty &&
      supabaseClient != null;
  bool get canUseGoogleSignIn => isConfigured;

  bool get hasPersistedAuthenticatedSession {
    if (supabaseClient?.auth.currentSession != null) {
      return true;
    }

    if (!environment.hasFirebase) {
      return false;
    }

    return firebase_auth.FirebaseAuth.instance.currentUser != null;
  }

  Future<void> signIn({
    required String joinCode,
    required String email,
    required String password,
    required String customerName,
  }) async {
    _assertConfigured();
    final auth = firebase_auth.FirebaseAuth.instance;
    final credentials = await auth.signInWithEmailAndPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );

    final signedInUser = credentials.user;
    if (signedInUser == null) {
      throw Exception('O Firebase não retornou uma conta válida.');
    }

    await signedInUser.reload();
    final refreshedUser = auth.currentUser ?? signedInUser;
    if (!refreshedUser.emailVerified) {
      try {
        await refreshedUser.sendEmailVerification();
      } catch (_) {
        // best effort
      }
      throw Exception('Confirme o e-mail antes de entrar no app.');
    }

    await _signInToSupabase(refreshedUser);

    final safeJoinCode = normalizeJoinCode(joinCode);
    if (safeJoinCode.isNotEmpty) {
      final fallbackName = customerName.trim().isEmpty
          ? (refreshedUser.displayName?.trim().isNotEmpty == true
                ? refreshedUser.displayName!.trim()
                : refreshedUser.email?.split('@').first ?? 'Cliente')
          : customerName.trim();

      await supabaseClient!.rpc(
        'join_salon',
        params: <String, dynamic>{
          'input_join_code': safeJoinCode,
          'customer_name': fallbackName,
        },
      );
    }
  }

  Future<String> signUp({
    required String email,
    required String password,
    required String customerName,
  }) async {
    _assertConfigured();
    final passwordError = validatePasswordStrength(password);
    if (passwordError != null) {
      throw Exception(passwordError);
    }

    final auth = firebase_auth.FirebaseAuth.instance;
    final credentials = await auth.createUserWithEmailAndPassword(
      email: email.trim().toLowerCase(),
      password: password,
    );

    final createdUser = credentials.user;
    if (createdUser == null) {
      throw Exception('O Firebase não retornou a conta recém-criada.');
    }

    if (customerName.trim().isNotEmpty) {
      await createdUser.updateDisplayName(customerName.trim());
    }

    await createdUser.sendEmailVerification();
    await auth.signOut();

    return 'Conta criada. Confirme o e-mail e volte para entrar.';
  }

  Future<void> signInWithGoogle({
    required String joinCode,
    String customerName = '',
  }) async {
    _assertConfigured();
    try {
      await _ensureGoogleInitialized();

      final googleUser = await GoogleSignIn.instance.authenticate();
      final googleAuth = googleUser.authentication;
      final idToken = googleAuth.idToken;
      if (idToken == null || idToken.trim().isEmpty) {
        throw Exception(_googleMissingTokenMessage());
      }

      final credential = firebase_auth.GoogleAuthProvider.credential(
        idToken: idToken,
      );

      final credentials = await firebase_auth.FirebaseAuth.instance
          .signInWithCredential(credential);
      final firebaseUser = credentials.user;
      if (firebaseUser == null) {
        throw Exception('O Google não retornou uma conta válida.');
      }

      await firebaseUser.reload();
      final refreshedUser =
          firebase_auth.FirebaseAuth.instance.currentUser ?? firebaseUser;
      await _signInToSupabase(refreshedUser);

      final safeJoinCode = normalizeJoinCode(joinCode);
      if (safeJoinCode.isNotEmpty) {
        await supabaseClient!.rpc(
          'join_salon',
          params: <String, dynamic>{
            'input_join_code': safeJoinCode,
            'customer_name': _resolvedCustomerName(
              refreshedUser,
              preferredName: customerName,
            ),
          },
        );
      }
    } on GoogleSignInException catch (error) {
      throw Exception(_googleExceptionMessage(error));
    } on PlatformException catch (error) {
      throw Exception(_googlePlatformExceptionMessage(error));
    } on firebase_auth.FirebaseAuthException catch (error) {
      throw Exception(_socialFirebaseAuthMessage('Google', error));
    }
  }

  Future<void> sendPasswordReset(String email) async {
    _assertConfigured();
    await firebase_auth.FirebaseAuth.instance.sendPasswordResetEmail(
      email: email.trim().toLowerCase(),
    );
  }

  Future<bool> restoreSupabaseSessionFromFirebase() async {
    if (!isConfigured) {
      return false;
    }

    final currentSession = supabaseClient!.auth.currentSession;
    if (currentSession != null) {
      return true;
    }

    final firebaseUser = firebase_auth.FirebaseAuth.instance.currentUser;
    if (firebaseUser == null) {
      return false;
    }

    await firebaseUser.reload();
    final refreshedUser =
        firebase_auth.FirebaseAuth.instance.currentUser ?? firebaseUser;
    if (!_canMirrorFirebaseUserToSupabase(refreshedUser)) {
      return false;
    }

    try {
      await _signInToSupabase(refreshedUser);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> signOut() async {
    await supabaseClient?.auth.signOut();
    if (environment.hasFirebase) {
      await _signOutGoogleBestEffort();      await firebase_auth.FirebaseAuth.instance.signOut();
    }
  }

  Future<void> _signInToSupabase(firebase_auth.User firebaseUser) async {
    final credentials = await _bridgeCredentials(firebaseUser);
    final currentSession = supabaseClient!.auth.currentSession;
    final currentSessionEmail = currentSession?.user.email
        ?.trim()
        .toLowerCase();
    if (currentSession != null &&
        currentSessionEmail != credentials.email.trim().toLowerCase()) {
      await supabaseClient!.auth.signOut();
    }
    final result = await runGuardedWrite(
      () => supabaseClient!.auth.signInWithPassword(
        email: credentials.email,
        password: credentials.password,
      ),
    );

    if (result.user == null || result.session == null) {
      throw Exception('O Supabase não retornou uma sessão válida.');
    }
  }

  Future<_BridgeCredentials> _bridgeCredentials(
    firebase_auth.User firebaseUser,
  ) async {
    try {
      return await _requestBridgeCredentials(firebaseUser, forceRefresh: false);
    } catch (error) {
      if ('$error'.contains('Confirme o e-mail') &&
          firebaseUser.emailVerified) {
        return await _requestBridgeCredentials(
          firebaseUser,
          forceRefresh: true,
        );
      }

      rethrow;
    }
  }

  Future<_BridgeCredentials> _requestBridgeCredentials(
    firebase_auth.User firebaseUser, {
    required bool forceRefresh,
  }) async {
    final firebaseToken = await firebaseUser.getIdToken(forceRefresh);
    if (firebaseToken == null || firebaseToken.trim().isEmpty) {
      throw Exception('O Firebase não retornou um token válido.');
    }

    final response = await runGuardedRead(
      () => client.post(
        Uri.parse(environment.resolvedBridgeUrl),
        headers: <String, String>{
          'Content-Type': 'application/json',
          if (environment.apiBaseUrl.isNotEmpty)
            'Origin': environment.apiBaseUrl,
        },
        body: jsonEncode(<String, dynamic>{
          'firebase_api_key': environment.firebaseApiKey,
          'firebase_id_token': firebaseToken,
        }),
      ),
      timeout: const Duration(seconds: 12),
      retries: 1,
    );

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw Exception(_bridgeMessage(payload));
    }

    final email =
        stringOrNull(payload['email']) ?? firebaseUser.email?.trim() ?? '';
    final password = stringOrNull(payload['supabase_password']) ?? '';
    if (email.isEmpty || password.isEmpty) {
      throw Exception('A bridge respondeu sem credenciais válidas.');
    }

    return _BridgeCredentials(email: email, password: password);
  }

  String _bridgeMessage(Map<String, dynamic> payload) {
    switch (stringOrNull(payload['error'])?.toLowerCase()) {
      case 'email_not_verified':
        return 'Confirme o e-mail antes de entrar.';
      case 'missing_server_secrets':
        return 'A bridge do Firebase ainda não foi configurada.';
      case 'missing_firebase_context':
      case 'invalid_firebase_context':
        return 'A autenticação do Firebase não conseguiu validar a conta.';
      case 'origin_not_allowed':
        return 'A origem do app ainda não foi liberada na bridge.';
      default:
        return stringOrNull(payload['detail']) ??
            'Não foi possível sincronizar o login com o Supabase.';
    }
  }

  void _assertConfigured() {
    if (!isConfigured) {
      throw Exception(
        'Configure Firebase, Supabase e a bridge para usar o login do app.',
      );
    }
  }

  String _resolvedCustomerName(
    firebase_auth.User firebaseUser, {
    String preferredName = '',
  }) {
    final normalizedPreferredName = preferredName.trim();
    if (normalizedPreferredName.isNotEmpty) {
      return normalizedPreferredName;
    }

    final displayName = firebaseUser.displayName?.trim();
    if (displayName != null && displayName.isNotEmpty) {
      return displayName;
    }

    final emailPrefix = firebaseUser.email?.split('@').first.trim();
    if (emailPrefix != null && emailPrefix.isNotEmpty) {
      return emailPrefix;
    }

    return 'Cliente';
  }

  bool _canMirrorFirebaseUserToSupabase(firebase_auth.User firebaseUser) {
    if (firebaseUser.emailVerified) {
      return true;
    }

    return firebaseUser.providerData.any(
      (provider) => _trustedFederatedProviders.contains(provider.providerId),
    );
  }

  Future<void> _ensureGoogleInitialized() {
    final serverClientId = environment.googleServerClientId.trim();
    return _googleInitFuture ??= GoogleSignIn.instance.initialize(
      serverClientId: serverClientId.isEmpty ? null : serverClientId,
    );
  }

  Future<void> _signOutGoogleBestEffort() async {
    try {
      await _ensureGoogleInitialized();
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // best effort
    }
  }

  String _googleMissingTokenMessage() {
    if (environment.googleServerClientId.trim().isNotEmpty) {
      return 'O Google abriu, mas não devolveu um token válido. Confira a configuração do app no Firebase.';
    }

    return 'O Google abriu, mas não devolveu um token válido. Confira o google-services.json e o GOOGLE_SERVER_CLIENT_ID do app.';
  }

  String _googleExceptionMessage(GoogleSignInException error) {
    switch (error.code) {
      case GoogleSignInExceptionCode.canceled:
        return 'Login com Google cancelado. Se a tela fechou sozinha, confira os SHA-1/SHA-256 deste build no Firebase. Se o app veio da Play Store, confirme tambem o certificado de App signing em Integridade do app e baixe o google-services.json atualizado.';
      case GoogleSignInExceptionCode.clientConfigurationError:
        return _googleConfigurationHelpMessage();
      default:
        final description = error.description?.trim();
        if (_looksLikeGoogleConfigurationError(description)) {
          return _googleConfigurationHelpMessage();
        }

        return description?.isNotEmpty == true
            ? description!
            : 'Não foi possível iniciar o login com Google.';
    }
  }

  String _googlePlatformExceptionMessage(PlatformException error) {
    final details = <String?>[
      error.code,
      error.message,
      error.details?.toString(),
    ].whereType<String>().join(' ');
    if (_looksLikeGoogleConfigurationError(details)) {
      return _googleConfigurationHelpMessage();
    }

    return error.message?.trim().isNotEmpty == true
        ? error.message!.trim()
        : 'Não foi possível iniciar o login com Google.';
  }

  bool _looksLikeGoogleConfigurationError(String? message) {
    final normalized = message?.toLowerCase() ?? '';
    return normalized.contains('api exception: 10') ||
        normalized.contains('developer_error') ||
        normalized.contains('clientconfiguration') ||
        normalized.contains('configuration') ||
        normalized.contains('sha-1') ||
        normalized.contains('sha1');
  }

  String _googleConfigurationHelpMessage() {
    return 'Google ainda nao configurado para este build. Confira SHA-1/SHA-256 no Firebase. Se o app veio da Play Store, confirme tambem o certificado de App signing em Integridade do app, baixe o google-services.json atualizado e gere o app novamente.';
  }

  String _socialFirebaseAuthMessage(
    String providerLabel,
    firebase_auth.FirebaseAuthException error,
  ) {
    switch (error.code) {
      case 'account-exists-with-different-credential':
        return 'Este e-mail já existe com outro tipo de acesso. Entre pelo método original e depois vincule o $providerLabel.';
      case 'operation-not-allowed':
        return '$providerLabel ainda não foi liberado no Firebase Authentication.';
      case 'invalid-credential':
      case 'invalid-oauth-response':
        return 'O $providerLabel retornou uma credencial inválida. Confira a configuração do provedor.';
      case 'network-request-failed':
        return 'Não foi possível concluir o login com $providerLabel por causa da conexão.';
      case 'user-disabled':
        return 'Esta conta foi desativada.';
      default:
        return error.message?.trim().isNotEmpty == true
            ? error.message!.trim()
            : 'Não foi possível entrar com $providerLabel.';
    }
  }
}

class _BridgeCredentials {
  const _BridgeCredentials({required this.email, required this.password});

  final String email;
  final String password;
}
