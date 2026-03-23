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
              ? 'Conta criada. Confirme o e-mail ${result.email} e depois entre para conectar o código do seu salão.'
              : 'Conta criada com sucesso. Agora entre e continue para conectar o código do seu salão.',
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
                      hintText: 'nome@email.com',
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
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
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
                                  child: _AuthShowcase(
                                    mode: _mode,
                                    compact: false,
                                  ),
                                ),
                                const SizedBox(width: 20),
                                Expanded(
                                  flex: 10,
                                  child: _buildAuthPanel(
                                    context,
                                    compact: false,
                                  ),
                                ),
                              ],
                            )
                          : Column(
                              children: [
                                _buildAuthPanel(context, compact: true),
                                const SizedBox(height: 16),
                                _AuthShowcase(mode: _mode, compact: true),
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

  Widget _buildAuthPanel(BuildContext context, {required bool compact}) {
    final theme = Theme.of(context);
    final activeStatus = _loading
        ? (_mode == _AuthMode.signIn
              ? 'Entrando com segurança...'
              : 'Criando sua conta...')
        : _biometricLoading
        ? 'Validando biometria...'
        : null;

    return SoftCard(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _AuthModeSwitcher(
            child: Column(
              key: ValueKey('auth-panel-header-${_mode.name}-$compact'),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _EntranceMotion(
                  delay: const Duration(milliseconds: 0),
                  child: _AuthHeroTag(
                    icon: _mode == _AuthMode.signIn
                        ? Icons.verified_user_outlined
                        : Icons.person_add_alt_1_rounded,
                    label: _mode == _AuthMode.signIn
                        ? 'Acesso pessoal'
                        : 'Criar acesso',
                  ),
                ),
                const SizedBox(height: 14),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 40),
                  child: Row(
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
                                  ? 'Entre para agendar mais rápido, usar benefícios e falar com o salão.'
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
                ),
                const SizedBox(height: 20),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 80),
                  child: Text(
                    _mode == _AuthMode.signIn
                        ? 'Entre e continue para o seu salão.'
                        : 'Crie sua conta e continue para o seu salão.',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontSize: compact ? 28 : 30,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 120),
                  child: Text(
                    _mode == _AuthMode.signIn
                        ? 'Seu login leva ao próximo passo: conectar o código do salão e liberar agenda, benefícios e contato.'
                        : 'Você cria o acesso agora e conecta o código do salão no passo seguinte.',
                    style: theme.textTheme.bodyLarge,
                  ),
                ),
                const SizedBox(height: 14),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 160),
                  child: _AuthSignalRow(mode: _mode),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _EntranceMotion(
            delay: const Duration(milliseconds: 120),
            child: _ModeSelector(
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
          ),
          const SizedBox(height: 16),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: _buildSwitchTransition,
            child: activeStatus != null
                ? Padding(
                    key: ValueKey('auth-activity-$activeStatus'),
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _AuthActivityBanner(label: activeStatus),
                  )
                : _feedback != null
                ? Padding(
                    key: ValueKey('auth-feedback-${_feedback!.message}'),
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _FeedbackBanner(feedback: _feedback!),
                  )
                : const SizedBox.shrink(key: ValueKey('auth-idle')),
          ),
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
            const _EntranceMotion(
              delay: Duration(milliseconds: 0),
              child: _AuthFormHeader(
                title: 'Seus dados de acesso',
                message:
                    'Use o e-mail da sua conta para liberar sua rotina com o salão.',
              ),
            ),
            const SizedBox(height: 16),
            if (_biometricState.hasSavedCredentials) ...[
              _EntranceMotion(
                delay: const Duration(milliseconds: 40),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _biometricLoading
                        ? null
                        : _submitBiometricSignIn,
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
              ),
              const SizedBox(height: 16),
              const _EntranceMotion(
                delay: Duration(milliseconds: 70),
                child: _AuthSectionDivider(
                  label: 'ou entre com e-mail e senha',
                ),
              ),
              const SizedBox(height: 16),
            ],
            _EntranceMotion(
              delay: const Duration(milliseconds: 90),
              child: TextFormField(
                controller: _signInEmailController,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.email],
                validator: (value) => validateAuthEmail(value ?? ''),
                decoration: const InputDecoration(
                  labelText: 'E-mail',
                  hintText: 'nome@email.com',
                  prefixIcon: Icon(Icons.alternate_email_rounded),
                ),
              ),
            ),
            const SizedBox(height: 14),
            _EntranceMotion(
              delay: const Duration(milliseconds: 130),
              child: TextFormField(
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
            ),
            const SizedBox(height: 8),
            _EntranceMotion(
              delay: const Duration(milliseconds: 160),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _loading ? null : _showPasswordResetDialog,
                  child: const Text('Esqueci minha senha'),
                ),
              ),
            ),
            const SizedBox(height: 18),
            _EntranceMotion(
              delay: const Duration(milliseconds: 190),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _loading ? null : _submitSignIn,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.login_rounded),
                  label: Text(_loading ? 'Entrando...' : 'Entrar e continuar'),
                ),
              ),
            ),
            if (_biometricState.isSupported) ...[
              const SizedBox(height: 14),
              _EntranceMotion(
                delay: const Duration(milliseconds: 230),
                child: _AuthSupportCard(
                  icon: _biometricState.kind == QuickBiometricKind.face
                      ? Icons.face_retouching_natural_rounded
                      : Icons.fingerprint_rounded,
                  title: _biometricState.hasSavedCredentials
                      ? 'Entrada rápida neste aparelho'
                      : 'Atalho liberado depois do primeiro login',
                  message: _biometricState.hasSavedCredentials
                      ? 'Você já pode manter o acesso rápido ativo neste dispositivo.'
                      : 'Salvamos seu acesso com segurança só neste dispositivo se você optar por isso.',
                  child: CheckboxListTile(
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
                    onChanged: _loading || _biometricLoading
                        ? null
                        : (value) {
                            setState(() => _biometricOptIn = value ?? false);
                          },
                  ),
                ),
              ),
            ],
            const SizedBox(height: 14),
            const _EntranceMotion(
              delay: Duration(milliseconds: 270),
              child: _AuthNextStepNotice(
                title: 'Próximo passo',
                message:
                    'Depois do login, basta informar o código do salão para liberar agenda, benefícios e contato.',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignUpForm(BuildContext context) {
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
            const _EntranceMotion(
              delay: Duration(milliseconds: 0),
              child: _AuthFormHeader(
                title: 'Seu acesso começa aqui',
                message:
                    'Crie a conta primeiro. Depois, você conecta o salão no próximo passo.',
              ),
            ),
            const SizedBox(height: 16),
            _EntranceMotion(
              delay: const Duration(milliseconds: 60),
              child: TextFormField(
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
                  hintText: 'nome@email.com',
                  prefixIcon: Icon(Icons.mail_outline_rounded),
                ),
              ),
            ),
            const SizedBox(height: 14),
            _EntranceMotion(
              delay: const Duration(milliseconds: 100),
              child: TextFormField(
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
            ),
            const SizedBox(height: 10),
            _EntranceMotion(
              delay: const Duration(milliseconds: 130),
              child: _PasswordStrengthBanner(strength: passwordStrength),
            ),
            const SizedBox(height: 14),
            _EntranceMotion(
              delay: const Duration(milliseconds: 170),
              child: TextFormField(
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
            ),
            const SizedBox(height: 16),
            _EntranceMotion(
              delay: const Duration(milliseconds: 210),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _loading ? null : _submitSignUp,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.person_add_alt_1_rounded),
                  label: Text(
                    _loading ? 'Criando conta...' : 'Criar conta e continuar',
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const _EntranceMotion(
              delay: Duration(milliseconds: 250),
              child: _AuthStepChecklist(),
            ),
            const SizedBox(height: 14),
            const _EntranceMotion(
              delay: Duration(milliseconds: 290),
              child: _AuthNextStepNotice(
                title: 'Depois do cadastro',
                message:
                    'Entre e continue para informar o código do salão e liberar a experiência completa.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthShowcase extends StatelessWidget {
  const _AuthShowcase({required this.mode, required this.compact});

  final _AuthMode mode;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = switch (mode) {
      _AuthMode.signIn => 'Tudo do seu salão em um só lugar.',
      _AuthMode.signUp => 'Sua conta começa simples e cresce com o salão.',
    };
    final message = switch (mode) {
      _AuthMode.signIn =>
        'Depois de entrar, você acompanha agenda, benefícios e contato com o salão sem depender de conversa solta.',
      _AuthMode.signUp =>
        'Você cria o acesso agora e informa o código do salão depois para liberar a experiência certa.',
    };
    final highlights = switch (mode) {
      _AuthMode.signIn => const [
        'Agenda, histórico e rebook no mesmo lugar.',
        'Benefícios ativos e promoções sempre visíveis.',
        'Contato rápido para alinhar atendimento e retorno.',
      ],
      _AuthMode.signUp => const [
        'Seu e-mail vira a chave da sua conta.',
        'O código do salão libera a experiência certa.',
        'Agenda, benefícios e contato ficam no mesmo app.',
      ],
    };

    if (compact) {
      return SoftCard(
        padding: const EdgeInsets.all(22),
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF4EA), Color(0xFFF1CFB7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderColor: const Color(0xFFDAB79E),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _AuthModeSwitcher(
              child: Column(
                key: ValueKey('auth-showcase-compact-${mode.name}'),
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _EntranceMotion(
                    delay: const Duration(milliseconds: 0),
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.78),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x26A8562D)),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Image.asset(
                              'assets/branding/app_splash.png',
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Salon Fun',
                                style: theme.textTheme.labelLarge,
                              ),
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
                  ),
                  const SizedBox(height: 18),
                  _EntranceMotion(
                    delay: const Duration(milliseconds: 50),
                    child: Text(
                      title,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontSize: 28,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _EntranceMotion(
                    delay: const Duration(milliseconds: 90),
                    child: Text(
                      message,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: const Color(0xFF5F4334),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _EntranceMotion(
                    delay: const Duration(milliseconds: 130),
                    child: _ShowcaseSpotlight(mode: mode, compact: true),
                  ),
                  const SizedBox(height: 18),
                  for (var index = 0; index < highlights.length; index++) ...[
                    _EntranceMotion(
                      delay: Duration(milliseconds: 170 + (index * 35)),
                      child: _AuthValueRow(message: highlights[index]),
                    ),
                    if (index != highlights.length - 1)
                      const SizedBox(height: 10),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
    }

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
          _AuthModeSwitcher(
            child: Column(
              key: ValueKey('auth-showcase-wide-${mode.name}'),
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _EntranceMotion(
                  delay: const Duration(milliseconds: 0),
                  child: Row(
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
                            Text(
                              'Salon Fun',
                              style: theme.textTheme.labelLarge,
                            ),
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
                ),
                const SizedBox(height: 18),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 50),
                  child: Text(title, style: theme.textTheme.headlineMedium),
                ),
                const SizedBox(height: 14),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 90),
                  child: Text(
                    message,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: const Color(0xFF5F4334),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 130),
                  child: _ShowcaseSpotlight(mode: mode, compact: false),
                ),
                const SizedBox(height: 22),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 170),
                  child: _ShowcaseFeature(
                    title: 'Agenda que converte',
                    message:
                        'Veja horários, confirme presença e faça rebook com menos fricção.',
                    icon: Icons.calendar_month_rounded,
                  ),
                ),
                const SizedBox(height: 12),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 205),
                  child: _ShowcaseFeature(
                    title: 'Benefícios que puxam retorno',
                    message:
                        'Cashback, pacote e promoções ficam visíveis para incentivar a próxima visita.',
                    icon: Icons.workspace_premium_rounded,
                  ),
                ),
                const SizedBox(height: 12),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 240),
                  child: _ShowcaseFeature(
                    title: 'Contato que resolve rápido',
                    message:
                        'O cliente fala com o salão com contexto, sem perder histórico nem próximos passos.',
                    icon: Icons.chat_bubble_outline_rounded,
                  ),
                ),
                const SizedBox(height: 20),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 275),
                  child: _ShowcaseSecurityCard(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

Widget _buildSwitchTransition(Widget child, Animation<double> animation) {
  final curved = CurvedAnimation(
    parent: animation,
    curve: Curves.easeOutCubic,
    reverseCurve: Curves.easeInCubic,
  );

  return FadeTransition(
    opacity: curved,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(0, 0.035),
        end: Offset.zero,
      ).animate(curved),
      child: child,
    ),
  );
}

class _EntranceMotion extends StatelessWidget {
  const _EntranceMotion({required this.child, this.delay = Duration.zero});

  final Widget child;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    const duration = Duration(milliseconds: 360);
    const offsetY = 14.0;
    final total = delay + duration;
    final delayFactor = total.inMicroseconds == 0
        ? 0.0
        : delay.inMicroseconds / total.inMicroseconds;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      builder: (context, value, child) {
        final normalized = value <= delayFactor
            ? 0.0
            : ((value - delayFactor) / (1 - delayFactor)).clamp(0.0, 1.0);
        final eased = Curves.easeOutCubic.transform(normalized);

        return Opacity(
          opacity: eased,
          child: Transform.translate(
            offset: Offset(0, (1 - eased) * offsetY),
            child: Transform.scale(
              scale: 0.985 + (0.015 * eased),
              alignment: Alignment.topCenter,
              child: child,
            ),
          ),
        );
      },
      child: child,
    );
  }
}

class _AuthModeSwitcher extends StatelessWidget {
  const _AuthModeSwitcher({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: _buildSwitchTransition,
      child: child,
    );
  }
}

class _ShowcaseSecurityCard extends StatelessWidget {
  const _ShowcaseSecurityCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
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
            child: const Icon(Icons.shield_rounded, color: Color(0xFF8E441F)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Conta segura, experiência liberada em seguida',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Você cria o acesso uma vez e, na sequência, conecta o código do salão para carregar agenda, benefícios e contato certo.',
                  style: theme.textTheme.bodyMedium?.copyWith(
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

class _AuthHeroTag extends StatelessWidget {
  const _AuthHeroTag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF5EB),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE8D3C1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF8E441F)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF6B4B3A),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthSignalRow extends StatelessWidget {
  const _AuthSignalRow({required this.mode});

  final _AuthMode mode;

  @override
  Widget build(BuildContext context) {
    final items = switch (mode) {
      _AuthMode.signIn => const [
        (icon: Icons.flash_on_rounded, label: 'Agenda sem fricção'),
        (
          icon: Icons.workspace_premium_outlined,
          label: 'Benefícios sempre visíveis',
        ),
      ],
      _AuthMode.signUp => const [
        (icon: Icons.timer_outlined, label: 'Cadastro rápido'),
        (icon: Icons.link_rounded, label: 'Conecta no próximo passo'),
      ],
    };

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final item in items)
          _AuthSignalChip(icon: item.icon, label: item.label),
      ],
    );
  }
}

