import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/tenant_theme.dart';

class PremiumGalleryCard extends StatelessWidget {
  const PremiumGalleryCard({
    super.key,
    required this.title,
    required this.imageUrl,
    this.subtitle,
    this.badge,
    this.onTap,
  });

  final String title;
  final String imageUrl;
  final String? subtitle;
  final String? badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = context.premiumTheme;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(PremiumRadius.card),
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(PremiumRadius.card),
          border: Border.all(color: theme.strokeSoft),
          boxShadow: theme.softShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(PremiumRadius.card),
          child: Stack(
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Image.network(
                  imageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => DecoratedBox(
                    decoration: BoxDecoration(gradient: theme.bannerGradient),
                    child: Center(
                      child: Icon(
                        Icons.photo_camera_back_outlined,
                        color: theme.textPrimary,
                        size: 28,
                      ),
                    ),
                  ),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.black.withValues(alpha: 0.0),
                        Colors.black.withValues(alpha: 0.54),
                      ],
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                    ),
                  ),
                ),
              ),
              if (badge != null)
                Positioned(
                  top: PremiumSpacing.sm,
                  left: PremiumSpacing.sm,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: PremiumSpacing.sm,
                      vertical: PremiumSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.34),
                      borderRadius: BorderRadius.circular(PremiumRadius.pill),
                    ),
                    child: Text(
                      badge!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              Positioned(
                left: PremiumSpacing.md,
                right: PremiumSpacing.md,
                bottom: PremiumSpacing.md,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                      const SizedBox(height: PremiumSpacing.xs),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
