import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

const kSalonPortraitAvatarAlignment = Alignment(0, -0.68);

double salonBottomActionInset(BuildContext context, {double base = 20}) {
  final mediaQuery = MediaQuery.of(context);
  return base +
      math.max(mediaQuery.viewInsets.bottom, mediaQuery.viewPadding.bottom);
}

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
    final hasBackgroundImage =
        backgroundImageUrl != null && backgroundImageUrl!.trim().isNotEmpty;
    final overlayOpacity = switch (activeBannerStyle) {
      'immersive' => 0.34,
      'spotlight' => 0.28,
      _ => 0.18,
    };
    final middleOverlayOpacity = hasBackgroundImage
        ? switch (activeBannerStyle) {
            'immersive' => 0.82,
            'spotlight' => 0.86,
            _ => 0.9,
          }
        : 1.0;
    final tailOverlayOpacity = hasBackgroundImage
        ? switch (activeBannerStyle) {
            'immersive' => 0.96,
            'spotlight' => 0.97,
            _ => 0.985,
          }
        : 1.0;
    final tailColor = Color.lerp(spec.backgroundColor, spec.panelColor, 0.5)!;
    return LayoutBuilder(
      builder: (context, constraints) {
        final devicePixelRatio =
            MediaQuery.maybeDevicePixelRatioOf(context) ?? 1;
        final cacheWidth =
            constraints.maxWidth.isFinite && constraints.maxWidth > 0
            ? (constraints.maxWidth * devicePixelRatio).round()
            : null;
        final cacheHeight =
            constraints.maxHeight.isFinite && constraints.maxHeight > 0
            ? (constraints.maxHeight * devicePixelRatio).round()
            : null;
        final strengthenedOverlayOpacity = hasBackgroundImage
            ? switch (activeBannerStyle) {
                'immersive' => 0.44,
                'spotlight' => 0.36,
                _ => 0.24,
              }
            : overlayOpacity;
        final strengthenedMiddleOverlayOpacity = hasBackgroundImage
            ? switch (activeBannerStyle) {
                'immersive' => 0.88,
                'spotlight' => 0.90,
                _ => 0.94,
              }
            : middleOverlayOpacity;

        return DecoratedBox(
          decoration: BoxDecoration(color: spec.backgroundColor),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (hasBackgroundImage)
                Image.network(
                  backgroundImageUrl!,
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  filterQuality: FilterQuality.high,
                  isAntiAlias: true,
                  gaplessPlayback: true,
                  cacheWidth: cacheWidth,
                  cacheHeight: cacheHeight,
                  errorBuilder: (context, error, stackTrace) =>
                      const SizedBox.shrink(),
                ),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0, 0.46, 1],
                    colors: [
                      tone.withValues(alpha: strengthenedOverlayOpacity),
                      spec.backgroundColor.withValues(
                        alpha: strengthenedMiddleOverlayOpacity,
                      ),
                      tailColor.withValues(alpha: tailOverlayOpacity),
                    ],
                  ),
                ),
              ),
              child,
            ],
          ),
        );
      },
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
            alpha: theme.brightness == Brightness.dark ? 0.94 : 0.985,
          )
        : spec.panelColor.withValues(alpha: 0.992);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: panelColor,
        borderRadius: BorderRadius.circular(AppTheme.panelRadius),
        border: Border.all(
          color: isGlass
              ? spec.lineColor.withValues(alpha: 0.88)
              : spec.lineColor,
          width: isOutlined ? 1.25 : 1,
        ),
        boxShadow: isOutlined
            ? const []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isGlass ? 0.08 : 0.05),
                  blurRadius: isGlass ? 30 : 30,
                  offset: const Offset(0, 14),
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
    final isGlass = spec.cardStyle == 'glass';
    final bg =
        backgroundColor ??
        (isGlass
            ? spec.panelColor.withValues(alpha: 0.92)
            : spec.secondaryColor.withValues(alpha: 0.08));
    final fg =
        foregroundColor ??
        (isGlass ? spec.inkColor.withValues(alpha: 0.9) : spec.secondaryColor);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color:
              foregroundColor?.withValues(alpha: 0.08) ??
              (isGlass
                  ? spec.lineColor.withValues(alpha: 0.92)
                  : spec.lineColor),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: fg),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
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
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                ],
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
    );
  }
}

