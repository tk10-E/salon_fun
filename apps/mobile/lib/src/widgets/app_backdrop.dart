import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';

class AppBackdrop extends StatelessWidget {
  const AppBackdrop({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.branding,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final SalonBranding? branding;

  @override
  Widget build(BuildContext context) {
    final activeBranding = branding;
    final topGradient = activeBranding == null
        ? const [Color(0xFFFBF7F2), Color(0xFFF6EEE4)]
        : <Color>[
            Color.lerp(activeBranding.surface, Colors.white, 0.18)!,
            Color.lerp(activeBranding.soft, Colors.white, 0.36)!,
          ];
    final topOrbColors = activeBranding == null
        ? const [Color(0x33D47B4C), Color(0x00D47B4C)]
        : <Color>[
            activeBranding.primary.withValues(alpha: 0.24),
            activeBranding.primary.withValues(alpha: 0.0),
          ];
    final sideOrbColors = activeBranding == null
        ? const [Color(0x1FE4BB8E), Color(0x00E4BB8E)]
        : <Color>[
            activeBranding.soft.withValues(alpha: 0.34),
            activeBranding.soft.withValues(alpha: 0.0),
          ];
    final bottomOrbColors = activeBranding == null
        ? const [Color(0x1AC56B43), Color(0x00C56B43)]
        : <Color>[
            activeBranding.deep.withValues(alpha: 0.14),
            activeBranding.deep.withValues(alpha: 0.0),
          ];

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: topGradient,
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              border: Border.all(color: const Color(0x00FFFFFF)),
            ),
          ),
        ),
        Positioned(
          top: -70,
          left: -30,
          child: _GlowOrb(size: 180, colors: topOrbColors),
        ),
        Positioned(
          right: -90,
          top: 60,
          child: _GlowOrb(size: 220, colors: sideOrbColors),
        ),
        Positioned(
          bottom: -90,
          left: 24,
          child: _GlowOrb(size: 220, colors: bottomOrbColors),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.0),
                    Colors.white.withValues(alpha: 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),
          ),
        ),
        Padding(padding: padding, child: child),
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.size, required this.colors});

  final double size;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: colors),
        ),
      ),
    );
  }
}
