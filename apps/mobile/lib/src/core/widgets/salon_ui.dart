import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AppGradientBackground extends StatelessWidget {
  const AppGradientBackground({
    super.key,
    required this.child,
    this.accentColor,
    this.backgroundImageUrl,
    this.bannerStyle,
  });

  final Widget child;
  final Color? accentColor;
  final String? backgroundImageUrl;
  final String? bannerStyle;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final tone = accentColor ?? spec.primaryColor;
    final activeBannerStyle = bannerStyle ?? spec.bannerStyle;
    final overlayOpacity = switch (activeBannerStyle) {
      'immersive' => 0.26,
      'spotlight' => 0.2,
      _ => 0.14,
    };
    final tailColor = Color.lerp(spec.backgroundColor, spec.panelColor, 0.5)!;
    return DecoratedBox(
      decoration: BoxDecoration(color: spec.backgroundColor),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (backgroundImageUrl != null &&
              backgroundImageUrl!.trim().isNotEmpty)
            Image.network(
              backgroundImageUrl!,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) =>
                  const SizedBox.shrink(),
            ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  tone.withValues(alpha: overlayOpacity),
                  spec.backgroundColor,
                  tailColor,
                ],
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class SalonPanel extends StatelessWidget {
  const SalonPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
    this.accent,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final theme = Theme.of(context);
    final isGlass = spec.cardStyle == 'glass';
    final isOutlined = spec.cardStyle == 'outlined';
    final panelColor = isGlass
        ? spec.panelColor.withValues(
            alpha: theme.brightness == Brightness.dark ? 0.76 : 0.82,
          )
        : spec.panelColor.withValues(alpha: 0.96);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: panelColor,
        borderRadius: BorderRadius.circular(AppTheme.panelRadius),
        border: Border.all(
          color: isGlass
              ? spec.lineColor.withValues(alpha: 0.72)
              : spec.lineColor,
          width: isOutlined ? 1.25 : 1,
        ),
        boxShadow: isOutlined
            ? const []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isGlass ? 0.06 : 0.05),
                  blurRadius: isGlass ? 34 : 30,
                  offset: const Offset(0, 16),
                ),
              ],
        gradient: accent == null
            ? null
            : LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  panelColor,
                  accent!.withValues(alpha: isGlass ? 0.12 : 0.08),
                ],
              ),
      ),
      child: child,
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: theme.textTheme.titleLarge),
              const SizedBox(height: 6),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({
    super.key,
    required this.label,
    this.backgroundColor,
    this.foregroundColor,
    this.icon,
  });

  final String label;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final bg = backgroundColor ?? spec.secondaryColor.withValues(alpha: 0.08);
    final fg = foregroundColor ?? spec.secondaryColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: foregroundColor?.withValues(alpha: 0.08) ?? spec.lineColor,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class ToneIconBadge extends StatelessWidget {
  const ToneIconBadge({
    super.key,
    required this.icon,
    required this.tone,
    this.size = 42,
  });

  final IconData icon;
  final Color tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(15),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: tone, size: size * 0.48),
    );
  }
}

class SurfaceMetricCard extends StatelessWidget {
  const SurfaceMetricCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.support,
    required this.tone,
    this.minHeight = 156,
  });

  final IconData icon;
  final String label;
  final String value;
  final String support;
  final Color tone;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    return Container(
      constraints: BoxConstraints(minHeight: minHeight),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: spec.panelColor,
        borderRadius: BorderRadius.circular(AppTheme.cardRadius),
        border: Border.all(color: spec.lineColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ToneIconBadge(icon: icon, tone: tone),
          const SizedBox(height: 14),
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Text(
            support,
            style: Theme.of(context).textTheme.bodySmall,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    this.support,
  });

  final String label;
  final String value;
  final String? support;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: spec.panelColor,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: spec.lineColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: theme.textTheme.bodySmall),
            const SizedBox(height: 10),
            Text(value, style: theme.textTheme.titleLarge),
            if (support != null) ...[
              const SizedBox(height: 4),
              Text(support!, style: theme.textTheme.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

class AsyncButton extends StatelessWidget {
  const AsyncButton({
    super.key,
    required this.label,
    required this.isBusy,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final bool isBusy;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: isBusy ? null : onPressed,
      child: isBusy
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.2),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                ],
                Text(label),
              ],
            ),
    );
  }
}

class NetworkCardImage extends StatelessWidget {
  const NetworkCardImage({
    super.key,
    required this.imageUrl,
    required this.height,
    this.borderRadius = 24,
    this.fit = BoxFit.cover,
  });

  final String? imageUrl;
  final double height;
  final double borderRadius;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        height: height,
        width: double.infinity,
        child: imageUrl == null || imageUrl!.isEmpty
            ? DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      spec.primaryColor.withValues(alpha: 0.22),
                      spec.secondaryColor.withValues(alpha: 0.14),
                    ],
                  ),
                ),
                child: Center(
                  child: Icon(
                    Icons.auto_awesome_rounded,
                    size: 28,
                    color: spec.inkColor.withValues(alpha: 0.66),
                  ),
                ),
              )
            : Image.network(
                imageUrl!,
                fit: fit,
                errorBuilder: (context, error, stackTrace) {
                  return DecoratedBox(
                    decoration: BoxDecoration(color: spec.lineColor),
                    child: Center(
                      child: Text(
                        'Imagem indisponível',
                        style: theme.textTheme.bodySmall,
                      ),
                    ),
                  );
                },
                loadingBuilder: (context, child, progress) {
                  if (progress == null) {
                    return child;
                  }

                  return DecoratedBox(
                    decoration: BoxDecoration(color: spec.lineColor),
                    child: const Center(
                      child: CircularProgressIndicator(strokeWidth: 2.4),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

class EmptyStateCard extends StatelessWidget {
  const EmptyStateCard({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.layers_clear_rounded,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final spec = AppTheme.spec(context);
    return SalonPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: spec.primaryColor),
          const SizedBox(height: 14),
          Text(title, style: theme.textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(message, style: theme.textTheme.bodySmall),
        ],
      ),
    );
  }
}
