import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

class AdaptiveBannerAd extends StatefulWidget {
  const AdaptiveBannerAd({
    super.key,
    required this.adUnitId,
    this.horizontalPadding = 8,
  });

  final String adUnitId;
  final double horizontalPadding;

  @override
  State<AdaptiveBannerAd> createState() => _AdaptiveBannerAdState();
}

class _AdaptiveBannerAdState extends State<AdaptiveBannerAd> {
  BannerAd? _ad;
  Orientation? _orientation;
  int? _lastWidth;
  bool _isLoaded = false;
  bool _loadScheduled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _scheduleLoadForCurrentLayout();
  }

  @override
  void didUpdateWidget(covariant AdaptiveBannerAd oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.adUnitId != widget.adUnitId) {
      _scheduleLoad(force: true);
    }
  }

  @override
  void dispose() {
    unawaited(_ad?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OrientationBuilder(
      builder: (context, orientation) {
        final width = _availableWidth(context);
        if (_orientation != orientation || _lastWidth != width) {
          _orientation = orientation;
          _lastWidth = width;
          _scheduleLoad(force: true);
        }

        final ad = _ad;
        final height = _isLoaded && ad != null
            ? ad.size.height.toDouble()
            : 0.0;

        return AnimatedSize(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          alignment: Alignment.topCenter,
          child: height == 0
              ? const SizedBox.shrink()
              : DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(
                        color: Theme.of(
                          context,
                        ).colorScheme.outlineVariant.withValues(alpha: 0.32),
                      ),
                    ),
                  ),
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      widget.horizontalPadding,
                      4,
                      widget.horizontalPadding,
                      2,
                    ),
                    child: Center(
                      child: SizedBox(
                        width: ad!.size.width.toDouble(),
                        height: height,
                        child: AdWidget(ad: ad),
                      ),
                    ),
                  ),
                ),
        );
      },
    );
  }

  void _scheduleLoadForCurrentLayout() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      final width = _availableWidth(context);
      if (width <= 0) {
        return;
      }

      _lastWidth = width;
      _scheduleLoad(force: true);
    });
  }

  void _scheduleLoad({required bool force}) {
    if (_loadScheduled) {
      return;
    }

    _loadScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadScheduled = false;
      if (!mounted) {
        return;
      }

      unawaited(_loadAd(force: force));
    });
  }

  int _availableWidth(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final horizontalSafeArea =
        mediaQuery.padding.left + mediaQuery.padding.right;
    final rawWidth =
        mediaQuery.size.width -
        horizontalSafeArea -
        (widget.horizontalPadding * 2);
    return rawWidth.clamp(1, 1200).truncate();
  }

  Future<void> _loadAd({required bool force}) async {
    if (!mounted || widget.adUnitId.isEmpty || kIsWeb) {
      return;
    }

    final width = _lastWidth ?? _availableWidth(context);
    if (width <= 0) {
      return;
    }

    if (!force && _ad != null) {
      return;
    }

    final previousAd = _ad;
    setState(() {
      _ad = null;
      _isLoaded = false;
    });
    await previousAd?.dispose();

    // The regular anchored adaptive size keeps the banner compact above the
    // navigation bar while still adapting to the current phone width.
    // ignore: deprecated_member_use
    final size = await AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(
      width,
    );
    if (!mounted || size == null) {
      return;
    }

    final banner = BannerAd(
      adUnitId: widget.adUnitId,
      size: size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            unawaited(ad.dispose());
            return;
          }

          setState(() {
            _ad = ad as BannerAd;
            _isLoaded = true;
          });
        },
        onAdFailedToLoad: (ad, error) {
          unawaited(ad.dispose());
          if (mounted && identical(_ad, ad)) {
            setState(() {
              _ad = null;
              _isLoaded = false;
            });
          }
          if (kDebugMode) {
            debugPrint('AdMob banner failed to load: $error');
          }
        },
      ),
    );

    _ad = banner;
    await banner.load();
  }
}
