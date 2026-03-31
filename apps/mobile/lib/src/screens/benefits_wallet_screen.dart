import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cinematic_reveal.dart';
import '../widgets/empty_state.dart';
import '../widgets/loyalty_summary_card.dart';
import '../widgets/referral_program_card.dart';
import '../widgets/soft_card.dart';

class BenefitsWalletScreen extends StatefulWidget {
  const BenefitsWalletScreen({
    super.key,
    required this.repository,
    required this.profile,
    this.initialLoyaltySummary,
    this.initialReferralSummary,
  });

  final SalonRepository repository;
  final CustomerProfile profile;
  final CustomerLoyaltySummary? initialLoyaltySummary;
  final ReferralSummary? initialReferralSummary;

  @override
  State<BenefitsWalletScreen> createState() => _BenefitsWalletScreenState();
}

class _BenefitsWalletScreenState extends State<BenefitsWalletScreen> {
  late final SalonBranding _branding;
  late CustomerLoyaltySummary? _loyaltySummary;
  late ReferralSummary? _referralSummary;
  late Future<List<LoyaltyTransactionItem>> _transactionsFuture;
  bool _isRefreshingSummaries = false;

  @override
  void initState() {
    super.initState();
    _branding = SalonBranding.fromName(
      widget.profile.salonName,
      overrideHexColor: widget.profile.salonBrandColor,
      businessSegment: widget.profile.salonBusinessSegment,
      clientAppConfig: widget.profile.salonClientAppConfig,
    );
    _loyaltySummary = widget.initialLoyaltySummary;
    _referralSummary = widget.initialReferralSummary;
    _transactionsFuture = _loadTransactions();
    if (_loyaltySummary == null || _referralSummary == null) {
      unawaited(_refreshSummaries(showLoader: true));
    }
  }

  Future<List<LoyaltyTransactionItem>> _loadTransactions() {
    return widget.repository.getLoyaltyTransactions(limit: 24);
  }

  Future<void> _reloadTransactions() async {
    final future = _loadTransactions();
    if (mounted) {
      setState(() => _transactionsFuture = future);
    }
    await future;
  }

  Future<void> _refresh() async {
    await Future.wait<void>([
      _refreshSummaries(showLoader: false),
      _reloadTransactions(),
    ]);
  }

