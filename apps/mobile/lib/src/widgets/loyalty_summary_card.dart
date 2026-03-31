import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class LoyaltySummaryCard extends StatelessWidget {
  const LoyaltySummaryCard({
    super.key,
    required this.summary,
    required this.branding,
  });

  final CustomerLoyaltySummary summary;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final program = summary.program;
    final currentTier = summary.currentTier;
    final nextTier = summary.nextTier;
    final cashbackLabel = NumberFormat.currency(
      locale: 'pt_BR',
      symbol: 'R\$',
    ).format(summary.cashbackBalance);
    final pointsPerVisit = program?.pointsPerVisit ?? 0;
    final cashbackPercent = _percentLabel(program?.cashbackPercent ?? 0);
    final currentDiscountLabel = _percentLabel(
      currentTier?.discountPercent ?? 0,
    );
    final vipRewardServiceName = program?.vipRewardServiceName?.trim();
    final hasVipRewardService =
        vipRewardServiceName != null && vipRewardServiceName.isNotEmpty;

    return SoftCard(
      padding: const EdgeInsets.all(20),
      borderColor: branding.outline.withValues(alpha: 0.72),
      gradient: LinearGradient(
        colors: [
          branding.primary.withValues(alpha: 0.16),
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
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.86),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.workspace_premium_rounded,
                  color: branding.deep,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      program?.title ?? 'Clube de fidelidade',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      summary.isVip
                          ? hasVipRewardService
                                ? 'Você já está no nível mais alto e liberou $vipRewardServiceName.'
                                : 'Você já está no nível mais alto do salão.'
                          : currentTier == null
                          ? 'A cada visita concluída você sobe de nível.'
                          : 'Seu nível atual é ${currentTier.label}.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              if (summary.isVip)
                _BadgeChip(
                  label: currentTier?.label ?? 'VIP',
                  background: branding.deep,
                  foreground: Colors.white,
                )
              else if (currentTier != null &&
                  currentTier.minVisits > 0 &&
                  currentTier.discountPercent > 0)
                _BadgeChip(
                  label: '${currentTier.label} • $currentDiscountLabel%',
                  background: Colors.white.withValues(alpha: 0.9),
                  foreground: branding.deep,
                ),
            ],
          ),
          if (program?.description?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Text(
              program!.description!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF715A4C),
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.82),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.62),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  summary.rankPosition == null
                      ? 'Comece a pontuar para entrar no ranking do salão.'
                      : summary.rankedCustomers <= 1
                      ? 'Você lidera o ranking de fidelidade do salão.'
                      : 'Você está em ${summary.rankPosition}º lugar entre ${summary.rankedCustomers} clientes ranqueados.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  summary.isVip
                      ? hasVipRewardService
                            ? 'Seu desconto progressivo atual é de $currentDiscountLabel% e o salão também libera $vipRewardServiceName como benefício do nível máximo.'
                            : 'Seu desconto progressivo atual é de $currentDiscountLabel% e o cashback segue acumulando a cada visita.'
                      : currentTier != null && currentTier.discountPercent > 0
                      ? 'Seu desconto progressivo atual é de $currentDiscountLabel% no próximo atendimento.'
                      : 'Cada visita concluída soma $pointsPerVisit pontos e gera $cashbackPercent% de cashback.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF715A4C),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _MetricBox(
                  label: 'Pontos',
                  value: '${summary.pointsBalance}',
                  branding: branding,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricBox(
                  label: 'Visitas',
                  value: '${summary.completedVisits}',
                  branding: branding,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricBox(
                  label: 'Cashback',
                  value: cashbackLabel,
                  branding: branding,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: branding.deep.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.58),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.auto_graph_rounded, color: branding.deep),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    nextTier == null
                        ? hasVipRewardService
                              ? 'Você já desbloqueou o nível máximo do programa. Continue acumulando pontos e cashback nas próximas visitas enquanto mantém $vipRewardServiceName como benefício especial do salão.'
                              : 'Você já desbloqueou o nível máximo do programa. Continue acumulando pontos e cashback nas próximas visitas.'
                        : nextTier.isVip && hasVipRewardService
                        ? 'Faltam ${summary.visitsToNextTier} visita${summary.visitsToNextTier == 1 ? '' : 's'} para chegar em ${nextTier.label}, manter ${_percentLabel(nextTier.discountPercent)}% de desconto e liberar $vipRewardServiceName no app.'
                        : 'Faltam ${summary.visitsToNextTier} visita${summary.visitsToNextTier == 1 ? '' : 's'} para chegar em ${nextTier.label} e liberar ${_percentLabel(nextTier.discountPercent)}% de desconto.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w700,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (program != null && program.tiers.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'Escada de benefícios',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: program.tiers.map((tier) {
                final isCurrent =
                    currentTier != null && currentTier.label == tier.label;
                final isUnlocked = summary.completedVisits >= tier.minVisits;

                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isCurrent
                        ? branding.deep
                        : isUnlocked
                        ? Colors.white.withValues(alpha: 0.88)
                        : Colors.white.withValues(alpha: 0.58),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: isCurrent
                          ? branding.deep
                          : branding.outline.withValues(alpha: 0.62),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tier.label,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: isCurrent ? Colors.white : branding.deep,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${tier.minVisits}+ visitas • ${_percentLabel(tier.discountPercent)}%',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: isCurrent
                              ? Colors.white.withValues(alpha: 0.9)
                              : const Color(0xFF715A4C),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }

  String _percentLabel(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toStringAsFixed(1).replaceAll('.', ',');
  }
}

class _MetricBox extends StatelessWidget {
  const _MetricBox({
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
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: const Color(0xFF715A4C),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: foreground.withValues(alpha: 0.12)),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelMedium?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
