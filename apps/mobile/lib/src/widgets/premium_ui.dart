import 'package:flutter/material.dart';

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

    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color:
            backgroundColor ??
            Color.alphaBlend(
              Colors.white.withValues(alpha: tokens.isDarkShell ? 0.03 : 0.65),
              tokens.surfaceStrong,
            ),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: tokens.outline),
        boxShadow: const [
          BoxShadow(
            color: Color(0x15000000),
            blurRadius: 26,
            offset: Offset(0, 12),
          ),
        ],
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
    this.trailing,
  });

  final String title;
  final String subtitle;
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
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Não deu para carregar esta área',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodySmall),
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
    this.action,
  });

  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
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
  });

  final Widget child;
  final String? imageUrl;
  final double height;

  @override
  Widget build(BuildContext context) {
    final tokens = context.salonTheme;

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(34),
        gradient: tokens.heroGradient,
        image: imageUrl == null
            ? null
            : DecorationImage(
                image: NetworkImage(imageUrl!),
                fit: BoxFit.cover,
                colorFilter: const ColorFilter.mode(
                  Color(0x780F0907),
                  BlendMode.darken,
                ),
              ),
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
        child: Padding(padding: const EdgeInsets.all(24), child: child),
      ),
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
