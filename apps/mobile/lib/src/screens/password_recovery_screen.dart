import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/auth_form_validators.dart';
import '../repositories/salon_repository.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/soft_card.dart';

class PasswordRecoveryScreen extends StatefulWidget {
  const PasswordRecoveryScreen({
    super.key,
    required this.repository,
    required this.onCompleted,
    required this.onCancel,
  });

  final SalonRepository repository;
  final Future<void> Function() onCompleted;
  final Future<void> Function() onCancel;

  @override
  State<PasswordRecoveryScreen> createState() => _PasswordRecoveryScreenState();
}

class _PasswordRecoveryScreenState extends State<PasswordRecoveryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _saving = false;
  bool _passwordVisible = false;
  bool _confirmPasswordVisible = false;
  String? _feedback;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    final isValid = _formKey.currentState?.validate() ?? false;
    if (!isValid) {
      return;
    }

    setState(() {
      _saving = true;
      _feedback = null;
    });

    try {
      await widget.repository.updatePassword(
        password: _passwordController.text,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _feedback =
            'Senha atualizada com sucesso. Sua sessão segura já está pronta.';
      });

      await widget.onCompleted();
    } on AuthException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _feedback = _humanizeAuthError(error.message));
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(
        () => _feedback =
            'Não foi possível atualizar sua senha agora. Tente novamente em instantes.',
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  String _humanizeAuthError(String raw) {
    if (raw.contains('same password')) {
      return 'Escolha uma senha diferente da anterior.';
    }
    if (raw.contains('Password should be at least')) {
      return 'Use uma senha com pelo menos 6 caracteres.';
    }

    return raw;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppBackdrop(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: SoftCard(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Redefina sua senha',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF2F231C),
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Seu link foi validado. Defina uma nova senha para voltar ao app com segurança.',
                          style: TextStyle(
                            height: 1.5,
                            color: Color(0xFF765E4E),
                          ),
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: !_passwordVisible,
                          textInputAction: TextInputAction.next,
                          decoration: InputDecoration(
                            labelText: 'Nova senha',
                            hintText: 'Digite sua nova senha',
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(
                                  () => _passwordVisible = !_passwordVisible,
                                );
                              },
                              icon: Icon(
                                _passwordVisible
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                            ),
                          ),
                          validator: (value) =>
                              validateAuthPassword(value ?? ''),
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: !_confirmPasswordVisible,
                          textInputAction: TextInputAction.done,
                          decoration: InputDecoration(
                            labelText: 'Confirme a nova senha',
                            hintText: 'Repita a nova senha',
                            suffixIcon: IconButton(
                              onPressed: () {
                                setState(
                                  () => _confirmPasswordVisible =
                                      !_confirmPasswordVisible,
                                );
                              },
                              icon: Icon(
                                _confirmPasswordVisible
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                            ),
                          ),
                          validator: (value) => validatePasswordConfirmation(
                            password: _passwordController.text,
                            confirmation: value ?? '',
                          ),
                          onFieldSubmitted: (_) {
                            if (!_saving) {
                              _submit();
                            }
                          },
                        ),
                        if (_feedback != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            _feedback!,
                            style: TextStyle(
                              color: _feedback!.contains('sucesso')
                                  ? const Color(0xFF2E7D32)
                                  : const Color(0xFFB42318),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _saving ? null : widget.onCancel,
                                child: const Text('Cancelar e sair'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: FilledButton(
                                onPressed: _saving ? null : _submit,
                                child: _saving
                                    ? const SizedBox.square(
                                        dimension: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Text('Salvar nova senha'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
