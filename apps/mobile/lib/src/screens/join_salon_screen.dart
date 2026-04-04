import 'dart:async';

import 'package:flutter/material.dart';

import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../widgets/premium_ui.dart';

class JoinSalonScreen extends StatefulWidget {
  const JoinSalonScreen({
    super.key,
    required this.repository,
    required this.onJoined,
    required this.onSignOutRequested,
  });

  final SalonRepository repository;
  final Future<void> Function(CustomerProfile profile) onJoined;
  final Future<void> Function() onSignOutRequested;

  @override
  State<JoinSalonScreen> createState() => _JoinSalonScreenState();
}

class _JoinSalonScreenState extends State<JoinSalonScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _nameController = TextEditingController();
  final _referralController = TextEditingController();
  Timer? _previewDebounce;
  SalonJoinPreview? _preview;
  bool _isPreviewLoading = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final emailPrefix = widget.repository.currentUser?.email?.split('@').first;
    if (emailPrefix != null && emailPrefix.trim().isNotEmpty) {
      _nameController.text = emailPrefix
          .replaceAll(RegExp(r'[._-]+'), ' ')
          .split(' ')
          .where((part) => part.trim().isNotEmpty)
          .map(
            (part) =>
                '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}',
          )
          .join(' ');
    }
  }

  @override
  void dispose() {
    _previewDebounce?.cancel();
    _codeController.dispose();
    _nameController.dispose();
    _referralController.dispose();
    super.dispose();
  }

  void _onCodeChanged(String value) {
    _previewDebounce?.cancel();
    final normalized = value.trim().toUpperCase();

    if (normalized.length < 4) {
      setState(() {
        _preview = null;
        _isPreviewLoading = false;
      });
      return;
    }

    _previewDebounce = Timer(const Duration(milliseconds: 420), () async {
      setState(() => _isPreviewLoading = true);
      final preview = await widget.repository.getSalonJoinPreview(normalized);
      if (!mounted) {
        return;
      }
      setState(() {
        _preview = preview;
        _isPreviewLoading = false;
      });
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final profile = await widget.repository.joinSalon(
        code: _codeController.text,
        customerName: _nameController.text,
        referralCode: _referralController.text,
      );
      await widget.repository.waitForCurrentCustomerLink();
      await widget.onJoined(profile);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final compactHero = MediaQuery.sizeOf(context).width < 430;
    final prefersTabletVariant = MediaQuery.sizeOf(context).width >= 720;
    final heroImage =
        _preview?.clientAppConfig.resolveHeroImageForLayout(
          prefersTabletVariant: prefersTabletVariant,
        ) ??
        _preview?.clientAppConfig.resolveGalleryCoverImageForLayout(
          prefersTabletVariant: prefersTabletVariant,
        );

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: PremiumBackground(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: SingleChildScrollView(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  HeroImagePanel(
                    imageUrl: heroImage,
                    height: compactHero ? 360 : 310,
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final compactContent =
                            constraints.maxWidth < 340 ||
                            constraints.maxHeight < 280;
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: EdgeInsets.symmetric(
                                horizontal: compactContent ? 10 : 12,
                                vertical: compactContent ? 6 : 8,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                _preview?.businessSegment ?? 'Código do salão',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: compactContent ? 12 : 14,
                                ),
                              ),
                            ),
                            SizedBox(height: compactContent ? 14 : 0),
                            if (!compactContent) const Spacer(),
                            Text(
                              _preview?.clientAppConfig.welcomeHeadline ??
                                  _preview?.name ??
                                  'Entre no salão certo e destrave a experiência premium.',
                              maxLines: compactContent ? 3 : 4,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? Theme.of(
                                              context,
                                            ).textTheme.headlineMedium
                                          : Theme.of(
                                              context,
                                            ).textTheme.displaySmall)
                                      ?.copyWith(color: Colors.white),
                            ),
                            SizedBox(height: compactContent ? 8 : 12),
                            Text(
                              _preview?.tagline ??
                                  'O código conecta sua conta ao catálogo, agenda, benefícios, feed e relacionamento do salão.',
                              maxLines: compactContent ? 3 : 4,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  (compactContent
                                          ? Theme.of(
                                              context,
                                            ).textTheme.bodySmall
                                          : Theme.of(
                                              context,
                                            ).textTheme.bodyMedium)
                                      ?.copyWith(
                                        color: Colors.white.withValues(
                                          alpha: 0.84,
                                        ),
                                      ),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 18),
                  PremiumCard(
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Vincular ao salão',
                            style: Theme.of(context).textTheme.headlineMedium,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Use o código compartilhado pelo salão. Assim o app já abre na marca certa e carrega os dados reais do seu atendimento.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 18),
                          TextFormField(
                            controller: _codeController,
                            textCapitalization: TextCapitalization.characters,
                            decoration: const InputDecoration(
                              labelText: 'Código do salão',
                            ),
                            onChanged: _onCodeChanged,
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.length < 4) {
                                return 'Informe o código do salão.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _nameController,
                            decoration: const InputDecoration(
                              labelText: 'Seu nome no salão',
                            ),
                            validator: (value) {
                              if ((value?.trim() ?? '').length < 2) {
                                return 'Informe seu nome.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _referralController,
                            decoration: const InputDecoration(
                              labelText: 'Código de indicação (opcional)',
                            ),
                          ),
                          const SizedBox(height: 18),
                          if (_isPreviewLoading)
                            const Padding(
                              padding: EdgeInsets.only(bottom: 14),
                              child: LinearProgressIndicator(minHeight: 3),
                            )
                          else if (_preview != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: PremiumCard(
                                padding: const EdgeInsets.all(16),
                                backgroundColor: Theme.of(
                                  context,
                                ).colorScheme.surface.withValues(alpha: 0.78),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 26,
                                      backgroundColor: Colors.white,
                                      backgroundImage: _preview?.logoUrl != null
                                          ? NetworkImage(_preview!.logoUrl!)
                                          : null,
                                      child: _preview?.logoUrl == null
                                          ? Text(
                                              _preview!.name
                                                  .trim()
                                                  .substring(0, 2)
                                                  .toUpperCase(),
                                            )
                                          : null,
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _preview!.name,
                                            style: Theme.of(
                                              context,
                                            ).textTheme.titleLarge,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            _preview!.tagline ??
                                                'Marca pronta para agenda, benefícios e feed.',
                                            style: Theme.of(
                                              context,
                                            ).textTheme.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          FilledButton(
                            onPressed: _isSubmitting ? null : _submit,
                            child: Text(
                              _isSubmitting
                                  ? 'Vinculando...'
                                  : 'Entrar neste salão',
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextButton(
                            onPressed: _isSubmitting
                                ? null
                                : widget.onSignOutRequested,
                            child: const Text('Sair desta conta'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
