import 'package:flutter/material.dart';

class HomeSectionIntro extends StatelessWidget {
  const HomeSectionIntro({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.description,
  });

  final String eyebrow;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(eyebrow, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(description, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}
