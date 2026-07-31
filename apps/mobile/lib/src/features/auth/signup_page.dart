import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../shared/app_models.dart';
import 'auth_mode_switch.dart';
import 'social_auth_button.dart';

class SignupPage extends StatefulWidget {
  const SignupPage({super.key, required this.bootstrap});

  final AppBootstrap bootstrap;

  @override
  State<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends State<SignupPage> {
  final _joinCodeController = TextEditingController();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    final defaultJoinCode = widget.bootstrap.environment.defaultJoinCode;
    if (defaultJoinCode.isNotEmpty) {
      _joinCodeController.text = defaultJoinCode;
      widget.bootstrap.sessionController.previewSalon(defaultJoinCode);
    }
  }

  @override
  void dispose() {
    _joinCodeController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final sessionController = widget.bootstrap.sessionController;

    if (_joinCodeController.text.trim().isEmpty) {
      _showSnackBar('Informe o código do salão.');
      return;
    }
    if (_nameController.text.trim().isEmpty) {
      _showSnackBar('Informe seu nome.');
      return;
    }
    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.trim().isEmpty) {
      _showSnackBar('Preencha e-mail e senha.');
      return;
    }
    if (_confirmPasswordController.text.trim().isEmpty) {
      _showSnackBar('Repita a senha para confirmar o cadastro.');
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      _showSnackBar('As senhas não conferem.');
      return;
    }

    final result = await sessionController.signUp(
      email: _emailController.text,
      password: _passwordController.text,
      customerName: _nameController.text,
    );

    if (!mounted) {
      return;
    }

    if (result != null) {
      _showSnackBar(result);
      Navigator.of(context).pop(<String, String>{
        'joinCode': normalizeJoinCode(_joinCodeController.text),
        'email': _emailController.text.trim(),
      });
      return;
    }

