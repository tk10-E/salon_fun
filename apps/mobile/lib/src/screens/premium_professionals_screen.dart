import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';

class PremiumProfessionalsScreen extends StatelessWidget {
  const PremiumProfessionalsScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.professionals,
    this.onBook,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<StaffMemberItem> professionals;
  final ValueChanged<StaffMemberItem>? onBook;

  @override
  Widget build(BuildContext context) {
    final brandConfig = SalonBrandConfig.fromProfile(profile);

    return Scaffold(
      appBar: AppBar(title: const Text('Profissionais')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          PremiumBanner(
            eyebrow: profile.salonName,
            title: 'Time em destaque',
            subtitle:
                'Cards premium para valorizar especialidade, confianca e disponibilidade.',
            imageUrl: brandConfig.heroImageUrl,
            tabletImageUrl: brandConfig.heroImageTabletUrl,
            imageAlignment: brandConfig.heroImageAlignment,
            imageScale: brandConfig.heroImageScale,
            primaryActionLabel: 'Voltar para agenda',
            onPrimaryAction: () {
              Navigator.of(context).maybePop();
            },
          ),
          const SizedBox(height: PremiumSpacing.xl),
          if (professionals.isEmpty)
            const PremiumEmptyState(
              eyebrow: 'Equipe em atualizacao',
              title: 'Os profissionais vao aparecer aqui',
              message:
                  'Quando a agenda estiver publicada por completo, esta tela exibe especialidade e disponibilidade de cada nome.',
            )
          else ...[
            PremiumSectionHeader(
              title: 'Selecione seu profissional',
              subtitle: 'Lista premium pronta para reserva por preferencia.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            ...professionals.map(
              (professional) => Padding(
                padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                child: PremiumProfessionalCard(
                  name: professional.name,
                  specialty: professional.role?.trim().isNotEmpty == true
                      ? professional.role!
                      : 'Especialista do salao',
                  availabilityLabel: professional.availableSlotsCount > 0
                      ? '${professional.availableSlotsCount} horarios livres'
                      : 'Agenda sob consulta',
                  onBook: onBook == null ? null : () => onBook!(professional),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
