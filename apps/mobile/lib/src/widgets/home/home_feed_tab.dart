import 'package:flutter/material.dart';

import '../../models/app_models.dart';
import '../../screens/premium_gallery_screen.dart';
import '../../theme/salon_branding.dart';

class HomeFeedTab extends StatelessWidget {
  const HomeFeedTab({
    super.key,
    required this.profile,
    required this.branding,
    required this.posts,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.onToggleLike,
    required this.onOpenComments,
    required this.onBookService,
    required this.busyPostIds,
    this.onOpenVideo,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<SalonPost> posts;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final Future<void> Function(SalonPost post) onToggleLike;
  final Future<void> Function(SalonPost post) onOpenComments;
  final Future<void> Function(ServiceItem service) onBookService;
  final Set<String> busyPostIds;
  final Future<void> Function(SalonPost post)? onOpenVideo;

  @override
  Widget build(BuildContext context) {
    return PremiumGalleryScreen(
      profile: profile,
      branding: branding,
      posts: posts,
      onRefresh: onRefresh,
      onWhatsApp: onWhatsApp,
      onToggleLike: onToggleLike,
      onOpenComments: onOpenComments,
      onBookService: onBookService,
      busyPostIds: busyPostIds,
      onOpenVideo: onOpenVideo,
    );
  }
}
