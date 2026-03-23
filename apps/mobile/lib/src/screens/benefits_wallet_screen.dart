import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
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
      appBar: AppBar(title: const Text('Minha carteira')),
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
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                children: [
                  _WalletHero(
                    profile: widget.profile,
                    branding: _branding,
                    loyaltySummary: _loyaltySummary,
                    referralSummary: _referralSummary,
                    isRefreshing: _isRefreshingSummaries,
                  ),
                  const SizedBox(height: 20),
                  if (_loyaltySummary?.hasVisibleContent == true) ...[
                    LoyaltySummaryCard(
                      summary: _loyaltySummary!,
                      branding: _branding,
                    ),
                    const SizedBox(height: 20),
                  ] else
                    _WalletEmptyCard(
                      branding: _branding,
                      title: 'Seu clube de fidelidade ainda está vazio',
                      message:
                          'Assim que visitas concluídas começarem a gerar pontos e cashback, o saldo vai aparecer aqui.',
                    ),
                  if (_referralSummary?.hasVisibleContent == true) ...[
                    ReferralProgramCard(
                      summary: _referralSummary!,
                      branding: _branding,
                      onCopyCode: () {
                        unawaited(
                          _copyReferralCode(_referralSummary!.referralCode),
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                  ],
                  Text(
                    'Extrato recente',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: _branding.deep,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Veja quando pontos, cashback e visitas foram lançados na sua carteira.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: _branding.mutedText,
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
    final focusTitle = referralSummary?.availableRewardsCount != null &&
            referralSummary!.availableRewardsCount > 0
        ? 'Você já tem recompensa pronta para usar'
        : loyaltySummary?.visitsToNextTier == 1
        ? 'Falta só uma visita para subir de nível'
        : (loyaltySummary?.cashbackBalance ?? 0) > 0
        ? 'Seu cashback já pode ajudar no próximo retorno'
        : 'Sua carteira já trabalha retenção a seu favor';
    final focusMessage = referralSummary?.availableRewardsCount != null &&
            referralSummary!.availableRewardsCount > 0
        ? 'Abra a carteira sempre que for marcar a próxima visita e alinhe com o salão a melhor forma de usar esse benefício.'
        : loyaltySummary?.visitsToNextTier == 1
        ? 'Manter sua frequência agora pode puxar mais desconto, cashback e posição melhor no ranking do salão.'
        : (loyaltySummary?.cashbackBalance ?? 0) > 0
        ? 'Seu saldo já está disponível para entrar na decisão da próxima reserva com mais inteligência.'
        : 'Pontos, indicações e visitas começam a aparecer aqui conforme sua relação com o salão evolui.';

    return SoftCard(
      padding: const EdgeInsets.all(22),
      borderColor: branding.outline.withValues(alpha: 0.76),
      gradient: LinearGradient(
        colors: [
          branding.primary.withValues(alpha: 0.18),
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
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.86),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.account_balance_wallet_rounded,
                  color: branding.deep,
                  size: 28,
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
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pontos, cashback e vantagens que você já acumulou em ${profile.salonName}.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (isRefreshing)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: branding.deep,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 18),
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
              ),
              _HeroChip(
                label: 'Cashback $cashbackLabel',
                branding: branding,
                icon: Icons.savings_rounded,
              ),
              if (referralCode != null && referralCode.isNotEmpty)
                _HeroChip(
                  label: 'Código $referralCode',
                  branding: branding,
                  icon: Icons.card_giftcard_rounded,
                ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _HeroMetricTile(
                  label: 'Pontos',
                  value: '${loyaltySummary?.pointsBalance ?? 0}',
                  branding: branding,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroMetricTile(
                  label: 'Visitas',
                  value: '${loyaltySummary?.completedVisits ?? 0}',
                  branding: branding,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _HeroMetricTile(
                  label: 'Prêmios',
                  value: '${referralSummary?.availableRewardsCount ?? 0}',
                  branding: branding,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  focusTitle,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  focusMessage,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.mutedText,
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

class _HeroChip extends StatelessWidget {
  const _HeroChip({
    required this.label,
    required this.branding,
    required this.icon,
  });

  final String label;
  final SalonBranding branding;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: branding.outline.withValues(alpha: 0.68)),
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
  });

  final String label;
  final String value;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.62)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
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
