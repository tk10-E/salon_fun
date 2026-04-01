import 'package:intl/intl.dart';

import '../domain/growth_journey_models.dart';

enum GrowthScreenType { home, booking, profile, loyalty }

enum GrowthBlockTone { brand, success, warning, neutral }

class GrowthUiBlock {
  const GrowthUiBlock({
    required this.id,
    required this.eyebrow,
    required this.title,
    required this.summary,
    required this.purpose,
    required this.ctaLabel,
    required this.logic,
    this.highlight,
    this.supportingCopy,
    this.tone = GrowthBlockTone.neutral,
  });

  final String id;
  final String eyebrow;
  final String title;
  final String summary;
  final String purpose;
  final String ctaLabel;
  final String logic;
  final String? highlight;
  final String? supportingCopy;
  final GrowthBlockTone tone;
}

class GrowthScreenDefinition {
  const GrowthScreenDefinition({
    required this.type,
    required this.title,
    required this.subtitle,
    required this.primaryCtaLabel,
    required this.blocks,
  });

  final GrowthScreenType type;
  final String title;
  final String subtitle;
  final String primaryCtaLabel;
  final List<GrowthUiBlock> blocks;
}

class GrowthJourneyPlaybook {
  const GrowthJourneyPlaybook({
    required this.screens,
    required this.routineInsight,
    required this.recommendedService,
    required this.recommendedWindow,
  });

  final List<GrowthScreenDefinition> screens;
  final GrowthRoutineInsight routineInsight;
  final GrowthServiceSummary recommendedService;
  final GrowthAvailableWindow? recommendedWindow;

  GrowthScreenDefinition screen(GrowthScreenType type) {
    return screens.firstWhere((item) => item.type == type);
  }
}

class GrowthJourneyBuilder {
  const GrowthJourneyBuilder();

  GrowthJourneyPlaybook build(GrowthJourneySnapshot snapshot, {DateTime? now}) {
    final reference = now ?? DateTime.now();
    final visits = [...snapshot.visitHistory]
      ..sort((left, right) => right.visitedAt.compareTo(left.visitedAt));

    if (visits.isEmpty) {
      throw StateError(
        'Growth journey requires at least one visit history entry',
      );
    }

    final lastVisit = visits.first;
    final rule = _resolveRule(lastVisit);
    final daysSinceLastVisit = reference
        .difference(_dateOnly(lastVisit.visitedAt))
        .inDays;
    final recommendedBookingDate = _dateOnly(
      lastVisit.visitedAt.add(Duration(days: rule.revisitEveryDays)),
    );
    final routineInsight = GrowthRoutineInsight(
      lastVisit: lastVisit,
      rule: rule,
      urgency: _resolveUrgency(daysSinceLastVisit, rule),
      daysSinceLastVisit: daysSinceLastVisit,
      recommendedBookingDate: recommendedBookingDate,
    );

    final recommendedService = _resolveRecommendedService(snapshot, lastVisit);
    final recommendedWindow = _resolveRecommendedWindow(snapshot);

    return GrowthJourneyPlaybook(
      routineInsight: routineInsight,
      recommendedService: recommendedService,
      recommendedWindow: recommendedWindow,
      screens: [
        _buildHomeScreen(
          snapshot: snapshot,
          insight: routineInsight,
          service: recommendedService,
          window: recommendedWindow,
        ),
        _buildBookingScreen(
          snapshot: snapshot,
          insight: routineInsight,
          service: recommendedService,
          window: recommendedWindow,
        ),
        _buildProfileScreen(
          snapshot: snapshot,
          insight: routineInsight,
          service: recommendedService,
        ),
        _buildLoyaltyScreen(
          snapshot: snapshot,
          insight: routineInsight,
          service: recommendedService,
        ),
      ],
    );
  }

