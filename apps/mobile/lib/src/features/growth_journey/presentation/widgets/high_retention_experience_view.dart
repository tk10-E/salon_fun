import 'package:flutter/material.dart';

import '../../domain/high_retention_experience_models.dart';

class HighRetentionHomeExperienceView extends StatelessWidget {
  const HighRetentionHomeExperienceView({super.key, required this.model});

  final HighRetentionHomeModel model;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                child: HighRetentionHomeSectionGroup(
                  model: model,
                  showHeader: true,
                  onIntent: (_) {},
                ),
              ),
            ),
          ],
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 18,
          child: SafeArea(
            top: false,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF241711), Color(0xFF9E4D27)],
                ),
                borderRadius: BorderRadius.circular(22),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x33241711),
                    blurRadius: 26,
                    offset: Offset(0, 14),
                  ),
                ],
              ),
              child: Material(
                type: MaterialType.transparency,
                child: InkWell(
                  borderRadius: BorderRadius.circular(22),
                  onTap: () {},
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 16,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            model.stickyCta.label,
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class HighRetentionHomeSectionGroup extends StatelessWidget {
  const HighRetentionHomeSectionGroup({
    super.key,
    required this.model,
    this.showHeader = false,
    this.sectionLimit,
    this.onIntent,
  });

  final HighRetentionHomeModel model;
  final bool showHeader;
  final int? sectionLimit;
  final ValueChanged<String>? onIntent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sections = sectionLimit == null
        ? model.sections
        : model.sections.take(sectionLimit!).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showHeader) ...[
          Text(
            model.greeting,
            style: theme.textTheme.labelLarge?.copyWith(
              color: const Color(0xFF8A6550),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            model.headerTitle,
            style: theme.textTheme.headlineMedium?.copyWith(
              color: const Color(0xFF2D2019),
              fontWeight: FontWeight.w800,
              height: 1.08,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            model.headerBody,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF6A5345),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 22),
        ],
        for (var index = 0; index < sections.length; index += 1) ...[
          _ExperienceSectionCard(section: sections[index], onIntent: onIntent),
          if (index != sections.length - 1) const SizedBox(height: 16),
        ],
      ],
    );
  }
}

class HighRetentionBookingExperienceView extends StatelessWidget {
  const HighRetentionBookingExperienceView({super.key, required this.model});

  final HighRetentionBookingFlowModel model;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      children: [
        Text(
          model.headline,
          style: theme.textTheme.headlineSmall?.copyWith(
            color: const Color(0xFF2C211B),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 18),
        _BookingMetaCard(
          eyebrow: 'Servico preselecionado',
          title: model.serviceLabel,
        ),
        const SizedBox(height: 14),
        _BookingMetaCard(
          eyebrow: 'Profissional preferida',
          title: model.professionalLabel,
        ),
        const SizedBox(height: 14),
        Text(
          'Horarios ranqueados para voce',
          style: theme.textTheme.titleMedium?.copyWith(
            color: const Color(0xFF2C211B),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        for (final slot in model.slots) ...[
          _RankedSlotCard(slot: slot),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF241711),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                model.summaryTitle,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                model.summaryBody,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.84),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {},
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFE5A073),
                    foregroundColor: const Color(0xFF241711),
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                  child: Text(model.confirmAction.label),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ExperienceSectionCard extends StatelessWidget {
  const _ExperienceSectionCard({required this.section, this.onIntent});

  final HighRetentionSectionModel section;
  final ValueChanged<String>? onIntent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = _palette(section.tone);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: palette.gradient,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: palette.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.eyebrow,
            style: theme.textTheme.labelMedium?.copyWith(
              color: palette.accent,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            section.title,
            style: theme.textTheme.titleLarge?.copyWith(
              color: palette.title,
              fontWeight: FontWeight.w800,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            section.body,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: palette.body,
              height: 1.5,
            ),
          ),
          if (section.chips.isNotEmpty) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: section.chips
                  .map(
                    (chip) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.68),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: palette.border),
                      ),
                      child: Text(
                        chip,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: palette.title,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (section.meta != null) ...[
            const SizedBox(height: 12),
            Text(
              section.meta!,
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.body.withValues(alpha: 0.86),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () => onIntent?.call(section.primaryAction.intent),
                  style: FilledButton.styleFrom(
                    backgroundColor: palette.button,
                    foregroundColor: palette.buttonText,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(section.primaryAction.label),
                ),
              ),
              if (section.secondaryAction != null) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () =>
                        onIntent?.call(section.secondaryAction!.intent),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: palette.accent,
                      side: BorderSide(color: palette.border),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(section.secondaryAction!.label),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _BookingMetaCard extends StatelessWidget {
  const _BookingMetaCard({required this.eyebrow, required this.title});

  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE7D8CD)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: theme.textTheme.labelMedium?.copyWith(
              color: const Color(0xFF8D684F),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              color: const Color(0xFF2C211B),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _RankedSlotCard extends StatelessWidget {
  const _RankedSlotCard({required this.slot});

  final RankedBookingSlot slot;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: slot.isBest ? const Color(0xFFFFF4EA) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: slot.isBest
              ? const Color(0xFFE4BF9E)
              : const Color(0xFFE7D8CD),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  slot.title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: const Color(0xFF2C211B),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (slot.isBest)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF241711),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Melhor para voce',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            slot.reason,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF654E40),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

({
  LinearGradient gradient,
  Color border,
  Color accent,
  Color title,
  Color body,
  Color button,
  Color buttonText,
})
_palette(HighRetentionSectionTone tone) {
  switch (tone) {
    case HighRetentionSectionTone.hero:
      return (
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF2E9), Color(0xFFF2D6C2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: const Color(0xFFE3C5B0),
        accent: const Color(0xFF9C4B26),
        title: const Color(0xFF2C211B),
        body: const Color(0xFF5E4A3D),
        button: const Color(0xFF241711),
        buttonText: Colors.white,
      );
    case HighRetentionSectionTone.accent:
      return (
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFFFF), Color(0xFFF7F1EC)],
        ),
        border: const Color(0xFFE7D8CD),
        accent: const Color(0xFF85583D),
        title: const Color(0xFF2C211B),
        body: const Color(0xFF5E4A3D),
        button: const Color(0xFFE5A073),
        buttonText: const Color(0xFF241711),
      );
    case HighRetentionSectionTone.reward:
      return (
        gradient: const LinearGradient(
          colors: [Color(0xFFF8FBEF), Color(0xFFEAF1D4)],
        ),
        border: const Color(0xFFD1DEC0),
        accent: const Color(0xFF517440),
        title: const Color(0xFF243019),
        body: const Color(0xFF45563C),
        button: const Color(0xFF2E5C39),
        buttonText: Colors.white,
      );
    case HighRetentionSectionTone.urgency:
      return (
        gradient: const LinearGradient(
          colors: [Color(0xFFFFF7EF), Color(0xFFFFE4CC)],
        ),
        border: const Color(0xFFE6C7A1),
        accent: const Color(0xFF9A6810),
        title: const Color(0xFF342618),
        body: const Color(0xFF6A5032),
        button: const Color(0xFF9A4A1F),
        buttonText: Colors.white,
      );
    case HighRetentionSectionTone.quiet:
      return (
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFFFF), Color(0xFFF8F4F1)],
        ),
        border: const Color(0xFFE7DCD4),
        accent: const Color(0xFF765D50),
        title: const Color(0xFF2C211B),
        body: const Color(0xFF5E4A3D),
        button: const Color(0xFFF1E6DE),
        buttonText: const Color(0xFF241711),
      );
  }
}
