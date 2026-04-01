import 'package:intl/intl.dart';

import '../domain/growth_journey_models.dart';
import '../domain/high_retention_experience_models.dart';
import 'growth_journey_builder.dart';

class HighRetentionExperienceBuilder {
  const HighRetentionExperienceBuilder({
    this.journeyBuilder = const GrowthJourneyBuilder(),
  });

  final GrowthJourneyBuilder journeyBuilder;

  HighRetentionExperienceModel build(
    GrowthJourneySnapshot snapshot, {
    DateTime? now,
  }) {
    final reference = now ?? DateTime.now();
    final playbook = journeyBuilder.build(snapshot, now: reference);
    final insight = playbook.routineInsight;
    final service = playbook.recommendedService;
    final window = playbook.recommendedWindow;
    final greeting = _greeting(reference);
    final headerTitle = _headerTitle(snapshot.customerName, insight);
    final headerBody = _headerBody(
      snapshot: snapshot,
      insight: insight,
      serviceName: service.name,
      window: window,
    );

    final home = HighRetentionHomeModel(
      greeting: greeting,
      headerTitle: headerTitle,
      headerBody: headerBody,
      stickyCta: HighRetentionAction(
        label: _stickyCtaLabel(insight, service.name),
        intent: 'book_recommended_service',
      ),
      sections: [
        _heroSection(
          snapshot: snapshot,
          insight: insight,
          serviceName: service.name,
          window: window,
        ),
        _bestTimeSection(snapshot: snapshot, insight: insight, window: window),
        _urgencySection(
          snapshot: snapshot,
          insight: insight,
          serviceName: service.name,
          window: window,
        ),
        _loyaltySection(snapshot, service.name),
        _identitySection(snapshot, insight, service.name),
        _inspirationSection(snapshot, service.name),
      ],
    );

    final rankedSlots = _rankedSlots(snapshot, window);
    final booking = HighRetentionBookingFlowModel(
      headline: _bookingHeadline(insight, service.name),
      serviceLabel:
          '${service.name} • ${_currency(service.price)} • ${service.durationMinutes} min',
      professionalLabel: _preferredProfessionalLabel(snapshot, window),
      slots: rankedSlots,
      summaryTitle: 'Seu horario ja esta quase fechado',
      summaryBody: _bookingSummaryBody(
        serviceName: service.name,
        window: rankedSlots.isNotEmpty ? rankedSlots.first.title : null,
        loyalty: snapshot.loyalty,
      ),
      confirmAction: const HighRetentionAction(
        label: 'Confirmar em 1 toque',
        intent: 'confirm_booking',
      ),
    );

    return HighRetentionExperienceModel(
      home: home,
      booking: booking,
      emotionalMessages: _emotionalMessages(
        snapshot: snapshot,
        insight: insight,
        serviceName: service.name,
      ),
    );
  }

  HighRetentionSectionModel _heroSection({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required String serviceName,
    required GrowthAvailableWindow? window,
  }) {
    return HighRetentionSectionModel(
      id: 'hero',
      eyebrow: 'Seu proximo passo',
      title: _heroTitle(insight, serviceName),
      body: _heroBody(
        snapshot: snapshot,
        insight: insight,
        serviceName: serviceName,
        window: window,
      ),
      primaryAction: HighRetentionAction(
        label: _stickyCtaLabel(insight, serviceName),
        intent: 'book_recommended_service',
      ),
      secondaryAction: const HighRetentionAction(
        label: 'Ver outros horarios',
        intent: 'open_schedule',
      ),
      chips: [
        insight.urgency.label,
        '${insight.daysSinceLastVisit} dias',
        if (window != null) _slotChip(window),
      ],
      tone: HighRetentionSectionTone.hero,
    );
  }

