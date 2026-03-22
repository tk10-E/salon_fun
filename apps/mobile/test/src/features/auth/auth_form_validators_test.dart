import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/auth/auth_form_validators.dart';

void main() {
  group('validateAuthEmail', () {
    test('rejects empty email', () {
      expect(validateAuthEmail(''), 'Informe seu e-mail.');
    });

    test('rejects malformed email', () {
      expect(validateAuthEmail('cliente@salon'), 'Informe um e-mail válido.');
    });

    test('accepts valid email', () {
      expect(validateAuthEmail('cliente@salon.com'), isNull);
    });
  });

  group('validateAuthPassword', () {
    test('rejects short password', () {
      expect(
        validateAuthPassword('123'),
        'Use uma senha com pelo menos 6 caracteres.',
      );
    });

    test('accepts password with six or more chars', () {
      expect(validateAuthPassword('123456'), isNull);
    });
  });

  group('validatePasswordConfirmation', () {
    test('rejects different confirmation', () {
      expect(
        validatePasswordConfirmation(
          password: 'segredo123',
          confirmation: 'segredo456',
        ),
        'As senhas não conferem.',
      );
    });

    test('accepts matching confirmation', () {
      expect(
        validatePasswordConfirmation(
          password: 'segredo123',
          confirmation: 'segredo123',
        ),
        isNull,
      );
    });
  });

  group('evaluatePasswordStrength', () {
    test('classifies basic password as weak', () {
      expect(evaluatePasswordStrength('abcdef'), PasswordStrength.weak);
    });

    test('classifies mixed password as medium', () {
      expect(evaluatePasswordStrength('Abcdef12'), PasswordStrength.medium);
    });

    test('classifies varied password as strong', () {
      expect(evaluatePasswordStrength('Abcdef12!'), PasswordStrength.strong);
    });
  });
}
