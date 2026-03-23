import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_experience_preset.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/soft_card.dart';

class JoinSalonScreen extends StatefulWidget {
  const JoinSalonScreen({
    super.key,
    required this.repository,
    required this.onJoined,
  });

  final SalonRepository repository;
  final Future<void> Function() onJoined;

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

  @override
  void initState() {
    super.initState();
    _codeController.addListener(_handleCodeChanged);
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
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: Column(
                  children: [
                    SoftCard(
                      padding: const EdgeInsets.all(28),
                      gradient: LinearGradient(
                        colors: [branding.surface, branding.soft],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderColor: branding.outline,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 9,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.64),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.76),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.flag_outlined,
                                  size: 16,
                                  color: branding.deep,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  preview == null
                                      ? 'Última etapa do acesso'
                                      : 'Último passo para liberar ${preview.name}',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: branding.deep,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              if (preview != null)
                                SalonBrandMark(
                                  salonName: preview.name,
                                  logoUrl: preview.logoUrl,
                                  branding: branding,
                                  size: 62,
                                  borderRadius: 20,
                                )
                              else
                                Container(
                                  width: 62,
                                  height: 62,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.88),
                                    borderRadius: BorderRadius.circular(20),
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
                          const SizedBox(height: 20),
                          Text(
                            preview == null
                                ? 'Conecte seu salão para liberar sua experiência.'
                                : 'Último passo para entrar em ${preview.name}.',
                            style: theme.textTheme.headlineSmall?.copyWith(
                              color: branding.deep,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            preview == null
                                ? 'Depois do login, falta apenas informar o código do salão para liberar agenda, benefícios e contato no app.'
                                : 'Seu login já está pronto. Agora confirme o código para liberar agenda, benefícios e contato com ${preview.name}.',
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: branding.mutedText,
                            ),
                          ),
                          const SizedBox(height: 18),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.58),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.8),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  preview == null
                                      ? Icons.key_rounded
                                      : Icons.storefront_rounded,
                                  color: branding.deep,
                                ),
                                const SizedBox(width: 12),
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
                          const SizedBox(height: 18),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.62),
                              borderRadius: BorderRadius.circular(20),
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
                                const SizedBox(height: 12),
                                ..._valueHighlights.map(
                                  (item) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: _JoinValueItem(
                                      label: item,
                                      branding: branding,
                                    ),
                                  ),
                                ),
                                if (_hasPreviewWhatsApp) ...[
                                  const SizedBox(height: 6),
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
                    const SizedBox(height: 20),
                    SoftCard(
                      padding: const EdgeInsets.all(22),
                      borderColor: branding.outline.withValues(alpha: 0.74),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Confirme para continuar',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: branding.deep,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Seu login já foi concluído. Agora confirme seu nome e o código do salão para entrar na experiência certa.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: branding.mutedText,
                            ),
                          ),
                          const SizedBox(height: 18),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: branding.highlightBackground,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: branding.outline.withValues(alpha: 0.74),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.rocket_launch_outlined,
                                  color: branding.deep,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Quando você conectar o salão, o app já segue com agenda, benefícios e contato liberados.',
                                    style: theme.textTheme.bodyMedium?.copyWith(
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
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: branding.highlightBackground,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: branding.outline.withValues(
                                    alpha: 0.8,
                                  ),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.verified_user_rounded,
                                    color: branding.deep,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      preset.joinVerificationMessage.replaceAll(
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
                            'Se tiver código de indicação, adicione antes do primeiro agendamento.',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: branding.mutedText,
                              fontWeight: FontWeight.w600,
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

class _JoinValueItem extends StatelessWidget {
  const _JoinValueItem({required this.label, required this.branding});

  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.check_circle_rounded, size: 18, color: branding.deep),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w700,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}
