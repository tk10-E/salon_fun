import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../models/client_app_config.dart';
import '../theme/app_theme.dart';

class PremiumBackground extends StatelessWidget {
  const PremiumBackground({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return DecoratedBox(
      decoration: BoxDecoration(gradient: tokens.appGradient),
      child: Stack(
        children: [
          Positioned(
            top: -120,
            right: -90,
            child: _GlowOrb(
              color: tokens.brand.withValues(
                alpha: tokens.isDarkShell ? 0.26 : 0.18,
              ),
              size: 260,
            ),
          ),
          Positioned(
            bottom: -120,
            left: -80,
            child: _GlowOrb(
              color: tokens.accent.withValues(
                alpha: tokens.isDarkShell ? 0.18 : 0.12,
              ),
              size: 220,
            ),
          ),
          SafeArea(
            child: Padding(padding: padding, child: child),
          ),
        ],
      ),
    );
  }
}

class PremiumCard extends StatelessWidget {
  const PremiumCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.radius = 28,
    this.backgroundColor,
  });

  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final cardShadow = switch (tokens.cardStyle) {
      SalonCardStyle.outlined => const <BoxShadow>[],
      SalonCardStyle.glass => const [
        BoxShadow(
          color: Color(0x11000000),
          blurRadius: 22,
          offset: Offset(0, 10),
        ),
      ],
      SalonCardStyle.floating => const [
        BoxShadow(
          color: Color(0x15000000),
          blurRadius: 26,
          offset: Offset(0, 12),
        ),
      ],
    };
    final cardBackground =
        backgroundColor ??
        switch (tokens.cardStyle) {
          SalonCardStyle.glass => Color.alphaBlend(
            Colors.white.withValues(alpha: tokens.isDarkShell ? 0.06 : 0.42),
            tokens.surfaceStrong,
          ),
          SalonCardStyle.outlined => tokens.surfaceStrong,
          SalonCardStyle.floating => Color.alphaBlend(
            Colors.white.withValues(alpha: tokens.isDarkShell ? 0.03 : 0.65),
            tokens.surfaceStrong,
          ),
        };
    final cardBorder = switch (tokens.cardStyle) {
      SalonCardStyle.glass => tokens.outline.withValues(alpha: 0.45),
      SalonCardStyle.outlined => tokens.outline,
      SalonCardStyle.floating => tokens.outline.withValues(alpha: 0.75),
    };

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: cardBackground,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: cardBorder),
        boxShadow: cardShadow,
      ),
      child: child,
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.eyebrow,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final String? eyebrow;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final tokens = context.salonTheme;
    final children = <Widget>[
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (eyebrow != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Color.alphaBlend(
                    tokens.brand.withValues(alpha: 0.1),
                    tokens.surfaceStrong,
                  ),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: tokens.brand.withValues(alpha: 0.2),
                  ),
                ),
                child: Text(
                  eyebrow!,
                  style: textTheme.labelMedium?.copyWith(
                    color: tokens.brandDark,
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            Text(title, style: textTheme.headlineMedium),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: textTheme.bodySmall?.copyWith(color: tokens.textMuted),
            ),
          ],
        ),
      ),
    ];

    if (trailing != null) {
      children.add(trailing!);
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }
}

class MetricPill extends StatelessWidget {
  const MetricPill({
    super.key,
    required this.label,
    required this.value,
    this.toneColor,
  });

  final String label;
  final String value;
  final Color? toneColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final color = toneColor ?? tokens.brand;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          color.withValues(alpha: 0.12),
          tokens.surfaceStrong,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: tokens.textMuted,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.label = 'Carregando experiência...'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: PremiumCard(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.4),
            ),
            const SizedBox(height: 16),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class ErrorStateCard extends StatelessWidget {
  const ErrorStateCard({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Color.alphaBlend(
                tokens.warning.withValues(alpha: 0.16),
                tokens.surfaceStrong,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.cloud_off_rounded, color: tokens.warning),
          ),
          const SizedBox(height: 14),
          Text(
            'Não deu para carregar esta área',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              child: const Text('Tentar novamente'),
            ),
          ],
        ],
      ),
    );
  }
}

class EmptyStateCard extends StatelessWidget {
  const EmptyStateCard({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.auto_awesome_rounded,
    this.eyebrow,
    this.action,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? eyebrow;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Color.alphaBlend(
                tokens.accent.withValues(alpha: 0.14),
                tokens.surfaceStrong,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: tokens.brand),
          ),
          const SizedBox(height: 14),
          if (eyebrow != null) ...[
            Text(
              eyebrow!,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: tokens.textMuted),
            ),
            const SizedBox(height: 4),
          ],
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.textMuted),
          ),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

class OperationalNoticeCard extends StatelessWidget {
  const OperationalNoticeCard({
    super.key,
    required this.title,
    required this.message,
    this.action,
    this.icon = Icons.sync_problem_rounded,
    this.toneColor,
  });

  final String title;
  final String message;
  final Widget? action;
  final IconData icon;
  final Color? toneColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final accent = toneColor ?? tokens.warning;

