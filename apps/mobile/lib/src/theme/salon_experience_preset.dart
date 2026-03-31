import 'package:flutter/material.dart';

String normalizeSalonBusinessSegment(String? value) {
  switch (value?.trim()) {
    case 'nail_studio':
    case 'barbershop':
    case 'brows_lashes':
    case 'aesthetics_clinic':
      return value!.trim();
    case 'beauty_salon':
    default:
      return 'beauty_salon';
  }
}

class SalonExperiencePreset {
  const SalonExperiencePreset._({
    required this.value,
    required this.label,
    required this.appBarLabel,
    required this.segmentIcon,
    required this.heroSupportLine,
    required this.agendaMetricLabel,
    required this.benefitsMetricLabel,
    required this.portfolioMetricLabel,
    required this.momentumLabel,
    required this.momentumTitleWithFeed,
    required this.momentumTitleWithoutFeed,
    required this.momentumDescriptionWithFeed,
    required this.momentumDescriptionWithoutFeed,
    required this.benefitsPillLabel,
    required this.offersPillLabel,
    required this.feedPillLabel,
    required this.feedEyebrow,
    required this.feedTitle,
    required this.feedDescription,
    required this.feedEmptyTitle,
    required this.feedEmptyMessage,
    required this.feedConversionTitleWithLinked,
    required this.feedConversionTitleWithoutLinked,
    required this.feedConversionDescriptionWithLinked,
    required this.feedConversionDescriptionWithoutLinked,
    required this.feedSupportLine,
    required this.membershipSubtitle,
    required this.offerSubtitle,
    required this.postsSubtitle,
    required this.benefitsSubtitle,
    required this.noServicesSubtitle,
    required this.joinUnknownTagline,
    required this.joinKnownTagline,
    required this.joinPendingTitle,
    required this.joinPendingDescription,
    required this.joinConnectedDescription,
    required this.joinVerificationMessage,
    required this.joinSuccessMessage,
    required this.highlightCollectionLabel,
    required this.highlightCollectionNote,
    required this.highlightPortfolioLabel,
    required this.highlightPortfolioEmptyNote,
    required this.highlightPortfolioFilledNote,
  });

  final String value;
  final String label;
  final String appBarLabel;
  final IconData segmentIcon;
  final String heroSupportLine;
  final String agendaMetricLabel;
  final String benefitsMetricLabel;
  final String portfolioMetricLabel;
  final String momentumLabel;
  final String momentumTitleWithFeed;
  final String momentumTitleWithoutFeed;
  final String momentumDescriptionWithFeed;
  final String momentumDescriptionWithoutFeed;
  final String benefitsPillLabel;
  final String offersPillLabel;
  final String feedPillLabel;
  final String feedEyebrow;
  final String feedTitle;
  final String feedDescription;
  final String feedEmptyTitle;
  final String feedEmptyMessage;
  final String feedConversionTitleWithLinked;
  final String feedConversionTitleWithoutLinked;
  final String feedConversionDescriptionWithLinked;
  final String feedConversionDescriptionWithoutLinked;
  final String feedSupportLine;
  final String membershipSubtitle;
  final String offerSubtitle;
  final String postsSubtitle;
  final String benefitsSubtitle;
  final String noServicesSubtitle;
  final String joinUnknownTagline;
  final String joinKnownTagline;
  final String joinPendingTitle;
  final String joinPendingDescription;
  final String joinConnectedDescription;
  final String joinVerificationMessage;
  final String joinSuccessMessage;
  final String highlightCollectionLabel;
  final String highlightCollectionNote;
  final String highlightPortfolioLabel;
  final String highlightPortfolioEmptyNote;
  final String highlightPortfolioFilledNote;

  static SalonExperiencePreset fromBusinessSegment(String? value) {
    switch (normalizeSalonBusinessSegment(value)) {
      case 'nail_studio':
        return nailStudio;
      case 'barbershop':
        return barbershop;
      case 'brows_lashes':
        return browsLashes;
      case 'aesthetics_clinic':
        return aestheticsClinic;
      case 'beauty_salon':
      default:
        return beautySalon;
    }
  }