class _AuthSignalChip extends StatelessWidget {
  const _AuthSignalChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 280),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF9F3),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE9DACA)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFFB55D34)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              softWrap: true,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF6B4B3A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthFormHeader extends StatelessWidget {
  const _AuthFormHeader({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.titleMedium?.copyWith(
            color: const Color(0xFF4C3427),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF876F5F),
            fontWeight: FontWeight.w600,
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
        gradient: selected
            ? const LinearGradient(
                colors: [Color(0xFFCF764A), Color(0xFFB55D34)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              )
            : null,
        color: selected ? null : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        boxShadow: selected
            ? const [
                BoxShadow(
                  color: Color(0x26C56B43),
                  blurRadius: 16,
                  offset: Offset(0, 8),
                ),
              ]
            : const [],
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
                  letterSpacing: selected ? 0.1 : 0,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AuthSectionDivider extends StatelessWidget {
  const _AuthSectionDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: Color(0xFFE5D5C6), thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF876F5F),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const Expanded(child: Divider(color: Color(0xFFE5D5C6), thickness: 1)),
      ],
    );
  }
}

class _AuthActivityBanner extends StatelessWidget {
  const _AuthActivityBanner({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7EC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE7D3BE)),
      ),
      child: Row(
        children: [
          const SizedBox.square(
            dimension: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2.2,
              color: Color(0xFFC56B43),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF8E441F),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthSupportCard extends StatelessWidget {
  const _AuthSupportCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.child,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE5D5C6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEFE2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 18, color: const Color(0xFF8E441F)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF4C3427),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      message,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF876F5F),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _AuthNextStepNotice extends StatelessWidget {
  const _AuthNextStepNotice({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8F1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE5D5C6)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: const Color(0xFFFFEFE2),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.arrow_circle_right_outlined,
              size: 18,
              color: Color(0xFFB55D34),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF4C3427),
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF876F5F),
                    fontWeight: FontWeight.w600,
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

class _ShowcaseSpotlight extends StatelessWidget {
  const _ShowcaseSpotlight({required this.mode, required this.compact});

  final _AuthMode mode;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = switch (mode) {
      _AuthMode.signIn => 'O que fica liberado logo depois do login',
      _AuthMode.signUp => 'Como a experiência entra em cena',
    };
    final metrics = switch (mode) {
      _AuthMode.signIn => const [
        (
          label: 'Agenda',
          value: 'Próximo horário e rebook',
          icon: Icons.calendar_today_rounded,
        ),
        (
          label: 'Benefícios',
          value: 'Cashback, pacote e promoções',
          icon: Icons.workspace_premium_rounded,
        ),
        (
          label: 'Contato',
          value: 'Canal direto com o salão',
          icon: Icons.chat_bubble_outline_rounded,
        ),
      ],
      _AuthMode.signUp => const [
        (
          label: 'Cadastro',
          value: 'E-mail e senha em poucos passos',
          icon: Icons.person_add_alt_1_rounded,
        ),
        (
          label: 'Conexão',
          value: 'Código do salão no passo seguinte',
          icon: Icons.link_rounded,
        ),
        (
          label: 'Resultado',
          value: 'Agenda, benefícios e contato no mesmo app',
          icon: Icons.auto_awesome_rounded,
        ),
      ],
    };

    return Container(
      padding: EdgeInsets.all(compact ? 16 : 18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: compact ? 0.58 : 0.5),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x26A8562D)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final item in metrics)
                _ShowcaseMetricCard(
                  icon: item.icon,
                  label: item.label,
                  value: item.value,
                  compact: compact,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShowcaseMetricCard extends StatelessWidget {
  const _ShowcaseMetricCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.compact,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ConstrainedBox(
      constraints: BoxConstraints(minWidth: compact ? 120 : 150, maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0x1FA8562D)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(0xFFFFEFE2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 18, color: const Color(0xFF8E441F)),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF8E441F),
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF5F4334),
                fontWeight: FontWeight.w700,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
