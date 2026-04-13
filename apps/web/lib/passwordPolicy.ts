export const PASSWORD_MIN_LENGTH = 10;

export function validatePasswordStrength(password: string) {
  const value = password.trim();

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  if (!/[a-z]/.test(value)) {
    return "A senha precisa ter pelo menos uma letra minúscula.";
  }

  if (!/[A-Z]/.test(value)) {
    return "A senha precisa ter pelo menos uma letra maiúscula.";
  }

  if (!/\d/.test(value)) {
    return "A senha precisa ter pelo menos um número.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "A senha precisa ter pelo menos um símbolo.";
  }

  return null;
}