    return PremiumCard(
      backgroundColor: Color.alphaBlend(
        accent.withValues(alpha: 0.08),
        tokens.surfaceStrong,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: accent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(message, style: Theme.of(context).textTheme.bodySmall),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

class HeroImagePanel extends StatelessWidget {
  const HeroImagePanel({
    super.key,
    required this.child,
    this.imageUrl,
    this.height = 300,
    this.imageAlignment = Alignment.center,
    this.imageScale = 1,
  });

  final Widget child;
  final String? imageUrl;
  final double height;
  final Alignment imageAlignment;
  final double imageScale;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final overlayGradient = switch (tokens.bannerStyle) {
      SalonBannerStyle.editorial => const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: <Color>[
          Color(0x360F0907),
          Color(0x6A0F0907),
          Color(0x880F0907),
        ],
      ),
      SalonBannerStyle.spotlight => LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: <Color>[
          tokens.brand.withValues(alpha: 0.16),
          const Color(0x5A0F0907),
          const Color(0x860F0907),
        ],
      ),
      SalonBannerStyle.immersive => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: <Color>[
          Color(0x280F0907),
          Color(0x720F0907),
          Color(0x8A0F0907),
        ],
      ),
    };

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(34),
        gradient: tokens.heroGradient,
        boxShadow: const [
          BoxShadow(
            color: Color(0x26000000),
            blurRadius: 32,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(34),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl != null)
              Transform.scale(
                scale: imageScale,
                child: PremiumNetworkImage(
                  imageUrl: imageUrl,
                  fit: BoxFit.cover,
                  alignment: imageAlignment,
                ),
              ),
            DecoratedBox(decoration: BoxDecoration(gradient: overlayGradient)),
            Padding(padding: const EdgeInsets.all(24), child: child),
          ],
        ),
      ),
    );
  }
}

class PremiumNetworkImage extends StatelessWidget {
  const PremiumNetworkImage({
    super.key,
    required this.imageUrl,
    required this.fit,
    this.alignment = Alignment.center,
    this.width,
    this.height,
    this.placeholder,
  });

  final String? imageUrl;
  final BoxFit fit;
  final Alignment alignment;
  final double? width;
  final double? height;
  final Widget? placeholder;

  bool get _hasUsableUrl {
    final url = imageUrl?.trim();
    if (url == null || url.isEmpty) {
      return false;
    }

    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme) {
      return false;
    }

    return uri.scheme == 'http' || uri.scheme == 'https';
  }

  @override
  Widget build(BuildContext context) {
    final fallback =
        placeholder ??
        DecoratedBox(
          decoration: BoxDecoration(gradient: context.salonTheme.heroGradient),
        );

    if (!_hasUsableUrl) {
      return SizedBox(width: width, height: height, child: fallback);
    }

    return Image.network(
      imageUrl!.trim(),
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      errorBuilder: (context, error, stackTrace) =>
          SizedBox(width: width, height: height, child: fallback),
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) {
          return child;
        }

        return Stack(
          fit: StackFit.expand,
          children: [
            SizedBox(width: width, height: height, child: fallback),
            const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
            ),
          ],
        );
      },
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    this.icon = Icons.wifi_off_rounded,
    this.toneColor,
  });

  final String label;
  final IconData icon;
  final Color? toneColor;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;
    final color = toneColor ?? tokens.warning;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Color.alphaBlend(
          color.withValues(alpha: 0.13),
          tokens.surfaceStrong,
        ),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String formatOperationalIssues(List<OperationalIssue> issues) {
  return issues
      .take(3)
      .map((issue) => '${issue.title}: ${issue.message}')
      .join('\n\n');
}

class StaggerReveal extends StatefulWidget {
  const StaggerReveal({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 620),
    this.offsetY = 26,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final double offsetY;

  @override
  State<StaggerReveal> createState() => _StaggerRevealState();
}

class _StaggerRevealState extends State<StaggerReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final Animation<double> _opacity = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );
  late final Animation<Offset> _offset = Tween<Offset>(
    begin: Offset(0, widget.offsetY / 100),
    end: Offset.zero,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.delay, () async {
      if (!mounted) {
        return;
      }

      _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _offset, child: widget.child),
    );
  }
}

class ExperienceVeil extends StatelessWidget {
  const ExperienceVeil({super.key, this.title = 'Salon Fun'});

  final String title;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return DecoratedBox(
      decoration: BoxDecoration(gradient: tokens.appGradient),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            top: -100,
            right: -60,
            child: _GlowOrb(
              color: tokens.brand.withValues(alpha: 0.22),
              size: 260,
            ),
          ),
          Positioned(
            bottom: -80,
            left: -50,
            child: _GlowOrb(
              color: tokens.accent.withValues(alpha: 0.18),
              size: 220,
            ),
          ),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 112,
                  height: 112,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: tokens.heroGradient,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x29000000),
                        blurRadius: 36,
                        offset: Offset(0, 18),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: Colors.white,
                    size: 42,
                  ),
                ),
                const SizedBox(height: 26),
                Text(title, style: Theme.of(context).textTheme.displaySmall),
                const SizedBox(height: 10),
                Text(
                  'Experiência cliente carregando',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: <Color>[color, color.withValues(alpha: 0)],
          ),
        ),
      ),
    );
  }
}
