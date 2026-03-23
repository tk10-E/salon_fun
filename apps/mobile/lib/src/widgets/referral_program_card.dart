import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'soft_card.dart';

class ReferralProgramCard extends StatelessWidget {
  const ReferralProgramCard({
    super.key,
    required this.summary,
    required this.branding,
    required this.onCopyCode,
  });

  final ReferralSummary summary;
  final SalonBranding branding;
  final VoidCallback onCopyCode;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final program = summary.program;
    final hasSummaryContent =
        summary.referralCode.trim().isNotEmpty ||
        summary.pendingCount > 0 ||
        summary.qualifiedCount > 0 ||
        summary.referrals.isNotEmpty ||
        summary.rewardUnlocks.isNotEmpty ||
        summary.unlockedRewardsCount > 0;

    if (program == null && !hasSummaryContent) {
      return const SizedBox.shrink();
    }

    final title = program?.title ?? 'Indique e ganhe';
    final rewardForReferrer =
        program?.rewardForReferrer ??
        'A recompensa aparece aqui quando a meta de indicações validadas é atingida.';
    final rewardForInvited = program?.rewardForInvited;
    final description = program?.description?.trim();
    final hasDescription = description != null && description.isNotEmpty;
    final rewardTarget = summary.requiredQualifiedReferrals;
    final cycleProgress = rewardTarget > 0
        ? summary.currentCycleProgress.clamp(0, rewardTarget)
        : summary.currentCycleProgress;
    final progressRatio = rewardTarget > 0 ? cycleProgress / rewardTarget : 0.0;
    final rewardHeadline = program?.rewardServiceName?.trim().isNotEmpty == true
        ? program!.rewardServiceName!
        : rewardForReferrer;
    final rewardPreview = program?.rewardServiceName?.trim().isNotEmpty == true
        ? '${program!.rewardServiceName} configurado como recompensa principal.'
        : rewardForReferrer;
    final invitationRule = rewardTarget == 1
        ? 'Cada indicação concluída já libera 1 recompensa.'
        : 'Cada bloco de $rewardTarget indicações validadas libera 1 recompensa do salão.';
    final highlightText = summary.availableRewardsCount > 0
        ? summary.availableRewardsCount == 1
              ? 'Você tem 1 recompensa liberada aguardando uso no salão.'
              : 'Você tem ${summary.availableRewardsCount} recompensas liberadas aguardando uso no salão.'
        : summary.unlockedRewardsCount > 0
        ? summary.unlockedRewardsCount == 1
              ? 'Você já completou 1 ciclo de indicação.'
              : 'Você já completou ${summary.unlockedRewardsCount} ciclos de indicação.'
        : null;
    final progressText = summary.availableRewardsCount > 0 && cycleProgress == 0
        ? 'Meta concluída. Agora é só apresentar seu resgate no salão.'
        : summary.nextRewardRemaining <= 0
        ? 'Sua próxima recompensa está pronta para liberar.'
        : summary.nextRewardRemaining == 1
        ? 'Falta 1 indicação validada para liberar a próxima recompensa.'
        : 'Faltam ${summary.nextRewardRemaining} indicações validadas para liberar a próxima recompensa.';
    final progressTitle = rewardTarget == 1
        ? 'A cada indicação validada'
        : 'A cada $rewardTarget indicações validadas';
    final rewardUnlocks = summary.rewardUnlocks.take(3).toList();

