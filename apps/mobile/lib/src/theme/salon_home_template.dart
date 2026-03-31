import '../models/salon_client_app_config.dart';

enum SalonHomeSurface { services, portfolio, benefits }

enum SalonHomeSignal {
  growth,
  smartSchedule,
  vacancy,
  offer,
  loyalty,
  referral,
}

class SalonHomeTemplate {
  const SalonHomeTemplate._({
    required this.model,
    required this.label,
    required this.heroTag,
    required this.defaultPrimarySurface,
    required this.secondarySurface,
    required this.signalPriority,
    required this.servicesTitle,
    required this.portfolioTitle,
    required this.benefitsTitle,
    required this.momentTitle,
    required this.defaultPrimaryCtaLabel,
    required this.servicePreviewCount,
    required this.galleryPreviewCount,
  });

  final SalonClientExperienceModel model;
  final String label;
  final String heroTag;
  final SalonHomeSurface defaultPrimarySurface;
  final SalonHomeSurface secondarySurface;
  final List<SalonHomeSignal> signalPriority;
  final String servicesTitle;
  final String portfolioTitle;
  final String benefitsTitle;
  final String momentTitle;
  final String defaultPrimaryCtaLabel;
  final int servicePreviewCount;
  final int galleryPreviewCount;

  SalonHomeSurface resolvePrimarySurface(SalonClientHomeEmphasis emphasis) {
    switch (emphasis) {
      case SalonClientHomeEmphasis.portfolio:
        return SalonHomeSurface.portfolio;
      case SalonClientHomeEmphasis.benefits:
        return SalonHomeSurface.benefits;
      case SalonClientHomeEmphasis.schedule:
      case SalonClientHomeEmphasis.services:
      case SalonClientHomeEmphasis.auto:
        return defaultPrimarySurface;
    }
  }

  static SalonHomeTemplate resolve({
    required SalonClientAppConfig config,
    required String? businessSegment,
  }) {
    switch (config.resolveExperienceModel(businessSegment)) {
      case SalonClientExperienceModel.nailGallery:
        return nailGallery;
      case SalonClientExperienceModel.barberHouse:
        return barberHouse;
      case SalonClientExperienceModel.browsAtelier:
        return browsAtelier;
      case SalonClientExperienceModel.aestheticClinic:
        return aestheticClinic;
      case SalonClientExperienceModel.beautySignature:
      case SalonClientExperienceModel.auto:
        return beautySignature;
    }
  }

  static const SalonHomeTemplate beautySignature = SalonHomeTemplate._(
    model: SalonClientExperienceModel.beautySignature,
    label: 'Signature Beauty',
    heroTag: 'Agenda, brilho e transformação',
    defaultPrimarySurface: SalonHomeSurface.services,
    secondarySurface: SalonHomeSurface.portfolio,
    signalPriority: [
      SalonHomeSignal.growth,
      SalonHomeSignal.smartSchedule,
      SalonHomeSignal.offer,
      SalonHomeSignal.loyalty,
      SalonHomeSignal.vacancy,
      SalonHomeSignal.referral,
    ],
    servicesTitle: 'Serviços em destaque',
    portfolioTitle: 'Últimos trabalhos',
    benefitsTitle: 'Vantagens do salão',
    momentTitle: 'Seu melhor próximo passo',
    defaultPrimaryCtaLabel: 'Agendar agora',
    servicePreviewCount: 4,
    galleryPreviewCount: 3,
  );

  static const SalonHomeTemplate nailGallery = SalonHomeTemplate._(
    model: SalonClientExperienceModel.nailGallery,
    label: 'Nail Gallery',
    heroTag: 'Cor, vitrine e manutenção',
    defaultPrimarySurface: SalonHomeSurface.portfolio,
    secondarySurface: SalonHomeSurface.services,
    signalPriority: [
      SalonHomeSignal.growth,
      SalonHomeSignal.offer,
      SalonHomeSignal.smartSchedule,
      SalonHomeSignal.loyalty,
      SalonHomeSignal.referral,
      SalonHomeSignal.vacancy,
    ],
    servicesTitle: 'Cuidados da semana',
    portfolioTitle: 'Unhas em destaque',
    benefitsTitle: 'Vantagens do studio',
    momentTitle: 'Sua próxima manutenção',
    defaultPrimaryCtaLabel: 'Agendar agora',
    servicePreviewCount: 4,
    galleryPreviewCount: 3,
  );

  static const SalonHomeTemplate barberHouse = SalonHomeTemplate._(
    model: SalonClientExperienceModel.barberHouse,
    label: 'Barber House',
    heroTag: 'Corte, barba e presença',
    defaultPrimarySurface: SalonHomeSurface.services,
    secondarySurface: SalonHomeSurface.portfolio,
    signalPriority: [
      SalonHomeSignal.smartSchedule,
      SalonHomeSignal.vacancy,
      SalonHomeSignal.growth,
      SalonHomeSignal.offer,
      SalonHomeSignal.loyalty,
      SalonHomeSignal.referral,
    ],
    servicesTitle: 'Cortes da casa',
    portfolioTitle: 'Assinatura da barbearia',
    benefitsTitle: 'Clube do cliente',
    momentTitle: 'Janela ideal para voltar',
    defaultPrimaryCtaLabel: 'Agendar corte',
    servicePreviewCount: 4,
    galleryPreviewCount: 3,
  );

  static const SalonHomeTemplate browsAtelier = SalonHomeTemplate._(
    model: SalonClientExperienceModel.browsAtelier,
    label: 'Brows Atelier',
    heroTag: 'Design, retoque e precisão',
    defaultPrimarySurface: SalonHomeSurface.portfolio,
    secondarySurface: SalonHomeSurface.benefits,
    signalPriority: [
      SalonHomeSignal.growth,
      SalonHomeSignal.loyalty,
      SalonHomeSignal.referral,
      SalonHomeSignal.smartSchedule,
      SalonHomeSignal.offer,
      SalonHomeSignal.vacancy,
    ],
    servicesTitle: 'Técnicas do studio',
    portfolioTitle: 'Resultados em foco',
    benefitsTitle: 'Plano de retorno',
    momentTitle: 'Retoque no timing certo',
    defaultPrimaryCtaLabel: 'Agendar agora',
    servicePreviewCount: 4,
    galleryPreviewCount: 3,
  );

  static const SalonHomeTemplate aestheticClinic = SalonHomeTemplate._(
    model: SalonClientExperienceModel.aestheticClinic,
    label: 'Clinical Premium',
    heroTag: 'Protocolo, agenda e confiança',
    defaultPrimarySurface: SalonHomeSurface.benefits,
    secondarySurface: SalonHomeSurface.services,
    signalPriority: [
      SalonHomeSignal.loyalty,
      SalonHomeSignal.growth,
      SalonHomeSignal.smartSchedule,
      SalonHomeSignal.offer,
      SalonHomeSignal.referral,
      SalonHomeSignal.vacancy,
    ],
    servicesTitle: 'Protocolos disponíveis',
    portfolioTitle: 'Resultados acompanhados',
    benefitsTitle: 'Seu acompanhamento',
    momentTitle: 'Seu próximo cuidado',
    defaultPrimaryCtaLabel: 'Reservar protocolo',
    servicePreviewCount: 4,
    galleryPreviewCount: 3,
  );
}