  HighRetentionSectionModel _bestTimeSection({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required GrowthAvailableWindow? window,
  }) {
    final preferredMoment = snapshot.preferences.preferredDayParts.isEmpty
        ? 'Seu melhor horario'
        : 'Seu melhor horario costuma ser na ${snapshot.preferences.preferredDayParts.first.label.toLowerCase()}';

    return HighRetentionSectionModel(
      id: 'best_time',
      eyebrow: 'Janela perfeita',
      title: window == null
          ? '$preferredMoment. Vamos abrir uma boa janela para voce.'
          : '${_weekday(window.startAt)} às ${_hour(window.startAt)} combina com o seu ritmo.',
      body: window == null
          ? 'Ainda nao apareceu um encaixe ideal com o seu historico, entao vamos te levar direto para os proximos horarios mais leves de decidir.'
          : 'Escolhemos esse horario porque ele respeita seu periodo favorito e o profissional que mais combina com seu ritual no salao.',
      primaryAction: HighRetentionAction(
        label: window == null ? 'Abrir agenda' : 'Quero esse horario',
        intent: 'accept_best_time',
      ),
      secondaryAction: const HighRetentionAction(
        label: 'Trocar horario',
        intent: 'change_slot',
      ),
      chips: [
        if (window != null) window.staffMemberName,
        if (snapshot.preferences.preferredDayParts.isNotEmpty)
          snapshot.preferences.preferredDayParts.first.label,
      ],
      meta: 'Objetivo: tirar a carga de decisao do cliente.',
      tone: HighRetentionSectionTone.accent,
    );
  }

  HighRetentionSectionModel _urgencySection({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required String serviceName,
    required GrowthAvailableWindow? window,
  }) {
    final hasTodayWindow =
        window != null && _isSameDay(window.startAt, DateTime.now());
    final title = hasTodayWindow
        ? 'Abriu um encaixe hoje e ele tem a sua cara.'
        : insight.urgency == GrowthUrgency.lapsed
        ? 'Seu retorno nao pode ficar para depois.'
        : 'Se voce quer manter o efeito bonito, esta e a hora.';

    final body = hasTodayWindow
        ? 'Hoje às ${_hour(window!.startAt)} ficou livre com ${window.staffMemberName}. Reservando agora, voce resolve isso em segundos.'
        : insight.urgency == GrowthUrgency.lapsed
        ? 'Voce saiu do ritmo ideal. Em vez de te empurrar desconto genérico, a gente esta te chamando de volta com o servico certo e o horario mais facil.'
        : 'O app puxou esta chamada agora porque sua rotina entrou na janela ideal de retorno. Quanto menos voce pensar, maior a chance de se sentir cuidada.';

    return HighRetentionSectionModel(
      id: 'urgency',
      eyebrow: 'Agora ou nunca',
      title: title,
      body: body,
      primaryAction: HighRetentionAction(
        label: hasTodayWindow ? 'Pegar encaixe' : 'Garantir meu horario',
        intent: 'claim_urgency_slot',
      ),
      chips: [
        serviceName,
        if (hasTodayWindow) 'Hoje',
        if (insight.urgency == GrowthUrgency.lapsed) 'Winback elegante',
      ],
      tone: HighRetentionSectionTone.urgency,
    );
  }

  HighRetentionSectionModel _loyaltySection(
    GrowthJourneySnapshot snapshot,
    String serviceName,
  ) {
    final loyalty = snapshot.loyalty;
    final title = loyalty.availableRewardsCount > 0
        ? 'Voce ja tem uma recompensa esperando a proxima visita.'
        : loyalty.visitsToNextTier == 1
        ? 'Sua proxima visita libera um novo nivel.'
        : loyalty.cashbackBalance > 0
        ? 'Seu saldo ja pode aliviar a proxima reserva.'
        : 'Sua frequencia esta construindo vantagens reais.';

    final body = loyalty.availableRewardsCount > 0
        ? 'Em vez de esconder seu ganho na carteira, a gente trouxe ele para perto da agenda. Use sua recompensa no $serviceName e sinta a diferenca agora.'
        : loyalty.visitsToNextTier == 1
        ? 'Falta uma visita para subir. Esse tipo de progresso visivel transforma retorno em jogo gostoso, nao em tarefa.'
        : loyalty.cashbackBalance > 0
        ? 'Voce acumulou ${_currency(loyalty.cashbackBalance)}. O melhor momento para usar isso e quando a vontade de voltar ja existe.'
        : 'Cada visita esta fortalecendo seu lugar dentro do salao. O app deixa esse caminho visivel para manter o impulso vivo.';

    return HighRetentionSectionModel(
      id: 'loyalty',
      eyebrow: 'Seu momentum',
      title: title,
      body: body,
      primaryAction: const HighRetentionAction(
        label: 'Abrir minha carteira',
        intent: 'open_wallet',
      ),
      secondaryAction: const HighRetentionAction(
        label: 'Usar na reserva',
        intent: 'apply_reward_to_booking',
      ),
      chips: [
        if (loyalty.cashbackBalance > 0) _currency(loyalty.cashbackBalance),
        if (loyalty.visitsToNextTier > 0)
          '${loyalty.visitsToNextTier} visita(s) para subir',
        if (loyalty.availableRewardsCount > 0)
          '${loyalty.availableRewardsCount} recompensa(s)',
      ],
      tone: HighRetentionSectionTone.reward,
    );
  }

