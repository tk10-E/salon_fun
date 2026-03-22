import 'package:flutter/material.dart';

class AppBackdrop extends StatelessWidget {
  const AppBackdrop({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFFBF7F2), Color(0xFFF6EEE4)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              border: Border.all(color: const Color(0x00FFFFFF)),
            ),
          ),
        ),
        const Positioned(
          top: -70,
          left: -30,
          child: _GlowOrb(
            size: 180,
            colors: [Color(0x33D47B4C), Color(0x00D47B4C)],
          ),
        ),
        const Positioned(
          right: -90,
          top: 60,
          child: _GlowOrb(
            size: 220,
            colors: [Color(0x1FE4BB8E), Color(0x00E4BB8E)],
          ),
        ),
        const Positioned(
          bottom: -90,
          left: 24,
          child: _GlowOrb(
            size: 220,
            colors: [Color(0x1AC56B43), Color(0x00C56B43)],
          ),
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