  String nextAvailableSubtitle(String nextAvailableLabel) {
    switch (value) {
      case 'nail_studio':
        return 'Sua próxima manutenção pode sair em $nextAvailableLabel.';
      case 'barbershop':
        return 'Seu próximo corte pode sair em $nextAvailableLabel.';
      case 'brows_lashes':
        return 'Seu próximo retoque pode sair em $nextAvailableLabel.';
      case 'aesthetics_clinic':
        return 'Seu próximo protocolo pode sair em $nextAvailableLabel.';
      case 'beauty_salon':
      default:
        return 'Seu próximo horário pode sair em $nextAvailableLabel.';
    }
  }

  String servicesAvailableSubtitle(List<String> highlights) {
    final joinedHighlights = highlights.join(' • ');

    switch (value) {
      case 'nail_studio':
        return '$joinedHighlights disponíveis no app.';
      case 'barbershop':
        return '$joinedHighlights disponíveis no app.';
      case 'brows_lashes':
        return '$joinedHighlights disponíveis no app.';
      case 'aesthetics_clinic':
        return '$joinedHighlights disponíveis no app.';
      case 'beauty_salon':
      default:
        return '$joinedHighlights disponíveis para agendamento no app.';
    }
  }

  List<String> joinValueHighlights(String salonLabel) {
    switch (value) {
      case 'nail_studio':
        return [
          'Agenda, referências e identidade de $salonLabel no app.',
          'Carteira com manutenção e vantagens quando o studio ativar.',
          'Contato rápido para alinhar referência e retorno.',
        ];
      case 'barbershop':
        return [
          'Agenda, profissionais e identidade de $salonLabel no app.',
          'Rotina, vantagens e avisos para manter corte e barba em dia.',
          'Contato direto para alinhar estilo e horário.',
        ];
      case 'brows_lashes':
        return [
          'Agenda, retoques e identidade de $salonLabel no app.',
          'Carteira com retorno e vantagens no timing certo.',
          'Contato rápido para alinhar preferências e cuidados.',
        ];
      case 'aesthetics_clinic':
        return [
          'Agenda, protocolos e identidade de $salonLabel no app.',
          'Carteira com acompanhamento e retorno organizado.',
          'Contato direto para alinhar dúvidas e próximos passos.',
        ];
      case 'beauty_salon':
      default:
        return [
          'Agenda, serviços e identidade de $salonLabel no app.',
          'Carteira com fidelidade e ofertas quando o salão ativar.',
          'Contato rápido para decidir, reservar e voltar.',
        ];
    }
  }

  static const SalonExperiencePreset beautySalon = SalonExperiencePreset._(
    value: 'beauty_salon',
    label: 'Salão',
    appBarLabel: 'Seu app do salão',
    segmentIcon: Icons.auto_awesome_rounded,
    heroSupportLine: 'Escolha, converse e reserve no mesmo lugar.',
    agendaMetricLabel: 'Próximo horário',
    benefitsMetricLabel: 'Benefícios',
    portfolioMetricLabel: 'Vitrine',
    momentumLabel: 'Momento do salão',
    momentumTitleWithFeed: 'Seu próximo visual pode começar agora',
    momentumTitleWithoutFeed: 'Sua próxima reserva pode sair mais rápido daqui',
    momentumDescriptionWithFeed:
        'Horários, inspirações e benefícios estão no mesmo lugar para transformar vontade em agendamento sem atrito.',
    momentumDescriptionWithoutFeed:
        'A agenda real do salão já está aqui com tudo que ajuda você a decidir melhor e voltar com mais frequência.',
    benefitsPillLabel: 'Benefícios acompanhados no app',
    offersPillLabel: 'Planos e ofertas ativos',
    feedPillLabel: 'Vitrine com resultados reais',
    feedEyebrow: 'Feed do salão',
    feedTitle: 'Resultados, novidades e inspirações',
    feedDescription:
        'Veja transformações reais, vídeos curtos e resultados assinados pelo salão para escolher seu próximo atendimento com mais desejo e confiança.',
    feedEmptyTitle: 'Seu próximo visual favorito vai aparecer aqui',
    feedEmptyMessage:
        'Quando o salão publicar transformações, vídeos e resultados reais, você vai poder salvar a referência, conversar e decidir com muito mais confiança.',
    feedConversionTitleWithLinked:
        'Seu próximo visual pode sair do feed de hoje',
    feedConversionTitleWithoutLinked:
        'Use o feed para descobrir o atendimento que mais combina com você',
    feedConversionDescriptionWithLinked:
        'Há resultados com reserva direta, transformações reais e referências que ajudam você a imaginar como vai sair do salão antes mesmo de marcar.',
    feedConversionDescriptionWithoutLinked:
        'Mesmo quando a publicação ainda não estiver ligada a um serviço, ela já funciona como referência para você conversar com o salão e montar o visual ideal.',
    feedSupportLine:
        'Peça a referência, marque o serviço ou converse com o salão sem sair do app.',
    membershipSubtitle: 'Planos e horários do salão em uma leitura rápida.',
    offerSubtitle: 'Ofertas e horários prontos para reservar.',
    postsSubtitle: 'Resultados reais para escolher seu próximo cuidado.',
    benefitsSubtitle: 'Sua carteira e seus retornos no mesmo app.',
    noServicesSubtitle: 'Agenda e contato do salão no mesmo lugar.',
    joinUnknownTagline: 'Logo, agenda e identidade do salão no app.',
    joinKnownTagline: 'Essa é a marca que o cliente vai ver no app.',
    joinPendingTitle: 'Conecte sua conta ao salão certo.',
    joinPendingDescription: 'Digite o código para liberar agenda e marca.',
    joinConnectedDescription: 'Ao confirmar, o app assume a marca certa.',
    joinVerificationMessage:
        'Você vai entrar em {salon} com agenda e marca certas.',
    joinSuccessMessage: 'Tudo pronto. {salon} já está no seu app.',
    highlightCollectionLabel: 'Serviços do salão',
    highlightCollectionNote: 'Preço visível e escolha sem atrito',
    highlightPortfolioLabel: 'Vitrine do salão',
    highlightPortfolioEmptyNote:
        'Quando o salão publicar, a vitrine aparece aqui para inspirar sua próxima visita',
    highlightPortfolioFilledNote:
        'Resultados reais para escolher com mais desejo e confiança',
  );

