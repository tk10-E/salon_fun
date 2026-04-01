import 'package:flutter/material.dart';

import '../application/growth_journey_builder.dart';
import '../data/growth_journey_sample_data.dart';
import '../domain/growth_journey_models.dart';
import 'widgets/growth_journey_cards.dart';

class GrowthJourneyPreviewScreen extends StatelessWidget {
  const GrowthJourneyPreviewScreen({
    super.key,
    this.snapshot,
    this.builder = const GrowthJourneyBuilder(),
  });

  final GrowthJourneySnapshot? snapshot;
  final GrowthJourneyBuilder builder;

  @override
  Widget build(BuildContext context) {
    final resolvedSnapshot = snapshot ?? buildGrowthJourneySampleSnapshot();
    final playbook = builder.build(resolvedSnapshot);

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Growth Journey • ${resolvedSnapshot.salonName}'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Home'),
              Tab(text: 'Booking'),
              Tab(text: 'Profile'),
              Tab(text: 'Loyalty'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            GrowthScreenView(screen: playbook.screen(GrowthScreenType.home)),
            GrowthScreenView(screen: playbook.screen(GrowthScreenType.booking)),
            GrowthScreenView(screen: playbook.screen(GrowthScreenType.profile)),
            GrowthScreenView(screen: playbook.screen(GrowthScreenType.loyalty)),
          ],
        ),
      ),
    );
  }
}