  HighRetentionSectionModel _identitySection(
    GrowthJourneySnapshot snapshot,
    GrowthRoutineInsight insight,
    String serviceName,
  ) {
    final favoriteStaff = snapshot.preferences.favoriteStaffMemberIds.isNotEmpty
        ? 'Seu profissional favorito ja esta salvo.'
        : 'Ainda vamos descobrir qual profissional vira o seu favorito.';

    return HighRetentionSectionModel(
      id: 'identity',
      eyebrow: 'Seu estilo aqui dentro',
      title: 'Seu ritual no ${snapshot.salonName} ja tem assinatura.',
      body:
          'Seu historico mostra que voce gosta de $serviceName, volta num ritmo claro e prefere uma experiencia consistente. $favoriteStaff',
      primaryAction: const HighRetentionAction(
        label: 'Ver meu historico',
        intent: 'open_profile_history',
      ),
      secondaryAction: const HighRetentionAction(
        label: 'Ajustar preferencias',
        intent: 'edit_preferences',
      ),
      chips: [
        serviceName,
        if (snapshot.preferences.preferredDayParts.isNotEmpty)
          snapshot.preferences.preferredDayParts.first.label,
        if (snapshot.preferences.preferredWeekdays.isNotEmpty)
          'Dia forte: ${_weekdayFromInt(snapshot.preferences.preferredWeekdays.first)}',
      ],
      tone: HighRetentionSectionTone.quiet,
    );
  }

  HighRetentionSectionModel _inspirationSection(
    GrowthJourneySnapshot snapshot,
    String serviceName,
  ) {
    return HighRetentionSectionModel(
      id: 'inspiration',
      eyebrow: 'Inspire sem distrair',
      title: 'Um pouco de desejo, logo abaixo da decisao.',
      body:
          'A galeria nao vem para roubar sua atencao da reserva. Ela aparece depois da agenda essencial, mostrando resultados que combinam com $serviceName e reforcam o valor do salao.',
      primaryAction: const HighRetentionAction(
        label: 'Ver inspiracoes',
        intent: 'open_curated_gallery',
      ),
      secondaryAction: const HighRetentionAction(
        label: 'Salvar como proxima ideia',
        intent: 'save_inspiration',
      ),
      chips: const ['Antes e depois', 'Curadoria leve', 'Sem poluicao'],
      tone: HighRetentionSectionTone.quiet,
    );
  }

  List<RankedBookingSlot> _rankedSlots(
    GrowthJourneySnapshot snapshot,
    GrowthAvailableWindow? recommendedWindow,
  ) {
    final windows = [...snapshot.availableWindows];
    windows.sort((left, right) {
      if (recommendedWindow != null) {
        if (left.startAt == recommendedWindow.startAt) {
          return -1;
        }
        if (right.startAt == recommendedWindow.startAt) {
          return 1;
        }
      }
      return left.startAt.compareTo(right.startAt);
    });

    return windows.take(3).map((window) {
      final isBest =
          recommendedWindow != null &&
          window.startAt == recommendedWindow.startAt;
      return RankedBookingSlot(
        title:
            '${_weekday(window.startAt)}, ${DateFormat('dd/MM').format(window.startAt)} • ${_hour(window.startAt)}',
        reason: isBest
            ? 'Melhor equilibrio entre seu ritmo, sua recorrencia e sua profissional favorita.'
            : 'Boa alternativa caso voce queira ajustar o dia sem perder fluidez.',
        isBest: isBest,
      );
    }).toList();
  }

