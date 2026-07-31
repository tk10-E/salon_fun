import 'package:flutter/material.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import '../notifications/customer_notifications_controller.dart';
import '../shared/app_models.dart';

class LoyaltyPage extends StatefulWidget {
  const LoyaltyPage({
    super.key,
    required this.bootstrap,
    required this.notificationsController,
    required this.session,
    required this.customer,
    this.initialSummary,
  });

  final AppBootstrap bootstrap;
  final CustomerNotificationsController notificationsController;
  final AppSession session;
  final CustomerProfile customer;
  final LoyaltySummary? initialSummary;

  @override
  State<LoyaltyPage> createState() => _LoyaltyPageState();
}

class _LoyaltyPageState extends State<LoyaltyPage> {
  LoyaltySummary? _summary;
  List<CustomerLoyaltyTransaction> _transactions =
      const <CustomerLoyaltyTransaction>[];
  bool _loading = true;
  late int _lastBenefitsRevision;

  @override
  void initState() {
    super.initState();
    _summary = widget.initialSummary;
    _loading = widget.initialSummary == null;
    _lastBenefitsRevision = widget.notificationsController.benefitsRevision;
    widget.notificationsController.addListener(_handleBenefitsChange);
    _load();
  }

  @override
  void didUpdateWidget(covariant LoyaltyPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.notificationsController != widget.notificationsController) {
      oldWidget.notificationsController.removeListener(_handleBenefitsChange);
      _lastBenefitsRevision = widget.notificationsController.benefitsRevision;
      widget.notificationsController.addListener(_handleBenefitsChange);
    }
  }

  @override
  void dispose() {
    widget.notificationsController.removeListener(_handleBenefitsChange);
    super.dispose();
  }

  void _handleBenefitsChange() {
    final revision = widget.notificationsController.benefitsRevision;
    if (_lastBenefitsRevision == revision) {
      return;
    }

    _lastBenefitsRevision = revision;
    _load();
  }

  Future<void> _load() async {
    final showLoading = _summary == null && _transactions.isEmpty;
    if (mounted && showLoading) {
      setState(() => _loading = true);
    }

    final summaryFallback = _summary;
    final transactionsFallback = _transactions;
    final results = await Future.wait<dynamic>([
      _safeLoad(
        widget.bootstrap.profileRepository.fetchLoyaltySummary,
        summaryFallback,
      ),
      _safeLoad(
        () => widget.bootstrap.profileRepository.fetchLoyaltyTransactions(
          customerId: widget.customer.id,
        ),
        transactionsFallback,
      ),
    ]);

    if (!mounted) {
      return;
    }

    setState(() {
      _summary = results[0] as LoyaltySummary?;
      _transactions = results[1] as List<CustomerLoyaltyTransaction>;
      _loading = false;
    });
  }

  Future<T> _safeLoad<T>(Future<T> Function() loader, T fallback) async {
    try {
      return await loader();
    } catch (_) {
      return fallback;
    }
  }

  @override
  Widget build(BuildContext context) {
    final preview = widget.session.landingData?.preview;
    final accent = parseHexColor(preview?.brandColor);
    final summary = _summary;
    final program = summary?.program;
    final currentTier = summary?.currentTier;
    final nextTier = summary?.nextTier;
    final tiers = program?.tiers ?? const <LoyaltyTierSnapshot>[];
    final progress = _resolveTierProgress(summary);
    final rankLabel = _buildRankLabel(summary);
    final progressLabel = _buildProgressLabel(summary);
    final overviewDescription = sentenceOrFallback(
      program?.description,
      program == null
          ? 'Quando o salão ativar o programa, esta área mostra saldo, níveis, cashback e o extrato em tempo real.'
          : program.isActive
          ? 'O programa está ativo e o app acompanha os ganhos reais do seu histórico.'
          : 'O salão configurou o programa, mas ele está pausado no painel no momento.',
    );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(title: const Text('Clube de fidelidade')),
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl:
            preview?.profileCoverImageUrl ?? preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                SalonPanel(
                  accent: accent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          Pill(
                            label: program == null
                                ? 'Aguardando programa'
                                : program.isActive
                                ? 'Programa ativo'
                                : 'Programa pausado',
                            icon: program == null
                                ? Icons.hourglass_bottom_rounded
                                : program.isActive
                                ? Icons.workspace_premium_rounded
                                : Icons.pause_circle_outline_rounded,
                            backgroundColor: program == null
                                ? AppTheme.accent.withValues(alpha: 0.18)
                                : program.isActive
                                ? AppTheme.secondary.withValues(alpha: 0.16)
                                : AppTheme.primary.withValues(alpha: 0.14),
                            foregroundColor: program == null
                                ? AppTheme.ink
                                : program.isActive
                                ? AppTheme.secondary
                                : AppTheme.primary,
                          ),
                          Pill(
                            label: currentTier?.label ?? 'Base',
                            icon: currentTier?.isVip == true
                                ? Icons.auto_awesome_rounded
                                : Icons.verified_rounded,
                            backgroundColor: accent.withValues(alpha: 0.12),
                            foregroundColor: accent,
                          ),
                          if (program?.vipRewardServiceName
                                  ?.trim()
                                  .isNotEmpty ==
                              true)
                            Pill(
                              label:
                                  'VIP libera ${program!.vipRewardServiceName!}',
                              icon: Icons.card_giftcard_rounded,
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        program?.title ?? 'Fidelidade do salão',
                        style: Theme.of(
                          context,
                        ).textTheme.displaySmall?.copyWith(fontSize: 31),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        overviewDescription,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                _LoyaltyGrid(
                  children: [
                    SurfaceMetricCard(
                      icon: Icons.stars_rounded,
                      label: 'Pontos ativos',
                      value: '${summary?.pointsBalance ?? 0}',
                      support:
                          'Total ganho: ${summary?.totalPointsEarned ?? 0}',
                      tone: accent,
                    ),
                    SurfaceMetricCard(
                      icon: Icons.savings_rounded,
                      label: 'Cashback real',
                      value: formatCurrency(summary?.cashbackBalance ?? 0),
                      support:
                          'Total acumulado: ${formatCurrency(summary?.totalCashbackEarned ?? 0)}',
                      tone: AppTheme.secondary,
                    ),
                    SurfaceMetricCard(
                      icon: Icons.military_tech_rounded,
                      label: 'Sua posição',
                      value: rankLabel,
                      support: progressLabel,
                      tone: AppTheme.primary,
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                SalonPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionTitle(
                        title: 'Ritmo da sua carteira',
                        subtitle:
                            'O app soma apenas dados reais vindos dos atendimentos concluídos e lançamentos do painel.',
                        trailing: Pill(
                          label: '${summary?.completedVisits ?? 0} visitas',
                          icon: Icons.event_available_rounded,
                        ),
                      ),
                      const SizedBox(height: 16),
                      _LoyaltyProgressCard(
                        progress: progress,
                        currentTierLabel: currentTier?.label ?? 'Base',
                        nextTierLabel: nextTier?.label,
                        visitsToNextTier: summary?.visitsToNextTier ?? 0,
                        lastRewardAt: summary?.lastRewardAt,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                SalonPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionTitle(
                        title: 'Regras do programa',
                        subtitle:
                            'Essas regras vêm do painel do salão e atualizam em tempo real no seu app.',
                      ),
                      const SizedBox(height: 16),
                      _LoyaltyGrid(
                        children: [
                          SurfaceMetricCard(
                            icon: Icons.checklist_rounded,
                            label: 'Pontos por visita',
                            value: '${program?.pointsPerVisit ?? 0}',
                            support:
                                'Cada atendimento concluído soma esse valor na sua carteira.',
                            tone: AppTheme.secondary,
                          ),
                          SurfaceMetricCard(
                            icon: Icons.percent_rounded,
                            label: 'Cashback por visita',
                            value: _formatPercent(
                              program?.cashbackPercent ?? 0,
                            ),
                            support:
                                'O saldo entra conforme a configuração real do programa.',
                            tone: accent,
                          ),
                          SurfaceMetricCard(
                            icon: Icons.card_giftcard_rounded,
                            label: 'Recompensa VIP',
                            value:
                                program?.vipRewardServiceName ??
                                'Sem bonus extra',
                            support:
                                'Quando existir recompensa especial, ela aparece aqui.',
                            tone: AppTheme.primary,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (tiers.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  SalonPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SectionTitle(
                          title: 'Escada de niveis',
                          subtitle:
                              'Cada etapa mostra a visita minima e o desconto progressivo liberado.',
                        ),
                        const SizedBox(height: 16),
                        for (final tier in tiers) ...[
                          _LoyaltyTierTile(
                            tier: tier,
                            accent: accent,
                            isCurrent: tier.label == currentTier?.label,
                            isNext: tier.label == nextTier?.label,
                            completedVisits: summary?.completedVisits ?? 0,
                          ),
                          if (tier != tiers.last) const SizedBox(height: 12),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                SalonPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionTitle(
                        title: 'Historico recente',
                        subtitle:
                            'Toda movimentação aparece aqui para você conferir o que entrou e o que foi usado.',
                        trailing: Pill(
                          label: '${_transactions.length} itens',
                          icon: Icons.receipt_long_rounded,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_loading && summary == null && _transactions.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (_transactions.isEmpty)
                        Text(
                          'Assim que houver atendimento concluído ou ajuste do salão, o extrato aparece aqui.',
                          style: Theme.of(context).textTheme.bodySmall,
                        )
                      else
                        Column(
                          children: [
                            for (final transaction in _transactions) ...[
                              _LoyaltyTransactionTile(transaction: transaction),
                              if (transaction != _transactions.last)
                                const SizedBox(height: 12),
                            ],
                          ],
                        ),
                    ],
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

double _resolveTierProgress(LoyaltySummary? summary) {
  if (summary == null) {
    return 0;
  }

  final currentMinVisits = summary.currentTier?.minVisits ?? 0;
  final nextMinVisits = summary.nextTier?.minVisits;
  if (nextMinVisits == null || nextMinVisits <= currentMinVisits) {
    return 1;
  }

  final completedWithinBand = summary.completedVisits.clamp(
    currentMinVisits,
    nextMinVisits,
  );
  final band = nextMinVisits - currentMinVisits;
  if (band <= 0) {
    return 1;
  }

  return (completedWithinBand - currentMinVisits) / band;
}

String _buildRankLabel(LoyaltySummary? summary) {
  if (summary?.rankPosition != null && (summary?.rankedCustomers ?? 0) > 0) {
    return '${summary!.rankPosition}º';
  }

  return 'Base';
}

String _buildProgressLabel(LoyaltySummary? summary) {
  if (summary == null) {
    return 'Seu ranking aparece assim que houver movimento na carteira.';
  }

  if (summary.rankedCustomers <= 0 || summary.rankPosition == null) {
    return 'Assim que houver pontos ou visitas, sua posição aparece aqui.';
  }

  return '${summary.rankPosition}º de ${summary.rankedCustomers} clientes ranqueados.';
}

String _formatPercent(num value) {
  final normalized = value.toDouble();
  final label = normalized == normalized.roundToDouble()
      ? normalized.toStringAsFixed(0)
      : normalized.toStringAsFixed(1);
  return '$label%';
}

class _LoyaltyGrid extends StatelessWidget {
  const _LoyaltyGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final columns = width >= 900
            ? 3
            : width >= 520
            ? 2
            : 1;
        final spacing = 12.0;
        final itemWidth = columns == 1
            ? width
            : (width - (spacing * (columns - 1))) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              SizedBox(width: itemWidth, child: child),
          ],
        );
      },
    );
  }
}

class _LoyaltyProgressCard extends StatelessWidget {
  const _LoyaltyProgressCard({
    required this.progress,
    required this.currentTierLabel,
    required this.nextTierLabel,
    required this.visitsToNextTier,
    required this.lastRewardAt,
  });

  final double progress;
  final String currentTierLabel;
  final String? nextTierLabel;
  final int visitsToNextTier;
  final DateTime? lastRewardAt;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final theme = Theme.of(context);
    final reachedTop = nextTierLabel == null || visitsToNextTier <= 0;
    final progressValue = progress.clamp(0, 1).toDouble();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: spec.panelColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: spec.lineColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  reachedTop
                      ? 'Você já está no topo do programa.'
                      : 'Faltam $visitsToNextTier visitas para $nextTierLabel.',
                  style: theme.textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: 12),
              Pill(
                label: currentTierLabel,
                icon: Icons.workspace_premium_rounded,
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progressValue,
              minHeight: 12,
              backgroundColor: spec.lineColor.withValues(alpha: 0.7),
              valueColor: AlwaysStoppedAnimation<Color>(spec.primaryColor),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            reachedTop
                ? 'Continue concluindo atendimentos para manter o ritmo e acumular cashback.'
                : 'Cada visita concluída aproxima seu app do próximo nível liberado no painel.',
            style: theme.textTheme.bodySmall,
          ),
          if (lastRewardAt != null) ...[
            const SizedBox(height: 12),
            Text(
              'Última entrada registrada em ${formatCompactDateTime(lastRewardAt!)}.',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ],
      ),
    );
  }
}

class _LoyaltyTierTile extends StatelessWidget {
  const _LoyaltyTierTile({
    required this.tier,
    required this.accent,
    required this.isCurrent,
    required this.isNext,
    required this.completedVisits,
  });

  final LoyaltyTierSnapshot tier;
  final Color accent;
  final bool isCurrent;
  final bool isNext;
  final int completedVisits;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final theme = Theme.of(context);
    final unlocked = completedVisits >= tier.minVisits;
    final highlightColor = isCurrent
        ? spec.secondaryColor
        : isNext
        ? accent
        : spec.inkColor;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: spec.panelColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isCurrent || isNext
              ? highlightColor.withValues(alpha: 0.34)
              : spec.lineColor,
          width: isCurrent || isNext ? 1.4 : 1,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ToneIconBadge(
            icon: tier.isVip
                ? Icons.auto_awesome_rounded
                : Icons.workspace_premium_rounded,
            tone: highlightColor,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(tier.label, style: theme.textTheme.titleMedium),
                    if (isCurrent)
                      Pill(
                        label: 'Atual',
                        icon: Icons.check_circle_rounded,
                        backgroundColor: spec.secondaryColor.withValues(
                          alpha: 0.14,
                        ),
                        foregroundColor: spec.secondaryColor,
                      ),
                    if (isNext)
                      Pill(
                        label: 'Proximo',
                        icon: Icons.flag_rounded,
                        backgroundColor: accent.withValues(alpha: 0.12),
                        foregroundColor: accent,
                      ),
                    if (tier.isVip && !isCurrent)
                      const Pill(
                        label: 'VIP',
                        icon: Icons.card_giftcard_rounded,
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'Libera a partir de ${tier.minVisits} visitas com ${_formatPercent(tier.discountPercent)} de desconto progressivo.',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Icon(
            unlocked ? Icons.lock_open_rounded : Icons.lock_outline_rounded,
            color: unlocked ? spec.secondaryColor : spec.mutedInkColor,
          ),
        ],
      ),
    );
  }
}

class _LoyaltyTransactionTile extends StatelessWidget {
  const _LoyaltyTransactionTile({required this.transaction});

  final CustomerLoyaltyTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final theme = Theme.of(context);
    final tone = _transactionTone(transaction);
    final professionalName = transaction.staffMemberName?.trim();
    final badges = <Widget>[
      if (transaction.pointsDelta != 0)
        Pill(
          label:
              '${transaction.pointsDelta > 0 ? '+' : ''}${transaction.pointsDelta} pts',
          icon: Icons.stars_rounded,
          backgroundColor: tone.withValues(alpha: 0.12),
          foregroundColor: tone,
        ),
      if (transaction.cashbackDelta != 0)
        Pill(
          label:
              '${transaction.cashbackDelta > 0 ? '+' : ''}${formatCurrency(transaction.cashbackDelta)}',
          icon: Icons.savings_rounded,
          backgroundColor: spec.secondaryColor.withValues(alpha: 0.12),
          foregroundColor: spec.secondaryColor,
        ),
      if (transaction.completedVisitDelta > 0)
        Pill(
          label:
              '${transaction.completedVisitDelta} visita${transaction.completedVisitDelta == 1 ? '' : 's'}',
          icon: Icons.event_available_rounded,
        ),
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: spec.panelColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: spec.lineColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _LoyaltyTransactionArtwork(
                imageUrl: transaction.staffMemberImageUrl,
                icon: _transactionIcon(transaction),
                accent: tone,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _transactionTitle(transaction),
                      style: theme.textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatCompactDateTime(transaction.occurredAt),
                      style: theme.textTheme.bodySmall,
                    ),
                    if (professionalName != null && professionalName.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Com $professionalName',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _transactionSubtitle(transaction),
            style: theme.textTheme.bodySmall,
          ),
          if (badges.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: badges),
          ],
        ],
      ),
    );
  }
}

