import 'package:flutter/material.dart';

import '../../../../models/app_models.dart';
import '../../../../theme/salon_branding.dart';
import '../../../../widgets/premium_surface_card.dart';
import '../../domain/retention_v1_models.dart';

class RetentionV1HomeBlock extends StatefulWidget {
  const RetentionV1HomeBlock({
    super.key,
    required this.profile,
    required this.branding,
    required this.model,
    required this.onPrimaryAction,
    this.onSecondaryAction,
    this.onImpression,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final RetentionV1HomeModel model;
  final VoidCallback onPrimaryAction;
  final VoidCallback? onSecondaryAction;
  final VoidCallback? onImpression;

  @override
  State<RetentionV1HomeBlock> createState() => _RetentionV1HomeBlockState();
}

class _RetentionV1HomeBlockState extends State<RetentionV1HomeBlock> {
  bool _impressionSent = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _impressionSent) {
        return;
      }

      _impressionSent = true;
      widget.onImpression?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PremiumSurfaceCard(
      tone: widget.model.highlightReward
          ? PremiumSurfaceTone.accent
          : PremiumSurfaceTone.secondary,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.profile.salonName,
            style: theme.textTheme.labelLarge?.copyWith(
              color: widget.model.highlightReward
                  ? Colors.white
                  : widget.branding.deep,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            widget.model.eyebrow,
            style: theme.textTheme.bodySmall?.copyWith(
              color: widget.model.highlightReward
                  ? Colors.white.withValues(alpha: 0.82)
                  : widget.branding.mutedText,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            widget.model.title,
            style: theme.textTheme.headlineSmall?.copyWith(
              color: widget.model.highlightReward
                  ? Colors.white
                  : widget.branding.deep,
              fontWeight: FontWeight.w900,
              height: 1.08,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            widget.model.body,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: widget.model.highlightReward
                  ? Colors.white.withValues(alpha: 0.84)
                  : widget.branding.mutedText,
              height: 1.45,
            ),
          ),
          if (widget.model.pills.isNotEmpty) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: widget.model.pills
                  .map(
                    (pill) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: widget.model.highlightReward
                            ? Colors.white.withValues(alpha: 0.12)
                            : widget.branding.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: widget.model.highlightReward
                              ? Colors.white.withValues(alpha: 0.18)
                              : widget.branding.outline.withValues(alpha: 0.48),
                        ),
                      ),
                      child: Text(
                        pill.label,
                        style: theme.textTheme.labelMedium?.copyWith(
                          color: widget.model.highlightReward
                              ? Colors.white
                              : widget.branding.deep,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: widget.onPrimaryAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: widget.model.highlightReward
                        ? Colors.white
                        : widget.branding.deep,
                    foregroundColor: widget.model.highlightReward
                        ? widget.branding.deep
                        : Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                  ),
                  child: Text(widget.model.primaryCtaLabel),
                ),
              ),
              if (widget.model.secondaryCtaLabel != null &&
                  widget.onSecondaryAction != null) ...[
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: widget.onSecondaryAction,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: widget.model.highlightReward
                        ? Colors.white
                        : widget.branding.deep,
                    side: BorderSide(
                      color: widget.model.highlightReward
                          ? Colors.white.withValues(alpha: 0.3)
                          : widget.branding.outline,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 15,
                    ),
                  ),
                  child: Text(widget.model.secondaryCtaLabel!),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
