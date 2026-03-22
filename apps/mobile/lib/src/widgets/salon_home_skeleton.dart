import 'package:flutter/material.dart';

import '../theme/salon_branding.dart';
import 'soft_card.dart';

class SalonHomeSkeleton extends StatelessWidget {
  const SalonHomeSkeleton({
    super.key,
    required this.branding,
    this.historyMode = false,
  });

  final SalonBranding branding;
  final bool historyMode;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
      children: historyMode
          ? [
              const _SkeletonHeader(),
              const SizedBox(height: 18),
              for (var i = 0; i < 3; i++) ...[
                const _HistorySkeletonCard(),
                const SizedBox(height: 14),
              ],
            ]
          : [
              _HeroSkeleton(branding: branding),
              const SizedBox(height: 22),
              _HighlightsSkeleton(branding: branding),
              const SizedBox(height: 26),
              const _SkeletonHeader(),
              const SizedBox(height: 16),
              for (var i = 0; i < 3; i++) ...[
                _ServiceSkeletonCard(branding: branding),
                const SizedBox(height: 16),
              ],
            ],
    );
  }
}

class _HeroSkeleton extends StatelessWidget {
  const _HeroSkeleton({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: EdgeInsets.zero,
      gradient: branding.heroGradient,
      borderColor: branding.outline,
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            _SkeletonBlock(width: 110, height: 14, dark: true),
            SizedBox(height: 18),
            Row(
              children: [
                _SkeletonCircle(size: 78),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SkeletonBlock(
                        width: double.infinity,
                        height: 26,
                        dark: true,
                      ),
                      SizedBox(height: 10),
                      _SkeletonBlock(width: 220, height: 14),
                      SizedBox(height: 8),
                      _SkeletonBlock(width: 180, height: 14),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 20),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _SkeletonBlock(width: 170, height: 48, rounded: 20, dark: true),
                _SkeletonBlock(width: 120, height: 48, rounded: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _HighlightsSkeleton extends StatelessWidget {
  const _HighlightsSkeleton({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 860
            ? 3
            : constraints.maxWidth >= 520
            ? 2
            : 1;
        final totalSpacing = 14.0 * (columns - 1);
        final itemWidth = (constraints.maxWidth - totalSpacing) / columns;

        return Wrap(
          spacing: 14,
          runSpacing: 14,
          children: List.generate(
            3,
            (_) => SizedBox(
              width: itemWidth,
              child: SoftCard(
                borderColor: branding.outline,
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SkeletonBlock(width: 46, height: 46, rounded: 16),
                    SizedBox(height: 18),
                    _SkeletonBlock(width: 120, height: 14),
                    SizedBox(height: 10),
                    _SkeletonBlock(width: 150, height: 22, dark: true),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ServiceSkeletonCard extends StatelessWidget {
  const _ServiceSkeletonCard({required this.branding});

  final SalonBranding branding;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          _SkeletonBlock(width: double.infinity, height: 8, rounded: 0),
          Padding(
            padding: EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _SkeletonBlock(width: 46, height: 46, rounded: 16),
                    SizedBox(width: 12),
                    Expanded(
                      child: _SkeletonBlock(
                        width: double.infinity,
                        height: 22,
                        dark: true,
                      ),
                    ),
                  ],
                ),
                SizedBox(height: 18),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _SkeletonBlock(width: 96, height: 38, rounded: 16),
                    _SkeletonBlock(width: 118, height: 38, rounded: 16),
                  ],
                ),
                SizedBox(height: 16),
                _SkeletonBlock(width: double.infinity, height: 14),
                SizedBox(height: 8),
                _SkeletonBlock(width: 210, height: 14),
                SizedBox(height: 18),
                _SkeletonBlock(
                  width: double.infinity,
                  height: 50,
                  rounded: 18,
                  dark: true,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HistorySkeletonCard extends StatelessWidget {
  const _HistorySkeletonCard();

  @override
  Widget build(BuildContext context) {
    return const SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _SkeletonBlock(
                  width: double.infinity,
                  height: 22,
                  dark: true,
                ),
              ),
              SizedBox(width: 12),
              _SkeletonBlock(width: 88, height: 28, rounded: 999),
            ],
          ),
          SizedBox(height: 14),
          _SkeletonBlock(width: 180, height: 14),
          SizedBox(height: 8),
          _SkeletonBlock(width: 210, height: 14),
        ],
      ),
    );
  }
}

class _SkeletonHeader extends StatelessWidget {
  const _SkeletonHeader();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SkeletonBlock(width: 96, height: 12),
        SizedBox(height: 10),
        _SkeletonBlock(width: 220, height: 26, dark: true),
      ],
    );
  }
}

class _SkeletonCircle extends StatelessWidget {
  const _SkeletonCircle({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.32),
        shape: BoxShape.circle,
      ),
    );
  }
}

class _SkeletonBlock extends StatelessWidget {
  const _SkeletonBlock({
    required this.width,
    required this.height,
    this.rounded = 12,
    this.dark = false,
  });

  final double width;
  final double height;
  final double rounded;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: dark
            ? Colors.white.withValues(alpha: 0.3)
            : const Color(0xFFECE0D4),
        borderRadius: BorderRadius.circular(rounded),
      ),
    );
  }
}