int? _resolveSalonImageCacheExtent(
  double extent, {
  required double devicePixelRatio,
  required double scale,
  required int maxPixels,
}) {
  if (!extent.isFinite || extent <= 0) {
    return null;
  }

  final scaledExtent = (extent * devicePixelRatio * scale).round();
  return math.max(48, math.min(maxPixels, scaledExtent));
}

class SalonNetworkImage extends StatelessWidget {
  const SalonNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.backgroundColor,
    this.placeholder,
    this.error,
    this.cacheScale = 1.12,
    this.maxCacheWidth = 2048,
    this.maxCacheHeight = 2048,
    this.onError,
  });

  final String? imageUrl;
  final BoxFit fit;
  final Alignment alignment;
  final Color? backgroundColor;
  final Widget? placeholder;
  final Widget? error;
  final double cacheScale;
  final int maxCacheWidth;
  final int maxCacheHeight;
  final VoidCallback? onError;

  @override
  Widget build(BuildContext context) {
    final normalizedImageUrl = imageUrl?.trim();
    final fallback = error ?? placeholder ?? const _DefaultImageFallback();
    final loading = placeholder ?? fallback;

    Widget decorate(BoxConstraints constraints, Widget child) {
      final hasFiniteWidth =
          constraints.maxWidth.isFinite && constraints.maxWidth > 0;
      final hasFiniteHeight =
          constraints.maxHeight.isFinite && constraints.maxHeight > 0;
      // Scroll/list layouts often leave one axis unconstrained.
      final wrappedChild = hasFiniteWidth && hasFiniteHeight
          ? SizedBox.expand(child: child)
          : hasFiniteWidth || hasFiniteHeight
          ? SizedBox(
              width: hasFiniteWidth ? constraints.maxWidth : null,
              height: hasFiniteHeight ? constraints.maxHeight : null,
              child: child,
            )
          : child;

      if (backgroundColor == null) {
        return wrappedChild;
      }
      return ColoredBox(color: backgroundColor!, child: wrappedChild);
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        if (normalizedImageUrl == null || normalizedImageUrl.isEmpty) {
          return decorate(constraints, fallback);
        }

        final devicePixelRatio =
            MediaQuery.maybeDevicePixelRatioOf(context) ?? 1;
        final cacheWidth = _resolveSalonImageCacheExtent(
          constraints.maxWidth,
          devicePixelRatio: devicePixelRatio,
          scale: cacheScale,
          maxPixels: maxCacheWidth,
        );
        final cacheHeight = _resolveSalonImageCacheExtent(
          constraints.maxHeight,
          devicePixelRatio: devicePixelRatio,
          scale: cacheScale,
          maxPixels: maxCacheHeight,
        );

        return decorate(
          constraints,
          Image.network(
            normalizedImageUrl,
            fit: fit,
            alignment: alignment,
            filterQuality: FilterQuality.high,
            isAntiAlias: true,
            gaplessPlayback: true,
            cacheWidth: cacheWidth,
            cacheHeight: cacheHeight,
            errorBuilder: (context, errorObject, stackTrace) {
              if (onError != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  onError?.call();
                });
              }
              return fallback;
            },
            loadingBuilder: (context, child, progress) {
              if (progress == null) {
                return child;
              }
              return loading;
            },
          ),
        );
      },
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
    this.alignment = Alignment.center,
    this.backgroundColor,
  });

  final String? imageUrl;
  final double height;
  final double borderRadius;
  final BoxFit fit;
  final Alignment alignment;
  final Color? backgroundColor;

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
            : SalonNetworkImage(
                imageUrl: imageUrl!,
                fit: fit,
                alignment: alignment,
                backgroundColor: backgroundColor ?? spec.lineColor,
                error: Center(
                  child: Text(
                    'Imagem indisponível',
                    style: theme.textTheme.bodySmall,
                  ),
                ),
                placeholder: const Center(
                  child: CircularProgressIndicator(strokeWidth: 2.4),
                ),
              ),
      ),
    );
  }
}

class _DefaultImageFallback extends StatelessWidget {
  const _DefaultImageFallback();

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    return DecoratedBox(
      decoration: BoxDecoration(color: spec.lineColor),
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: 24,
          color: spec.inkColor.withValues(alpha: 0.46),
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
