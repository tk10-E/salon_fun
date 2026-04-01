import 'package:intl/intl.dart';

import '../../growth_journey/domain/growth_journey_models.dart';
import '../domain/retention_v1_models.dart';

class RetentionV1PushPlanner {
  const RetentionV1PushPlanner();

  RetentionV1PushPlan? buildDueSoonPlan(RetentionV1Experience experience) {
    if (!experience.flags.allowPushNotifications ||
        !experience.flags.allowDueSoonPush ||
        (experience.urgency != GrowthUrgency.dueSoon &&
            experience.urgency != GrowthUrgency.dueNow)) {
      return null;
    }

    return RetentionV1PushPlan(
      type: RetentionV1PushType.dueSoon,
      title: 'Seu próximo horário pode ficar resolvido agora',
      body:
          'Seu ${experience.bookingRequest.serviceName} já está pronto para reservar sem começar tudo de novo.',
      payload: <String, String>{
        'type': RetentionV1PushType.dueSoon.notificationType,
        'serviceId': experience.bookingRequest.serviceId,
        'serviceName': experience.bookingRequest.serviceName,
      },
    );
  }

  RetentionV1PushPlan? buildAbandonedBookingPlan(
    RetentionV1BookingRequest request, {
    required RetentionV1FeatureFlags flags,
  }) {
    if (!flags.allowPushNotifications || !flags.allowAbandonedBookingPush) {
      return null;
    }

    return RetentionV1PushPlan(
      type: RetentionV1PushType.abandonedBooking,
      title: 'Seu agendamento ficou quase pronto',
      body:
          'Se quiser retomar ${request.serviceName}, a gente deixou o caminho salvo para você voltar sem atrito.',
      payload: <String, String>{
        'type': RetentionV1PushType.abandonedBooking.notificationType,
        'serviceId': request.serviceId,
        'serviceName': request.serviceName,
      },
    );
  }

  RetentionV1PushPlan? buildMatchedVacancyPlan(
    RetentionV1Experience experience,
    GrowthAvailableWindow window,
  ) {
    if (!experience.flags.allowPushNotifications ||
        !experience.flags.allowMatchedVacancyPush) {
      return null;
    }

    return RetentionV1PushPlan(
      type: RetentionV1PushType.matchedVacancy,
      title: 'Abriu um encaixe que combina com você',
      body:
          '${DateFormat('dd/MM • HH:mm').format(window.startAt)} ficou livre para ${experience.bookingRequest.serviceName}${window.staffMemberName.trim().isEmpty ? '' : ' com ${window.staffMemberName}'}.',
      payload: <String, String>{
        'type': RetentionV1PushType.matchedVacancy.notificationType,
        'serviceId': experience.bookingRequest.serviceId,
        'serviceName': experience.bookingRequest.serviceName,
        'startsAt': window.startAt.toIso8601String(),
        'staffMemberId': window.staffMemberId ?? '',
        'staffMemberName': window.staffMemberName,
      },
    );
  }
}
