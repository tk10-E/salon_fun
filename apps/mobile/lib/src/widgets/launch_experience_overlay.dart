import 'dart:async';

import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';
import 'cinematic_reveal.dart';
import 'pulse_dot.dart';
import 'salon_brand_mark.dart';

class LaunchExperienceOverlay extends StatefulWidget {
  const LaunchExperienceOverlay({
    super.key,
    required this.child,
    required this.branding,
    this.logoUrl,
    this.salonName = 'Salon Fun',
  });

  final Widget child;
  final SalonBranding branding;
  final String? logoUrl;
  final String salonName;

  @override
  State<LaunchExperienceOverlay> createState() =>
      _LaunchExperienceOverlayState();
}

class _LaunchExperienceOverlayState extends State<LaunchExperienceOverlay> {
  bool _visible = true;
  bool _mountedOverlay = true;
  Timer? _timer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _startIfNeeded();
  }

  void _startIfNeeded() {
    if (_timer != null) {
      return;
    }

    final disableAnimations = MediaQuery.maybeOf(context)?.disableAnimations;
    final delay = disableAnimations == true
        ? const Duration(milliseconds: 60)
        : const Duration(milliseconds: 1180);

    _timer = Timer(delay, () {
      if (!mounted) {
        return;
      }
      setState(() => _visible = false);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (_mountedOverlay)
          Positioned.fill(
            child: IgnorePointer(
              ignoring: !_visible,
              child: AnimatedOpacity(
                opacity: _visible ? 1 : 0,
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeOutCubic,
                onEnd: () {
                  if (!_visible && mounted) {
                    setState(() => _mountedOverlay = false);
                  }
                },
                child: _LaunchExperiencePanel(
                  branding: widget.branding,
                  logoUrl: widget.logoUrl,
                  salonName: widget.salonName,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _LaunchExperiencePanel extends StatelessWidget {
  const _LaunchExperiencePanel({
    required this.branding,
    required this.logoUrl,
    required this.salonName,
  });

  final SalonBranding branding;
  final String? logoUrl;
  final String salonName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color.lerp(branding.deep, const Color(0xFF0E0D14), 0.12)!,
            branding.deep,
            Color.lerp(branding.primary, branding.deep, 0.18)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -72,
            right: -34,
            child: _LaunchOrb(
              size: 220,
              color: Colors.white.withValues(alpha: 0.08),
            ),
          ),
          Positioned(
            left: -60,
            bottom: -96,
            child: _LaunchOrb(
              size: 210,
              color: branding.primary.withValues(alpha: 0.16),
            ),
          ),
          Positioned(
            left: 26,
            right: 26,
            top: 120,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.white.withValues(alpha: 0.08),
                      Colors.white.withValues(alpha: 0.0),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: const SizedBox(height: 240),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CinematicReveal(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.14),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              PulseDot(
                                size: 8,
                                color: Color.lerp(
                                  branding.primary,
                                  Colors.white,
                                  0.22,
                                )!,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Experiência pronta para abrir',
                                style: theme.textTheme.labelLarge?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 80),
                        child: SalonBrandMark(
                          salonName: salonName,
                          branding: branding,
                          logoUrl: logoUrl,
                          size: 96,
                          borderRadius: 32,
                          showBorder: false,
                        ),
                      ),
                      const SizedBox(height: 22),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 140),
                        child: Text(
                          salonName,
                          textAlign: TextAlign.center,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: Colors.white.withValues(alpha: 0.84),
                            letterSpacing: 1,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 200),
                        child: Text(
                          'Seu salão abre como experiência, não só como app.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            height: 1.02,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 260),
                        child: Text(
                          'Agenda, carteira, feed e relacionamento entram em cena com mais clareza.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: Colors.white.withValues(alpha: 0.78),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 320),
                        child: Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 10,
                          runSpacing: 10,
                          children: const [
                            _LaunchPill(
                              icon: Icons.schedule_rounded,
                              label: 'Agenda real',
                            ),
                            _LaunchPill(
                              icon: Icons.card_giftcard_rounded,
                              label: 'Carteira ativa',
                            ),
                            _LaunchPill(
                              icon: Icons.auto_awesome_rounded,
                              label: 'Feed desejável',
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 28),
                      CinematicReveal(
                        delay: const Duration(milliseconds: 380),
                        child: Container(
                          width: 180,
                          height: 4,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            gradient: LinearGradient(
                              colors: [
                                Colors.white.withValues(alpha: 0.18),
                                Colors.white.withValues(alpha: 0.56),
                                Colors.white.withValues(alpha: 0.18),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LaunchPill extends StatelessWidget {
  const _LaunchPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: Colors.white),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _LaunchOrb extends StatelessWidget {
  const _LaunchOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}
