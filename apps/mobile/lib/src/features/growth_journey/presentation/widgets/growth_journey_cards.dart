import 'package:flutter/material.dart';

import '../../application/growth_journey_builder.dart';

class GrowthScreenView extends StatelessWidget {
  const GrowthScreenView({super.key, required this.screen});

  final GrowthScreenDefinition screen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
      children: [
        _GrowthHeroCard(screen: screen),
        const SizedBox(height: 16),
        for (final block in screen.blocks) ...[
          _GrowthBlockCard(block: block),
          const SizedBox(height: 14),
        ],
        Text(
          'CTA principal da tela: ${screen.primaryCtaLabel}',
          style: theme.textTheme.bodySmall?.copyWith(
            color: const Color(0xFF735A4A),
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _GrowthHeroCard extends StatelessWidget {
  const _GrowthHeroCard({required this.screen});

  final GrowthScreenDefinition screen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFFFFF2E8), Color(0xFFF6E1D3)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: const Color(0xFFE6CDBF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            screen.title,
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: const Color(0xFF2F211A),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            screen.subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              height: 1.45,
              color: const Color(0xFF6C5547),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () {},
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF9F4C26),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            ),
            child: Text(screen.primaryCtaLabel),
          ),
        ],
      ),
    );
  }
}

class _GrowthBlockCard extends StatelessWidget {
  const _GrowthBlockCard({required this.block});

  final GrowthUiBlock block;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tone = _toneColors(block.tone);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tone.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                block.eyebrow,
                style: theme.textTheme.labelMedium?.copyWith(
                  color: tone.accent,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              if (block.highlight != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.74),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: tone.border),
                  ),
                  child: Text(
                    block.highlight!,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF2F211A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            block.title,
            style: theme.textTheme.titleLarge?.copyWith(
              color: const Color(0xFF2D221C),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            block.summary,
            style: theme.textTheme.bodyMedium?.copyWith(
              height: 1.45,
              color: const Color(0xFF55433A),
            ),
          ),
          const SizedBox(height: 14),
          _GrowthMetadataRow(label: 'Purpose', value: block.purpose),
          const SizedBox(height: 10),
          _GrowthMetadataRow(label: 'Logic', value: block.logic),
          if (block.supportingCopy != null) ...[
            const SizedBox(height: 10),
            _GrowthMetadataRow(label: 'Support', value: block.supportingCopy!),
          ],
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: () {},
            style: OutlinedButton.styleFrom(
              foregroundColor: tone.accent,
              side: BorderSide(color: tone.border),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            child: Text(block.ctaLabel),
          ),
        ],
      ),
    );
  }
}

class _GrowthMetadataRow extends StatelessWidget {
  const _GrowthMetadataRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelMedium?.copyWith(
            color: const Color(0xFF8A6B59),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: const Color(0xFF3F3028),
            height: 1.45,
          ),
        ),
      ],
    );
  }
}

({Color background, Color border, Color accent}) _toneColors(
  GrowthBlockTone tone,
) {
  switch (tone) {
    case GrowthBlockTone.brand:
      return (
        background: const Color(0xFFFFF8F3),
        border: const Color(0xFFECCFBE),
        accent: const Color(0xFF9F4C26),
      );
    case GrowthBlockTone.success:
      return (
        background: const Color(0xFFF4FBF7),
        border: const Color(0xFFCFE4D8),
        accent: const Color(0xFF2E7D5A),
      );
    case GrowthBlockTone.warning:
      return (
        background: const Color(0xFFFFF8EE),
        border: const Color(0xFFE9D7B5),
        accent: const Color(0xFF9A6A12),
      );
    case GrowthBlockTone.neutral:
      return (
        background: const Color(0xFFFFFFFF),
        border: const Color(0xFFE5DDD7),
        accent: const Color(0xFF6F5A4E),
      );
  }
}