  static const SalonExperiencePreset nailStudio = SalonExperiencePreset._(
    value: 'nail_studio',
    label: 'Nail studio',
    appBarLabel: 'Seu nail studio no app',
    segmentIcon: Icons.back_hand_rounded,
    heroSupportLine:
        'Escolha a referência, cuide da manutenção e reserve no app.',
    agendaMetricLabel: 'Próxima manutenção',
    benefitsMetricLabel: 'Clube da cliente',
    portfolioMetricLabel: 'Inspirações',
    momentumLabel: 'Ritmo do studio',
    momentumTitleWithFeed: 'Suas próximas unhas já podem sair dessa vitrine',
    momentumTitleWithoutFeed:
        'Seu studio já está pronto para organizar manutenção e retorno',
    momentumDescriptionWithFeed:
        'Referências, horários e benefícios aparecem juntos para transformar inspiração em reserva sem perda de timing.',
    momentumDescriptionWithoutFeed:
        'A agenda do studio já ajuda você a visualizar manutenção, conversar com o salão e voltar no melhor momento.',
    benefitsPillLabel: 'Manutenção e carteira no app',
    offersPillLabel: 'Combos e ofertas ativos',
    feedPillLabel: 'Vitrine com nail arts reais',
    feedEyebrow: 'Vitrine do studio',
    feedTitle: 'Nail arts, acabamentos e ideias para sua próxima visita',
    feedDescription:
        'Veja resultados reais, cores, formatos e vídeos curtos para escolher a próxima referência com mais segurança e desejo.',
    feedEmptyTitle: 'Sua próxima referência de unhas vai aparecer aqui',
    feedEmptyMessage:
        'Quando o studio publicar alongamentos, manutenções e acabamentos reais, você vai conseguir escolher com muito mais clareza.',
    feedConversionTitleWithLinked:
        'Sua próxima manutenção ou nail art pode sair do feed de hoje',
    feedConversionTitleWithoutLinked:
        'Use o feed para escolher a referência certa antes de conversar com o studio',
    feedConversionDescriptionWithLinked:
        'Há resultados com reserva direta, referências reais e combinações que ajudam você a imaginar cor, formato e acabamento antes mesmo de marcar.',
    feedConversionDescriptionWithoutLinked:
        'Mesmo quando o post ainda não estiver ligado a um serviço, ele já funciona como referência para você alinhar estilo e acabamento com o studio.',
    feedSupportLine:
        'Peça a referência, combine a manutenção e reserve sem sair do app.',
    membershipSubtitle: 'Combos e horários do studio em uma leitura rápida.',
    offerSubtitle: 'Ofertas e manutenção organizadas no app.',
    postsSubtitle: 'Referências reais para escolher sua próxima visita.',
    benefitsSubtitle: 'Sua carteira e sua manutenção no mesmo app.',
    noServicesSubtitle: 'Agenda e contato do studio no mesmo lugar.',
    joinUnknownTagline: 'Referências, agenda e identidade do studio no app.',
    joinKnownTagline: 'Esse é o estilo que o cliente vai ver no app.',
    joinPendingTitle: 'Conecte sua conta ao nail studio certo.',
    joinPendingDescription: 'Digite o código para liberar agenda e referências.',
    joinConnectedDescription: 'Ao confirmar, o app assume o studio certo.',
    joinVerificationMessage:
        'Você vai entrar em {salon} com agenda e referências certas.',
    joinSuccessMessage: 'Tudo pronto. {salon} já está no seu app.',
    highlightCollectionLabel: 'Serviços do studio',
    highlightCollectionNote:
        'Combinações, manutenção e escolha com menos atrito',
    highlightPortfolioLabel: 'Vitrine do studio',
    highlightPortfolioEmptyNote:
        'Quando o studio publicar, a vitrine aparece aqui para inspirar sua próxima manutenção',
    highlightPortfolioFilledNote:
        'Referências reais para escolher formato, cor e acabamento com confiança',
  );

