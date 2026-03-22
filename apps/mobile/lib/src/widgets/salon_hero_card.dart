import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';

class SalonHeroCard extends StatelessWidget {
  const SalonHeroCard({
    super.key,
    required this.profile,
    required this.branding,
    required this.subtitle,
    this.logoUrl,
    required this.onWhatsApp,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final String subtitle;
  final String? logoUrl;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initials = _initials(profile.salonName);

    return Container(
      decoration: BoxDecoration(
        gradient: branding.heroGradient,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: branding.deep.withValues(alpha: 0.18),
            blurRadius: 34,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -36,
            right: -22,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.09),
              ),
            ),
          ),
          Positioned(
            right: 26,
            top: 38,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                  ),
                  child: Text(
                    'Olá, ${profile.name}',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: branding.onPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _HeroAvatar(
                      branding: branding,
                      initials: initials,
                      logoUrl: logoUrl,
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            profile.salonName,
                            style: theme.textTheme.headlineMedium?.copyWith(
                              color: branding.onPrimary,
                              height: 1.04,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            subtitle,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    FilledButton.icon(
                      onPressed: onWhatsApp,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: branding.deep,
                        minimumSize: const Size(0, 50),
                      ),
                      icon: const FaIcon(FontAwesomeIcons.whatsapp, size: 18),
                      label: const Text('Falar no WhatsApp'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroAvatar extends StatelessWidget {
  const _HeroAvatar({
    required this.branding,
    required this.initials,
    this.logoUrl,
  });

  final SalonBranding branding;
  final String initials;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final trimmedLogoUrl = logoUrl?.trim();

    return Container(
      width: 84,
      height: 84,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.84),
          width: 5,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: ClipOval(
        child: trimmedLogoUrl != null && trimmedLogoUrl.isNotEmpty
            ? Image.network(
                trimmedLogoUrl,
                width: 74,
                height: 74,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _AvatarFallback(
                  branding: branding,
                  initials: initials,
                  style: theme.textTheme.headlineSmall,
                ),
              )
            : _AvatarFallback(
                branding: branding,
                initials: initials,
                style: theme.textTheme.headlineSmall,
              ),
      ),
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback({
    required this.branding,
    required this.initials,
    required this.style,
  });

  final SalonBranding branding;
  final String initials;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 74,
      height: 74,
      color: Colors.white,
      alignment: Alignment.center,
      child: Text(
        initials,
        style: style?.copyWith(
          color: branding.deep,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

String _initials(String name) {
  final parts = name
      .split(RegExp(r'\s+'))
      .where((part) => part.trim().isNotEmpty)
      .toList();

  if (parts.isEmpty) {
    return 'SF';
  }

  if (parts.length == 1) {
    return parts.first.characters.take(2).toString().toUpperCase();
  }

  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
