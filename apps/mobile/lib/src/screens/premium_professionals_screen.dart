import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/salon_brand_mark.dart';

class PremiumProfessionalsScreen extends StatelessWidget {
  const PremiumProfessionalsScreen({
    super.key,
    required this.salonName,
    required this.branding,
    required this.professionals,
    this.logoUrl,
    this.heroImageUrl,
    this.heroTabletImageUrl,
    this.onBook,
  });

  final String salonName;
  final SalonBranding branding;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? heroTabletImageUrl;
  final List<ProfessionalHighlight> professionals;
  final ValueChanged<ProfessionalHighlight>? onBook;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profissionais')),
      body: AppBackdrop(
        branding: branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: salonName,
              title: 'Time em destaque',
              subtitle:
                  'Especialidade, confianca e leitura de agenda organizadas como vitrine premium.',
              imageUrl: heroImageUrl,
              tabletImageUrl: heroTabletImageUrl,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: salonName,
                    logoUrl: logoUrl,
                    branding: branding,
                    size: 56,
                    borderRadius: 18,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  Text(
                    '${professionals.length} especialistas',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: PremiumSpacing.xl),
            if (professionals.isEmpty)
              const PremiumEmptyState(
                eyebrow: 'Equipe em atualizacao',
                title: 'Os profissionais vao aparecer aqui',
                message:
                    'Quando o salao publicar a escala completa, esta tela exibe especialidade, disponibilidade e prova de marca.',
              )
            else ...[
              const PremiumSectionHeader(
                eyebrow: 'Curadoria',
                title: 'Selecione seu profissional',
                subtitle:
                    'A mesma espinha dorsal premium recebe diferentes estilos por tenant sem perder consistencia.',
              ),
              const SizedBox(height: PremiumSpacing.md),
              ...professionals.map(
                (professional) => Padding(
                  padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                  child: PremiumProfessionalCard(
                    name: professional.name,
                    specialty: professional.specialty,
                    availabilityLabel: professional.availabilityLabel,
                    ratingLabel: professional.ratingLabel,
                    imageUrl: professional.imageUrl,
                    ctaLabel: onBook == null
                        ? 'Voltar para agenda'
                        : 'Agendar agora',
                    onBook: onBook == null
                        ? () => Navigator.of(context).maybePop()
                        : () => onBook!(professional),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