  static const SalonExperiencePreset barbershop = SalonExperiencePreset._(
    value: 'barbershop',
    label: 'Barbearia',
    appBarLabel: 'Sua barbearia no app',
    segmentIcon: Icons.content_cut_rounded,
    heroSupportLine:
        'Mantenha seu corte em dia, fale com a barbearia e reserve rápido.',
    agendaMetricLabel: 'Próximo corte',
    benefitsMetricLabel: 'Vantagens',
    portfolioMetricLabel: 'Estilos',
    momentumLabel: 'Ritmo da barbearia',
    momentumTitleWithFeed:
        'Seu próximo corte já pode começar por esse portfólio',
    momentumTitleWithoutFeed: 'Sua próxima reserva pode sair mais rápido daqui',
    momentumDescriptionWithFeed:
        'Estilos, vagas e benefícios aparecem juntos para transformar referência em corte marcado sem enrolação.',
    momentumDescriptionWithoutFeed:
        'A agenda real da barbearia já ajuda você a decidir rápido e voltar no tempo certo.',
    benefitsPillLabel: 'Recorrência acompanhada no app',
    offersPillLabel: 'Combos e cortes ativos',
    feedPillLabel: 'Portfólio com estilos reais',
    feedEyebrow: 'Portfólio da barbearia',
    feedTitle: 'Cortes, acabamentos e assinatura dos profissionais',
    feedDescription:
        'Veja estilos reais, vídeos curtos e resultados assinados pela barbearia para escolher seu próximo corte com mais confiança.',
    feedEmptyTitle: 'Seu próximo corte favorito vai aparecer aqui',
    feedEmptyMessage:
        'Quando a barbearia publicar estilos, acabamentos e resultados reais, você vai conseguir decidir com muito mais segurança.',
    feedConversionTitleWithLinked:
        'Seu próximo corte pode sair do portfólio de hoje',
    feedConversionTitleWithoutLinked:
        'Use o portfólio para descobrir o estilo e o profissional que mais combinam com você',
    feedConversionDescriptionWithLinked:
        'Há resultados com reserva direta, acabamentos reais e referências que ajudam você a imaginar como vai sair da cadeira antes mesmo de marcar.',
    feedConversionDescriptionWithoutLinked:
        'Mesmo quando a publicação ainda não estiver ligada a um serviço, ela já funciona como referência para você alinhar corte, barba e acabamento com a barbearia.',
    feedSupportLine:
        'Peça a referência, combine o estilo e reserve sem sair do app.',
    membershipSubtitle: 'Combos e horários da barbearia em uma leitura rápida.',
    offerSubtitle: 'Ofertas, horários e contato sem enrolação.',
    postsSubtitle: 'Estilos reais para escolher seu próximo corte.',
    benefitsSubtitle: 'Sua rotina e sua carteira no mesmo app.',
    noServicesSubtitle: 'Agenda e contato da barbearia no mesmo lugar.',
    joinUnknownTagline: 'Agenda, estilo e identidade da barbearia no app.',
    joinKnownTagline: 'Esse é o estilo que o cliente vai ver no app.',
    joinPendingTitle: 'Conecte sua conta à barbearia certa.',
    joinPendingDescription: 'Digite o código para liberar agenda e portfólio.',
    joinConnectedDescription: 'Ao confirmar, o app assume a barbearia certa.',
    joinVerificationMessage:
        'Você vai entrar em {salon} com agenda e estilo certos.',
    joinSuccessMessage: 'Tudo pronto. {salon} já está no seu app.',
    highlightCollectionLabel: 'Assinaturas da barbearia',
    highlightCollectionNote: 'Estilo visível e escolha mais objetiva',
    highlightPortfolioLabel: 'Portfólio da barbearia',
    highlightPortfolioEmptyNote:
        'Quando a barbearia publicar, o portfólio aparece aqui para inspirar seu próximo corte',
    highlightPortfolioFilledNote:
        'Estilos reais para escolher acabamento e profissional com confiança',
  );

