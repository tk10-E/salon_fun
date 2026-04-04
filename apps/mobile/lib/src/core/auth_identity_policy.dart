bool requiresConfirmedEmailForSession(Iterable<String> providerIds) {
  final normalizedProviderIds = providerIds
      .map((providerId) => providerId.trim().toLowerCase())
      .where((providerId) => providerId.isNotEmpty)
      .toSet();

  if (normalizedProviderIds.isEmpty) {
    return true;
  }

  return normalizedProviderIds.contains('password');
}

bool hasVerifiedEmailIdentity({
  required String? email,
  required bool emailVerified,
}) {
  return emailVerified && (email?.trim().isNotEmpty ?? false);
}

bool hasConfirmedSupabaseEmailIdentity({
  required String? email,
  required String? emailConfirmedAt,
}) {
  return (emailConfirmedAt?.trim().isNotEmpty ?? false) &&
      (email?.trim().isNotEmpty ?? false);
}

String buildEmailVerificationRequiredMessage({
  required bool verificationEmailSent,
}) {
  if (verificationEmailSent) {
    return 'Confirme o e-mail antes de entrar. Reenviamos o link de verificação para sua caixa de entrada.';
  }

  return 'Confirme o e-mail antes de entrar para liberar sua conta no app.';
}