  List<String> _emotionalMessages({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required String serviceName,
  }) {
    return [
      'Seu proximo horario ja esta na hora certa.',
      'Se voce quer manter esse efeito bonito, este e o melhor momento.',
      'Hoje abriu um encaixe que combina com o seu ritmo.',
      'A Lia ficou livre e esse horario tem a sua cara.',
      'Voce esta a uma visita de subir de nivel.',
      'Seu saldo ja pode entrar na proxima reserva.',
      'Seu historico mostra um gosto muito claro. Vamos usar isso a seu favor.',
      'Nao precisa pensar tudo de novo. A gente puxou o melhor caminho.',
      'Seu ritual aqui ja tem assinatura.',
      'Uma boa volta começa antes da vontade esfriar.',
      if (insight.urgency == GrowthUrgency.lapsed)
        'Seu retorno merece um convite elegante, nao um empurrao qualquer.',
      'O salao lembra do que funciona em voce.',
      'Reservar agora leva menos tempo do que decidir depois.',
      'Seu momento favorito no salao pode ficar protegido hoje.',
      'A proxima visita ja esta te dando algo em troca.',
    ];
  }

  String _headerTitle(String customerName, GrowthRoutineInsight insight) {
    switch (insight.urgency) {
      case GrowthUrgency.onTrack:
        return '$customerName, vale deixar seu proximo horario protegido.';
      case GrowthUrgency.dueSoon:
        return '$customerName, seu proximo retorno esta se aproximando.';
      case GrowthUrgency.dueNow:
        return '$customerName, esse e o melhor momento para voltar.';
      case GrowthUrgency.lapsed:
        return '$customerName, vamos te trazer de volta do jeito certo.';
    }
  }

  String _headerBody({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required String serviceName,
    required GrowthAvailableWindow? window,
  }) {
    final base = switch (insight.urgency) {
      GrowthUrgency.onTrack =>
        'Seu historico mostra consistencia. O segredo agora e manter o cuidado sem precisar pensar demais.',
      GrowthUrgency.dueSoon =>
        'Voce esta entrando na janela ideal. Se reservar agora, sente o mesmo capricho sem correr atras depois.',
      GrowthUrgency.dueNow =>
        'Seu ultimo $serviceName ja entrou na hora certa de manutencao. O app puxou o caminho mais facil para voce repetir o que funciona.',
      GrowthUrgency.lapsed =>
        'A vontade de voltar costuma cair quando a decisao fica grande. Por isso ja deixamos o melhor atalho montado.',
    };
    if (window == null) {
      return base;
    }
    return '$base Melhor sugestao: ${_weekday(window.startAt)} às ${_hour(window.startAt)} com ${window.staffMemberName}.';
  }

  String _heroTitle(GrowthRoutineInsight insight, String serviceName) {
    switch (insight.urgency) {
      case GrowthUrgency.onTrack:
        return 'Seu $serviceName ainda esta bonito. Quer garantir o proximo antes da correria?';
      case GrowthUrgency.dueSoon:
        return 'Seu $serviceName vai pedir atencao nos proximos dias.';
      case GrowthUrgency.dueNow:
        return 'Seu $serviceName ja entrou na hora certa.';
      case GrowthUrgency.lapsed:
        return 'Seu $serviceName ficou para depois. Vamos resolver isso agora?';
    }
  }

