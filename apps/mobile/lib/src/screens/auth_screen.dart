import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../data/salon_repository.dart';
import '../theme/app_theme.dart';
import '../widgets/premium_ui.dart';
import 'password_recovery_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.repository});

  final SalonRepository repository;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSignUp = false;
  _AuthSubmissionMode _submissionMode = _AuthSubmissionMode.none;

  bool get _isSubmitting => _submissionMode != _AuthSubmissionMode.none;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _submissionMode = _AuthSubmissionMode.email);

    try {
      if (_isSignUp) {
        final result = await widget.repository.signUp(
          email: _emailController.text,
          password: _passwordController.text,
        );

        if (!mounted) {
          return;
        }

        if (result.requiresEmailConfirmation) {
          _passwordController.clear();
          _confirmPasswordController.clear();
          setState(() => _isSignUp = false);
        }

        final message = result.requiresEmailConfirmation
            ? 'Conta criada para ${result.email}. Enviamos um link de verificação; confirme o e-mail e depois entre no app.'
            : 'Conta criada com sucesso. Agora e so entrar e vincular ao salao.';
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(message)));
      } else {
        await widget.repository.signIn(
          email: _emailController.text,
          password: _passwordController.text,
        );
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submissionMode = _AuthSubmissionMode.none);
      }
    }
  }

  Future<void> _submitGoogle() async {
    FocusScope.of(context).unfocus();
    setState(() => _submissionMode = _AuthSubmissionMode.google);

    try {
      await widget.repository.signInWithGoogle();
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submissionMode = _AuthSubmissionMode.none);
      }
    }
  }

  Future<void> _submitFacebook() async {
    FocusScope.of(context).unfocus();
    setState(() => _submissionMode = _AuthSubmissionMode.facebook);

    try {
      await widget.repository.signInWithFacebook();
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submissionMode = _AuthSubmissionMode.none);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final tokens = context.salonTheme;
    final compactHero = MediaQuery.sizeOf(context).width < 430;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PremiumBackground(
        padding: const EdgeInsets.fromLTRB(24, 18, 24, 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: ListView(
              shrinkWrap: true,
              children: [
                const SizedBox(height: 8),
                StaggerReveal(
                  child: HeroImagePanel(
                    height: compactHero ? 540 : 356,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final compactContent =
                            constraints.maxWidth < 340 ||
                            constraints.maxHeight < 330;
                        final signalCardWidth = (constraints.maxWidth - 12) / 2;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (compactContent)
                              const _AuthGlassPill(label: 'Entrada premium')
                            else
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: const [
                                  _AuthGlassPill(label: 'Cadastro premium'),
                                  _AuthGlassPill(label: 'Google e Facebook'),
                                ],
                              ),
                            SizedBox(height: compactContent ? 16 : 0),
                            if (!compactContent) const Spacer(),
                            Text(
                              _isSignUp
                                  ? 'Crie sua presença no app do seu salão com uma entrada digna de produto premium.'
                                  : 'Volte para sua agenda, seus benefícios e o feed do salão com uma experiência à altura.',
                              maxLines: compactContent ? 3 : 5,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? textTheme.headlineMedium
                                          : textTheme.displaySmall)
                                      ?.copyWith(
                                        color: Colors.white,
                                        height: 1.12,
                                      ),
                            ),
                            SizedBox(height: compactContent ? 8 : 12),
                            Text(
                              'Entre com Google, Facebook ou e-mail. O app mantém a estética editorial e a velocidade de um produto maduro desde o primeiro toque.',
                              maxLines: compactContent ? 2 : 4,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? textTheme.bodySmall
                                          : textTheme.bodyMedium)
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.84,
                                        ),
                                      ),
                            ),
                            SizedBox(height: compactContent ? 14 : 18),
                            if (compactContent)
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: const [
                                  _AuthGlassPill(label: 'Agenda, push e feed'),
                                  _AuthGlassPill(label: 'Google + Facebook'),
                                ],
                              )
                            else
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: [
                                  SizedBox(
                                    width: signalCardWidth,
                                    child: const _HeroSignalCard(
                                      label: 'Reserva viva',
                                      value: 'Agenda, push e feed',
                                    ),
                                  ),
                                  SizedBox(
                                    width: signalCardWidth,
                                    child: const _HeroSignalCard(
                                      label: 'Entrada social',
                                      value: 'Google + Facebook',
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                StaggerReveal(
                  delay: const Duration(milliseconds: 100),
                  child: PremiumCard(
                    padding: const EdgeInsets.all(22),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _isSignUp
                                          ? 'Crie sua conta com classe'
                                          : 'Faça login com classe',
                                      style: textTheme.headlineMedium,
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      _isSignUp
                                          ? 'Abra sua conta pelo provedor que já faz parte da rotina do cliente e conecte o código do salão logo depois.'
                                          : 'Use seu provedor favorito ou continue com e-mail para retomar a experiência completa do cliente.',
                                      style: textTheme.bodySmall?.copyWith(
                                        color: tokens.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 14),
                              StatusPill(
                                label: _isSignUp
                                    ? 'Conta nova'
                                    : 'Login imediato',
                                icon: Icons.bolt_rounded,
                                toneColor: tokens.brand,
                              ),
                            ],
                          ),
                          const SizedBox(height: 22),
                          SegmentedButton<bool>(
                            showSelectedIcon: false,
                            segments: const [
                              ButtonSegment<bool>(
                                value: false,
                                label: Text('Entrar'),
                              ),
                              ButtonSegment<bool>(
                                value: true,
                                label: Text('Criar conta'),
                              ),
                            ],
                            selected: <bool>{_isSignUp},
                            onSelectionChanged: _isSubmitting
                                ? null
                                : (selection) {
                                    setState(() => _isSignUp = selection.first);
                                  },
                          ),
                          const SizedBox(height: 22),
                          _SocialAuthButton(
                            title: _isSignUp
                                ? 'Criar com Google'
                                : 'Entrar com Google',
                            subtitle:
                                'Fluxo rápido, confiável e com credencial verificada.',
                            icon: FontAwesomeIcons.google,
                            iconColor: const Color(0xFFDB4437),
                            accentColor: const Color(0xFFF3F0EC),
                            foregroundColor: const Color(0xFF1F1B18),
                            onPressed: _isSubmitting ? null : _submitGoogle,
                            isLoading:
                                _submissionMode == _AuthSubmissionMode.google,
                          ),
                          const SizedBox(height: 12),
                          _SocialAuthButton(
                            title: _isSignUp
                                ? 'Criar com Facebook'
                                : 'Entrar com Facebook',
                            subtitle:
                                'Perfeito para clientes que vivem no ecossistema social.',
                            icon: FontAwesomeIcons.facebookF,
                            iconColor: Colors.white,
                            accentColor: const Color(0xFF1877F2),
                            foregroundColor: Colors.white,
                            borderColor: const Color(0xFF1877F2),
                            onPressed: _isSubmitting ? null : _submitFacebook,
                            isLoading:
                                _submissionMode == _AuthSubmissionMode.facebook,
                          ),
                          const SizedBox(height: 20),
                          const _AuthDivider(label: 'ou continue com e-mail'),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.email],
                            decoration: const InputDecoration(
                              labelText: 'E-mail',
                              prefixIcon: Icon(Icons.alternate_email_rounded),
                            ),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty || !text.contains('@')) {
                                return 'Informe um e-mail válido.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: true,
                            autofillHints: _isSignUp
                                ? const [AutofillHints.newPassword]
                                : const [AutofillHints.password],
                            decoration: const InputDecoration(
                              labelText: 'Senha',
                              prefixIcon: Icon(Icons.lock_outline_rounded),
                            ),
                            validator: (value) {
                              final text = value ?? '';
                              if (text.length < 6) {
                                return 'Use pelo menos 6 caracteres.';
                              }
                              return null;
                            },
                          ),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 260),
                            switchInCurve: Curves.easeOutCubic,
                            switchOutCurve: Curves.easeOutCubic,
                            child: !_isSignUp
                                ? const SizedBox.shrink()
                                : Padding(
                                    padding: const EdgeInsets.only(top: 14),
                                    child: TextFormField(
                                      controller: _confirmPasswordController,
                                      obscureText: true,
                                      decoration: const InputDecoration(
                                        labelText: 'Confirmar senha',
                                        prefixIcon: Icon(
                                          Icons.verified_user_outlined,
                                        ),
                                      ),
                                      validator: (value) {
                                        if (!_isSignUp) {
                                          return null;
                                        }
                                        if ((value ?? '') !=
                                            _passwordController.text) {
                                          return 'As senhas não coincidem.';
                                        }
                                        return null;
                                      },
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 18),
                          FilledButton(
                            onPressed: _isSubmitting ? null : _submit,
                            child: Text(
                              _submissionMode == _AuthSubmissionMode.email
                                  ? 'Processando...'
                                  : _isSignUp
                                  ? 'Criar conta com e-mail'
                                  : 'Entrar com e-mail',
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (!_isSignUp)
                            TextButton(
                              onPressed: _isSubmitting
                                  ? null
                                  : () {
                                      Navigator.of(context).push(
                                        MaterialPageRoute<void>(
                                          builder: (_) =>
                                              PasswordRecoveryScreen(
                                                repository: widget.repository,
                                                initialEmail:
                                                    _emailController.text,
                                              ),
                                        ),
                                      );
                                    },
                              child: const Text('Esqueci minha senha'),
                            ),
                          const SizedBox(height: 6),
                          Text(
                            'Ao continuar, o cliente entra numa jornada segura com autenticação social, sincronização de agenda e vínculo posterior ao salão.',
                            style: textTheme.bodySmall?.copyWith(
                              color: tokens.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

enum _AuthSubmissionMode { none, email, google, facebook }

class _SocialAuthButton extends StatelessWidget {
  const _SocialAuthButton({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.accentColor,
    required this.foregroundColor,
    required this.onPressed,
    this.borderColor,
    this.isLoading = false,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final Color accentColor;
  final Color foregroundColor;
  final Color? borderColor;
  final VoidCallback? onPressed;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: isLoading ? null : onPressed,
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          decoration: BoxDecoration(
            color: accentColor,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: borderColor ?? tokens.outline.withValues(alpha: 0.65),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x12000000),
                blurRadius: 18,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: foregroundColor.withValues(
                    alpha: foregroundColor == Colors.white ? 0.12 : 0.92,
                  ),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: FaIcon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(
                        context,
                      ).textTheme.titleMedium?.copyWith(color: foregroundColor),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: foregroundColor.withValues(alpha: 0.82),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              isLoading
                  ? SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          foregroundColor,
                        ),
                      ),
                    )
                  : Icon(
                      Icons.arrow_forward_rounded,
                      color: foregroundColor.withValues(alpha: 0.84),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AuthDivider extends StatelessWidget {
  const _AuthDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 320;
        return Row(
          children: [
            Expanded(child: Divider(color: tokens.outline)),
            SizedBox(width: compact ? 8 : 12),
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            SizedBox(width: compact ? 8 : 12),
            Expanded(child: Divider(color: tokens.outline)),
          ],
        );
      },
    );
  }
}

class _AuthGlassPill extends StatelessWidget {
  const _AuthGlassPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _HeroSignalCard extends StatelessWidget {
  const _HeroSignalCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.72),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}