  GrowthScreenDefinition _buildHomeScreen({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required GrowthServiceSummary service,
    required GrowthAvailableWindow? window,
  }) {
    final urgencySummary = switch (insight.urgency) {
      GrowthUrgency.lapsed =>
        'Cliente ja saiu da janela ideal e precisa de winback com um atalho forte para voltar.',
      GrowthUrgency.dueNow =>
        'Cliente entrou na janela ideal e deve ver o proximo retorno na primeira dobra.',
      GrowthUrgency.dueSoon =>
        'Cliente esta perto da janela ideal e pode converter com baixa friccao.',
      GrowthUrgency.onTrack =>
        'Cliente ainda esta no ritmo, mas ja pode travar o proximo horario.',
    };

    return GrowthScreenDefinition(
      type: GrowthScreenType.home,
      title: 'Home orientada a retorno',
      subtitle:
          'Abre com o proximo agendamento mais facil de fechar, nao com conteudo disperso.',
      primaryCtaLabel: 'Agendar ${service.name}',
      blocks: [
        GrowthUiBlock(
          id: 'home-routine',
          eyebrow: 'Bloco 01',
          title: 'Hero de rebook inteligente',
          summary:
              'Mostra "${_urgencyHeadline(insight)}" com base na ultima visita de ${DateFormat('dd/MM').format(insight.lastVisit.visitedAt)}.',
          purpose: 'Puxar o proximo agendamento antes que o cliente esfrie.',
          ctaLabel: 'Agendar novamente',
          logic:
              'Usa ultimo servico concluido + categoria + janela de frequencia + urgencia para decidir a copy principal.',
          highlight: insight.urgency.label,
          tone: insight.urgency == GrowthUrgency.onTrack
              ? GrowthBlockTone.brand
              : GrowthBlockTone.warning,
        ),
        GrowthUiBlock(
          id: 'home-window',
          eyebrow: 'Bloco 02',
          title: 'Proximo melhor horario',
          summary: window == null
              ? 'Se nao houver encaixe claro, a home cai para "ver proximos horarios".'
              : 'Destaca um horario que respeita preferencia de periodo e profissional: ${_formatWindow(window)}.',
          purpose: 'Reduzir decisao e acelerar conversao em um toque.',
          ctaLabel: 'Ver horarios',
          logic:
              'Prioriza horario alinhado a preferencias inferidas do historico, depois cai para o proximo horario disponivel.',
          supportingCopy:
              'Evita obrigar o cliente a explorar a agenda inteira.',
          tone: GrowthBlockTone.success,
        ),
        GrowthUiBlock(
          id: 'home-wallet',
          eyebrow: 'Bloco 03',
          title: 'Momentum de fidelidade',
          summary:
              'Exibe saldo, proximidade da proxima recompensa e motivo para voltar agora.',
          purpose:
              'Aumentar recorrencia e ticket sem depender de desconto amplo.',
          ctaLabel: 'Abrir carteira',
          logic:
              'Se houver cashback ou recompensa disponivel, sobe no layout. Se nao houver, mostra progresso para proxima vantagem.',
          highlight: _loyaltyHighlight(snapshot.loyalty),
          tone: GrowthBlockTone.brand,
        ),
        GrowthUiBlock(
          id: 'home-recovery',
          eyebrow: 'Bloco 04',
          title: 'Recuperacao de vaga relevante',
          summary:
              'Quando surgir cancelamento, a home injeta um card de encaixe com contexto do servico e urgencia.',
          purpose: 'Recuperar receita sem notificar a base inteira.',
          ctaLabel: 'Pegar encaixe',
          logic:
              'So aparece quando vaga liberada combina com servico, frequencia e preferencia do cliente.',
          tone: GrowthBlockTone.neutral,
        ),
      ],
    );
  }