  String _heroBody({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required String serviceName,
    required GrowthAvailableWindow? window,
  }) {
    final rhythmCopy = switch (insight.urgency) {
      GrowthUrgency.onTrack =>
        'Voce ainda esta no ritmo, mas reservar cedo e a forma mais inteligente de nao perder o efeito que voce gosta.',
      GrowthUrgency.dueSoon =>
        'Se voce agir agora, volta no tempo ideal e evita aquele momento em que o visual perde forca de uma vez.',
      GrowthUrgency.dueNow =>
        'Esse e o ponto em que o cliente sente que “ja estava na hora”. Estamos usando essa sensacao a seu favor.',
      GrowthUrgency.lapsed =>
        'Sem culpa, sem desconto desesperado. So um convite elegante para voce voltar com o servico certo.',
    };

    if (window == null) {
      return rhythmCopy;
    }

    return '$rhythmCopy O melhor atalho hoje e ${_weekday(window.startAt)} às ${_hour(window.startAt)} com ${window.staffMemberName}.';
  }

  String _bookingHeadline(GrowthRoutineInsight insight, String serviceName) {
    switch (insight.urgency) {
      case GrowthUrgency.onTrack:
        return 'Vamos deixar seu proximo $serviceName protegido.';
      case GrowthUrgency.dueSoon:
        return 'Seu proximo $serviceName pode ficar resolvido agora.';
      case GrowthUrgency.dueNow:
        return 'Seu $serviceName esta a um toque de acontecer de novo.';
      case GrowthUrgency.lapsed:
        return 'Voltar para o $serviceName agora vai parecer leve, nao trabalhoso.';
    }
  }

  String _bookingSummaryBody({
    required String serviceName,
    required String? window,
    required GrowthLoyaltySnapshot loyalty,
  }) {
    final benefit = loyalty.availableRewardsCount > 0
        ? 'Sua recompensa entra nessa reserva.'
        : loyalty.cashbackBalance > 0
        ? '${_currency(loyalty.cashbackBalance)} de saldo pode entrar aqui.'
        : 'Essa reserva ja empurra sua proxima vantagem.';

    if (window == null) {
      return '$serviceName pronto para confirmar. $benefit';
    }

    return '$serviceName em $window. $benefit';
  }

  String _preferredProfessionalLabel(
    GrowthJourneySnapshot snapshot,
    GrowthAvailableWindow? window,
  ) {
    if (window != null) {
      return 'Profissional sugerida: ${window.staffMemberName}';
    }
    if (snapshot.preferences.favoriteStaffMemberIds.isNotEmpty) {
      return 'Profissional preferida ja marcada';
    }
    return 'Profissional mais fluida primeiro, sem travar a sua decisao';
  }

  String _stickyCtaLabel(GrowthRoutineInsight insight, String serviceName) {
    switch (insight.urgency) {
      case GrowthUrgency.onTrack:
        return 'Proteger meu $serviceName';
      case GrowthUrgency.dueSoon:
        return 'Agendar antes que passe';
      case GrowthUrgency.dueNow:
        return 'Reservar meu proximo horario';
      case GrowthUrgency.lapsed:
        return 'Voltar com facilidade';
    }
  }

  String _slotChip(GrowthAvailableWindow window) {
    return '${_weekday(window.startAt)} ${_hour(window.startAt)}';
  }

  String _weekday(DateTime value) {
    return _weekdayLabels[value.weekday] ?? 'Dia';
  }

  String _weekdayFromInt(int weekday) {
    return _weekdayLabels[weekday] ?? 'Dia';
  }

  String _hour(DateTime value) => DateFormat('HH:mm').format(value);

  String _currency(double value) =>
      NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(value);

  String _greeting(DateTime now) {
    if (now.hour < 12) {
      return 'Bom dia';
    }
    if (now.hour < 18) {
      return 'Boa tarde';
    }
    return 'Boa noite';
  }

  bool _isSameDay(DateTime left, DateTime right) {
    return left.year == right.year &&
        left.month == right.month &&
        left.day == right.day;
  }
}

const Map<int, String> _weekdayLabels = <int, String>{
  DateTime.monday: 'Segunda',
  DateTime.tuesday: 'Terca',
  DateTime.wednesday: 'Quarta',
  DateTime.thursday: 'Quinta',
  DateTime.friday: 'Sexta',
  DateTime.saturday: 'Sabado',
  DateTime.sunday: 'Domingo',
};
