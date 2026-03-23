part of 'salon_repository.dart';

mixin _SalonRepositoryAuthMixin on _SalonRepositoryBase {
  Future<void> signIn({required String email, required String password}) async {
    await client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<SignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim();

    final response = await client.auth.signUp(
      email: normalizedEmail,
      password: password,
      emailRedirectTo: _emailRedirectTo(),
    );

    return SignUpResult(
      email: normalizedEmail,
      requiresEmailConfirmation: response.session == null,
    );
  }

  Future<void> signOut() async {
    await client.auth.signOut();
  }

  Future<void> sendPasswordResetEmail({required String email}) async {
    await client.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo: _emailRedirectTo(),
    );
  }
}
