String? validatePasswordStrength(String password) {
  final value = password.trim();

  if (value.length < 10) {
    return 'Use uma senha com pelo menos 10 caracteres.';
  }

  if (!RegExp(r'[a-z]').hasMatch(value)) {
    return 'A senha precisa ter pelo menos uma letra minúscula.';
  }

  if (!RegExp(r'[A-Z]').hasMatch(value)) {
    return 'A senha precisa ter pelo menos uma letra maiúscula.';
  }

  if (!RegExp(r'\d').hasMatch(value)) {
    return 'A senha precisa ter pelo menos um número.';
  }

  if (!RegExp(r'[^A-Za-z0-9]').hasMatch(value)) {
    return 'A senha precisa ter pelo menos um símbolo.';
  }

  return null;
}
