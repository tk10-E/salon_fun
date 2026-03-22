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
        summary.referrals.isNotEmpty;

    if (program == null && !hasSummaryContent) {
      return const SizedBox.shrink();
    }

    final title = program?.title ?? 'Indique e ganhe';
    final rewardForReferrer =
        program?.rewardForReferrer ??
        'Seu benefício aparece aqui assim que a indicação conclui a primeira visita.';
    final rewardForInvited = program?.rewardForInvited;
    final description = program?.description?.trim();
    final hasDescription = description != null && description.isNotEmpty;
    final unlockedReferrals = summary.referrals
        .where((referral) => referral.status == 'qualified')
        .length;
    final highlightText = unlockedReferrals > 0
        ? unlockedReferrals == 1
              ? 'Você já liberou 1 indicação com visita concluída.'
              : 'Você já liberou $unlockedReferrals indicações com visita concluída.'
        : null;

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
                      'Seu código exclusivo: ${summary.referralCode}',
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
          _RewardLine(
            icon: Icons.workspace_premium_rounded,
            title: 'Quando sua indicação conclui a visita',
            body: rewardForReferrer,
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
          Row(
            children: [
              Expanded(
                child: _MetricBox(
                  label: 'Pendentes',
                  value: '${summary.pendingCount}',
                  branding: branding,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricBox(
                  label: 'Validadas',
                  value: '${summary.qualifiedCount}',
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
          if (summary.referrals.isNotEmpty) ...[
            const SizedBox(height: 18),
            Text(
              'Andamento das suas últimas indicações',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            ...summary.referrals.take(3).map(
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

class _ReferralStatusRow extends StatelessWidget {
  const _ReferralStatusRow({
    required this.referral,
    required this.branding,
  });

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
