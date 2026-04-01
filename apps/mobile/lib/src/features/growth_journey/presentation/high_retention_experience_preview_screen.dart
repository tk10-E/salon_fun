import 'package:flutter/material.dart';

import '../application/high_retention_experience_builder.dart';
import '../data/growth_journey_sample_data.dart';
import 'widgets/high_retention_experience_view.dart';

class HighRetentionExperiencePreviewScreen extends StatelessWidget {
  const HighRetentionExperiencePreviewScreen({
    super.key,
    this.builder = const HighRetentionExperienceBuilder(),
  });

  final HighRetentionExperienceBuilder builder;

  @override
  Widget build(BuildContext context) {
    final experience = builder.build(buildGrowthJourneySampleSnapshot());

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('High Retention Experience'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Home'),
              Tab(text: 'Booking'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            HighRetentionHomeExperienceView(model: experience.home),
            HighRetentionBookingExperienceView(model: experience.booking),
          ],
        ),
      ),
    );
  }
}