  GrowthScreenDefinition _buildBookingScreen({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required GrowthServiceSummary service,
    required GrowthAvailableWindow? window,
  }) {
    final favoriteStaff = snapshot.preferences.favoriteStaffMemberIds.isNotEmpty
        ? 'Sim'
        : 'Nao';

    return GrowthScreenDefinition(
      type: GrowthScreenType.booking,
      title: 'Booking com menos atrito',
      subtitle:
          'A reserva deve confirmar habito, nao obrigar o cliente a recomecar toda a escolha.',
      primaryCtaLabel: 'Confirmar horario',
      blocks: [
        GrowthUiBlock(
          id: 'booking-service',
          eyebrow: 'Bloco 01',
          title: 'Rail de servicos prioritarios',
          summary:
              'Comeca com "${service.name}" e um segundo card de add-on de maior margem.',
          purpose: 'Aumentar conversao e ticket medio no mesmo fluxo.',
          ctaLabel: 'Escolher servico',
          logic:
              'Ordena por ultimo servico, favoritos e servicos da mesma categoria. Add-on entra apenas se couber na janela.',
          highlight: _currencyLabel(service.price),
          tone: GrowthBlockTone.brand,
        ),
        GrowthUiBlock(
          id: 'booking-staff',
          eyebrow: 'Bloco 02',
          title: 'Preferencia de profissional',
          summary:
              'Cliente ve "Seu profissional preferido" antes da lista completa. Favorito ativo: $favoriteStaff.',
          purpose:
              'Reduzir hesitacao e proteger relacao com o profissional certo.',
          ctaLabel: 'Manter preferido',
          logic:
              'Se houver historico recorrente com o mesmo profissional, ele vira default; senao, o app sugere "qualquer um mais rapido".',
          tone: GrowthBlockTone.success,
        ),
        GrowthUiBlock(
          id: 'booking-slots',
          eyebrow: 'Bloco 03',
          title: 'Grade de horarios com recomendacao',
          summary: window == null
              ? 'Exibe o primeiro grupo de horarios da semana com badge "mais cedo".'
              : 'Marca ${_formatWindow(window)} como "melhor para voce".',
          purpose:
              'Levar o cliente para um horario provavel em vez de uma lista indiferenciada.',
          ctaLabel: 'Selecionar horario',
          logic:
              'Cruza dia da semana, periodo preferido e proximidade com a data ideal de retorno.',
          highlight: DateFormat('dd/MM').format(insight.recommendedBookingDate),
          tone: GrowthBlockTone.warning,
        ),
        GrowthUiBlock(
          id: 'booking-summary',
          eyebrow: 'Bloco 04',
          title: 'Resumo fixo e CTA final',
          summary:
              'Rodape fixo com servico, profissional, horario, beneficio aplicavel e valor final.',
          purpose:
              'Fechar a reserva sem o cliente perder contexto nem beneficio.',
          ctaLabel: 'Reservar agora',
          logic:
              'Se houver cashback ou recompensa, aplica no resumo. Se houver risco de no-show, antecipa regra de confirmacao.',
          tone: GrowthBlockTone.neutral,
        ),
      ],
    );
  }

  GrowthScreenDefinition _buildProfileScreen({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required GrowthServiceSummary service,
  }) {
    final dayParts = snapshot.preferences.preferredDayParts.isEmpty
        ? 'Sem preferencia explicita'
        : snapshot.preferences.preferredDayParts
              .map((item) => item.label)
              .join(', ');

    return GrowthScreenDefinition(
      type: GrowthScreenType.profile,
      title: 'Profile que alimenta retencao',
      subtitle:
          'Perfil deixa de ser cadastro passivo e vira painel da rotina de beleza do cliente.',
      primaryCtaLabel: 'Salvar preferencias',
      blocks: [
        GrowthUiBlock(
          id: 'profile-routine',
          eyebrow: 'Bloco 01',
          title: 'Resumo da rotina atual',
          summary:
              'Abre com ultimo servico, frequencia esperada e status: ${insight.urgency.label}.',
          purpose:
              'Dar contexto rapido para o cliente entender quando deve voltar.',
          ctaLabel: 'Ver proxima recomendacao',
          logic:
              'Comprime historico em uma leitura simples: ultimo atendimento + dias sem voltar + data recomendada.',
          highlight: '${insight.daysSinceLastVisit} dias',
          tone: GrowthBlockTone.brand,
        ),
        GrowthUiBlock(
          id: 'profile-preferences',
          eyebrow: 'Bloco 02',
          title: 'Preferencias operacionais',
          summary:
              'Campos para periodo favorito, profissional favorito, alergias e observacoes de beleza. Periodos atuais: $dayParts.',
          purpose:
              'Melhorar booking futuro e personalizacao sem criar friccao no cadastro.',
          ctaLabel: 'Atualizar perfil',
          logic:
              'Essas preferencias alimentam sugestoes de horario, atendimento e comunicacao de retorno.',
          tone: GrowthBlockTone.success,
        ),
        GrowthUiBlock(
          id: 'profile-history',
          eyebrow: 'Bloco 03',
          title: 'Timeline de visitas',
          summary:
              'Lista ultimas visitas com servico, ticket e profissional para reforcar continuidade.',
          purpose:
              'Aumentar confianca e facilitar rebook de servicos recorrentes.',
          ctaLabel: 'Repetir ultimo servico',
          logic:
              'Card de cada visita vira atalho para rebooking de um toque com o mesmo contexto.',
          highlight: service.name,
          tone: GrowthBlockTone.neutral,
        ),
        GrowthUiBlock(
          id: 'profile-retention-settings',
          eyebrow: 'Bloco 04',
          title: 'Preferencias de comunicacao',
          summary:
              'Controla push, WhatsApp e avisos de oportunidade sem desligar mensagens essenciais.',
          purpose:
              'Preservar entregabilidade e reduzir cancelamento por excesso de contato.',
          ctaLabel: 'Ajustar notificacoes',
          logic:
              'Confirma rebook e lembretes transacionais sempre; ofertas e winbacks respeitam opt-in.',
          tone: GrowthBlockTone.warning,
        ),
      ],
    );
  }

