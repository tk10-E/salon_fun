import 'package:flutter/material.dart';

import '../widgets/premium_ui.dart';

class TrustDocumentSection {
  const TrustDocumentSection({required this.title, required this.body});

  final String title;
  final String body;
}

class TrustDocumentScreen extends StatefulWidget {
  const TrustDocumentScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.eyebrow,
    required this.sections,
    this.primaryAction,
    this.primaryActionLabel,
    this.primaryActionIcon,
  });

  final String title;
  final String subtitle;
  final String eyebrow;
  final List<TrustDocumentSection> sections;
  final Future<void> Function()? primaryAction;
  final String? primaryActionLabel;
  final IconData? primaryActionIcon;

  @override
  State<TrustDocumentScreen> createState() => _TrustDocumentScreenState();
}

class _TrustDocumentScreenState extends State<TrustDocumentScreen> {
  bool _isSubmitting = false;

  Future<void> _handlePrimaryAction() async {
    final action = widget.primaryAction;
    if (action == null || _isSubmitting) {
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await action();
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(widget.title),
      ),
      body: PremiumBackground(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: ListView(
          padding: const EdgeInsets.only(bottom: 20),
          children: [
            HeroImagePanel(
              height: 260,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      widget.eyebrow,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    widget.title,
                    style: Theme.of(
                      context,
                    ).textTheme.displaySmall?.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    widget.subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.86),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SectionHeader(
                    title: 'Leitura clara',
                    subtitle:
                        'Uma visão objetiva para a cliente entender como o app funciona, cuida dos dados e abre canal de suporte.',
                  ),
                  const SizedBox(height: 18),
                  for (
                    var index = 0;
                    index < widget.sections.length;
                    index++
                  ) ...[
                    _DocumentSectionCard(section: widget.sections[index]),
                    if (index != widget.sections.length - 1)
                      const SizedBox(height: 14),
                  ],
                  if (widget.primaryAction != null &&
                      widget.primaryActionLabel != null) ...[
                    const SizedBox(height: 18),
                    FilledButton.icon(
                      onPressed: _isSubmitting ? null : _handlePrimaryAction,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                              ),
                            )
                          : Icon(
                              widget.primaryActionIcon ??
                                  Icons.support_agent_rounded,
                            ),
                      label: Text(widget.primaryActionLabel!),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DocumentSectionCard extends StatelessWidget {
  const _DocumentSectionCard({required this.section});

  final TrustDocumentSection section;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: 0.24),
        ),
        color: Theme.of(context).cardColor.withValues(alpha: 0.48),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(section.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(section.body, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
