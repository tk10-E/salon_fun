import 'package:flutter/material.dart';

import 'app_backdrop.dart';
import 'soft_card.dart';
import 'salon_brand_mark.dart';
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
                  colors: [activeBranding.surface, activeBranding.soft],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderColor: activeBranding.outline,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SalonBrandMark(
                      salonName: eyebrow,
                      branding: activeBranding,
                      logoUrl: logoUrl,
                      size: 88,
                      borderRadius: 28,
                    ),
                    const SizedBox(height: 20),
                    Text(eyebrow, style: theme.textTheme.labelLarge),
                    const SizedBox(height: 10),
                    Text(
                      title,
                      style: theme.textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      message,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: activeBranding.deep.withValues(alpha: 0.84),
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2.4),
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