  static const SalonExperiencePreset browsLashes = SalonExperiencePreset._(
    value: 'brows_lashes',
    label: 'Sobrancelha e cílios',
    appBarLabel: 'Seu studio de sobrancelhas e cílios',
    segmentIcon: Icons.visibility_rounded,
    heroSupportLine:
        'Cuide do retoque, converse com o studio e reserve no mesmo lugar.',
    agendaMetricLabel: 'Próximo retoque',
    benefitsMetricLabel: 'Vantagens',
    portfolioMetricLabel: 'Resultados',
    momentumLabel: 'Ritmo do studio',
    momentumTitleWithFeed:
        'Seu próximo retoque já pode começar por essa vitrine',
    momentumTitleWithoutFeed: 'Seu próximo retorno pode sair mais rápido daqui',
    momentumDescriptionWithFeed:
        'Resultados, horários e benefícios aparecem juntos para transformar confiança em agendamento com mais facilidade.',
    momentumDescriptionWithoutFeed:
        'A agenda do studio já ajuda você a enxergar o melhor momento de voltar e a manter seu cuidado em dia.',
    benefitsPillLabel: 'Retorno acompanhado no app',
    offersPillLabel: 'Vantagens e combos ativos',
    feedPillLabel: 'Vitrine com resultados reais',
    feedEyebrow: 'Vitrine do studio',
    feedTitle: 'Retoques, definição e resultados delicados',
    feedDescription:
        'Veja resultados reais, referências e detalhes de acabamento para escolher seu próximo cuidado com mais confiança.',
    feedEmptyTitle: 'Seu próximo resultado favorito vai aparecer aqui',
    feedEmptyMessage:
        'Quando o studio publicar retoques, resultados e acabamentos reais, você vai conseguir decidir com muito mais clareza.',
    feedConversionTitleWithLinked:
        'Seu próximo retoque pode sair da vitrine de hoje',
    feedConversionTitleWithoutLinked:
        'Use a vitrine para descobrir o cuidado ideal antes de conversar com o studio',
    feedConversionDescriptionWithLinked:
        'Há resultados com reserva direta e referências reais que ajudam você a enxergar o próximo cuidado antes mesmo de marcar.',
    feedConversionDescriptionWithoutLinked:
        'Mesmo quando a publicação ainda não estiver ligada a um serviço, ela já funciona como referência para você alinhar o resultado ideal com o studio.',
    feedSupportLine:
        'Peça a referência, tire dúvidas e reserve sem sair do app.',
    membershipSubtitle: 'Retoques e horários do studio em uma leitura rápida.',
    offerSubtitle: 'Vantagens e horários para decidir com mais calma.',
    postsSubtitle: 'Resultados reais para escolher seu próximo retoque.',
    benefitsSubtitle: 'Seu retorno e sua carteira no mesmo app.',
    noServicesSubtitle: 'Agenda e contato do studio no mesmo lugar.',
    joinUnknownTagline: 'Agenda, resultados e identidade do studio no app.',
    joinKnownTagline: 'Esse é o cuidado que o cliente vai ver no app.',
    joinPendingTitle: 'Conecte sua conta ao studio certo.',
    joinPendingDescription: 'Digite o código para liberar agenda e resultados.',
    joinConnectedDescription: 'Ao confirmar, o app assume o studio certo.',
    joinVerificationMessage:
        'Você vai entrar em {salon} com agenda e resultados certos.',
    joinSuccessMessage: 'Tudo pronto. {salon} já está no seu app.',
    highlightCollectionLabel: 'Cuidados do studio',
    highlightCollectionNote: 'Precisão, confiança e escolha com menos atrito',
    highlightPortfolioLabel: 'Vitrine do studio',
    highlightPortfolioEmptyNote:
        'Quando o studio publicar, a vitrine aparece aqui para inspirar seu próximo retoque',
    highlightPortfolioFilledNote:
        'Resultados reais para escolher com mais confiança e delicadeza',
  );