  GrowthScreenDefinition _buildLoyaltyScreen({
    required GrowthJourneySnapshot snapshot,
    required GrowthRoutineInsight insight,
    required GrowthServiceSummary service,
  }) {
    final loyalty = snapshot.loyalty;
    final nextRewardMessage = loyalty.availableRewardsCount > 0
        ? 'Cliente ja tem recompensa disponivel para usar.'
        : loyalty.visitsToNextTier > 0
        ? 'Faltam ${loyalty.visitsToNextTier} visitas para a proxima vantagem.'
        : 'Sem regra de proxima recompensa definida.';

    return GrowthScreenDefinition(
      type: GrowthScreenType.loyalty,
      title: 'Loyalty que puxa nova receita',
      subtitle:
          'A carteira existe para acelerar a proxima reserva, nao para ficar escondida depois da compra.',
      primaryCtaLabel: 'Usar beneficio na reserva',
      blocks: [
        GrowthUiBlock(
          id: 'loyalty-balance',
          eyebrow: 'Bloco 01',
          title: 'Hero de saldo e status',
          summary:
              'Mostra cashback, pontos e recompensa disponivel no topo com linguagem de proxima visita.',
          purpose: 'Transformar beneficio acumulado em reserva concreta.',
          ctaLabel: 'Aplicar beneficio',
          logic:
              'Se houver saldo ou recompensa, o app puxa para a reserva. Se nao houver, mostra progresso claro.',
          highlight: _loyaltyHighlight(loyalty),
          tone: GrowthBlockTone.brand,
        ),
        GrowthUiBlock(
          id: 'loyalty-progress',
          eyebrow: 'Bloco 02',
          title: 'Barra de progresso para recorrencia',
          summary: nextRewardMessage,
          purpose:
              'Criar motivo objetivo para a proxima visita acontecer logo.',
          ctaLabel: 'Acelerar proximo nivel',
          logic:
              'Progresso e recompensa ficam ligados ao rebook, nao escondidos em extrato secundario.',
          tone: GrowthBlockTone.success,
        ),
        GrowthUiBlock(
          id: 'loyalty-referral',
          eyebrow: 'Bloco 03',
          title: 'Loop de indicacao',
          summary:
              'Cliente acompanha quantas indicacoes qualificadas ja gerou e o que isso desbloqueia.',
          purpose: 'Gerar aquisicao com CAC baixo sem perder foco em retorno.',
          ctaLabel: 'Compartilhar codigo',
          logic:
              'Codigo, status da meta e recompensa aparecem juntos para reduzir abandono da campanha.',
          highlight: '${loyalty.qualifiedReferralCount} indicacoes',
          tone: GrowthBlockTone.neutral,
        ),
        GrowthUiBlock(
          id: 'loyalty-rebook',
          eyebrow: 'Bloco 04',
          title: 'CTA de volta para a agenda',
          summary:
              'Toda vantagem termina em um CTA de reserva do servico ${service.name}.',
          purpose:
              'Conectar beneficio direto a receita, sem beco sem saida na carteira.',
          ctaLabel: 'Reservar com beneficio',
          logic:
              'O ultimo bloco da tela sempre devolve o usuario para booking com saldo e contexto preservados.',
          tone: insight.urgency == GrowthUrgency.onTrack
              ? GrowthBlockTone.success
              : GrowthBlockTone.warning,
        ),
      ],
    );
  }

