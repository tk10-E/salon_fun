import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_experience_preset.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cinematic_reveal.dart';
import '../widgets/premium_surface_card.dart';
import '../widgets/salon_brand_mark.dart';

class JoinSalonScreen extends StatefulWidget {
  const JoinSalonScreen({
    super.key,
    required this.repository,
    required this.onJoined,
    this.initialJoinCode,
    this.onInitialJoinCodeConsumed,
  });

  final SalonRepository repository;
  final Future<void> Function() onJoined;
  final String? initialJoinCode;
  final ValueChanged<String>? onInitialJoinCodeConsumed;

  @override
  State<JoinSalonScreen> createState() => _JoinSalonScreenState();
}

class _JoinSalonScreenState extends State<JoinSalonScreen> {
  final _nameController = TextEditingController();
  final _codeController = TextEditingController();
  final _referralCodeController = TextEditingController();
  Timer? _previewDebounce;
  SalonJoinPreview? _joinPreview;
  String? _previewError;
  bool _previewLoading = false;
  bool _loading = false;
  int _previewRequestVersion = 0;
  String? _prefilledJoinCode;

  @override
  void initState() {
    super.initState();
    _codeController.addListener(_handleCodeChanged);
    _applyInitialJoinCode(widget.initialJoinCode);
  }

