import 'package:flutter/material.dart';

import '../empty_state.dart';

class HomeLoadErrorView extends StatelessWidget {
  const HomeLoadErrorView({
    super.key,
    required this.title,
    required this.message,
    required this.onRetry,
    required this.accentColor,
  });

  final String title;
  final String message;
  final Future<void> Function() onRetry;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        EmptyState(
          centered: true,
          icon: Icons.cloud_off_rounded,
          eyebrow: 'Sem conexão com o salão',
          title: title,
          message: message,
          actionLabel: 'Tentar novamente',
          onAction: onRetry,
          accentColor: accentColor,
        ),
      ],
    );
  }
}