  Future<void> _refreshSummaries({required bool showLoader}) async {
    if (showLoader && mounted) {
      setState(() => _isRefreshingSummaries = true);
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
          content: Text('Não foi possível atualizar sua carteira agora.'),
        ),
      );
    } finally {
      if (showLoader && mounted) {
        setState(() => _isRefreshingSummaries = false);
      }
    }
  }

  Future<void> _copyReferralCode(String code) async {
    final normalizedCode = code.trim();
    if (normalizedCode.isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: normalizedCode));
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Código de indicação copiado.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Minha carteira'),
            Text(
              'Saldo e carteira',
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
        child: FutureBuilder<List<LoyaltyTransactionItem>>(
          future: _transactionsFuture,
          builder: (context, snapshot) {
            final transactions =
                snapshot.data ?? const <LoyaltyTransactionItem>[];
            final isWaitingTransactions =
                snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData;

            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                children: [
                  CinematicReveal(
                    delay: const Duration(milliseconds: 20),
                    child: _WalletHero(
                      profile: widget.profile,
                      branding: _branding,
                      loyaltySummary: _loyaltySummary,
                      referralSummary: _referralSummary,
                      isRefreshing: _isRefreshingSummaries,
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (_loyaltySummary?.hasVisibleContent == true) ...[
                    CinematicReveal(
                      delay: const Duration(milliseconds: 90),
                      child: LoyaltySummaryCard(
                        summary: _loyaltySummary!,
                        branding: _branding,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ] else
                    CinematicReveal(
                      delay: const Duration(milliseconds: 90),
                      child: _WalletEmptyCard(
                        branding: _branding,
                        title: 'Seu clube de fidelidade ainda está vazio',
                        message:
                            'Assim que visitas concluídas começarem a gerar pontos e cashback, o saldo vai aparecer aqui.',
                      ),
                    ),
                  if (_referralSummary?.hasVisibleContent == true) ...[
                    CinematicReveal(
                      delay: const Duration(milliseconds: 150),
                      child: ReferralProgramCard(
                        summary: _referralSummary!,
                        branding: _branding,
                        onCopyCode: () {
                          unawaited(
                            _copyReferralCode(_referralSummary!.referralCode),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  CinematicReveal(
                    delay: const Duration(milliseconds: 190),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Movimentos recentes',
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: _branding.deep,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Veja quando pontos, cashback e visitas entraram na sua carteira.',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: _branding.mutedText,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (snapshot.hasError)
                    _WalletEmptyCard(
                      branding: _branding,
                      title: 'Não foi possível carregar o extrato agora',
                      message:
                          'Atualize a tela em alguns instantes para buscar seus lançamentos mais recentes.',
                    )
                  else if (isWaitingTransactions)
                    _WalletLoadingCard(branding: _branding)
                  else if (transactions.isEmpty)
                    EmptyState(
                      centered: true,
                      icon: Icons.receipt_long_outlined,
                      eyebrow: 'Sem movimentos ainda',
                      title: 'Seu extrato ainda está vazio',
                      message:
                          'Quando visitas forem concluídas ou houver uso de cashback, os lançamentos vão aparecer aqui.',
                      accentColor: _branding.primary,
                    )
                  else
                    Column(
                      children: transactions
                          .map(
                            (transaction) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _LoyaltyTransactionCard(
                                transaction: transaction,
                                branding: _branding,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  const SizedBox(height: 18),
                  CinematicReveal(
                    delay: const Duration(milliseconds: 260),
                    child: _WalletMomentumStrip(
                      branding: _branding,
                      loyaltySummary: _loyaltySummary,
                      referralSummary: _referralSummary,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _WalletHero extends StatelessWidget {
  const _WalletHero({
    required this.profile,
    required this.branding,
    required this.loyaltySummary,
    required this.referralSummary,
    required this.isRefreshing,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final bool isRefreshing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cashbackLabel = NumberFormat.currency(
      locale: 'pt_BR',
      symbol: 'R\$',
    ).format(loyaltySummary?.cashbackBalance ?? 0);
    final rankLabel = loyaltySummary?.rankPosition == null
        ? 'Sem ranking'
        : '${loyaltySummary!.rankPosition}º lugar';
    final referralCode = referralSummary?.referralCode.trim();
    final focusTitle =
        referralSummary?.availableRewardsCount != null &&
            referralSummary!.availableRewardsCount > 0
        ? 'Você já tem recompensa pronta para usar'
        : loyaltySummary?.visitsToNextTier == 1
        ? 'Falta só uma visita para subir de nível'
        : (loyaltySummary?.cashbackBalance ?? 0) > 0
        ? 'Seu cashback já pode ajudar no próximo retorno'
        : 'Sua carteira já trabalha retenção a seu favor';
    final focusMessage =
        referralSummary?.availableRewardsCount != null &&
            referralSummary!.availableRewardsCount > 0
        ? 'Abra a carteira sempre que for marcar a próxima visita e alinhe com o salão a melhor forma de usar esse benefício.'
        : loyaltySummary?.visitsToNextTier == 1
        ? 'Manter sua frequência agora pode puxar mais desconto, cashback e posição melhor no ranking do salão.'
        : (loyaltySummary?.cashbackBalance ?? 0) > 0
        ? 'Seu saldo já está disponível para entrar na decisão da próxima reserva com mais inteligência.'
        : 'Pontos, indicações e visitas começam a aparecer aqui conforme sua relação com o salão evolui.';

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.primary.withValues(alpha: 0.28),
      gradient: LinearGradient(
        colors: [
          Color.lerp(branding.deep, const Color(0xFF130F18), 0.12)!,
          branding.deep,
          Color.lerp(branding.primary, branding.deep, 0.22)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Stack(
        children: [
          Positioned(
            top: -46,
            right: -18,
            child: Container(
              width: 170,
              height: 170,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Positioned(
            left: -42,
            bottom: -60,
            child: Container(
              width: 154,
              height: 154,
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
                Row(
                  children: [
                    const _WalletHeroRibbon(
                      label: 'Carteira conectada ao salão',
                      icon: Icons.auto_awesome_rounded,
                    ),
                    const Spacer(),
                    if (isRefreshing)
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white.withValues(alpha: 0.82),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.14),
                        ),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_rounded,
                        color: Colors.white,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Carteira de benefícios',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Pontos, cashback e vantagens que você já acumulou em ${profile.salonName}.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.82),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _HeroChip(
                      label: loyaltySummary?.isVip == true
                          ? 'Cliente VIP'
                          : rankLabel,
                      branding: branding,
                      icon: loyaltySummary?.isVip == true
                          ? Icons.workspace_premium_rounded
                          : Icons.leaderboard_rounded,
                      dark: true,
                    ),
                    _HeroChip(
                      label: 'Cashback $cashbackLabel',
                      branding: branding,
                      icon: Icons.savings_rounded,
                      dark: true,
                    ),
                    if (referralCode != null && referralCode.isNotEmpty)
                      _HeroChip(
                        label: 'Código $referralCode',
                        branding: branding,
                        icon: Icons.card_giftcard_rounded,
                        dark: true,
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _HeroMetricTile(
                        label: 'Pontos',
                        value: '${loyaltySummary?.pointsBalance ?? 0}',
                        branding: branding,
                        dark: true,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _HeroMetricTile(
                        label: 'Visitas',
                        value: '${loyaltySummary?.completedVisits ?? 0}',
                        branding: branding,
                        dark: true,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _HeroMetricTile(
                        label: 'Prêmios',
                        value: '${referralSummary?.availableRewardsCount ?? 0}',
                        branding: branding,
                        dark: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        focusTitle,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        focusMessage,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.82),
                          height: 1.45,
                        ),
                      ),
                    ],
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

class _HeroChip extends StatelessWidget {
  const _HeroChip({
    required this.label,
    required this.branding,
    required this.icon,
    this.dark = false,
  });

  final String label;
  final SalonBranding branding;
  final IconData icon;
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

class _WalletHeroRibbon extends StatelessWidget {
  const _WalletHeroRibbon({required this.label, required this.icon});

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

class _WalletMomentumStrip extends StatelessWidget {
  const _WalletMomentumStrip({
    required this.branding,
    required this.loyaltySummary,
    required this.referralSummary,
  });

  final SalonBranding branding;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;

  @override
  Widget build(BuildContext context) {
    final nextTierVisits = loyaltySummary?.visitsToNextTier;
    final rewardsReady = referralSummary?.availableRewardsCount ?? 0;
    final pendingReferrals = referralSummary?.pendingCount ?? 0;

    return SoftCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.98),
          branding.surface.withValues(alpha: 0.94),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline.withValues(alpha: 0.72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Status da sua relação com o salão',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'A carteira agora mostra com mais clareza o que está amadurecendo, o que já pode ser usado e o que ainda pode crescer.',
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
              _WalletStageCard(
                eyebrow: 'Próximo nível',
                title: nextTierVisits == null
                    ? 'Ranking em formação'
                    : nextTierVisits == 0
                    ? 'Nível atual estabilizado'
                    : 'Faltam $nextTierVisits visita${nextTierVisits == 1 ? '' : 's'}',
                description: loyaltySummary?.nextTier != null
                    ? 'Seu próximo salto é ${loyaltySummary!.nextTier!.label}.'
                    : 'Continue usando o app para fortalecer sua recorrência.',
                icon: Icons.stacked_line_chart_rounded,
                accent: Color.lerp(branding.primary, Colors.white, 0.14)!,
              ),
              _WalletStageCard(
                eyebrow: 'Recompensas',
                title: rewardsReady > 0
                    ? '$rewardsReady pront${rewardsReady == 1 ? 'a' : 'as'} para uso'
                    : 'A carteira está acumulando valor',
                description: rewardsReady > 0
                    ? 'Vale abrir o app antes da próxima reserva para usar isso bem.'
                    : 'Pontos e cashback continuam construindo seu próximo retorno.',
                icon: Icons.card_giftcard_rounded,
                accent: Color.lerp(branding.deep, branding.primary, 0.4)!,
              ),
              _WalletStageCard(
                eyebrow: 'Indicações',
                title: pendingReferrals > 0
                    ? '$pendingReferrals indicação${pendingReferrals == 1 ? '' : 'ões'} em progresso'
                    : 'Canal de indicação pronto',
                description: pendingReferrals > 0
                    ? 'Sua rede já está trabalhando a favor da próxima recompensa.'
                    : 'Compartilhe seu código quando quiser ativar esse motor.',
                icon: Icons.groups_rounded,
                accent: Color.lerp(branding.primary, Colors.white, 0.28)!,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WalletLoadingCard extends StatelessWidget {
  const _WalletLoadingCard({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      borderColor: branding.outline.withValues(alpha: 0.6),
      child: Row(
        children: [
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: branding.deep,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text('Buscando seus lançamentos mais recentes...'),
          ),
        ],
      ),
    );
  }
}

class _WalletEmptyCard extends StatelessWidget {
  const _WalletEmptyCard({
    required this.title,
    required this.message,
    required this.branding,
  });

  final String title;
  final String message;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: branding.outline.withValues(alpha: 0.58),
      gradient: LinearGradient(
        colors: [
          branding.primary.withValues(alpha: 0.08),
          Colors.white.withValues(alpha: 0.96),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.86),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.auto_awesome_rounded, color: branding.deep),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(message, style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _LoyaltyTransactionCard extends StatelessWidget {
  const _LoyaltyTransactionCard({
    required this.transaction,
    required this.branding,
  });

  final LoyaltyTransactionItem transaction;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final dateLabel = DateFormat(
      'dd MMM • HH:mm',
      'pt_BR',
    ).format(transaction.createdAt);

    return SoftCard(
      padding: const EdgeInsets.all(18),
      borderColor: branding.outline.withValues(alpha: 0.72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: transaction.isRedemption
                      ? const Color(0xFFFCE9E6)
                      : branding.primary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  transaction.isRedemption
                      ? Icons.shopping_bag_outlined
                      : transaction.isVisitReward
                      ? Icons.stars_rounded
                      : Icons.tune_rounded,
                  color: transaction.isRedemption
                      ? const Color(0xFF9A3A24)
                      : branding.deep,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      transaction.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${transaction.kindLabel} • $dateLabel',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.mutedText,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (transaction.pointsDelta != 0)
                _DeltaChip(
                  label:
                      '${transaction.pointsDelta > 0 ? '+' : ''}${transaction.pointsDelta} pts',
                  positive: transaction.pointsDelta > 0,
                ),
              if (transaction.cashbackDelta != 0)
                _DeltaChip(
                  label:
                      '${transaction.cashbackDelta > 0 ? '+' : ''}${NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(transaction.cashbackDelta)}',
                  positive: transaction.cashbackDelta > 0,
                ),
              if (transaction.completedVisitDelta != 0)
                _DeltaChip(
                  label:
                      '${transaction.completedVisitDelta > 0 ? '+' : ''}${transaction.completedVisitDelta} visita${transaction.completedVisitDelta.abs() == 1 ? '' : 's'}',
                  positive: transaction.completedVisitDelta > 0,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            transaction.isRedemption
                ? 'Movimento que reduziu saldo ou consumiu um benefício da sua carteira.'
                : 'Movimento que fortaleceu sua carteira e ajuda no próximo retorno ao salão.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: branding.mutedText,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroMetricTile extends StatelessWidget {
  const _HeroMetricTile({
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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            dark
                ? Colors.white.withValues(alpha: 0.12)
                : Colors.white.withValues(alpha: 0.9),
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
              : branding.outline.withValues(alpha: 0.62),
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
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: dark
                  ? Colors.white.withValues(alpha: 0.74)
                  : branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: dark ? Colors.white : branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _WalletStageCard extends StatelessWidget {
  const _WalletStageCard({
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
    return Container(
      width: 238,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.white, accent.withValues(alpha: 0.14)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: accent.withValues(alpha: 0.26)),
      ),
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
    );
  }
}

class _DeltaChip extends StatelessWidget {
  const _DeltaChip({required this.label, required this.positive});

  final String label;
  final bool positive;

  @override
  Widget build(BuildContext context) {
    final background = positive
        ? const Color(0xFFE8F5EC)
        : const Color(0xFFFBEAE6);
    final foreground = positive
        ? const Color(0xFF216B38)
        : const Color(0xFF9A3A24);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}
