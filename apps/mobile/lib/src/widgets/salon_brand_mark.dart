import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';

class SalonBrandMark extends StatelessWidget {
  const SalonBrandMark({
    super.key,
    required this.salonName,
    required this.branding,
    this.logoUrl,
    this.size = 52,
    this.borderRadius,
    this.showBorder = true,
  });

  final String salonName;
  final SalonBranding branding;
  final String? logoUrl;
  final double size;
  final double? borderRadius;
  final bool showBorder;

  @override
  Widget build(BuildContext context) {
    final trimmedLogoUrl = logoUrl?.trim();
    final radius = borderRadius ?? (size * 0.32);
    final initials = _initials(salonName);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
        border: showBorder
            ? Border.all(color: branding.outline.withValues(alpha: 0.9))
            : null,
        boxShadow: const [
          BoxShadow(
            color: Color(0x16000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius - 2),
        child: trimmedLogoUrl != null && trimmedLogoUrl.isNotEmpty
            ? Image.network(
                trimmedLogoUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _FallbackMark(
                  branding: branding,
                  initials: initials,
                ),
              )
            : _FallbackMark(branding: branding, initials: initials),
      ),
    );
  }
}

class _FallbackMark extends StatelessWidget {
  const _FallbackMark({required this.branding, required this.initials});

  final SalonBranding branding;
  final String initials;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            branding.soft,
            Color.lerp(branding.primary, Colors.white, 0.15)!,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: TextStyle(
          color: branding.deep,
          fontWeight: FontWeight.w900,
          fontSize: 18,
          letterSpacing: 0.4,
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
    return parts.first.substring(0, parts.first.length.clamp(0, 2)).toUpperCase();
  }

  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}