    final message = sessionController.message;
    if (message != null && message.isNotEmpty) {
      _showSnackBar(message);
    }
  }

  Future<void> _submitGoogle() async {
    FocusScope.of(context).unfocus();
    final sessionController = widget.bootstrap.sessionController;

    if (_joinCodeController.text.trim().isEmpty) {
      _showSnackBar('Informe o código do salão antes de entrar com Google.');
      return;
    }

    final success = await sessionController.signInWithGoogle(
      joinCode: _joinCodeController.text,
      customerName: _nameController.text,
    );

    if (!mounted) {
      return;
    }

    if (!success) {
      _showSnackBar(
        sessionController.message ?? 'Não foi possível entrar com Google.',
      );
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final sessionController = widget.bootstrap.sessionController;
    final preview = sessionController.joinPreview;
    final accent = parseHexColor(preview?.preview.brandColor);

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl: preview?.preview.heroImageUrl,
        bannerStyle: preview?.preview.bannerStyle,
        child: SafeArea(
          child: AnimatedBuilder(
            animation: sessionController,
            builder: (context, _) {
              final canUseGoogleSignIn =
                  widget.bootstrap.authService.canUseGoogleSignIn;              final canUseSocialSignIn =
                  canUseGoogleSignIn;
              return ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                children: [
                  _SignupHero(preview: preview),
                  const SizedBox(height: 18),
                  SalonPanel(
                    accent: accent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AuthModeSwitch(
                          activeMode: AuthMode.signup,
                          onSelectLogin: () => Navigator.of(context).maybePop(),
                          onSelectSignup: null,
                        ),
                        const SizedBox(height: 18),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            Pill(
                              label: 'Novo cadastro',
                              icon: Icons.person_add_alt_1_rounded,
                              backgroundColor: accent.withValues(alpha: 0.12),
                              foregroundColor: accent,
                            ),
                            const Pill(
                              label: 'Senha confirmada',
                              icon: Icons.verified_user_rounded,
                            ),
                            const Pill(
                              label: 'Entrada depois no login',
                              icon: Icons.login_rounded,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Crie sua conta em uma tela só de cadastro.',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          canUseSocialSignIn
                              ? 'Você pode criar o acesso com senha ou entrar direto com Google. O código do salão continua obrigatório para vincular o perfil certo.'
                              : 'Aqui a cliente só cria o acesso. Depois ela volta para a tela de entrada, confirma o e-mail e entra no app com mais segurança.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 18),
                        _SignupNoticeCard(
                          tone: accent,
                          joinCode: normalizeJoinCode(_joinCodeController.text),
                        ),
                        const SizedBox(height: 18),
                        _SignupContextCard(
                          preview: preview,
                          joinCode: normalizeJoinCode(_joinCodeController.text),
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _joinCodeController,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: const [JoinCodeInputFormatter()],
                          onChanged: sessionController.previewSalon,
                          decoration: const InputDecoration(
                            labelText: 'Código do salão',
                            hintText: 'Ex.: ABCD1234',
                            prefixIcon: Icon(Icons.storefront_rounded),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _nameController,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Seu nome',
                            hintText: 'Como você quer aparecer no app',
                            prefixIcon: Icon(Icons.person_rounded),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'E-mail',
                            hintText: 'voce@exemplo.com',
                            prefixIcon: Icon(Icons.mail_rounded),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          decoration: InputDecoration(
                            labelText: 'Crie sua senha',
                            hintText: 'Escolha uma senha segura',
                            prefixIcon: const Icon(Icons.lock_rounded),
                            suffixIcon: IconButton(
                              onPressed: () => setState(() {
                                _obscurePassword = !_obscurePassword;
                              }),
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_rounded
                                    : Icons.visibility_off_rounded,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _confirmPasswordController,
                          obscureText: _obscureConfirmPassword,
                          decoration: InputDecoration(
                            labelText: 'Repita a senha',
                            hintText: 'Confirme sua senha',
                            prefixIcon: const Icon(Icons.verified_user_rounded),
                            suffixIcon: IconButton(
                              onPressed: () => setState(() {
                                _obscureConfirmPassword =
                                    !_obscureConfirmPassword;
                              }),
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_rounded
                                    : Icons.visibility_off_rounded,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        AsyncButton(
                          label: 'Criar meu acesso',
                          icon: Icons.person_add_alt_1_rounded,
                          isBusy: sessionController.isBusy,
                          onPressed: _submit,
                        ),
                        if (canUseSocialSignIn) ...[
                          const SizedBox(height: 18),
                          Row(
                            children: [
                              Expanded(
                                child: Divider(
                                  color: AppTheme.line,
                                  endIndent: 12,
                                ),
                              ),
                              Text(
                                'Entrar agora',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              Expanded(
                                child: Divider(
                                  color: AppTheme.line,
                                  indent: 12,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          if (canUseGoogleSignIn)
                            SocialAuthButton(
                              label: 'Criar e entrar com Google',
                              icon: FontAwesomeIcons.google,
                              iconColor: const Color(0xFFDB4437),
                              borderColor: const Color(0xFFE7DDD5),
                              onPressed: sessionController.isBusy
                                  ? null
                                  : _submitGoogle,
                            ),
                        ],
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.of(context).maybePop(),
                          icon: const Icon(Icons.arrow_back_rounded),
                          label: const Text('Voltar para login'),
                        ),
                        if (sessionController.message != null) ...[
                          const SizedBox(height: 14),
                          Text(
                            sessionController.message!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ],
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
}

class _SignupNoticeCard extends StatelessWidget {
  const _SignupNoticeCard({required this.tone, required this.joinCode});

  final Color tone;
  final String joinCode;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.person_add_alt_1_rounded, color: tone),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Cadastro separado do login',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  joinCode.isEmpty
                      ? 'Crie seu acesso aqui e depois entre na tela de login normalmente.'
                      : 'Seu primeiro acesso vai ficar ligado ao código $joinCode e pronto para entrar depois pelo login.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SignupHero extends StatelessWidget {
  const _SignupHero({required this.preview});

  final SalonLandingData? preview;

  @override
  Widget build(BuildContext context) {
    final data = preview;
    final accent = parseHexColor(data?.preview.brandColor);
    return SalonPanel(
      accent: accent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(
                label: data?.preview.segmentLabel ?? 'Salon Fun',
                backgroundColor: accent.withValues(alpha: 0.12),
                foregroundColor: accent,
                icon: Icons.auto_awesome_rounded,
              ),
              const SizedBox(width: 8),
              const Pill(
                label: 'Tela de cadastro',
                icon: Icons.person_add_alt_1_rounded,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Cadastro separado, claro e mais profissional.',
            style: Theme.of(context).textTheme.displaySmall,
          ),
          const SizedBox(height: 10),
          Text(
            sentenceOrFallback(
              data?.preview.welcomeMessage,
              'Cadastre a cliente com calma, confirme a senha e deixe o primeiro acesso pronto para entrar sem ruído.',
            ),
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
      ),
    );
  }
}

class _SignupContextCard extends StatelessWidget {
  const _SignupContextCard({required this.preview, required this.joinCode});

  final SalonLandingData? preview;
  final String joinCode;

  @override
  Widget build(BuildContext context) {
    final salonName = preview?.preview.appDisplayName;
    final normalizedSalonName = salonName?.trim();
    final safeSalonName =
        normalizedSalonName == null || normalizedSalonName.isEmpty
        ? 'Seu salão vai aparecer aqui assim que o código for validado.'
        : normalizedSalonName;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ToneIconBadge(
            icon: Icons.verified_user_rounded,
            tone: AppTheme.primary,
            size: 46,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Seu acesso vai ficar pronto para entrar no login.',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  safeSalonName,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                if (joinCode.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Pill(
                    label: 'Código $joinCode',
                    icon: Icons.storefront_rounded,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
