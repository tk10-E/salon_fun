import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/auth_form_validators.dart';
import '../repositories/salon_repository.dart';
import '../services/biometric_quick_login_service.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/soft_card.dart';

enum _AuthMode { signIn, signUp }

enum _AuthFeedbackTone { info, success, error }

class _AuthFeedback {
  const _AuthFeedback({required this.message, required this.tone});

  final String message;
  final _AuthFeedbackTone tone;
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.repository});

  final SalonRepository repository;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _signInFormKey = GlobalKey<FormState>();
  final _signUpFormKey = GlobalKey<FormState>();
  final _signInEmailController = TextEditingController();
  final _signInPasswordController = TextEditingController();
  final _signUpEmailController = TextEditingController();
  final _signUpPasswordController = TextEditingController();
  final _signUpConfirmPasswordController = TextEditingController();
  final _biometricQuickLoginService = BiometricQuickLoginService();

  _AuthMode _mode = _AuthMode.signIn;
  bool _loading = false;
  bool _biometricLoading = false;
  bool _biometricOptIn = false;
  bool _signInPasswordVisible = false;
  bool _signUpPasswordVisible = false;
  bool _signUpConfirmPasswordVisible = false;
  BiometricQuickLoginState _biometricState =
      const BiometricQuickLoginState.unsupported();
  _AuthFeedback? _feedback;

  @override
  void initState() {
    super.initState();
    _loadBiometricState();
  }

  @override
  void dispose() {
    _signInEmailController.dispose();
    _signInPasswordController.dispose();
    _signUpEmailController.dispose();
    _signUpPasswordController.dispose();
    _signUpConfirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadBiometricState() async {
    final state = await _biometricQuickLoginService.getState();
    if (!mounted) {
      return;
    }

    setState(() {
      _biometricState = state;
      _biometricOptIn = state.hasSavedCredentials;
    });
  }

  Future<void> _submitSignIn() async {
    FocusScope.of(context).unfocus();

    final isValid = _signInFormKey.currentState?.validate() ?? false;
    if (!isValid) {
      return;
    }

    setState(() {
      _loading = true;
      _feedback = null;
    });

    try {
      await widget.repository.signIn(
        email: _signInEmailController.text,
        password: _signInPasswordController.text,
      );

      if (_biometricState.isSupported) {
        if (_biometricOptIn) {
          await _biometricQuickLoginService.saveCredentials(
            email: _signInEmailController.text,
            password: _signInPasswordController.text,
          );
        } else if (_biometricState.hasSavedCredentials) {
          await _biometricQuickLoginService.clearSavedCredentials();
        }
      }
    } on AuthException catch (error) {
      _setFeedback(_humanizeAuthError(error.message), _AuthFeedbackTone.error);
    } catch (_) {
      _setFeedback(
        'Não foi possível concluir sua entrada agora. Tente novamente em instantes.',
        _AuthFeedbackTone.error,
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _submitBiometricSignIn() async {
    if (_biometricLoading || _loading || !_biometricState.hasSavedCredentials) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _biometricLoading = true;
      _feedback = null;
    });

    try {
      final credentials = await _biometricQuickLoginService
          .authenticateAndReadCredentials(kind: _biometricState.kind);
      if (credentials == null) {
        _setFeedback(
          'A autenticação biométrica foi cancelada ou não está disponível agora.',
          _AuthFeedbackTone.info,
        );
        return;
      }

      _signInEmailController.text = credentials.email;
      _signInPasswordController.text = credentials.password;
      await widget.repository.signIn(
        email: credentials.email,
        password: credentials.password,
      );
    } on AuthException catch (error) {
      if (error.message.contains('Invalid login credentials')) {
        await _biometricQuickLoginService.clearSavedCredentials();
        if (mounted) {
          setState(() {
            _biometricState = BiometricQuickLoginState(
              isSupported: _biometricState.isSupported,
              hasSavedCredentials: false,
              kind: _biometricState.kind,
            );
            _biometricOptIn = false;
          });
        }
        _setFeedback(
          'A senha salva neste aparelho expirou. Entre com e-mail e senha para ativar a biometria novamente.',
          _AuthFeedbackTone.error,
        );
        return;
      }

      _setFeedback(_humanizeAuthError(error.message), _AuthFeedbackTone.error);
    } catch (_) {
      _setFeedback(
        'Não foi possível entrar com biometria agora. Tente novamente em instantes.',
        _AuthFeedbackTone.error,
      );
    } finally {
      if (mounted) {
        setState(() => _biometricLoading = false);
      }
    }
  }

  Future<void> _submitSignUp() async {
    FocusScope.of(context).unfocus();

    final isValid = _signUpFormKey.currentState?.validate() ?? false;
    if (!isValid) {
      return;
    }

    setState(() {
      _loading = true;
      _feedback = null;
    });

    try {
      final result = await widget.repository.signUp(
        email: _signUpEmailController.text,
        password: _signUpPasswordController.text,
      );

      if (!mounted) {
        return;
      }

      _signInEmailController.text = result.email;
      _signInPasswordController.clear();
      _signUpConfirmPasswordController.clear();

      setState(() {
        _mode = _AuthMode.signIn;
        _feedback = _AuthFeedback(
          message: result.requiresEmailConfirmation
              ? 'Conta criada. Confirme o e-mail ${result.email} e depois entre no app.'
              : 'Conta criada com sucesso. Agora entre para informar o código do seu salão.',
          tone: _AuthFeedbackTone.success,
        );
      });
    } on AuthException catch (error) {
      _setFeedback(_humanizeAuthError(error.message), _AuthFeedbackTone.error);
    } catch (_) {
      _setFeedback(
        'Não foi possível criar sua conta agora. Tente novamente em instantes.',
        _AuthFeedbackTone.error,
      );
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _showPasswordResetDialog() async {
    final controller = TextEditingController(text: _activeEmail.trim());
    String? errorMessage;
    var sending = false;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Recuperar acesso'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Vamos enviar um link para redefinir sua senha no e-mail informado.',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: controller,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: InputDecoration(
                      labelText: 'E-mail',
                      hintText: 'voce@email.com',
                      errorText: errorMessage,
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: sending
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: sending
                      ? null
                      : () async {
                          final validation = validateAuthEmail(controller.text);
                          if (validation != null) {
                            setDialogState(() => errorMessage = validation);
                            return;
                          }

                          setDialogState(() {
                            sending = true;
                            errorMessage = null;
                          });

                          try {
                            await widget.repository.sendPasswordResetEmail(
                              email: controller.text,
                            );

                            if (dialogContext.mounted) {
                              Navigator.of(dialogContext).pop();
                            }

                            _setFeedback(
                              'Link enviado. Confira seu e-mail e siga as instruções para redefinir a senha.',
                              _AuthFeedbackTone.success,
                            );
                          } on AuthException catch (error) {
                            if (!dialogContext.mounted) {
                              return;
                            }

                            setDialogState(
                              () => errorMessage = _humanizeAuthError(
                                error.message,
                              ),
                            );
                          } catch (_) {
                            if (!dialogContext.mounted) {
                              return;
                            }

                            setDialogState(
                              () => errorMessage =
                                  'Não foi possível enviar o link agora.',
                            );
                          } finally {
                            if (dialogContext.mounted) {
                              setDialogState(() => sending = false);
                            }
                          }
                        },
                  child: sending
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Enviar link'),
                ),
              ],
            );
          },
        );
      },
    );

    controller.dispose();
  }

  void _setFeedback(String message, _AuthFeedbackTone tone) {
    if (!mounted) {
      return;
    }

    setState(() {
      _feedback = _AuthFeedback(message: message, tone: tone);
    });
  }

  String get _activeEmail {
    if (_mode == _AuthMode.signIn) {
      return _signInEmailController.text;
    }

    return _signUpEmailController.text;
  }

  String _humanizeAuthError(String raw) {
    if (raw.contains('User already registered')) {
      return 'Este e-mail já possui cadastro. Tente entrar com sua senha.';
    }
    if (raw.contains('email_address_invalid')) {
      return 'Informe um e-mail válido.';
    }
    if (raw.contains('Password should be at least')) {
      return 'Use uma senha com pelo menos 6 caracteres.';
    }
    if (raw.contains('Invalid login credentials')) {
      return 'E-mail ou senha inválidos.';
    }
    if (raw.contains('Email not confirmed')) {
      return 'Confirme seu e-mail antes de entrar.';
    }
    if (raw.contains('over_email_send_rate_limit')) {
      return 'Muitas tentativas seguidas. Aguarde um instante e tente novamente.';
    }
    if (raw.contains('For security purposes')) {
      return 'Se o e-mail existir, enviaremos um link de recuperação.';
    }
    if (raw.contains('empty response') || raw.contains('status code 404')) {
      return 'Não foi possível concluir a autenticação. Confirme no Supabase se o login por e-mail está ativo.';
    }

    return raw;
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);

    return Scaffold(
      body: AppBackdrop(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isWide = constraints.maxWidth >= 980;

              return ListView(
                padding: EdgeInsets.fromLTRB(
                  24,
                  24,
                  24,
                  24 + mediaQuery.viewInsets.bottom,
                ),
                children: [
                  Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1120),
                      child: isWide
                          ? Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  flex: 12,
                                  child: _AuthShowcase(mode: _mode),
                                ),
                                const SizedBox(width: 20),
                                Expanded(
                                  flex: 10,
                                  child: _buildAuthPanel(context),
                                ),
                              ],
                            )
                          : Column(
                              children: [
                                _AuthShowcase(mode: _mode),
                                const SizedBox(height: 20),
                                _buildAuthPanel(context),
                              ],
                            ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildAuthPanel(BuildContext context) {
    final theme = Theme.of(context);

    return SoftCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFF4EA), Color(0xFFF2D0B8)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFDAB79E)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Image.asset('assets/branding/app_splash.png'),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Acesso do cliente',
                      style: theme.textTheme.labelLarge,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _mode == _AuthMode.signIn
                          ? 'Entre para agendar mais rápido, resgatar benefícios e falar com o salão.'
                          : 'Crie sua conta para guardar agenda, benefícios e contato no mesmo app.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B4B3A),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            _mode == _AuthMode.signIn
                ? 'Entre e retome sua rotina com o salão.'
                : 'Crie sua conta e deixe o salão a um passo.',
            style: theme.textTheme.headlineSmall?.copyWith(fontSize: 30),
          ),
          const SizedBox(height: 10),
          Text(
            _mode == _AuthMode.signIn
                ? 'Entre com seu e-mail para ver próximos horários, benefícios ativos, inspirações e a conversa certa com o salão.'
                : 'Depois de criar sua conta, o app pede o código do salão para liberar agenda, benefícios, inspirações e contato direto.',
            style: theme.textTheme.bodyLarge,
          ),
          const SizedBox(height: 20),
          _ModeSelector(
            mode: _mode,
            onChanged: _loading
                ? null
                : (nextMode) {
                    setState(() {
                      _mode = nextMode;
                      _feedback = null;
                      if (nextMode == _AuthMode.signUp &&
                          _signUpEmailController.text.trim().isEmpty) {
                        _signUpEmailController.text = _signInEmailController
                            .text
                            .trim();
                      }
                      if (nextMode == _AuthMode.signIn &&
                          _signInEmailController.text.trim().isEmpty) {
                        _signInEmailController.text = _signUpEmailController
                            .text
                            .trim();
                      }
                    });
                  },
          ),
          const SizedBox(height: 16),
          _AuthValuePanel(mode: _mode),
          const SizedBox(height: 16),
          if (_feedback != null) ...[
            _FeedbackBanner(feedback: _feedback!),
            const SizedBox(height: 16),
          ],
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: _mode == _AuthMode.signIn
                ? _buildSignInForm(context)
                : _buildSignUpForm(context),
          ),
        ],
      ),
    );
  }

  Widget _buildSignInForm(BuildContext context) {
    final theme = Theme.of(context);

    return Form(
      key: _signInFormKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: AutofillGroup(
        key: const ValueKey('sign-in-form'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Entrar com minha conta', style: theme.textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(
              'Acesse sua agenda, seus benefícios, inspirações salvas e a comunicação direta com o salão.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _signInEmailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              validator: (value) => validateAuthEmail(value ?? ''),
              decoration: const InputDecoration(
                labelText: 'E-mail',
                hintText: 'voce@email.com',
                prefixIcon: Icon(Icons.alternate_email_rounded),
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _signInPasswordController,
              obscureText: !_signInPasswordVisible,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              validator: (value) => validateAuthPassword(value ?? ''),
              onFieldSubmitted: (_) => _loading ? null : _submitSignIn(),
              decoration: InputDecoration(
                labelText: 'Senha',
                hintText: 'Sua senha de acesso',
                prefixIcon: const Icon(Icons.lock_outline_rounded),
                suffixIcon: IconButton(
                  onPressed: () {
                    setState(
                      () => _signInPasswordVisible = !_signInPasswordVisible,
                    );
                  },
                  icon: Icon(
                    _signInPasswordVisible
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _loading ? null : _showPasswordResetDialog,
                child: const Text('Esqueci minha senha'),
              ),
            ),
            const SizedBox(height: 8),
            const _AuthMicroBenefitRow(
              items: [
                _AuthMicroBenefit(
                  icon: Icons.schedule_rounded,
                  label: 'Agenda pronta para rebook',
                ),
                _AuthMicroBenefit(
                  icon: Icons.notifications_active_outlined,
                  label: 'Avisos de vaga e promoções',
                ),
                _AuthMicroBenefit(
                  icon: Icons.workspace_premium_outlined,
                  label: 'Cashback e pacotes ativos',
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (_biometricState.hasSavedCredentials) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _biometricLoading ? null : _submitBiometricSignIn,
                  icon: _biometricLoading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          _biometricState.kind == QuickBiometricKind.face
                              ? Icons.face_retouching_natural_rounded
                              : Icons.fingerprint_rounded,
                        ),
                  label: Text(
                    _biometricLoading
                        ? 'Validando biometria...'
                        : _biometricState.actionLabel,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (_biometricState.isSupported) ...[
              CheckboxListTile(
                value: _biometricOptIn,
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                dense: true,
                activeColor: const Color(0xFFC56B43),
                title: Text(
                  _biometricState.optInLabel,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF4C3427),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  _biometricState.hasSavedCredentials
                      ? 'Você já pode entrar mais rápido neste aparelho.'
                      : 'Salvamos o acesso com segurança só neste dispositivo.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF876F5F),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onChanged: _loading || _biometricLoading
                    ? null
                    : (value) {
                        setState(() => _biometricOptIn = value ?? false);
                      },
              ),
              const SizedBox(height: 10),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _loading ? null : _submitSignIn,
                icon: _loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.login_rounded),
                label: Text(_loading ? 'Entrando...' : 'Entrar no app'),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Depois do login, o app confirma seu salão e já libera agenda, benefícios e contato em um só lugar.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF876F5F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignUpForm(BuildContext context) {
    final theme = Theme.of(context);
    final passwordStrength = evaluatePasswordStrength(
      _signUpPasswordController.text,
    );

    return Form(
      key: _signUpFormKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: AutofillGroup(
        key: const ValueKey('sign-up-form'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Criar minha conta', style: theme.textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(
              'Em seguida, você conecta o código do salão para liberar agenda, benefícios e contato.',
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _signUpEmailController,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [
                AutofillHints.newUsername,
                AutofillHints.email,
              ],
              validator: (value) => validateAuthEmail(value ?? ''),
              decoration: const InputDecoration(
                labelText: 'E-mail',
                hintText: 'voce@email.com',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _signUpPasswordController,
              obscureText: !_signUpPasswordVisible,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.newPassword],
              validator: (value) => validateAuthPassword(value ?? ''),
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: 'Senha',
                hintText: 'Crie uma senha segura',
                prefixIcon: const Icon(Icons.lock_person_outlined),
                suffixIcon: IconButton(
                  onPressed: () {
                    setState(
                      () => _signUpPasswordVisible = !_signUpPasswordVisible,
                    );
                  },
                  icon: Icon(
                    _signUpPasswordVisible
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _PasswordStrengthBanner(strength: passwordStrength),
            const SizedBox(height: 14),
            TextFormField(
              controller: _signUpConfirmPasswordController,
              obscureText: !_signUpConfirmPasswordVisible,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              validator: (value) => validatePasswordConfirmation(
                password: _signUpPasswordController.text,
                confirmation: value ?? '',
              ),
              onFieldSubmitted: (_) => _loading ? null : _submitSignUp(),
              decoration: InputDecoration(
                labelText: 'Confirmar senha',
                hintText: 'Repita a mesma senha',
                prefixIcon: const Icon(Icons.verified_user_outlined),
                suffixIcon: IconButton(
                  onPressed: () {
                    setState(
                      () => _signUpConfirmPasswordVisible =
                          !_signUpConfirmPasswordVisible,
                    );
                  },
                  icon: Icon(
                    _signUpConfirmPasswordVisible
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const _AuthStepChecklist(),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _loading ? null : _submitSignUp,
                icon: _loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.person_add_alt_1_rounded),
                label: Text(_loading ? 'Criando conta...' : 'Criar conta'),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Ao continuar, você cria a conta de acesso. O próximo passo conecta seu salão e ativa a experiência certa.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF876F5F),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthShowcase extends StatelessWidget {
  const _AuthShowcase({required this.mode});

  final _AuthMode mode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SoftCard(
      padding: const EdgeInsets.all(28),
      gradient: const LinearGradient(
        colors: [Color(0xFFFFF4EA), Color(0xFFF1CFB7)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: const Color(0xFFDAB79E),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.78),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0x26A8562D)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(11),
                  child: Image.asset('assets/branding/app_splash.png'),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Salon Fun', style: theme.textTheme.labelLarge),
                    const SizedBox(height: 2),
                    Text(
                      'Agenda, benefícios e contato com o salão no mesmo app',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B4B3A),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            mode == _AuthMode.signIn
                ? 'Entre para decidir mais rápido e voltar mais vezes.'
                : 'Crie sua conta e deixe o salão sempre a um passo.',
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: 14),
          Text(
            'A experiência começa no acesso: agenda organizada, inspiração para escolher, benefícios ativos, vagas liberadas e contato rápido com a marca certa.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF5F4334),
            ),
          ),
          const SizedBox(height: 22),
          const Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _ShowcasePill(
                icon: Icons.event_available_rounded,
                label: 'Reserva com poucos toques',
              ),
              _ShowcasePill(
                icon: Icons.loyalty_rounded,
                label: 'Desconto, cashback e pacote',
              ),
              _ShowcasePill(
                icon: Icons.chat_bubble_outline_rounded,
                label: 'Falar com o salão',
              ),
            ],
          ),
          const SizedBox(height: 22),
          const _ShowcaseFeature(
            title: 'Agenda que converte',
            message:
                'Veja horários disponíveis, confirme presença e faça rebook sem depender de conversa solta para fechar o retorno.',
            icon: Icons.calendar_month_rounded,
          ),
          const SizedBox(height: 12),
          const _ShowcaseFeature(
            title: 'Benefícios que puxam retorno',
            message:
                'Cashback, pacote, indicação e promoções ficam visíveis no app, incentivando a próxima visita.',
            icon: Icons.workspace_premium_rounded,
          ),
          const SizedBox(height: 12),
          const _ShowcaseFeature(
            title: 'Inspiração que vira agendamento',
            message:
                'Fotos, resultados e comunicação do salão ajudam o cliente a decidir mais rápido o próximo serviço.',
            icon: Icons.photo_library_outlined,
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0x26A8562D)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.84),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(
                    Icons.shield_rounded,
                    color: Color(0xFF8E441F),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Conta segura, valor liberado logo depois',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Você cria o acesso uma vez e, na sequência, conecta o código do salão para carregar agenda, benefícios, inspirações e contato certo.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF5F4334),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthValuePanel extends StatelessWidget {
  const _AuthValuePanel({required this.mode});

  final _AuthMode mode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final value = switch (mode) {
      _AuthMode.signIn => const (
        title: 'Ao entrar, você volta com vantagem',
        message:
            'O app devolve contexto, benefício e próximo passo logo no primeiro toque.',
        items: [
          'Próximo horário, histórico e rebook no mesmo lugar.',
          'Pontos, cashback, desconto ou pacote sempre à vista.',
          'Contato rápido quando você quiser alinhar o atendimento.',
        ],
      ),
      _AuthMode.signUp => const (
        title: 'Sua conta já nasce pronta para a experiência certa',
        message:
            'Depois do cadastro, basta informar o código do salão para destravar tudo.',
        items: [
          'Agenda e serviços personalizados do seu salão.',
          'Benefícios, promoções e condições especiais.',
          'Fotos, inspirações e contato direto para decidir mais rápido.',
        ],
      ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5D5C6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value.title,
            style: theme.textTheme.titleMedium?.copyWith(
              color: const Color(0xFF4A3124),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value.message,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF705A4B),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          for (final item in value.items) ...[
            _AuthValueRow(message: item),
            if (item != value.items.last) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _AuthValueRow extends StatelessWidget {
  const _AuthValueRow({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: const Color(0xFFFFEFE2),
            borderRadius: BorderRadius.circular(11),
          ),
          child: const Icon(
            Icons.check_rounded,
            size: 15,
            color: Color(0xFFB55D34),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF5F4334),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.mode, required this.onChanged});

  final _AuthMode mode;
  final ValueChanged<_AuthMode>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8EEE4),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE6D6C8)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _ModeSelectorButton(
              label: 'Entrar',
              selected: mode == _AuthMode.signIn,
              onTap: onChanged == null
                  ? null
                  : () => onChanged!(_AuthMode.signIn),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _ModeSelectorButton(
              label: 'Criar conta',
              selected: mode == _AuthMode.signUp,
              onTap: onChanged == null
                  ? null
                  : () => onChanged!(_AuthMode.signUp),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeSelectorButton extends StatelessWidget {
  const _ModeSelectorButton({
    required this.label,
    required this.selected,
    this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: selected ? const Color(0xFFC56B43) : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : const Color(0xFF7A5B4A),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeedbackBanner extends StatelessWidget {
  const _FeedbackBanner({required this.feedback});

  final _AuthFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, border) = switch (feedback.tone) {
      _AuthFeedbackTone.success => (
        const Color(0xFFEFF8F2),
        const Color(0xFF2E6B4B),
        const Color(0xFFBFE0CB),
      ),
      _AuthFeedbackTone.error => (
        const Color(0xFFFFF0EE),
        const Color(0xFFA63B30),
        const Color(0xFFF0C9C5),
      ),
      _AuthFeedbackTone.info => (
        const Color(0xFFFFF7EC),
        const Color(0xFF8E441F),
        const Color(0xFFE7D3BE),
      ),
    };

    final icon = switch (feedback.tone) {
      _AuthFeedbackTone.success => Icons.check_circle_rounded,
      _AuthFeedbackTone.error => Icons.error_rounded,
      _AuthFeedbackTone.info => Icons.info_rounded,
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              feedback.message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordStrengthBanner extends StatelessWidget {
  const _PasswordStrengthBanner({required this.strength});

  final PasswordStrength strength;

  @override
  Widget build(BuildContext context) {
    final color = switch (strength) {
      PasswordStrength.strong => const Color(0xFF2E6B4B),
      PasswordStrength.medium => const Color(0xFFC56B43),
      PasswordStrength.weak => const Color(0xFF8A6B59),
    };

    final note = switch (strength) {
      PasswordStrength.strong =>
        'Boa combinação de tamanho, letras e variação.',
      PasswordStrength.medium =>
        'Já está aceitável, mas pode ficar mais forte.',
      PasswordStrength.weak => 'Misture letras, números e mais caracteres.',
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE3D5C7)),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: '${passwordStrengthLabel(strength)}. ',
                    style: TextStyle(color: color, fontWeight: FontWeight.w800),
                  ),
                  TextSpan(
                    text: note,
                    style: const TextStyle(
                      color: Color(0xFF705A4B),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthStepChecklist extends StatelessWidget {
  const _AuthStepChecklist();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5D5C6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          _AuthStepRow(
            step: '1',
            title: 'Criar o acesso',
            message: 'Seu e-mail vira a chave da sua conta no app.',
          ),
          SizedBox(height: 12),
          _AuthStepRow(
            step: '2',
            title: 'Confirmar o e-mail, se necessário',
            message:
                'Alguns projetos pedem confirmação antes do primeiro login.',
          ),
          SizedBox(height: 12),
          _AuthStepRow(
            step: '3',
            title: 'Informar o código do salão',
            message: 'É nessa etapa que a experiência fica personalizada.',
          ),
        ],
      ),
    );
  }
}

class _AuthStepRow extends StatelessWidget {
  const _AuthStepRow({
    required this.step,
    required this.title,
    required this.message,
  });

  final String step;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFFC56B43),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Text(
            step,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF705A4B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ShowcaseFeature extends StatelessWidget {
  const _ShowcaseFeature({
    required this.title,
    required this.message,
    required this.icon,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x26A8562D)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: const Color(0xFF8E441F)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF5F4334),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShowcasePill extends StatelessWidget {
  const _ShowcasePill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.52),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x26A8562D)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF8E441F)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF5F4334),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthMicroBenefit {
  const _AuthMicroBenefit({required this.icon, required this.label});

  final IconData icon;
  final String label;
}

class _AuthMicroBenefitRow extends StatelessWidget {
  const _AuthMicroBenefitRow({required this.items});

  final List<_AuthMicroBenefit> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: items
          .map(
            (item) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8F1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5D5C6)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(item.icon, size: 18, color: const Color(0xFF8E441F)),
                  const SizedBox(width: 8),
                  Text(
                    item.label,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF5F4334),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}