  GrowthServiceSummary _resolveRecommendedService(
    GrowthJourneySnapshot snapshot,
    GrowthVisitHistoryEntry lastVisit,
  ) {
    for (final favoriteId in snapshot.preferences.favoriteServiceIds) {
      for (final service in snapshot.services) {
        if (service.id == favoriteId) {
          return service;
        }
      }
    }

    for (final service in snapshot.services) {
      if (lastVisit.serviceId != null && service.id == lastVisit.serviceId) {
        return service;
      }
    }

    for (final service in snapshot.services) {
      if (_normalize(service.name) == _normalize(lastVisit.serviceName)) {
        return service;
      }
    }

    for (final service in snapshot.services) {
      if (service.category != null &&
          lastVisit.serviceCategory != null &&
          _normalize(service.category!) ==
              _normalize(lastVisit.serviceCategory!)) {
        return service;
      }
    }

    return snapshot.services.first;
  }

  GrowthAvailableWindow? _resolveRecommendedWindow(
    GrowthJourneySnapshot snapshot,
  ) {
    if (snapshot.availableWindows.isEmpty) {
      return null;
    }

    final preferredWeekdays = snapshot.preferences.preferredWeekdays;
    final preferredDayParts = snapshot.preferences.preferredDayParts;
    final favoriteStaff = snapshot.preferences.favoriteStaffMemberIds;
    final windows = [...snapshot.availableWindows];

    windows.sort((left, right) {
      final leftScore = _windowScore(
        window: left,
        preferredWeekdays: preferredWeekdays,
        preferredDayParts: preferredDayParts,
        favoriteStaff: favoriteStaff,
      );
      final rightScore = _windowScore(
        window: right,
        preferredWeekdays: preferredWeekdays,
        preferredDayParts: preferredDayParts,
        favoriteStaff: favoriteStaff,
      );

      if (leftScore != rightScore) {
        return rightScore.compareTo(leftScore);
      }

      return left.startAt.compareTo(right.startAt);
    });

    return windows.first;
  }

  int _windowScore({
    required GrowthAvailableWindow window,
    required Set<int> preferredWeekdays,
    required Set<GrowthDayPart> preferredDayParts,
    required Set<String> favoriteStaff,
  }) {
    var score = 0;
    if (preferredWeekdays.contains(window.startAt.weekday)) {
      score += 3;
    }
    if (preferredDayParts.contains(window.dayPart)) {
      score += 2;
    }
    if (window.staffMemberId != null &&
        favoriteStaff.contains(window.staffMemberId)) {
      score += 4;
    }
    return score;
  }

  GrowthFrequencyRule _resolveRule(GrowthVisitHistoryEntry visit) {
    final haystack = _normalize(
      '${visit.serviceCategory ?? ''} ${visit.serviceName}',
    );

    for (final rule in _frequencyRules) {
      for (final keyword in rule.keywords) {
        if (haystack.contains(keyword)) {
          return rule;
        }
      }
    }

    return _defaultRule;
  }

