import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
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

  bool get isConfigured =>
      environment.hasFirebase &&
      environment.hasSupabase &&
      environment.resolvedBridgeUrl.isNotEmpty &&
      supabaseClient != null;

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

  Future<void> signInWithGoogle({required String joinCode}) async {
    _assertConfigured();
    await _ensureGoogleInitialized();

    final googleUser = await GoogleSignIn.instance.authenticate().catchError((
      error,
    ) {
      final detail = '$error'.toLowerCase();
      if (detail.contains('cancel') || detail.contains('canceled')) {
        throw Exception('Login com Google cancelado.');
      }
      throw Exception('Não foi possível iniciar o login com Google.');
    });

    final googleAuth = googleUser.authentication;
    final idToken = googleAuth.idToken;
    if (idToken == null || idToken.trim().isEmpty) {
      throw Exception('O Google não retornou um token válido.');
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
          'customer_name': _resolvedCustomerName(refreshedUser),
        },
      );
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
    if (!refreshedUser.emailVerified) {
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
      await _signOutGoogleBestEffort();
      await firebase_auth.FirebaseAuth.instance.signOut();
    }
  }

  Future<void> _signInToSupabase(firebase_auth.User firebaseUser) async {
    final credentials = await _bridgeCredentials(firebaseUser);
    await supabaseClient!.auth.signOut();
    final result = await supabaseClient!.auth.signInWithPassword(
      email: credentials.email,
      password: credentials.password,
    );

    if (result.user == null || result.session == null) {
      throw Exception('O Supabase não retornou uma sessão válida.');
    }
  }

  Future<_BridgeCredentials> _bridgeCredentials(
    firebase_auth.User firebaseUser,
  ) async {
    final firebaseToken = await firebaseUser.getIdToken(true);
    if (firebaseToken == null || firebaseToken.trim().isEmpty) {
      throw Exception('O Firebase não retornou um token válido.');
    }

    final response = await client.post(
      Uri.parse(environment.resolvedBridgeUrl),
      headers: <String, String>{
        'Content-Type': 'application/json',
        if (environment.apiBaseUrl.isNotEmpty) 'Origin': environment.apiBaseUrl,
      },
      body: jsonEncode(<String, dynamic>{
        'firebase_api_key': environment.firebaseApiKey,
        'firebase_id_token': firebaseToken,
      }),
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

  String _resolvedCustomerName(firebase_auth.User firebaseUser) {
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

  Future<void> _ensureGoogleInitialized() {
    return _googleInitFuture ??= GoogleSignIn.instance.initialize();
  }

  Future<void> _signOutGoogleBestEffort() async {
    try {
      await _ensureGoogleInitialized();
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // best effort
    }
  }
}

class _BridgeCredentials {
  const _BridgeCredentials({required this.email, required this.password});

  final String email;
  final String password;
}
