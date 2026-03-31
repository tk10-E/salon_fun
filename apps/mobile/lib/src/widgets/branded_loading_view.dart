import 'package:flutter/material.dart';

import 'app_backdrop.dart';
import 'cinematic_reveal.dart';
import 'pulse_dot.dart';
import 'salon_brand_mark.dart';
import 'soft_card.dart';
import '../theme/salon_branding.dart';

class BrandedLoadingView extends StatelessWidget {
  const BrandedLoadingView({
    super.key,
    this.eyebrow = 'Salon Fun',
    this.title = 'Preparando sua agenda',
    this.message = 'Estamos organizando seus dados para você entrar no app.',
    this.branding,
    this.logoUrl,
  });

  final String eyebrow;
  final String title;
  final String message;
  final SalonBranding? branding;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final activeBranding = branding ?? SalonBranding.fromName(eyebrow);

    return Scaffold(
      body: AppBackdrop(
        branding: activeBranding,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: SoftCard(
                padding: const EdgeInsets.all(28),
                gradient: LinearGradient(
                  colors: [
                    Color.lerp(activeBranding.surface, Colors.white, 0.08)!,
                    activeBranding.soft,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderColor: activeBranding.outline,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CinematicReveal(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.72),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: activeBranding.outline.withValues(
                              alpha: 0.72,
                            ),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PulseDot(size: 8, color: activeBranding.primary),
                            const SizedBox(width: 8),
                            Text(
                              'Experiência em preparação',
                              style: theme.textTheme.labelLarge?.copyWith(
                                color: activeBranding.deep,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    CinematicReveal(
                      delay: const Duration(milliseconds: 80),
                      child: SalonBrandMark(
                        salonName: eyebrow,
                        branding: activeBranding,
                        logoUrl: logoUrl,
                        size: 92,
                        borderRadius: 30,
                      ),
                    ),
                    const SizedBox(height: 18),
                    CinematicReveal(
                      delay: const Duration(milliseconds: 140),
                      child: Text(
                        eyebrow,
                        style: theme.textTheme.labelLarge?.copyWith(
                          letterSpacing: 0.9,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    CinematicReveal(
                      delay: const Duration(milliseconds: 200),
                      child: Text(
                        title,
                        style: theme.textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 10),
                    CinematicReveal(
                      delay: const Duration(milliseconds: 260),
                      child: Text(
                        message,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          color: activeBranding.deep.withValues(alpha: 0.84),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 22),
                    const CinematicReveal(
                      delay: Duration(milliseconds: 320),
                      child: Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          _LoadingPill(
                            icon: Icons.schedule_rounded,
                            label: 'Agenda viva',
                          ),
                          _LoadingPill(
                            icon: Icons.card_giftcard_rounded,
                            label: 'Carteira pronta',
                          ),
                          _LoadingPill(
                            icon: Icons.chat_bubble_outline_rounded,
                            label: 'Contato direto',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    const CinematicReveal(
                      delay: Duration(milliseconds: 380),
                      child: SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoadingPill extends StatelessWidget {
  const _LoadingPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x26A8562D)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: const Color(0xFF8E441F)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: const Color(0xFF6B4B3A),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
