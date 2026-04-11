import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_brand_hero.dart';
import '../../core/widgets/salon_ui.dart';
import '../shared/app_models.dart';
import 'auth_mode_switch.dart';
import 'signup_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.bootstrap});

  final AppBootstrap bootstrap;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _joinCodeController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;

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
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final sessionController = widget.bootstrap.sessionController;

    if (_joinCodeController.text.trim().isEmpty) {
      _showSnackBar('Informe o código do salão.');
      return;
    }
    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.trim().isEmpty) {
      _showSnackBar('Preencha e-mail e senha.');
      return;
    }

    final success = await sessionController.signIn(
      joinCode: _joinCodeController.text,
      email: _emailController.text,
      password: _passwordController.text,
      customerName: '',
    );

    if (!mounted) {
      return;
    }

    if (!success) {
      _showSnackBar(sessionController.message ?? 'Não foi possível entrar.');
    }
  }

  Future<void> _sendReset() async {
    if (_emailController.text.trim().isEmpty) {
      _showSnackBar('Digite seu e-mail para recuperar a senha.');
      return;
    }

    await widget.bootstrap.sessionController.sendPasswordReset(
      _emailController.text,
    );

    if (!mounted) {
      return;
    }

    _showSnackBar(
      widget.bootstrap.sessionController.message ??
          'Link de recuperação enviado.',
    );
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

  Future<void> _openSignup() async {
    final result = await Navigator.of(context).push<Map<String, String>>(
      MaterialPageRoute<Map<String, String>>(
        builder: (context) => SignupPage(bootstrap: widget.bootstrap),
      ),
    );

    if (!mounted || result == null) {
      return;
    }

    final joinCode = result['joinCode']?.trim();
    final email = result['email']?.trim();

    if (joinCode != null && joinCode.isNotEmpty) {
      _joinCodeController.text = joinCode;
      widget.bootstrap.sessionController.previewSalon(joinCode);
    }
    if (email != null && email.isNotEmpty) {
      _emailController.text = email;
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _showSocialComingSoon(String provider) {
    _showSnackBar('Login com $provider entra na próxima etapa do app.');
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
              return ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                children: [
                  _LoginHero(preview: preview),
                  const SizedBox(height: 18),
                  SalonPanel(
                    accent: accent,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AuthModeSwitch(
                          activeMode: AuthMode.login,
                          onSelectLogin: null,
                          onSelectSignup: _openSignup,
                        ),
                        const SizedBox(height: 18),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            Pill(
                              label: 'Entrada do app',
                              backgroundColor: AppTheme.primary.withValues(
                                alpha: 0.12,
                              ),
                              foregroundColor: AppTheme.primary,
                              icon: Icons.login_rounded,
                            ),
                            if (sessionController.canUseBiometricUnlock)
                              const Pill(
                                label: 'Impressão digital ativa',
                                icon: Icons.fingerprint_rounded,
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Entre com sua conta.',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'O cadastro agora fica em uma tela própria. Aqui a cliente só entra com o acesso que já criou.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 18),
                        _AuthNoticeCard(
                          icon: Icons.lock_open_rounded,
                          title: 'Entrada separada do cadastro',
                          message:
                              'O primeiro acesso é criado em outra tela. Aqui a cliente entra com e-mail, senha, Google ou impressão digital.',
                          tone: AppTheme.primary,
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _joinCodeController,
                          textCapitalization: TextCapitalization.characters,
                          onChanged: sessionController.previewSalon,
                          decoration: const InputDecoration(
                            labelText: 'Código do salão',
                            hintText: 'Ex.: ABCD1234',
                            prefixIcon: Icon(Icons.storefront_rounded),
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
                            labelText: 'Senha',
                            hintText: 'Sua senha segura',
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
                        const SizedBox(height: 18),
                        if (!widget.bootstrap.authService.isConfigured)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 14),
                            child: EmptyStateCard(
                              title: 'Integração pronta para receber as chaves',
                              message:
                                  'O layout já está pronto. Falta alinhar Firebase, Supabase e a bridge. No Android, o login também aceita o google-services.json nativo do Firebase.',
                              icon: Icons.key_rounded,
                            ),
                          ),
                        AsyncButton(
                          label: 'Entrar com meu cadastro',
                          icon: Icons.arrow_forward_rounded,
                          isBusy: sessionController.isBusy,
                          onPressed: _submit,
                        ),
                        const SizedBox(height: 10),
                        OutlinedButton(
                          onPressed: _sendReset,
                          child: const Text('Recuperar senha'),
                        ),
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
                              'Entradas sociais',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            Expanded(
                              child: Divider(color: AppTheme.line, indent: 12),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        SocialAuthButton(
                          label: 'Continuar com Google',
                          icon: FontAwesomeIcons.google,
                          iconColor: const Color(0xFFDB4437),
                          borderColor: const Color(0xFFE7DDD5),
                          onPressed: sessionController.isBusy
                              ? null
                              : _submitGoogle,
                        ),
                        const SizedBox(height: 10),
                        SocialAuthButton(
                          label: 'Continuar com Facebook',
                          icon: FontAwesomeIcons.facebookF,
                          iconColor: const Color(0xFF1877F2),
                          borderColor: const Color(0xFFD7E4FF),
                          onPressed: sessionController.isBusy
                              ? null
                              : () => _showSocialComingSoon('Facebook'),
                          trailing: const SoonTag(),
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

class _LoginHero extends StatelessWidget {
  const _LoginHero({required this.preview});

  final SalonLandingData? preview;

  @override
  Widget build(BuildContext context) {
    final data = preview;
    return SalonBrandHero(
      preview: data?.preview,
      title: data?.preview.welcomeHeadline,
      description: sentenceOrFallback(
        data?.preview.welcomeMessage,
        'Entre no app do salão com agenda, feed e loja em um só lugar.',
      ),
      bottom: data == null
          ? null
          : Row(
              children: [
                MetricTile(
                  label: 'Serviços',
                  value: '${data.stats.servicesCount}',
                ),
                const SizedBox(width: 10),
                MetricTile(
                  label: 'Ofertas',
                  value: '${data.stats.activeOffersCount}',
                ),
                const SizedBox(width: 10),
                MetricTile(
                  label: 'Feed',
                  value: '${data.stats.recentPostsCount}',
                ),
              ],
            ),
    );
  }
}

class _AuthNoticeCard extends StatelessWidget {
  const _AuthNoticeCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.tone,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: tone.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: tone),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(message, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class SocialAuthButton extends StatelessWidget {
  const SocialAuthButton({
    super.key,
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.borderColor,
    required this.onPressed,
    this.trailing,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final Color borderColor;
  final VoidCallback? onPressed;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        backgroundColor: Colors.white,
        side: BorderSide(color: borderColor),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Center(child: FaIcon(icon, size: 18, color: iconColor)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ],
      ),
    );
  }
}

class SoonTag extends StatelessWidget {
  const SoonTag({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.secondary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        'Em breve',
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: AppTheme.secondary),
      ),
    );
  }
}