  static const SalonExperiencePreset aestheticsClinic = SalonExperiencePreset._(
    value: 'aesthetics_clinic',
    label: 'Estética',
    appBarLabel: 'Sua clínica no app',
    segmentIcon: Icons.spa_rounded,
    heroSupportLine:
        'Acompanhe seu protocolo, converse com a clínica e reserve no app.',
    agendaMetricLabel: 'Próximo protocolo',
    benefitsMetricLabel: 'Vantagens',
    portfolioMetricLabel: 'Resultados',
    momentumLabel: 'Ritmo da clínica',
    momentumTitleWithFeed:
        'Seu próximo protocolo pode começar por essa vitrine',
    momentumTitleWithoutFeed: 'Seu próximo cuidado pode sair mais rápido daqui',
    momentumDescriptionWithFeed:
        'Resultados, agenda e benefícios aparecem juntos para transformar confiança em continuidade do tratamento.',
    momentumDescriptionWithoutFeed:
        'A agenda da clínica já ajuda você a visualizar retorno, benefícios e a próxima etapa do seu cuidado.',
    benefitsPillLabel: 'Acompanhamento no app',
    offersPillLabel: 'Protocolos e vantagens ativos',
    feedPillLabel: 'Vitrine com resultados reais',
    feedEyebrow: 'Resultados da clínica',
    feedTitle: 'Protocolos, evolução e confiança no seu próximo cuidado',
    feedDescription:
        'Veja resultados reais, vídeos curtos e conteúdos que ajudam você a entender melhor seu próximo protocolo com confiança.',
    feedEmptyTitle: 'Seu próximo resultado favorito vai aparecer aqui',
    feedEmptyMessage:
        'Quando a clínica publicar protocolos, bastidores e resultados reais, você vai conseguir decidir com muito mais clareza.',
    feedConversionTitleWithLinked:
        'Seu próximo protocolo pode sair da vitrine de hoje',
    feedConversionTitleWithoutLinked:
        'Use a vitrine para descobrir o próximo cuidado ideal antes de conversar com a clínica',
    feedConversionDescriptionWithLinked:
        'Há resultados com reserva direta e conteúdos que ajudam você a visualizar a continuidade do cuidado antes mesmo de marcar.',
    feedConversionDescriptionWithoutLinked:
        'Mesmo quando a publicação ainda não estiver ligada a um serviço, ela já funciona como contexto para você alinhar protocolo e objetivo com a clínica.',
    feedSupportLine: 'Tire dúvidas, peça orientação e reserve sem sair do app.',
    membershipSubtitle: 'Protocolos e horários da clínica em uma leitura rápida.',
    offerSubtitle: 'Vantagens e horários para seguir seu cuidado.',
    postsSubtitle: 'Resultados reais para escolher seu próximo protocolo.',
    benefitsSubtitle: 'Sua carteira e seu acompanhamento no mesmo app.',
    noServicesSubtitle: 'Agenda e contato da clínica no mesmo lugar.',
    joinUnknownTagline: 'Protocolos, agenda e identidade da clínica no app.',
    joinKnownTagline: 'Esse é o cuidado que o cliente vai ver no app.',
    joinPendingTitle: 'Conecte sua conta à clínica certa.',
    joinPendingDescription: 'Digite o código para liberar agenda e protocolos.',
    joinConnectedDescription: 'Ao confirmar, o app assume a clínica certa.',
    joinVerificationMessage:
        'Você vai entrar em {salon} com agenda e protocolos certos.',
    joinSuccessMessage: 'Tudo pronto. {salon} já está no seu app.',
    highlightCollectionLabel: 'Protocolos da clínica',
    highlightCollectionNote: 'Clareza de valor e escolha mais segura',
    highlightPortfolioLabel: 'Resultados da clínica',
    highlightPortfolioEmptyNote:
        'Quando a clínica publicar, a vitrine aparece aqui para inspirar seu próximo protocolo',
    highlightPortfolioFilledNote:
        'Resultados reais para escolher o próximo cuidado com mais confiança',
  );
}