    return SoftCard(
      padding: const EdgeInsets.all(20),
      borderColor: branding.outline.withValues(alpha: 0.72),
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
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.86),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(Icons.card_giftcard_rounded, color: branding.deep),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      summary.referralCode.trim().isEmpty
                          ? 'Seu código aparece aqui quando o salão ativa a campanha.'
                          : 'Seu código exclusivo: ${summary.referralCode}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: branding.deep,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (highlightText != null) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: branding.deep.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: branding.outline.withValues(alpha: 0.52),
                ),
              ),
              child: Text(
                highlightText,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: branding.deep,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
          if (hasDescription) ...[
            const SizedBox(height: 16),
            Text(
              description,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF715A4C),
              ),
            ),
          ],
          const SizedBox(height: 18),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.84),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: branding.outline.withValues(alpha: 0.58),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  progressTitle,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  rewardHeadline,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: branding.deep,
                  ),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progressRatio.clamp(0, 1),
                    minHeight: 12,
                    backgroundColor: const Color(0xFFF1E4D7),
                    valueColor: AlwaysStoppedAnimation<Color>(branding.deep),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  '$cycleProgress/$rewardTarget validadas neste ciclo',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  progressText,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF715A4C),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _RewardLine(
            icon: Icons.workspace_premium_rounded,
            title: 'Recompensa principal do programa',
            body: rewardPreview,
            branding: branding,
          ),
          const SizedBox(height: 12),
          _RewardLine(
            icon: Icons.rule_folder_rounded,
            title: 'Quando a indicação realmente conta',
            body:
                '$invitationRule O sistema só valida depois que a pessoa entra com o código, agenda e conclui o primeiro atendimento.',
            branding: branding,
          ),
          if (rewardForInvited?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 12),
            _RewardLine(
              icon: Icons.favorite_border_rounded,
              title: 'Para quem entra com o seu código',
              body: rewardForInvited!,
              branding: branding,
            ),
          ],
          const SizedBox(height: 18),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              SizedBox(
                width: 146,
                child: _MetricBox(
                  label: 'Pendentes',
                  value: '${summary.pendingCount}',
                  branding: branding,
                ),
              ),
              SizedBox(
                width: 146,
                child: _MetricBox(
                  label: 'Validadas',
                  value: '${summary.qualifiedCount}',
                  branding: branding,
                ),
              ),
              SizedBox(
                width: 146,
                child: _MetricBox(
                  label: 'Liberadas',
                  value: '${summary.unlockedRewardsCount}',
                  branding: branding,
                ),
              ),
              SizedBox(
                width: 146,
                child: _MetricBox(
                  label: 'Disponíveis',
                  value: '${summary.availableRewardsCount}',
                  branding: branding,
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: onCopyCode,
              icon: const Icon(Icons.copy_rounded),
              label: const Text('Copiar código de indicação'),
            ),
          ),
          if (rewardUnlocks.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'Recompensas já liberadas',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            ...rewardUnlocks.map(
              (reward) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _RewardUnlockRow(reward: reward, branding: branding),
              ),
            ),
          ],
          if (summary.referrals.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'Andamento das suas últimas indicações',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            ...summary.referrals
                .take(3)
                .map(
                  (referral) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ReferralStatusRow(
                      referral: referral,
                      branding: branding,
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _RewardLine extends StatelessWidget {
  const _RewardLine({
    required this.icon,
    required this.title,
    required this.body,
    required this.branding,
  });

  final IconData icon;
  final String title;
  final String body;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.55)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: branding.deep),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF715A4C),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.88),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF7A6658),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontSize: 30,
              color: branding.deep,
            ),
          ),
        ],
      ),
    );
  }
}

class _RewardUnlockRow extends StatelessWidget {
  const _RewardUnlockRow({required this.reward, required this.branding});

  final ReferralRewardUnlockItem reward;
  final SalonBranding branding;

  String _formatShortDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day/$month/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isRedeemed = reward.status == 'redeemed';
    final statusColor = isRedeemed
        ? const Color(0xFF7A6658)
        : const Color(0xFF2E6B4B);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.74),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.48)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: branding.deep.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Icon(Icons.workspace_premium_rounded, color: branding.deep),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  reward.rewardServiceName ?? reward.rewardDescription,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Liberada em ${_formatShortDate(reward.unlockedAt)} depois de ${reward.thresholdReached} indicações validadas.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF7A6658),
                  ),
                ),
                if (reward.rewardServiceName != null &&
                    reward.rewardDescription != reward.rewardServiceName) ...[
                  const SizedBox(height: 4),
                  Text(
                    reward.rewardDescription,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF7A6658),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              isRedeemed ? 'Usada' : 'Liberada',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: statusColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReferralStatusRow extends StatelessWidget {
  const _ReferralStatusRow({required this.referral, required this.branding});

  final ReferralProgressItem referral;
  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isQualified = referral.status == 'qualified';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.74),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.outline.withValues(alpha: 0.48)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  referral.customerName,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isQualified
                      ? 'Atendimento concluído e indicação validada.'
                      : 'Baixou o app e entrou no salão. Falta concluir o atendimento.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF7A6658),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isQualified
                  ? const Color(0x1F2E6B4B)
                  : branding.highlightBackground,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              isQualified ? 'Validada' : 'Pendente',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: isQualified ? const Color(0xFF2E6B4B) : branding.deep,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
