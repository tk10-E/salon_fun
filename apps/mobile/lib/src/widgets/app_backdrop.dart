import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';

class AppBackdrop extends StatefulWidget {
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
  State<AppBackdrop> createState() => _AppBackdropState();
}

class _AppBackdropState extends State<AppBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations;
    if (disableAnimations == true) {
      _controller.stop();
      _controller.value = 1;
      return;
    }

    if (_controller.status == AnimationStatus.dismissed) {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final activeBranding = widget.branding;
    final topGradient = activeBranding == null
        ? const [Color(0xFFFBF7F2), Color(0xFFF6EEE4)]
        : activeBranding.shellBackgroundGradient;
    final topOrbColors = activeBranding == null
        ? const [Color(0x33D47B4C), Color(0x00D47B4C)]
        : <Color>[
            activeBranding.primary.withValues(alpha: 0.16),
            activeBranding.primary.withValues(alpha: 0.0),
          ];
    final sideOrbColors = activeBranding == null
        ? const [Color(0x1FE4BB8E), Color(0x00E4BB8E)]
        : <Color>[
            activeBranding.usesDarkShell
                ? Colors.white.withValues(alpha: 0.08)
                : activeBranding.soft.withValues(alpha: 0.2),
            Colors.transparent,
          ];
    final bottomOrbColors = activeBranding == null
        ? const [Color(0x1AC56B43), Color(0x00C56B43)]
        : <Color>[
            activeBranding.usesDarkShell
                ? activeBranding.primary.withValues(alpha: 0.1)
                : activeBranding.deep.withValues(alpha: 0.08),
            Colors.transparent,
          ];
    final veilColors = activeBranding == null
        ? const [Color(0x14FFFFFF), Color(0x00FFFFFF)]
        : <Color>[
            activeBranding.usesDarkShell
                ? Colors.white.withValues(alpha: 0.04)
                : activeBranding.primary.withValues(alpha: 0.08),
            Colors.white.withValues(alpha: 0.0),
          ];

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final drift = Curves.easeInOutSine.transform(_controller.value) - 0.5;

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
              top: -54 + (drift * 18),
              left: -18 + (drift * 28),
              child: Transform.scale(
                scale: 1 + (drift * 0.08),
                child: _GlowOrb(size: 146, colors: topOrbColors),
              ),
            ),
            Positioned(
              right: -72 - (drift * 34),
              top: 78 + (drift * 22),
              child: Transform.scale(
                scale: 1 - (drift * 0.06),
                child: _GlowOrb(size: 176, colors: sideOrbColors),
              ),
            ),
            Positioned(
              bottom: -72 - (drift * 24),
              left: 18 - (drift * 20),
              child: Transform.scale(
                scale: 1 + (drift * 0.05),
                child: _GlowOrb(size: 168, colors: bottomOrbColors),
              ),
            ),
            Positioned(
              top: 96 + (drift * 12),
              left: -30 - (drift * 18),
              right: -30 + (drift * 18),
              child: IgnorePointer(
                child: Container(
                  height: 220,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: veilColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(120),
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.white.withValues(alpha: 0.0),
                        Colors.white.withValues(
                          alpha: activeBranding?.usesDarkShell == true
                              ? 0.02
                              : 0.05,
                        ),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
              ),
            ),
            Padding(padding: widget.padding, child: widget.child),
          ],
        );
      },
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
