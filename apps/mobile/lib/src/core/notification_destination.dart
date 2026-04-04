abstract final class ClientShellTabIndex {
  static const int home = 0;
  static const int explore = 1;
  static const int appointments = 2;
  static const int feed = 3;
  static const int profile = 4;
}

class NotificationDestination {
  const NotificationDestination({
    required this.analyticsTarget,
    required this.actionLabel,
    this.tabIndex,
    this.feedbackMessage,
    this.opensNotificationsCenter = false,
  });

  final String analyticsTarget;
  final String actionLabel;
  final int? tabIndex;
  final String? feedbackMessage;
  final bool opensNotificationsCenter;

  bool get hasTabTarget => tabIndex != null;
}

NotificationDestination resolveNotificationDestination(String rawType) {
  final type = rawType.trim().toLowerCase();

  if (type == 'vacancy_alert' || type.startsWith('appointment_')) {
    return const NotificationDestination(
      analyticsTarget: 'appointments',
      actionLabel: 'Ver agenda',
      tabIndex: ClientShellTabIndex.appointments,
      feedbackMessage: 'Abrimos sua agenda para continuar por aqui.',
    );
  }

  if (type == 'feed_post_published') {
    return const NotificationDestination(
      analyticsTarget: 'feed',
      actionLabel: 'Abrir feed',
      tabIndex: ClientShellTabIndex.feed,
      feedbackMessage: 'Abrimos o feed do salão para você.',
    );
  }

  if (type == 'winback_offer') {
    return const NotificationDestination(
      analyticsTarget: 'explore',
      actionLabel: 'Ver oferta',
      tabIndex: ClientShellTabIndex.explore,
      feedbackMessage: 'Abrimos a vitrine com sua campanha de retorno.',
    );
  }

  if (type == 'smart_rebook_prompt') {
    return const NotificationDestination(
      analyticsTarget: 'explore',
      actionLabel: 'Agendar retorno',
      tabIndex: ClientShellTabIndex.explore,
      feedbackMessage:
          'Abrimos o catálogo para você marcar sua próxima visita.',
    );
  }

  if (type.startsWith('promotion_') || type.startsWith('membership_')) {
    return const NotificationDestination(
      analyticsTarget: 'explore',
      actionLabel: 'Ver ofertas',
      tabIndex: ClientShellTabIndex.explore,
      feedbackMessage: 'Abrimos a vitrine do salão para você.',
    );
  }

  if (type.startsWith('service_')) {
    return const NotificationDestination(
      analyticsTarget: 'explore',
      actionLabel: 'Ver catálogo',
      tabIndex: ClientShellTabIndex.explore,
      feedbackMessage: 'Abrimos o catálogo do salão para você.',
    );
  }

  if (type.startsWith('referral_') || type.startsWith('loyalty_')) {
    return const NotificationDestination(
      analyticsTarget: 'profile',
      actionLabel: 'Ver benefícios',
      tabIndex: ClientShellTabIndex.profile,
      feedbackMessage: 'Abrimos sua área de benefícios.',
    );
  }

  return const NotificationDestination(
    analyticsTarget: 'notifications_center',
    actionLabel: 'Abrir avisos',
    feedbackMessage: 'Abrimos seus avisos.',
    opensNotificationsCenter: true,
  );
}