  @override
  void didUpdateWidget(covariant JoinSalonScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialJoinCode != widget.initialJoinCode) {
      _applyInitialJoinCode(widget.initialJoinCode);
    }
  }

  @override
  void dispose() {
    _previewDebounce?.cancel();
    _nameController.dispose();
    _codeController.removeListener(_handleCodeChanged);
    _codeController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  String get _normalizedJoinCode => _codeController.text.trim().toUpperCase();
  bool get _hasDeepLinkedCode => _prefilledJoinCode == _normalizedJoinCode;

  SalonBranding get _branding {
    final preview = _joinPreview;
    if (preview == null) {
      return SalonBranding.fromName(
        'Salon Fun',
        overrideHexColor: '#C56B43',
        businessSegment: 'beauty_salon',
      );
    }

    return SalonBranding.fromName(
      preview.name,
      overrideHexColor: preview.brandColor,
      businessSegment: preview.businessSegment,
      clientAppConfig: preview.clientAppConfig,
    );
  }

  SalonExperiencePreset get _preset {
    return SalonExperiencePreset.fromBusinessSegment(
      _joinPreview?.businessSegment,
    );
  }

  bool get _hasPreviewWhatsApp {
    final digits = _joinPreview?.whatsappPhone?.replaceAll(RegExp(r'\D'), '');
    return digits != null && digits.length >= 10;
  }

  List<String> get _valueHighlights {
    final preset = _preset;
    final salonName = _joinPreview?.name;
    final salonLabel = salonName == null || salonName.trim().isEmpty
        ? 'o salão'
        : salonName;

    return preset.joinValueHighlights(salonLabel);
  }

  Future<void> _openPreviewWhatsApp() async {
    final digits = _joinPreview?.whatsappPhone?.replaceAll(RegExp(r'\D'), '');
    if (digits == null || digits.length < 10) {
      _showMessage('O WhatsApp deste salão ainda não foi configurado.');
      return;
    }

    final salonName = _joinPreview?.name ?? 'o salão';
    final message = Uri.encodeComponent(
      'Olá, estou entrando no app e queria confirmar meu código para conectar com $salonName.',
    );
    final uri = Uri.parse('https://wa.me/$digits?text=$message');
    final launched = await launchUrl(uri, mode: LaunchMode.platformDefault);

    if (!launched && mounted) {
      _showMessage(
        'Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.',
      );
    }
  }

  void _handleCodeChanged() {
    _previewDebounce?.cancel();
    _previewDebounce = Timer(const Duration(milliseconds: 320), () {
      unawaited(_loadJoinPreview());
    });
  }

  void _applyInitialJoinCode(String? rawCode) {
    final normalizedCode = rawCode?.trim().toUpperCase().replaceAll(
      RegExp(r'[^A-Z0-9]'),
      '',
    );
    if (normalizedCode == null || normalizedCode.isEmpty) {
      return;
    }

    _prefilledJoinCode = normalizedCode;
    if (_normalizedJoinCode != normalizedCode) {
      _codeController.value = TextEditingValue(
        text: normalizedCode,
        selection: TextSelection.collapsed(offset: normalizedCode.length),
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      widget.onInitialJoinCodeConsumed?.call(normalizedCode);
    });
  }

  Future<void> _loadJoinPreview() async {
    final normalizedCode = _normalizedJoinCode;
    final shouldSearch = normalizedCode.length >= 4;

    if (!shouldSearch) {
      if (!mounted) {
        return;
      }

      setState(() {
        _previewLoading = false;
        _previewError = null;
        _joinPreview = null;
      });
      return;
    }

    final requestVersion = ++_previewRequestVersion;
    if (mounted) {
      setState(() {
        _previewLoading = true;
        _previewError = null;
      });
    }

    try {
      final preview = await widget.repository.getSalonJoinPreview(
        normalizedCode,
      );

      if (!mounted || requestVersion != _previewRequestVersion) {
        return;
      }

      setState(() {
        _joinPreview = preview;
        _previewLoading = false;
        _previewError = preview == null
            ? 'Não encontramos um salão com esse código.'
            : null;
      });
    } catch (_) {
      if (!mounted || requestVersion != _previewRequestVersion) {
        return;
      }

      setState(() {
        _previewLoading = false;
        _previewError = 'Não foi possível validar o código agora.';
      });
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);

    try {
      await widget.repository.joinSalon(
        code: _codeController.text,
        customerName: _nameController.text,
        referralCode: _referralCodeController.text,
      );
      await widget.onJoined();

      if (!mounted) {
        return;
      }

      final preset = _preset;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _joinPreview == null
                ? 'Salão vinculado com sucesso. Agenda, benefícios e avisos já ficam organizados no app.'
                : preset.joinSuccessMessage.replaceAll(
                    '{salon}',
                    _joinPreview!.name,
                  ),
          ),
        ),
      );
    } on PostgrestException catch (error) {
      _showMessage(_humanizePostgrestError(error.message));
    } catch (_) {
      _showMessage('Não foi possível vincular ao salão.');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  String _humanizePostgrestError(String raw) {
    if (raw.contains('invalid_salon_code')) {
      return 'Código do salão inválido.';
    }
    if (raw.contains('customer_already_linked_to_another_salon')) {
      return 'Esta conta já está vinculada a outro salão.';
    }
    if (raw.contains('customer_name_required')) {
      return 'Informe seu nome.';
    }
    if (raw.contains('invalid_referral_code')) {
      return 'O código de indicação não foi encontrado neste salão.';
    }
    if (raw.contains('referral_program_inactive')) {
      return 'O programa de indicação deste salão não está ativo agora.';
    }
    if (raw.contains('cannot_refer_yourself')) {
      return 'Você não pode usar o próprio código de indicação.';
    }
    if (raw.contains('referral_already_registered')) {
      return 'Esta conta já está ligada a uma indicação neste salão.';
    }
    if (raw.contains('referral_code_too_late')) {
      return 'O código de indicação precisa ser informado antes do primeiro agendamento.';
    }
    return 'Não foi possível vincular ao salão.';
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final branding = _branding;
    final preset = _preset;
    final preview = _joinPreview;
    final previewTagline = preview?.tagline?.trim();

    return Scaffold(
      body: AppBackdrop(
        branding: branding,
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  children: [
                    CinematicReveal(
                      delay: const Duration(milliseconds: 20),
                      child: _JoinEditorialHero(
                        branding: branding,
                        preview: preview,
                        preset: preset,
                        normalizedJoinCode: _normalizedJoinCode,
                        hasPreviewWhatsApp: _hasPreviewWhatsApp,
                      ),
                    ),
                    const SizedBox(height: 16),
                    CinematicReveal(
                      delay: const Duration(milliseconds: 90),
                      child: PremiumSurfaceCard(
                        padding: const EdgeInsets.all(20),
                        gradient: LinearGradient(
                          colors: [
                            Colors.white.withValues(alpha: 0.98),
                            branding.surface.withValues(alpha: 0.94),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        tone: PremiumSurfaceTone.secondary,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 11,
                                vertical: 7,
                              ),
                              decoration: BoxDecoration(
                                color: branding.highlightBackground,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: branding.outline.withValues(
                                    alpha: 0.72,
                                  ),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.link_rounded,
                                    size: 15,
                                    color: branding.deep,
                                  ),
                                  const SizedBox(width: 7),
                                  Text(
                                    'Conexão com o salão',
                                    style: theme.textTheme.labelMedium
                                        ?.copyWith(
                                          color: branding.deep,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              'Confirme para continuar',
                              style: theme.textTheme.titleLarge?.copyWith(
                                color: branding.deep,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Seu login já está pronto. Agora confirme seu nome e o código do salão.',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: branding.mutedText,
                              ),
                            ),
                            const SizedBox(height: 18),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: branding.highlightBackground,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: branding.outline.withValues(
                                    alpha: 0.74,
                                  ),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 30,
                                    height: 30,
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(
                                        alpha: 0.74,
                                      ),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: branding.outline.withValues(
                                          alpha: 0.72,
                                        ),
                                      ),
                                    ),
                                    child: Icon(
                                      Icons.rocket_launch_outlined,
                                      size: 18,
                                      color: branding.deep,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      'Conecte o salão para liberar agenda, carteira e contato.',
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            color: branding.deep,
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 22),
                            TextField(
                              controller: _nameController,
                              decoration: const InputDecoration(
                                labelText: 'Seu nome',
                                hintText: 'Maria Silva',
                              ),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _codeController,
                              textCapitalization: TextCapitalization.characters,
                              decoration: InputDecoration(
                                labelText: 'Código do salão',
                                hintText: 'A1B2C3',
                                prefixIcon: const Icon(Icons.password_rounded),
                                suffixIcon: _previewLoading
                                    ? const Padding(
                                        padding: EdgeInsets.all(14),
                                        child: SizedBox.square(
                                          dimension: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        ),
                                      )
                                    : preview != null
                                    ? Icon(
                                        Icons.verified_rounded,
                                        color: branding.primary,
                                      )
                                    : null,
                              ),
                            ),
                            if (_hasDeepLinkedCode) ...[
                              const SizedBox(height: 10),
                              Text(
                                'Código preenchido automaticamente a partir da vitrine do salão.',
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: branding.deep,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                            if (_previewError != null) ...[
                              const SizedBox(height: 10),
                              Text(
                                _previewError!,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: const Color(0xFFB44D2A),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ] else if (preview != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: branding.highlightBackground,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: branding.outline.withValues(
                                      alpha: 0.8,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 30,
                                      height: 30,
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.7,
                                        ),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: branding.outline.withValues(
                                            alpha: 0.72,
                                          ),
                                        ),
                                      ),
                                      child: Icon(
                                        Icons.verified_user_rounded,
                                        size: 18,
                                        color: branding.deep,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        preset.joinVerificationMessage
                                            .replaceAll(
                                              '{salon}',
                                              preview.name,
                                            ),
                                        style: theme.textTheme.bodyMedium
                                            ?.copyWith(
                                              color: branding.deep,
                                              fontWeight: FontWeight.w700,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 16),
                            TextField(
                              controller: _referralCodeController,
                              textCapitalization: TextCapitalization.characters,
                              decoration: const InputDecoration(
                                labelText: 'Código de indicação (opcional)',
                                hintText: 'INDIQUE8',
                                prefixIcon: Icon(Icons.redeem_outlined),
                              ),
                            ),
                            const SizedBox(height: 24),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: _loading ? null : _submit,
                                child: _loading
                                    ? const SizedBox.square(
                                        dimension: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : Text(
                                        preview == null
                                            ? 'Conectar salão e continuar'
                                            : 'Conectar ${preview.name} e continuar',
                                      ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Se tiver indicação, adicione agora.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: branding.mutedText,
                                fontWeight: FontWeight.w600,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    PremiumSurfaceCard(
                      padding: const EdgeInsets.all(22),
                      gradient: LinearGradient(
                        colors: [branding.surface, branding.soft],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      tone: PremiumSurfaceTone.accent,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 11,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.74),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.flag_outlined,
                                  size: 15,
                                  color: branding.deep,
                                ),
                                const SizedBox(width: 7),
                                Text(
                                  preview == null
                                      ? 'Última etapa do acesso'
                                      : 'Último passo para ${preview.name}',
                                  style: theme.textTheme.labelMedium?.copyWith(
                                    color: branding.deep,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (preview != null)
                                SalonBrandMark(
                                  salonName: preview.name,
                                  logoUrl: preview.logoUrl,
                                  branding: branding,
                                  size: 56,
                                  borderRadius: 18,
                                )
                              else
                                Container(
                                  width: 56,
                                  height: 56,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.84),
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(
                                      color: branding.outline.withValues(
                                        alpha: 0.74,
                                      ),
                                    ),
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
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
                                      preview == null
                                          ? 'Código do salão'
                                          : preview.name,
                                      style: theme.textTheme.titleLarge
                                          ?.copyWith(
                                            color: branding.deep,
                                            fontWeight: FontWeight.w900,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      previewTagline?.isNotEmpty == true
                                          ? previewTagline!
                                          : preview == null
                                          ? preset.joinUnknownTagline
                                          : preset.joinKnownTagline,
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            color: branding.mutedText,
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            preview == null
                                ? 'Conecte seu salão'
                                : 'Entrar em ${preview.name}',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: branding.deep,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            preview == null
                                ? 'Depois do login, falta só informar o código do salão.'
                                : 'Seu login já está pronto. Agora confirme o código de ${preview.name}.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: branding.mutedText,
                              height: 1.5,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 11,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.56),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.8),
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 30,
                                  height: 30,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.72),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(
                                    preview == null
                                        ? Icons.key_rounded
                                        : Icons.storefront_rounded,
                                    size: 17,
                                    color: branding.deep,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    preview == null
                                        ? 'Exemplo de código: A1B2C3'
                                        : 'Código reconhecido: $_normalizedJoinCode',
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      color: branding.deep,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(13),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.58),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.76),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  preview == null
                                      ? 'O que libera depois da conexão'
                                      : 'O que libera depois da conexão com ${preview.name}',
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    color: branding.deep,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                ..._valueHighlights.map(
                                  (item) => Padding(
                                    padding: const EdgeInsets.only(bottom: 8),
                                    child: _JoinValueItem(
                                      label: item,
                                      branding: branding,
                                    ),
                                  ),
                                ),
                                if (_hasPreviewWhatsApp) ...[
                                  const SizedBox(height: 4),
                                  OutlinedButton.icon(
                                    onPressed: _openPreviewWhatsApp,
                                    icon: const Icon(
                                      Icons.chat_bubble_outline_rounded,
                                    ),
                                    label: const Text('Falar com o salão'),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _JoinEditorialHero extends StatelessWidget {
  const _JoinEditorialHero({
    required this.branding,
    required this.preview,
    required this.preset,
    required this.normalizedJoinCode,
    required this.hasPreviewWhatsApp,
  });

  final SalonBranding branding;
  final SalonJoinPreview? preview;
  final SalonExperiencePreset preset;
  final String normalizedJoinCode;
  final bool hasPreviewWhatsApp;

  @override
  Widget build(BuildContext context) {
    final salonName = preview?.name ?? 'seu salão';
    final spotlight = preview == null
        ? 'Digite o código para liberar a marca certa.'
        : '$salonName já foi reconhecido e está pronto para entrar.';

    return PremiumSurfaceCard(
      padding: EdgeInsets.zero,
      gradient: LinearGradient(
        colors: [
          Color.lerp(branding.deep, const Color(0xFF120F17), 0.12)!,
          branding.deep,
          Color.lerp(branding.primary, branding.deep, 0.18)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.contrast,
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -18,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            left: -38,
            bottom: -58,
            child: Container(
              width: 138,
              height: 138,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: branding.primary.withValues(alpha: 0.14),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    const _JoinHeroPill(
                      label: 'Entrada',
                      icon: Icons.auto_awesome_rounded,
                    ),
                    _JoinHeroPill(
                      label: preview == null
                          ? 'Aguardando código'
                          : 'Código reconhecido',
                      icon: preview == null
                          ? Icons.password_rounded
                          : Icons.verified_rounded,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  preview == null
                      ? 'Conecte seu salão'
                      : '$salonName pronto para entrar',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    height: 1.04,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  spotlight,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.82),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _JoinHeroMetric(
                      label: normalizedJoinCode.isEmpty
                          ? 'Código do salão'
                          : normalizedJoinCode,
                      icon: Icons.key_rounded,
                    ),
                    _JoinHeroMetric(
                      label: preview == null
                          ? 'Agenda e carteira após a conexão'
                          : preset.joinKnownTagline,
                      icon: Icons.calendar_month_rounded,
                    ),
                    _JoinHeroMetric(
                      label: hasPreviewWhatsApp
                          ? 'Contato do salão ativo'
                          : 'Conexão pelo app',
                      icon: hasPreviewWhatsApp
                          ? Icons.chat_bubble_outline_rounded
                          : Icons.bolt_rounded,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _JoinHeroPill extends StatelessWidget {
  const _JoinHeroPill({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _JoinHeroMetric extends StatelessWidget {
  const _JoinHeroMetric({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.white),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.84),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _JoinValueItem extends StatelessWidget {
  const _JoinValueItem({required this.label, required this.branding});

  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: branding.outline.withValues(alpha: 0.66)),
          ),
          child: Icon(Icons.check_rounded, size: 16, color: branding.deep),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w700,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }
}
