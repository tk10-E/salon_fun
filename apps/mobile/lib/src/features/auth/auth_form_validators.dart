enum PasswordStrength { weak, medium, strong }

String? validateAuthEmail(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    return 'Informe seu e-mail.';
  }

  final emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  if (!emailPattern.hasMatch(normalized)) {
    return 'Informe um e-mail válido.';
  }

  return null;
}

String? validateAuthPassword(String value) {
  if (value.isEmpty) {
    return 'Informe sua senha.';
  }

  if (value.length < 6) {
    return 'Use uma senha com pelo menos 6 caracteres.';
  }

  return null;
}

String? validatePasswordConfirmation({
  required String password,
  required String confirmation,
}) {
  if (confirmation.isEmpty) {
    return 'Confirme sua senha.';
  }

  if (password != confirmation) {
    return 'As senhas não conferem.';
  }

  return null;
}

PasswordStrength evaluatePasswordStrength(String password) {
  var score = 0;

  if (password.length >= 8) {
    score += 1;
  }

  if (RegExp(r'[A-Z]').hasMatch(password) && RegExp(r'[a-z]').hasMatch(password)) {
    score += 1;
  }

  if (RegExp(r'[0-9]').hasMatch(password)) {
    score += 1;
  }

  if (RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
    score += 1;
  }

  if (score >= 4) {
    return PasswordStrength.strong;
  }

  if (score >= 2) {
    return PasswordStrength.medium;
  }

  return PasswordStrength.weak;
}

String passwordStrengthLabel(PasswordStrength strength) {
  switch (strength) {
    case PasswordStrength.strong:
      return 'Senha forte';
    case PasswordStrength.medium:
      return 'Senha média';
    case PasswordStrength.weak:
      return 'Senha básica';
  }
}
