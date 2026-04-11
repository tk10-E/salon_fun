import 'package:flutter/material.dart';

import '../../features/shared/app_models.dart';
import '../utils/formatters.dart';
import 'salon_ui.dart';

class SalonBrandHero extends StatelessWidget {
  const SalonBrandHero({
    super.key,
    required this.preview,
    this.accent,
    this.greeting,
    this.eyebrow,
    this.title,
    this.description,
    this.supportLine,
    this.joinCode,
    this.extraPills = const <Widget>[],
    this.bottom,
    this.imageHeight = 190,
    this.showImage = true,
    this.showRating = true,
  });

  final SalonPreview? preview;
  final Color? accent;
  final String? greeting;
  final String? eyebrow;
  final String? title;
  final String? description;
  final String? supportLine;
  final String? joinCode;
  final List<Widget> extraPills;
  final Widget? bottom;
  final double imageHeight;
  final bool showImage;
  final bool showRating;

  @override
  Widget build(BuildContext context) {
    final resolvedAccent = accent ?? parseHexColor(preview?.brandColor);
    final resolvedEyebrow = sentenceOrFallback(
      eyebrow,
      preview?.segmentLabel ?? 'Seu salão',
    );
    final resolvedTitle = sentenceOrFallback(
      title,
      preview?.heroHeadline ??
          preview?.welcomeHeadline ??
          preview?.appDisplayName ??
          preview?.name ??
          'Seu salão no app',
    );
    final resolvedDescription = sentenceOrFallback(
      description,
      preview?.welcomeMessage ??
          preview?.promotionHeadline ??
          preview?.tagline ??
          'Agenda, vitrine e relacionamento do salão em um só lugar.',
    );
    final resolvedSupportLine =
        _normalizeText(supportLine) ?? _normalizeText(preview?.heroSupportLine);
    final resolvedJoinCode = _normalizeText(joinCode);
    final resolvedImageUrl = _firstNonEmpty(<String?>[
      preview?.heroImageUrl,
      preview?.galleryCoverImageUrl,
      preview?.profileCoverImageUrl,
      preview?.shareImageUrl,
      preview?.logoUrl,
    ]);
    final resolvedLogoUrl = _normalizeText(preview?.logoUrl);
    final shouldOverlayLogo =
        resolvedLogoUrl != null && resolvedLogoUrl != resolvedImageUrl;
    final pillWidgets = <Widget>[
      Pill(
        label: resolvedEyebrow,
        backgroundColor: resolvedAccent.withValues(alpha: 0.12),
        foregroundColor: resolvedAccent,
        icon: Icons.auto_awesome_rounded,
      ),
      if (showRating && preview?.ratingValue != null)
        Pill(
          label: '${preview!.ratingValue!.toStringAsFixed(1)} de avaliação',
          icon: Icons.star_rounded,
        ),
      if (resolvedJoinCode != null)
        Pill(label: 'Código $resolvedJoinCode', icon: Icons.dialpad_rounded),
      ...extraPills,
    ];

    return SalonPanel(
      accent: resolvedAccent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (pillWidgets.isNotEmpty)
            Wrap(spacing: 8, runSpacing: 8, children: pillWidgets),
          if (greeting != null) ...[
            const SizedBox(height: 18),
            Text(greeting!, style: Theme.of(context).textTheme.bodySmall),
          ],
          const SizedBox(height: 8),
          Text(resolvedTitle, style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 10),
          Text(
            resolvedDescription,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if (resolvedSupportLine != null) ...[
            const SizedBox(height: 10),
            Text(
              resolvedSupportLine,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          if (showImage) ...[
            const SizedBox(height: 18),
            Stack(
              children: [
                NetworkCardImage(
                  imageUrl: resolvedImageUrl,
                  height: imageHeight,
                ),
                if (shouldOverlayLogo)
                  Positioned(
                    left: 14,
                    bottom: 14,
                    child: _HeroLogoBadge(
                      imageUrl: resolvedLogoUrl,
                      accent: resolvedAccent,
                    ),
                  ),
              ],
            ),
          ],
          if (bottom != null) ...[const SizedBox(height: 16), bottom!],
        ],
      ),
    );
  }
}

class _HeroLogoBadge extends StatelessWidget {
  const _HeroLogoBadge({required this.imageUrl, required this.accent});

  final String imageUrl;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            width: 52,
            height: 52,
            child: Image.network(
              imageUrl,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return DecoratedBox(
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                  ),
                  child: Icon(
                    Icons.storefront_rounded,
                    color: accent,
                    size: 24,
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

String? _firstNonEmpty(Iterable<String?> values) {
  for (final value in values) {
    final normalized = _normalizeText(value);
    if (normalized != null) {
      return normalized;
    }
  }
  return null;
}

String? _normalizeText(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }
  return normalized;
}
