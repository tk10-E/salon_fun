import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/soft_card.dart';
import 'benefits_wallet_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.repository,
    required this.profile,
    required this.onSignOut,
    required this.onWhatsApp,
    this.userEmail,
    this.initialLoyaltySummary,
    this.initialReferralSummary,
    this.onProfileChanged,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final String? userEmail;
  final CustomerLoyaltySummary? initialLoyaltySummary;
  final ReferralSummary? initialReferralSummary;
  final Future<void> Function() onSignOut;
  final VoidCallback onWhatsApp;
  final ValueChanged<CustomerProfile>? onProfileChanged;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final TextEditingController _nameController;
  late CustomerProfile _profile;
  late final SalonBranding _branding;
  CustomerLoyaltySummary? _loyaltySummary;
  ReferralSummary? _referralSummary;
  bool _isSavingName = false;
  bool _isSigningOut = false;
  bool _isRefreshingBenefits = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _branding = SalonBranding.fromName(
      widget.profile.salonName,
      overrideHexColor: widget.profile.salonBrandColor,
    );
    _loyaltySummary = widget.initialLoyaltySummary;
    _referralSummary = widget.initialReferralSummary;
    _nameController = TextEditingController(text: widget.profile.name);

    if (_loyaltySummary == null || _referralSummary == null) {
      unawaited(_refreshBenefits(showLoader: true));
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  String get _userEmail {
    final email = widget.userEmail?.trim();
    if (email != null && email.isNotEmpty) {
      return email;
    }

    return 'E-mail da conta indisponível';
  }

  Future<void> _refreshBenefits({required bool showLoader}) async {
    if (showLoader && mounted) {
      setState(() => _isRefreshingBenefits = true);
    }

    try {
      final results = await Future.wait<Object?>([
        widget.repository.getLoyaltySummary(),
        widget.repository.getReferralSummary(),
      ]);

      if (!mounted) {
        return;
      }

      setState(() {
        _loyaltySummary = results[0] as CustomerLoyaltySummary?;
        _referralSummary = results[1] as ReferralSummary?;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível atualizar seus benefícios agora.'),
        ),
      );
    } finally {
      if (showLoader && mounted) {
        setState(() => _isRefreshingBenefits = false);
      }
    }
  }

  Future<void> _saveName() async {
    final normalizedName = _nameController.text.trim();
    if (normalizedName.isEmpty) {
      _showMessage('Informe seu nome.');
      return;
    }

    if (normalizedName == _profile.name || _isSavingName) {
      return;
    }

    setState(() => _isSavingName = true);

    try {
      await widget.repository.updateCustomerName(
        customerId: _profile.id,
        customerName: normalizedName,
      );

      if (!mounted) {
        return;
      }

      final updatedProfile = _profile.copyWith(name: normalizedName);
      setState(() => _profile = updatedProfile);
      widget.onProfileChanged?.call(updatedProfile);
      _showMessage('Seu nome foi atualizado.');
    } on PostgrestException catch (error) {
      final raw = error.message.toLowerCase();
      final message = raw.contains('row-level security') ||
              raw.contains('permission')
          ? 'Não foi possível salvar seu nome agora.'
          : 'Não foi possível atualizar seu nome.';
      _showMessage(message);
    } catch (_) {
      _showMessage('Não foi possível atualizar seu nome.');
    } finally {
      if (mounted) {
        setState(() => _isSavingName = false);
      }
    }
  }

  Future<void> _copyReferralCode() async {
    final code = _referralSummary?.referralCode.trim() ?? '';
    if (code.isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) {
      return;
    }

    _showMessage('Código de indicação copiado.');
  }

  Future<void> _openBenefitsWallet() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BenefitsWalletScreen(
          repository: widget.repository,
          profile: _profile,
          initialLoyaltySummary: _loyaltySummary,
          initialReferralSummary: _referralSummary,
        ),
      ),
    );

    if (!mounted) {
      return;
    }

    await _refreshBenefits(showLoader: false);
  }

  Future<void> _signOut() async {
    if (_isSigningOut) {
      return;
    }

    setState(() => _isSigningOut = true);

    try {
      await widget.onSignOut();
      if (!mounted) {
        return;
      }

      Navigator.of(context).pop();
    } finally {
      if (mounted) {
        setState(() => _isSigningOut = false);
      }
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tierLabel = _loyaltySummary?.currentTier?.label;
    final referralCode = _referralSummary?.referralCode.trim();

    return Scaffold(
      appBar: AppBar(title: const Text('Minha conta')),
      body: AppBackdrop(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            SoftCard(
              padding: const EdgeInsets.all(22),
              borderColor: _branding.outline.withValues(alpha: 0.72),
              gradient: LinearGradient(
                colors: [
                  _branding.primary.withValues(alpha: 0.18),
                  Colors.white.withValues(alpha: 0.98),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.88),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: _profile.salonLogoUrl == null
                            ? Icon(
                                Icons.storefront_rounded,
                                color: _branding.deep,
                                size: 30,
                              )
                            : ClipRRect(
                                borderRadius: BorderRadius.circular(18),
                                child: Image.network(
                                  _profile.salonLogoUrl!,
                                  fit: BoxFit.cover,
                                ),
                              ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _profile.name,
                              style: theme.textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _profile.salonName,
                              style: theme.textTheme.bodyLarge?.copyWith(
                                color: _branding.deep,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (_profile.salonTagline?.trim().isNotEmpty ==
                                true) ...[
                              const SizedBox(height: 2),
                              Text(
                                _profile.salonTagline!,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: _branding.mutedText,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _AccountChip(
                        icon: Icons.verified_user_rounded,
                        label: tierLabel == null
                            ? 'Cliente do salão'
                            : 'Nível $tierLabel',
                        branding: _branding,
                      ),
                      _AccountChip(
                        icon: Icons.local_fire_department_rounded,
                        label: _loyaltySummary?.isVip == true
                            ? 'Cliente VIP'
                            : '${_loyaltySummary?.completedVisits ?? 0} visitas concluídas',
                        branding: _branding,
                      ),
                      if (referralCode != null && referralCode.isNotEmpty)
                        _AccountChip(
                          icon: Icons.card_giftcard_rounded,
                          label: 'Código $referralCode',
                          branding: _branding,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SoftCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Seus dados',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Atualize seu nome e confira a conta usada no app.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _nameController,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      labelText: 'Seu nome',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9F2EB),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE5D3C3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.email_outlined),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Conta conectada',
                                style: theme.textTheme.labelLarge,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                _userEmail,
                                style: theme.textTheme.bodyMedium,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _isSavingName ? null : _saveName,
                      icon: _isSavingName
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.save_outlined),
                      label: const Text('Salvar nome'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SoftCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Relacionamento e benefícios',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      if (_isRefreshingBenefits)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Sua carteira junta fidelidade, cashback, ranking e indicação num só lugar.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 18),
                  _MetricPreviewRow(
                    branding: _branding,
                    loyaltySummary: _loyaltySummary,
                    referralSummary: _referralSummary,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _openBenefitsWallet,
                      icon: const Icon(Icons.account_balance_wallet_outlined),
                      label: const Text('Abrir carteira de benefícios'),
                    ),
                  ),
                  if (referralCode != null && referralCode.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    TextButton.icon(
                      onPressed: _copyReferralCode,
                      icon: const Icon(Icons.copy_rounded),
                      label: const Text('Copiar código de indicação'),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            SoftCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Contato e acesso',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Fale com o salão ou encerre sua sessão neste aparelho.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: widget.onWhatsApp,
                      icon: const Icon(Icons.chat_bubble_outline_rounded),
                      label: const Text('Falar com o salão'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _isSigningOut ? null : _signOut,
                      icon: _isSigningOut
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.logout_rounded),
                      label: const Text('Sair da conta'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountChip extends StatelessWidget {
  const _AccountChip({
    required this.icon,
    required this.label,
    required this.branding,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: branding.outline.withValues(alpha: 0.7)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricPreviewRow extends StatelessWidget {
  const _MetricPreviewRow({
    required this.branding,
    required this.loyaltySummary,
    required this.referralSummary,
  });

  final SalonBranding branding;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _PreviewMetricBox(
            label: 'Pontos',
            value: '${loyaltySummary?.pointsBalance ?? 0}',
            branding: branding,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _PreviewMetricBox(
            label: 'Cashback',
            value:
                'R\$ ${(loyaltySummary?.cashbackBalance ?? 0).toStringAsFixed(2).replaceAll('.', ',')}',
            branding: branding,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _PreviewMetricBox(
            label: 'Indicações',
            value: '${referralSummary?.qualifiedCount ?? 0}',
            branding: branding,
          ),
        ),
      ],
    );
  }
}

class _PreviewMetricBox extends StatelessWidget {
  const _PreviewMetricBox({
    required this.label,
    required this.value,
    required this.branding,
  });

  final String label;
  final String value;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9F2EB),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.68)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
              color: branding.deep,
            ),
          ),
        ],
      ),
    );
  }
}