class _LoyaltyTransactionArtwork extends StatelessWidget {
  const _LoyaltyTransactionArtwork({
    required this.imageUrl,
    required this.icon,
    required this.accent,
  });

  final String? imageUrl;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        width: 52,
        height: 52,
        child: imageUrl?.trim().isNotEmpty == true
            ? SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: BoxFit.cover,
                alignment: kSalonPortraitAvatarAlignment,
                error: _LoyaltyTransactionFallbackArtwork(
                  accent: accent,
                  icon: icon,
                ),
                placeholder: _LoyaltyTransactionFallbackArtwork(
                  accent: accent,
                  icon: icon,
                ),
              )
            : _LoyaltyTransactionFallbackArtwork(accent: accent, icon: icon),
      ),
    );
  }
}

class _LoyaltyTransactionFallbackArtwork extends StatelessWidget {
  const _LoyaltyTransactionFallbackArtwork({
    required this.accent,
    required this.icon,
  });

  final Color accent;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [accent.withValues(alpha: 0.18), AppTheme.panel],
        ),
      ),
      child: Center(child: Icon(icon, color: accent, size: 25)),
    );
  }
}

Color _transactionTone(CustomerLoyaltyTransaction transaction) {
  if (transaction.isCashbackRedemption) {
    return AppTheme.primary;
  }
  if (transaction.isVisitReward) {
    return AppTheme.secondary;
  }
  return AppTheme.accent;
}

IconData _transactionIcon(CustomerLoyaltyTransaction transaction) {
  if (transaction.isCashbackRedemption) {
    return Icons.money_off_rounded;
  }
  if (transaction.isVisitReward) {
    return Icons.content_cut_rounded;
  }
  return Icons.tune_rounded;
}

String _transactionTitle(CustomerLoyaltyTransaction transaction) {
  if (transaction.isVisitReward) {
    return transaction.serviceName ?? 'Atendimento concluido';
  }
  if (transaction.isCashbackRedemption) {
    return 'Resgate de cashback';
  }

  return 'Ajuste do salão';
}

String _transactionSubtitle(CustomerLoyaltyTransaction transaction) {
  final description = transaction.description?.trim();
  if (description != null && description.isNotEmpty) {
    return description;
  }

  if (transaction.isVisitReward) {
    return 'Recompensa automática liberada quando o atendimento foi concluído no salão.';
  }
  if (transaction.isCashbackRedemption) {
    return 'Parte do seu saldo foi usada no caixa do salão.';
  }

  return 'O salão registrou um ajuste manual na sua carteira.';
}
