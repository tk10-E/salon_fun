import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import '../theme/salon_experience_preset.dart';

class SalonHeroCard extends StatelessWidget {
  const SalonHeroCard({
    super.key,
    required this.profile,
    required this.branding,
    required this.subtitle,
    this.logoUrl,
    this.metrics = const <SalonHeroMetric>[],
    this.compact = false,
    required this.onWhatsApp,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final String subtitle;
  final String? logoUrl;
  final List<SalonHeroMetric> metrics;
  final bool compact;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = _initials(profile.salonName);
    final preset = SalonExperiencePreset.fromBusinessSegment(
      profile.salonBusinessSegment,
    );
    final outerPadding = compact
        ? const EdgeInsets.fromLTRB(18, 18, 18, 20)
        : const EdgeInsets.fromLTRB(22, 22, 22, 24);
    final badgePadding = compact
        ? const EdgeInsets.symmetric(horizontal: 10, vertical: 6)
        : const EdgeInsets.symmetric(horizontal: 12, vertical: 8);
    final avatarSize = compact ? 72.0 : 84.0;

    return Container(
      decoration: BoxDecoration(
        gradient: branding.heroGradient,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: branding.deep.withValues(alpha: 0.18),
            blurRadius: 34,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -36,
            right: -22,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.09),
              ),
            ),
          ),
          Positioned(
            right: 26,
            top: 38,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),
          Padding(
            padding: outerPadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (compact)
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Olá, ${profile.name}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.78),
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      _HeroMetaPill(
                        icon: preset.segmentIcon,
                        label: preset.label,
                        compact: true,
                      ),
                    ],
                  )
                else
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _HeroMetaPill(
                        label: 'Olá, ${profile.name}',
                        padding: badgePadding,
                      ),
                      _HeroMetaPill(
                        icon: preset.segmentIcon,
                        label: preset.label,
                        padding: badgePadding,
                      ),
                    ],
                  ),
                SizedBox(height: compact ? 14 : 18),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _HeroAvatar(
                      branding: branding,
                      initials: initials,
                      logoUrl: logoUrl,
                      size: avatarSize,
                    ),
                    SizedBox(width: compact ? 14 : 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile.salonName,
                            style:
                                (compact
                                        ? theme.textTheme.headlineSmall
                                        : theme.textTheme.headlineMedium)
                                    ?.copyWith(
                                      color: branding.onPrimary,
                                      height: 1.04,
                                    ),
                          ),
                          SizedBox(height: compact ? 8 : 10),
                          Text(
                            subtitle,
                            maxLines: compact ? 3 : 4,
                            overflow: TextOverflow.ellipsis,
                            style:
                                (compact
                                        ? theme.textTheme.bodyMedium
                                        : theme.textTheme.bodyLarge)
                                    ?.copyWith(
                                      color: Colors.white.withValues(
                                        alpha: 0.9,
                                      ),
                                      height: compact ? 1.36 : 1.42,
                                    ),
                          ),
                          SizedBox(height: compact ? 8 : 10),
                          Text(
                            preset.heroSupportLine,
                            maxLines: compact ? 2 : 3,
                            overflow: TextOverflow.ellipsis,
                            style:
                                (compact
                                        ? theme.textTheme.bodySmall
                                        : theme.textTheme.bodyMedium)
                                    ?.copyWith(
                                      color: Colors.white.withValues(
                                        alpha: 0.76,
                                      ),
                                      fontWeight: FontWeight.w700,
                                    ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (metrics.isNotEmpty) ...[
                  SizedBox(height: compact ? 14 : 18),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: metrics
                        .map(
                          (metric) => _HeroMetricChip(
                            metric: metric,
                            branding: branding,
                            compact: compact,
                          ),
                        )
                        .toList(),
                  ),
                ],
                SizedBox(height: compact ? 16 : 22),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    FilledButton.icon(
                      onPressed: onWhatsApp,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: branding.deep,
                        minimumSize: Size(0, compact ? 46 : 50),
                      ),
                      icon: const FaIcon(FontAwesomeIcons.whatsapp, size: 18),
                      label: const Text('Falar com o salão'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SalonHeroMetric {
  const SalonHeroMetric({required this.label, required this.value, this.icon});

  final String label;
  final String value;
  final IconData? icon;
}

class _HeroMetaPill extends StatelessWidget {
  const _HeroMetaPill({
    required this.label,
    this.icon,
    this.padding,
    this.compact = false,
  });

  final String label;
  final IconData? icon;
  final EdgeInsetsGeometry? padding;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          padding ??
          EdgeInsets.symmetric(
            horizontal: compact ? 10 : 12,
            vertical: compact ? 6 : 8,
          ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: compact ? 0.12 : 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: compact ? 14 : 16, color: Colors.white),
            SizedBox(width: compact ? 6 : 8),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.white.withValues(alpha: compact ? 0.92 : 1),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroAvatar extends StatelessWidget {
  const _HeroAvatar({
    required this.branding,
    required this.initials,
    required this.size,
    this.logoUrl,
  });

  final SalonBranding branding;
  final String initials;
  final double size;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final trimmedLogoUrl = logoUrl?.trim();

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.84),
          width: size >= 80 ? 5 : 4,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: ClipOval(
        child: trimmedLogoUrl != null && trimmedLogoUrl.isNotEmpty
            ? Image.network(
                trimmedLogoUrl,
                width: size - 10,
                height: size - 10,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _AvatarFallback(
                  branding: branding,
                  initials: initials,
                  size: size - 10,
                  style: theme.textTheme.headlineSmall,
                ),
              )
            : _AvatarFallback(
                branding: branding,
                initials: initials,
                size: size - 10,
                style: theme.textTheme.headlineSmall,
              ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({
    required this.branding,
    required this.initials,
    required this.size,
    required this.style,
  });

  final SalonBranding branding;
  final String initials;
  final double size;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      color: Colors.white,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: style?.copyWith(
          color: branding.deep,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _HeroMetricChip extends StatelessWidget {
  const _HeroMetricChip({
    required this.metric,
    required this.branding,
    required this.compact,
  });

  final SalonHeroMetric metric;
  final SalonBranding branding;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (compact) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (metric.icon != null) ...[
              Icon(metric.icon, size: 14, color: Colors.white),
              const SizedBox(width: 7),
            ],
            Text(
              metric.label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.76),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.52),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              metric.value,
              style: theme.textTheme.labelLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: compact
          ? const EdgeInsets.symmetric(horizontal: 12, vertical: 10)
          : const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (metric.icon != null) ...[
                Icon(metric.icon, size: 15, color: branding.onPrimary),
                const SizedBox(width: 8),
              ],
              Text(
                metric.label,
                style:
                    (compact
                            ? theme.textTheme.labelSmall
                            : theme.textTheme.labelMedium)
                        ?.copyWith(
                          color: Colors.white.withValues(alpha: 0.82),
                          fontWeight: FontWeight.w700,
                        ),
              ),
            ],
          ),
          SizedBox(height: compact ? 4 : 6),
          Text(
            metric.value,
            style:
                (compact
                        ? theme.textTheme.titleSmall
                        : theme.textTheme.titleMedium)
                    ?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
          ),
        ],
      ),
    );
  }
}

String _initials(String name) {
  final parts = name
      .split(RegExp(r'\s+'))
      .where((part) => part.trim().isNotEmpty)
      .toList();

  if (parts.isEmpty) {
    return 'SF';
  }

  if (parts.length == 1) {
    return parts.first.characters.take(2).toString().toUpperCase();
  }

  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
