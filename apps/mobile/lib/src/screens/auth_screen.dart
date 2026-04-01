import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/auth/auth_form_validators.dart';
import '../repositories/salon_repository.dart';
import '../services/biometric_quick_login_service.dart';
import '../theme/tenant_theme.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_surface_card.dart';

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
              : 'Conta criada com sucesso. Agora entre no app.',
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
    final premiumTheme = context.premiumTheme;
    final activeStatus = _loading
        ? (_mode == _AuthMode.signIn
              ? 'Entrando com segurança...'
              : 'Criando sua conta...')
        : _biometricLoading
        ? 'Validando biometria...'
        : null;

    return PremiumSurfaceCard(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: premiumTheme.isDark ? 0.08 : 0.98),
          premiumTheme.surfacePrimary,
          premiumTheme.surfaceAccent,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.contrast,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _AuthSignalPill(
                label: _mode == _AuthMode.signIn
                    ? 'Entrada segura'
                    : 'Nova conta',
                icon: _mode == _AuthMode.signIn
                    ? Icons.shield_outlined
                    : Icons.auto_awesome_rounded,
              ),
              _AuthSignalPill(
                label: _biometricState.hasSavedCredentials
                    ? 'Biometria liberada'
                    : 'Código do salão',
                icon: _biometricState.hasSavedCredentials
                    ? (_biometricState.kind == QuickBiometricKind.face
                          ? Icons.face_retouching_natural_rounded
                          : Icons.fingerprint_rounded)
                    : Icons.link_rounded,
              ),
            ],
          ),
          const SizedBox(height: 14),
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
                const SizedBox(height: 12),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 40),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFFF4EA), Color(0xFFF2D0B8)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFDAB79E)),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(9),
                          child: Image.asset('assets/branding/app_splash.png'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Área do cliente',
                              style: theme.textTheme.labelLarge,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _mode == _AuthMode.signIn
                                  ? 'Entre para abrir sua agenda.'
                                  : 'Crie sua conta para entrar no app.',
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
                const SizedBox(height: 16),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 80),
                  child: Text(
                    _mode == _AuthMode.signIn
                        ? 'Entre e siga para seu salão.'
                        : 'Crie sua conta e siga para seu salão.',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontSize: compact ? 26 : 28,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                _EntranceMotion(
                  delay: const Duration(milliseconds: 120),
                  child: Text(
                    _mode == _AuthMode.signIn
                        ? 'No próximo passo, você conecta o salão.'
                        : 'Crie o acesso agora. O código do salão vem depois.',
                    style: theme.textTheme.bodyLarge,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
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
                message: 'Use o e-mail da sua conta.',
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
                message: 'Crie a conta. Depois, conecte o salão.',
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
            const SizedBox(height: 14),
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
            const SizedBox(height: 14),
            const _EntranceMotion(
              delay: Duration(milliseconds: 250),
              child: _AuthStepChecklist(),
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
    final premiumTheme = context.premiumTheme;
    final title = switch (mode) {
      _AuthMode.signIn => 'Seu salão, no seu ritmo.',
      _AuthMode.signUp => 'Uma conta para entrar em qualquer salão.',
    };
    final message = switch (mode) {
      _AuthMode.signIn => 'Agenda, carteira e contato no mesmo app.',
      _AuthMode.signUp => 'Crie sua conta e escolha o salão depois.',
    };
    final highlights = switch (mode) {
      _AuthMode.signIn => const [
        'Agenda e histórico no mesmo lugar.',
        'Carteira e ofertas sempre visíveis.',
        'Contato rápido com o salão.',
      ],
      _AuthMode.signUp => const [
        'Seu e-mail vira a chave da conta.',
        'O código escolhe o salão certo.',
        'Agenda e carteira ficam no mesmo app.',
      ],
    };

    if (compact) {
      return PremiumSurfaceCard(
        padding: const EdgeInsets.all(22),
        gradient: LinearGradient(
          colors: [
            premiumTheme.surfaceAccent,
            premiumTheme.surfaceSecondary,
            premiumTheme.surfacePrimary,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        tone: PremiumSurfaceTone.accent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _AuthShowcaseRibbon(
                  label: mode == _AuthMode.signIn
                      ? 'Conta do cliente'
                      : 'Nova conta',
                  icon: Icons.auto_awesome_rounded,
                ),
                const _AuthShowcaseRibbon(
                  label: 'Agenda e carteira',
                  icon: Icons.grid_view_rounded,
                ),
              ],
            ),
            const SizedBox(height: 18),
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
                                'Agenda, carteira e contato no app',
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

    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(28),
      gradient: LinearGradient(
        colors: [
          premiumTheme.surfaceAccent,
          premiumTheme.surfaceSecondary,
          premiumTheme.surfacePrimary,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _AuthShowcaseRibbon(
                label: mode == _AuthMode.signIn
                    ? 'Conta do cliente'
                    : 'Nova conta',
                icon: Icons.auto_awesome_rounded,
              ),
              const _AuthShowcaseRibbon(
                label: 'Agenda e carteira',
                icon: Icons.grid_view_rounded,
              ),
            ],
          ),
          const SizedBox(height: 18),
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
                              'Agenda, carteira e contato no app',
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
                    title: 'Agenda clara',
                    message: 'Horários e confirmações no mesmo lugar.',
                    icon: Icons.calendar_month_rounded,
                  ),
                ),
                const SizedBox(height: 12),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 205),
                  child: _ShowcaseFeature(
                    title: 'Carteira visível',
                    message: 'Cashback, planos e ofertas sem ruído.',
                    icon: Icons.workspace_premium_rounded,
                  ),
                ),
                const SizedBox(height: 12),
                const _EntranceMotion(
                  delay: Duration(milliseconds: 240),
                  child: _ShowcaseFeature(
                    title: 'Contato que resolve rápido',
                    message: 'Fale com o salão sem sair do app.',
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
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.56),
            const Color(0xFFFFEBD8).withValues(alpha: 0.72),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
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
                  'Conta segura',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Entre uma vez e conecte o salão depois.',
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

class _AuthSignalPill extends StatelessWidget {
  const _AuthSignalPill({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 240),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFFFF7EE),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFE9DACB)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: const Color(0xFF8E441F)),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF6B4B3A),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthShowcaseRibbon extends StatelessWidget {
  const _AuthShowcaseRibbon({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.56),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0x26A8562D)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: const Color(0xFF8E441F)),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: const Color(0xFF6B4B3A),
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
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
            color: theme.colorScheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.68),
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
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.2),
        ),
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
    final theme = Theme.of(context);
    final selectedColor = theme.colorScheme.primary;
    final selectedForeground = theme.colorScheme.onPrimary;
    final idleForeground = theme.colorScheme.onSurface.withValues(alpha: 0.72);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        gradient: selected
            ? LinearGradient(
                colors: [
                  Color.lerp(selectedColor, Colors.white, 0.08)!,
                  Color.lerp(selectedColor, Colors.black, 0.08)!,
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              )
            : null,
        color: selected ? null : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        boxShadow: selected
            ? [
                BoxShadow(
                  color: selectedColor.withValues(alpha: 0.16),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : const [],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? selectedForeground : idleForeground,
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
    return PremiumSurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      tone: PremiumSurfaceTone.accent,
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

    return PremiumSurfaceCard(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
      tone: PremiumSurfaceTone.secondary,
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

    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(14),
      gradient: LinearGradient(
        colors: [background, Color.lerp(background, Colors.white, 0.2)!],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.secondary,
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

    return PremiumSurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      tone: PremiumSurfaceTone.secondary,
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
    return const PremiumSurfaceCard(
      padding: EdgeInsets.all(16),
      tone: PremiumSurfaceTone.secondary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
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
      _AuthMode.signIn => 'O que abre depois do login',
      _AuthMode.signUp => 'Como tudo começa',
    };
    final metrics = switch (mode) {
      _AuthMode.signIn => const [
        (
          label: 'Agenda',
          value: 'Próximo horário e retorno',
          icon: Icons.calendar_today_rounded,
        ),
        (
          label: 'Carteira',
          value: 'Cashback, planos e ofertas',
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
          value: 'Agenda, carteira e contato no app',
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
