import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/app_models.dart';
import '../navigation/salon_page_route.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cinematic_reveal.dart';
import '../widgets/premium_surface_card.dart';
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
    this.initialAppointments = const [],
    this.initialServices = const [],
    this.initialFavoriteServiceIds = const <String>{},
    this.onProfileChanged,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final String? userEmail;
  final CustomerLoyaltySummary? initialLoyaltySummary;
  final ReferralSummary? initialReferralSummary;
  final List<AppointmentItem> initialAppointments;
  final List<ServiceItem> initialServices;
  final Set<String> initialFavoriteServiceIds;
  final Future<void> Function() onSignOut;
  final VoidCallback onWhatsApp;
  final ValueChanged<CustomerProfile>? onProfileChanged;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _preferencesController;
  late final TextEditingController _allergiesController;
  late final TextEditingController _beautyProductsController;
  late CustomerProfile _profile;
  late final SalonBranding _branding;
  late List<AppointmentItem> _appointments;
  late List<ServiceItem> _services;
  late Set<String> _favoriteServiceIds;
  CustomerLoyaltySummary? _loyaltySummary;
  ReferralSummary? _referralSummary;
  List<FavoriteStaffMemberItem> _favoriteStaffMembers =
      const <FavoriteStaffMemberItem>[];
  bool _isSavingName = false;
  bool _isSigningOut = false;
  bool _isRefreshingBenefits = false;
  bool _isRefreshingRelationshipData = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _branding = SalonBranding.fromName(
      widget.profile.salonName,
      overrideHexColor: widget.profile.salonBrandColor,
      businessSegment: widget.profile.salonBusinessSegment,
      clientAppConfig: widget.profile.salonClientAppConfig,
    );
    _loyaltySummary = widget.initialLoyaltySummary;
    _referralSummary = widget.initialReferralSummary;
    _appointments = [...widget.initialAppointments]
      ..sort((left, right) => right.date.compareTo(left.date));
    _services = [...widget.initialServices];
    _favoriteServiceIds = {...widget.initialFavoriteServiceIds};
    _nameController = TextEditingController(text: widget.profile.name);
    _phoneController = TextEditingController(text: widget.profile.phone ?? '');
    _preferencesController = TextEditingController(
      text: widget.profile.preferences ?? '',
    );
    _allergiesController = TextEditingController(
      text: widget.profile.allergies ?? '',
    );
    _beautyProductsController = TextEditingController(
      text: widget.profile.beautyProducts ?? '',
    );

    if (_loyaltySummary == null || _referralSummary == null) {
      unawaited(_refreshBenefits(showLoader: true));
    }

    unawaited(_refreshRelationshipData(showLoader: _appointments.isEmpty));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _preferencesController.dispose();
    _allergiesController.dispose();
    _beautyProductsController.dispose();
    super.dispose();
  }

  String get _userEmail {
    final email = widget.userEmail?.trim();
    if (email != null && email.isNotEmpty) {
      return email;
    }

    return 'E-mail da conta indisponível';
  }

  String get _accountMomentumSummary {
    final loyaltySummary = _loyaltySummary;
    final referralSummary = _referralSummary;

    if ((referralSummary?.availableRewardsCount ?? 0) > 0) {
      return 'Você já tem recompensa liberada para usar na próxima visita.';
    }

    if ((loyaltySummary?.visitsToNextTier ?? 0) == 1) {
      return 'Falta 1 visita para subir de nível.';
    }

    if ((loyaltySummary?.visitsToNextTier ?? 0) > 1) {
      return 'Faltam ${loyaltySummary!.visitsToNextTier} visitas para seu próximo nível de fidelidade.';
    }

    if ((referralSummary?.qualifiedCount ?? 0) > 0 &&
        (referralSummary?.nextRewardRemaining ?? 0) > 0) {
      return 'Faltam ${referralSummary!.nextRewardRemaining} indicações qualificadas para a próxima recompensa.';
    }

    if ((loyaltySummary?.cashbackBalance ?? 0) > 0) {
      final cashbackLabel = NumberFormat.currency(
        locale: 'pt_BR',
        symbol: 'R\$',
      ).format(loyaltySummary!.cashbackBalance);
      return 'Você já tem $cashbackLabel de cashback acumulado para ajudar no próximo retorno.';
    }

    return 'Agenda, carteira e contato no mesmo app.';
  }

  String get _benefitFocusTitle {
    final loyaltySummary = _loyaltySummary;
    final referralSummary = _referralSummary;

    if ((referralSummary?.availableRewardsCount ?? 0) > 0) {
      return 'Sua próxima visita já pode usar uma recompensa';
    }

    if ((loyaltySummary?.visitsToNextTier ?? 0) == 1) {
      return 'Sua próxima visita pode liberar mais vantagem';
    }

    if ((loyaltySummary?.cashbackBalance ?? 0) > 0) {
      return 'Seu cashback já pode ajudar no próximo retorno';
    }

    if ((referralSummary?.nextRewardRemaining ?? 0) > 0 &&
        (referralSummary?.qualifiedCount ?? 0) > 0) {
      return 'Sua rede já está ajudando a puxar a próxima recompensa';
    }

    return 'Seu perfil já organiza seu retorno';
  }

  String get _benefitFocusMessage {
    final loyaltySummary = _loyaltySummary;
    final referralSummary = _referralSummary;

    if ((referralSummary?.availableRewardsCount ?? 0) > 0) {
      return 'Abra a carteira para ver a recompensa liberada.';
    }

    if ((loyaltySummary?.visitsToNextTier ?? 0) == 1) {
      return 'Você está a uma visita de subir de nível.';
    }

    if ((loyaltySummary?.cashbackBalance ?? 0) > 0) {
      final cashbackLabel = NumberFormat.currency(
        locale: 'pt_BR',
        symbol: 'R\$',
      ).format(loyaltySummary!.cashbackBalance);
      return 'Você já acumulou $cashbackLabel. Vale usar esse saldo no próximo retorno.';
    }

    if ((referralSummary?.nextRewardRemaining ?? 0) > 0 &&
        (referralSummary?.qualifiedCount ?? 0) > 0) {
      return 'Seu código já está funcionando. A próxima recompensa está mais perto.';
    }

    return 'Seu perfil reúne agenda, carteira e contato.';
  }

  List<AppointmentItem> get _recentAppointments {
    final sorted = [..._appointments]
      ..sort((left, right) => right.date.compareTo(left.date));
    return sorted.take(3).toList();
  }

  List<ServiceItem> get _favoriteServices {
    final items = _services
        .where((service) => _favoriteServiceIds.contains(service.id))
        .toList();

    items.sort((left, right) {
      if (left.sortOrder != right.sortOrder) {
        return left.sortOrder.compareTo(right.sortOrder);
      }

      return left.name.compareTo(right.name);
    });

    return items;
  }

  List<AppointmentItem> get _beautyHistoryAppointments {
    final completedAppointments =
        _appointments
            .where(
              (appointment) =>
                  appointment.status == 'completed' ||
                  appointment.completedAt != null,
            )
            .toList()
          ..sort((left, right) {
            final leftDate = left.completedAt ?? left.date;
            final rightDate = right.completedAt ?? right.date;
            return rightDate.compareTo(leftDate);
          });

    return completedAppointments.take(3).toList();
  }

  bool get _hasBeautyProfileData {
    return (_profile.preferences?.trim().isNotEmpty ?? false) ||
        (_profile.allergies?.trim().isNotEmpty ?? false) ||
        (_profile.beautyProducts?.trim().isNotEmpty ?? false) ||
        _beautyHistoryAppointments.isNotEmpty;
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

  Future<void> _refreshRelationshipData({required bool showLoader}) async {
    if (showLoader && mounted) {
      setState(() => _isRefreshingRelationshipData = true);
    }

    try {
      final results = await Future.wait<Object?>([
        widget.repository.getAppointments(),
        widget.repository.getServices(),
        widget.repository.getFavoriteServiceIds(),
        widget.repository.getFavoriteStaffMembers(),
      ]);

      if (!mounted) {
        return;
      }

      setState(() {
        _appointments = (results[0] as List<AppointmentItem>)
          ..sort((left, right) => right.date.compareTo(left.date));
        _services = results[1] as List<ServiceItem>;
        _favoriteServiceIds = results[2] as Set<String>;
        _favoriteStaffMembers = results[3] as List<FavoriteStaffMemberItem>;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível atualizar seu histórico agora.'),
        ),
      );
    } finally {
      if (showLoader && mounted) {
        setState(() => _isRefreshingRelationshipData = false);
      }
    }
  }

  Future<void> _saveProfile() async {
    final normalizedName = _nameController.text.trim();
    final normalizedPhone = _phoneController.text.trim();
    final normalizedPreferences = _preferencesController.text.trim();
    final normalizedAllergies = _allergiesController.text.trim();
    final normalizedBeautyProducts = _beautyProductsController.text.trim();
    if (normalizedName.isEmpty) {
      _showMessage('Informe seu nome.');
      return;
    }

    final unchanged =
        normalizedName == _profile.name &&
        normalizedPhone == (_profile.phone ?? '') &&
        normalizedPreferences == (_profile.preferences ?? '') &&
        normalizedAllergies == (_profile.allergies ?? '') &&
        normalizedBeautyProducts == (_profile.beautyProducts ?? '');

    if (unchanged || _isSavingName) {
      return;
    }

    setState(() => _isSavingName = true);

    try {
      await widget.repository.updateCustomerProfile(
        customerId: _profile.id,
        customerName: normalizedName,
        phone: normalizedPhone,
        preferences: normalizedPreferences,
        allergies: normalizedAllergies,
        beautyProducts: normalizedBeautyProducts,
      );

      if (!mounted) {
        return;
      }

      final updatedProfile = _profile.copyWith(
        name: normalizedName,
        phone: normalizedPhone,
        clearPhone: normalizedPhone.isEmpty,
        preferences: normalizedPreferences,
        clearPreferences: normalizedPreferences.isEmpty,
        allergies: normalizedAllergies,
        clearAllergies: normalizedAllergies.isEmpty,
        beautyProducts: normalizedBeautyProducts,
        clearBeautyProducts: normalizedBeautyProducts.isEmpty,
      );
      setState(() => _profile = updatedProfile);
      widget.onProfileChanged?.call(updatedProfile);
      _showMessage('Seu perfil foi atualizado.');
    } on PostgrestException catch (error) {
      final raw = error.message.toLowerCase();
      final message =
          raw.contains('row-level security') || raw.contains('permission')
          ? 'Não foi possível salvar seu perfil agora.'
          : 'Não foi possível atualizar seu perfil.';
      _showMessage(message);
    } catch (_) {
      _showMessage('Não foi possível atualizar seu perfil.');
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
      SalonPageRoute<void>(
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tierLabel = _loyaltySummary?.currentTier?.label;
    final referralCode = _referralSummary?.referralCode.trim();
    final cashbackLabel = NumberFormat.currency(
      locale: 'pt_BR',
      symbol: 'R\$',
    ).format(_loyaltySummary?.cashbackBalance ?? 0);
    final favoritesCount =
        _favoriteServices.length + _favoriteStaffMembers.length;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Minha conta'),
            Text(
              'Relacionamento, histórico e carteira',
              style: theme.textTheme.bodySmall?.copyWith(
                color: _branding.mutedText,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
      body: AppBackdrop(
        branding: _branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            CinematicReveal(
              delay: const Duration(milliseconds: 20),
              child: PremiumSurfaceCard(
                padding: EdgeInsets.zero,
                gradient: LinearGradient(
                  colors: [
                    Color.lerp(_branding.deep, const Color(0xFF120F17), 0.12)!,
                    _branding.deep,
                    Color.lerp(_branding.primary, _branding.deep, 0.2)!,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                tone: PremiumSurfaceTone.contrast,
                child: Stack(
                  children: [
                    Positioned(
                      top: -44,
                      right: -18,
                      child: Container(
                        width: 160,
                        height: 160,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                    ),
                    Positioned(
                      left: -40,
                      bottom: -60,
                      child: Container(
                        width: 148,
                        height: 148,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _branding.primary.withValues(alpha: 0.14),
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
                              const _ProfileHeroPill(
                                label: 'Seu perfil dentro do salão',
                                icon: Icons.auto_awesome_rounded,
                              ),
                              _ProfileHeroPill(
                                label: _loyaltySummary?.isVip == true
                                    ? 'Cliente VIP'
                                    : 'Conta ativa',
                                icon: _loyaltySummary?.isVip == true
                                    ? Icons.workspace_premium_rounded
                                    : Icons.verified_user_rounded,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Container(
                                width: 54,
                                height: 54,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.14),
                                  ),
                                ),
                                child: _profile.salonLogoUrl == null
                                    ? const Icon(
                                        Icons.storefront_rounded,
                                        color: Colors.white,
                                        size: 26,
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
                                      style: theme.textTheme.titleLarge
                                          ?.copyWith(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w900,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _profile.salonName,
                                      style: theme.textTheme.bodyLarge
                                          ?.copyWith(
                                            color: Colors.white.withValues(
                                              alpha: 0.9,
                                            ),
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                    if (_profile.salonTagline
                                            ?.trim()
                                            .isNotEmpty ==
                                        true) ...[
                                      const SizedBox(height: 2),
                                      Text(
                                        _profile.salonTagline!,
                                        style: theme.textTheme.bodyMedium
                                            ?.copyWith(
                                              color: Colors.white.withValues(
                                                alpha: 0.72,
                                              ),
                                            ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Text(
                            _accountMomentumSummary,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.82),
                              fontWeight: FontWeight.w600,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 14),
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
                                dark: true,
                              ),
                              _AccountChip(
                                icon: Icons.local_fire_department_rounded,
                                label: _loyaltySummary?.isVip == true
                                    ? 'Cliente VIP'
                                    : '${_loyaltySummary?.completedVisits ?? 0} visitas concluídas',
                                branding: _branding,
                                dark: true,
                              ),
                              if (referralCode != null &&
                                  referralCode.isNotEmpty)
                                _AccountChip(
                                  icon: Icons.card_giftcard_rounded,
                                  label: 'Código $referralCode',
                                  branding: _branding,
                                  dark: true,
                                ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: _PreviewMetricBox(
                                  label: 'Visitas',
                                  value:
                                      '${_loyaltySummary?.completedVisits ?? 0}',
                                  branding: _branding,
                                  dark: true,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _PreviewMetricBox(
                                  label: 'Cashback',
                                  value: cashbackLabel,
                                  branding: _branding,
                                  dark: true,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _PreviewMetricBox(
                                  label: 'Favoritos',
                                  value: '$favoritesCount',
                                  branding: _branding,
                                  dark: true,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: _isSigningOut ? null : _signOut,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: Colors.white,
                                side: BorderSide(
                                  color: Colors.white.withValues(alpha: 0.26),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 18,
                                  vertical: 16,
                                ),
                                backgroundColor: Colors.white.withValues(
                                  alpha: 0.08,
                                ),
                              ),
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
            ),
            const SizedBox(height: 18),
            CinematicReveal(
              delay: const Duration(milliseconds: 90),
              child: _ProfileMomentumStrip(
                branding: _branding,
                loyaltySummary: _loyaltySummary,
                referralSummary: _referralSummary,
                favoritesCount: favoritesCount,
                recentAppointmentsCount: _recentAppointments.length,
              ),
            ),
            const SizedBox(height: 18),
            PremiumSurfaceCard(
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
                    'Nome, telefone e preferências ajudam o salão a atender você melhor.',
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
                  TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Telefone',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _preferencesController,
                    minLines: 3,
                    maxLines: 5,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      labelText: 'Preferências',
                      hintText:
                          'Ex.: profissional preferido, estilo, acabamento ou cuidado que você gosta de repetir.',
                      prefixIcon: Icon(Icons.tune_rounded),
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _allergiesController,
                    minLines: 2,
                    maxLines: 4,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      labelText: 'Alergias ou cuidados',
                      hintText:
                          'Ex.: sensibilidade a química, fragrância forte, cola ou ingredientes a evitar.',
                      prefixIcon: Icon(Icons.health_and_safety_outlined),
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _beautyProductsController,
                    minLines: 2,
                    maxLines: 4,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      labelText: 'Produtos usados ou que você quer repetir',
                      hintText:
                          'Ex.: reconstrutor, finalizador sem sulfato, esmalte hipoalergênico ou outro produto que funciona bem.',
                      prefixIcon: Icon(Icons.spa_outlined),
                      alignLabelWithHint: true,
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
                      onPressed: _isSavingName ? null : _saveProfile,
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
                      label: const Text('Salvar perfil'),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            PremiumSurfaceCard(
              padding: const EdgeInsets.all(20),
              tone: PremiumSurfaceTone.secondary,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ficha do cliente',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Preferências, cuidados e histórico útil do seu atendimento.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  if (!_hasBeautyProfileData)
                    const _ProfileSectionEmptyState(
                      icon: Icons.spa_outlined,
                      title: 'Seu perfil de beleza começa aqui',
                      message:
                          'Salve preferências, alergias e produtos importantes para o salão cuidar melhor das próximas visitas.',
                      accentColor: Color(0xFF8E441F),
                    )
                  else ...[
                    if (_profile.preferences?.trim().isNotEmpty == true) ...[
                      _ProfileBeautyNoteCard(
                        icon: Icons.tune_rounded,
                        label: 'Preferências',
                        value: _profile.preferences!,
                        branding: _branding,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_profile.allergies?.trim().isNotEmpty == true) ...[
                      _ProfileBeautyNoteCard(
                        icon: Icons.health_and_safety_outlined,
                        label: 'Alergias e cuidados',
                        value: _profile.allergies!,
                        branding: _branding,
                        accentColor: const Color(0xFF8D5B28),
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_profile.beautyProducts?.trim().isNotEmpty == true) ...[
                      _ProfileBeautyNoteCard(
                        icon: Icons.spa_outlined,
                        label: 'Produtos e rotina',
                        value: _profile.beautyProducts!,
                        branding: _branding,
                      ),
                      const SizedBox(height: 12),
                    ],
                    if (_beautyHistoryAppointments.isNotEmpty) ...[
                      Text(
                        'Atendimentos anteriores',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Column(
                        children: _beautyHistoryAppointments
                            .map(
                              (appointment) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _ProfileAppointmentSummaryCard(
                                  appointment: appointment,
                                  branding: _branding,
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            PremiumSurfaceCard(
              padding: const EdgeInsets.all(20),
              tone: PremiumSurfaceTone.secondary,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Últimos atendimentos',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      if (_isRefreshingRelationshipData)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Serviços, datas e profissional guardados para você consultar rápido.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  if (_recentAppointments.isEmpty)
                    const _ProfileSectionEmptyState(
                      icon: Icons.history_toggle_off_rounded,
                      title: 'Seu histórico vai aparecer aqui',
                      message:
                          'Assim que seus atendimentos forem concluídos, o app registra datas, valores e profissional para facilitar o próximo retorno.',
                      accentColor: Color(0xFF8E441F),
                    )
                  else
                    Column(
                      children: _recentAppointments
                          .map(
                            (appointment) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _ProfileAppointmentSummaryCard(
                                appointment: appointment,
                                branding: _branding,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  if (_appointments.length > _recentAppointments.length) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Mostrando os 3 atendimentos mais recentes. O restante continua na aba Histórico.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF876F5F),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            PremiumSurfaceCard(
              padding: const EdgeInsets.all(20),
              tone: PremiumSurfaceTone.accent,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Carteira e benefícios',
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
                    'Tudo o que você acumulou com o salão em uma leitura simples.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 18),
                  _MetricPreviewRow(
                    branding: _branding,
                    loyaltySummary: _loyaltySummary,
                    referralSummary: _referralSummary,
                  ),
                  const SizedBox(height: 16),
                  _BenefitFocusCard(
                    title: _benefitFocusTitle,
                    message: _benefitFocusMessage,
                    branding: _branding,
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
            PremiumSurfaceCard(
              padding: const EdgeInsets.all(20),
              tone: PremiumSurfaceTone.secondary,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Seus favoritos',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      if (_isRefreshingRelationshipData)
                        const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Salve serviços e profissionais para voltar mais rápido ao que já gosta.',
                    style: theme.textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 16),
                  if (_favoriteServices.isEmpty &&
                      _favoriteStaffMembers.isEmpty)
                    const _ProfileSectionEmptyState(
                      icon: Icons.favorite_border_rounded,
                      title: 'Você ainda não salvou favoritos',
                      message:
                          'Use o coracao nos serviços e na escolha de profissionais para montar sua rotina com menos atrito.',
                      accentColor: Color(0xFF8E441F),
                    )
                  else ...[
                    if (_favoriteServices.isNotEmpty) ...[
                      Text(
                        'Serviços salvos',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: _favoriteServices
                            .map(
                              (service) => _ProfileFavoriteChip(
                                icon: Icons.content_cut_rounded,
                                label: service.name,
                                detail:
                                    'R\$ ${service.price.toStringAsFixed(2).replaceAll('.', ',')}',
                                branding: _branding,
                              ),
                            )
                            .toList(),
                      ),
                    ],
                    if (_favoriteServices.isNotEmpty &&
                        _favoriteStaffMembers.isNotEmpty)
                      const SizedBox(height: 16),
                    if (_favoriteStaffMembers.isNotEmpty) ...[
                      Text(
                        'Profissionais salvos',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: _favoriteStaffMembers
                            .map(
                              (staffMember) => _ProfileFavoriteChip(
                                icon: Icons.person_rounded,
                                label: staffMember.name,
                                detail: staffMember.role,
                                branding: _branding,
                              ),
                            )
                            .toList(),
                      ),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            PremiumSurfaceCard(
              padding: const EdgeInsets.all(20),
              tone: PremiumSurfaceTone.contrast,
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
                    'Use este espaço para alinhar retorno, pacote, encaixe ou qualquer detalhe da próxima visita sem depender de conversa solta.',
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileSectionEmptyState extends StatelessWidget {
  const _ProfileSectionEmptyState({
    required this.icon,
    required this.title,
    required this.message,
    this.accentColor = const Color(0xFF8E441F),
  });

  final IconData icon;
  final String title;
  final String message;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(16),
      tone: PremiumSurfaceTone.secondary,
      gradient: LinearGradient(
        colors: [accentColor.withValues(alpha: 0.12), Colors.white],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: accentColor),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF2F231C),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF765E4E),
                    height: 1.5,
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

class _ProfileAppointmentSummaryCard extends StatelessWidget {
  const _ProfileAppointmentSummaryCard({
    required this.appointment,
    required this.branding,
  });

  final AppointmentItem appointment;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm');
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: branding.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.auto_awesome_rounded, color: branding.deep),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  appointment.serviceName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _ProfileSummaryChip(
                icon: Icons.event_rounded,
                label:
                    '${dateFormat.format(appointment.date)} • ${timeFormat.format(appointment.date)}',
                branding: branding,
              ),
              _ProfileSummaryChip(
                icon: Icons.sell_rounded,
                label: currency.format(appointment.servicePrice),
                branding: branding,
              ),
              if ((appointment.staffMemberName ?? '').trim().isNotEmpty)
                _ProfileSummaryChip(
                  icon: Icons.person_rounded,
                  label: appointment.staffMemberName!,
                  branding: branding,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileFavoriteChip extends StatelessWidget {
  const _ProfileFavoriteChip({
    required this.icon,
    required this.label,
    required this.branding,
    this.detail,
  });

  final IconData icon;
  final String label;
  final String? detail;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final composedLabel = (detail ?? '').trim().isEmpty
        ? label
        : '$label • $detail';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: branding.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              composedLabel,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: branding.deep,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileBeautyNoteCard extends StatelessWidget {
  const _ProfileBeautyNoteCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.branding,
    this.accentColor = const Color(0xFF8E441F),
  });

  final IconData icon;
  final String label;
  final String value;
  final SalonBranding branding;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.58)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: accentColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF2F231C),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF6E584A),
                    height: 1.45,
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

class _ProfileSummaryChip extends StatelessWidget {
  const _ProfileSummaryChip({
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
        color: branding.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.42)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _AccountChip extends StatelessWidget {
  const _AccountChip({
    required this.icon,
    required this.label,
    required this.branding,
    this.dark = false,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: dark
            ? Colors.white.withValues(alpha: 0.12)
            : Colors.white.withValues(alpha: 0.68),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: dark
              ? Colors.white.withValues(alpha: 0.14)
              : branding.outline.withValues(alpha: 0.54),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: dark ? Colors.white : branding.deep),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: dark ? Colors.white : branding.deep,
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

class _BenefitFocusCard extends StatelessWidget {
  const _BenefitFocusCard({
    required this.title,
    required this.message,
    required this.branding,
  });

  final String title;
  final String message;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: branding.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.58)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.bolt_rounded, color: branding.deep),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF2F231C),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF765E4E),
                    height: 1.45,
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

class _PreviewMetricBox extends StatelessWidget {
  const _PreviewMetricBox({
    required this.label,
    required this.value,
    required this.branding,
    this.dark = false,
  });

  final String label;
  final String value;
  final SalonBranding branding;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            dark
                ? Colors.white.withValues(alpha: 0.12)
                : Colors.white.withValues(alpha: 0.92),
            dark
                ? branding.primary.withValues(alpha: 0.14)
                : branding.primary.withValues(alpha: 0.06),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: dark
              ? Colors.white.withValues(alpha: 0.14)
              : branding.outline.withValues(alpha: 0.68),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 3,
            decoration: BoxDecoration(
              color: branding.primary.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: dark
                  ? Colors.white.withValues(alpha: 0.74)
                  : branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
              color: dark ? Colors.white : branding.deep,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileHeroPill extends StatelessWidget {
  const _ProfileHeroPill({required this.label, required this.icon});

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

class _ProfileMomentumStrip extends StatelessWidget {
  const _ProfileMomentumStrip({
    required this.branding,
    required this.loyaltySummary,
    required this.referralSummary,
    required this.favoritesCount,
    required this.recentAppointmentsCount,
  });

  final SalonBranding branding;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final int favoritesCount;
  final int recentAppointmentsCount;

  @override
  Widget build(BuildContext context) {
    final nextTierVisits = loyaltySummary?.visitsToNextTier;

    return PremiumSurfaceCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.98),
          branding.surface.withValues(alpha: 0.94),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      tone: PremiumSurfaceTone.contrast,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Seu momento dentro do app',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Perfil, carteira e histórico agora conversam como uma experiência única do salão, não como telas soltas.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.mutedText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _ProfileStageCard(
                eyebrow: 'Próxima vantagem',
                title: nextTierVisits == null
                    ? 'Nível em construção'
                    : nextTierVisits == 0
                    ? 'Seu nível já está ativo'
                    : 'Faltam $nextTierVisits visita${nextTierVisits == 1 ? '' : 's'}',
                description:
                    'A próxima ida ao salão pode subir seu patamar no app.',
                icon: Icons.stacked_line_chart_rounded,
                accent: Color.lerp(branding.primary, Colors.white, 0.14)!,
              ),
              _ProfileStageCard(
                eyebrow: 'Favoritos',
                title: favoritesCount == 0
                    ? 'Sua curadoria começa agora'
                    : '$favoritesCount item${favoritesCount == 1 ? '' : 's'} salvo${favoritesCount == 1 ? '' : 's'}',
                description:
                    'Serviços e profissionais ficam a um toque para o próximo retorno.',
                icon: Icons.favorite_rounded,
                accent: Color.lerp(branding.deep, branding.primary, 0.4)!,
              ),
              _ProfileStageCard(
                eyebrow: 'Memória do salão',
                title: recentAppointmentsCount == 0
                    ? 'Histórico ainda nascendo'
                    : '$recentAppointmentsCount atendimento${recentAppointmentsCount == 1 ? '' : 's'} recente${recentAppointmentsCount == 1 ? '' : 's'}',
                description:
                    'Seu histórico já ajuda a repetir o que deu certo com menos atrito.',
                icon: Icons.history_rounded,
                accent: Color.lerp(branding.primary, Colors.white, 0.28)!,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileStageCard extends StatelessWidget {
  const _ProfileStageCard({
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.icon,
    required this.accent,
  });

  final String eyebrow;
  final String title;
  final String description;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 238,
      child: PremiumSurfaceCard(
        padding: const EdgeInsets.all(16),
        gradient: LinearGradient(
          colors: [Colors.white, accent.withValues(alpha: 0.14)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        tone: PremiumSurfaceTone.secondary,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    eyebrow,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: const Color(0xFF7A5E4E),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Icon(icon, size: 18, color: const Color(0xFF2F231C)),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: const Color(0xFF2F231C),
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              description,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF6C5547),
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