  GrowthUrgency _resolveUrgency(
    int daysSinceLastVisit,
    GrowthFrequencyRule rule,
  ) {
    if (daysSinceLastVisit >= rule.lapseAfterDays) {
      return GrowthUrgency.lapsed;
    }
    if (daysSinceLastVisit >= rule.revisitEveryDays) {
      return GrowthUrgency.dueNow;
    }
    if (daysSinceLastVisit >= rule.revisitEveryDays - rule.rebookLeadDays) {
      return GrowthUrgency.dueSoon;
    }
    return GrowthUrgency.onTrack;
  }
}

final GrowthFrequencyRule _defaultRule = GrowthFrequencyRule(
  key: 'geral',
  keywords: const <String>[],
  revisitEveryDays: 30,
  rebookLeadDays: 7,
  lapseAfterDays: 45,
);

const List<GrowthFrequencyRule> _frequencyRules = <GrowthFrequencyRule>[
  GrowthFrequencyRule(
    key: 'barba',
    keywords: <String>['barba', 'beard'],
    revisitEveryDays: 15,
    rebookLeadDays: 4,
    lapseAfterDays: 25,
  ),
  GrowthFrequencyRule(
    key: 'corte',
    keywords: <String>['corte', 'haircut', 'fade'],
    revisitEveryDays: 30,
    rebookLeadDays: 7,
    lapseAfterDays: 45,
  ),
  GrowthFrequencyRule(
    key: 'unhas',
    keywords: <String>['manicure', 'pedicure', 'unha'],
    revisitEveryDays: 21,
    rebookLeadDays: 5,
    lapseAfterDays: 35,
  ),
  GrowthFrequencyRule(
    key: 'cor',
    keywords: <String>['color', 'mecha', 'luzes', 'tintura'],
    revisitEveryDays: 45,
    rebookLeadDays: 10,
    lapseAfterDays: 60,
  ),
  GrowthFrequencyRule(
    key: 'tratamento',
    keywords: <String>['hidrat', 'tratamento', 'botox', 'selagem'],
    revisitEveryDays: 21,
    rebookLeadDays: 5,
    lapseAfterDays: 35,
  ),
  GrowthFrequencyRule(
    key: 'lashes',
    keywords: <String>['cilios', 'lash', 'sobrancel'],
    revisitEveryDays: 21,
    rebookLeadDays: 5,
    lapseAfterDays: 35,
  ),
];

String _normalize(String value) {
  return value
      .toLowerCase()
      .replaceAll('á', 'a')
      .replaceAll('à', 'a')
      .replaceAll('ã', 'a')
      .replaceAll('â', 'a')
      .replaceAll('é', 'e')
      .replaceAll('ê', 'e')
      .replaceAll('í', 'i')
      .replaceAll('ó', 'o')
      .replaceAll('ô', 'o')
      .replaceAll('õ', 'o')
      .replaceAll('ú', 'u')
      .replaceAll('ç', 'c');
}

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

String _currencyLabel(double value) {
  return NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(value);
}

String _formatWindow(GrowthAvailableWindow window) {
  final day = DateFormat('dd/MM').format(window.startAt);
  final start = DateFormat('HH:mm').format(window.startAt);
  final end = DateFormat('HH:mm').format(window.endAt);
  return '$day, $start-$end com ${window.staffMemberName}';
}

String _urgencyHeadline(GrowthRoutineInsight insight) {
  switch (insight.urgency) {
    case GrowthUrgency.lapsed:
      return 'Voce ja passou da janela ideal para voltar';
    case GrowthUrgency.dueNow:
      return 'Seu proximo horario ja esta na hora certa';
    case GrowthUrgency.dueSoon:
      return 'Seu retorno ideal esta chegando';
    case GrowthUrgency.onTrack:
      return 'Vale travar seu proximo horario agora';
  }
}

String _loyaltyHighlight(GrowthLoyaltySnapshot loyalty) {
  if (loyalty.availableRewardsCount > 0) {
    return '${loyalty.availableRewardsCount} recompensa(s)';
  }
  if (loyalty.cashbackBalance > 0) {
    return _currencyLabel(loyalty.cashbackBalance);
  }
  if (loyalty.visitsToNextTier > 0) {
    return '${loyalty.visitsToNextTier} visita(s) para subir';
  }
  return '${loyalty.pointsBalance} pontos';
}
