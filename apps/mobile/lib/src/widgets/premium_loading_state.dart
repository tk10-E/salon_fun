import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

class PremiumLoadingState extends StatefulWidget {
  const PremiumLoadingState({
    super.key,
    this.lines = 4,
    this.showBanner = true,
  });

  final int lines;
  final bool showBanner;

  @override
  State<PremiumLoadingState> createState() => _PremiumLoadingStateState();
}

class _PremiumLoadingStateState extends State<PremiumLoadingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final shimmer = Tween<double>(
          begin: 0.48,
          end: 0.92,
        ).transform(Curves.easeInOut.transform(_controller.value));
        final base = theme.surfaceSecondary;
        final highlight = theme.surfacePrimary.withValues(alpha: shimmer);

        return Column(
          children: [
            if (widget.showBanner)
              _SkeletonBox(
                height: 248,
                color: Color.lerp(base, highlight, 0.5)!,
                radius: PremiumRadius.cardLarge,
              ),
            const SizedBox(height: PremiumSpacing.lg),
            for (var index = 0; index < widget.lines; index++) ...[
              Row(
                children: [
                  Expanded(
                    flex: index.isEven ? 7 : 5,
                    child: _SkeletonBox(
                      height: index.isEven ? 124 : 96,
                      color: index.isEven ? base : highlight,
                    ),
                  ),
                  const SizedBox(width: PremiumSpacing.md),
                  Expanded(
                    flex: index.isEven ? 5 : 7,
                    child: _SkeletonBox(
                      height: index.isEven ? 124 : 96,
                      color: index.isEven ? highlight : base,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: PremiumSpacing.md),
            ],
          ],
        );
      },
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.height,
    required this.color,
    this.radius = PremiumRadius.card,
  });

  final double height;
  final Color color;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return Container(
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: theme.strokeSoft),
      ),
    );
  }
}
