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

class PremiumProfessionalsScreen extends StatefulWidget {
  const PremiumProfessionalsScreen({
    super.key,
    required this.salonName,
    required this.branding,
    required this.professionals,
    this.logoUrl,
    this.heroImageUrl,
    this.heroTabletImageUrl,
    this.onBook,
    this.initialFavoriteProfessionalIds = const <String>{},
    this.onToggleFavorite,
  });

  final String salonName;
  final SalonBranding branding;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? heroTabletImageUrl;
  final List<ProfessionalHighlight> professionals;
  final ValueChanged<ProfessionalHighlight>? onBook;
  final Set<String> initialFavoriteProfessionalIds;
  final Future<void> Function(
    ProfessionalHighlight professional,
    bool isFavorite,
  )?
  onToggleFavorite;

  @override
  State<PremiumProfessionalsScreen> createState() =>
      _PremiumProfessionalsScreenState();
}

class _PremiumProfessionalsScreenState
    extends State<PremiumProfessionalsScreen> {
  late Set<String> _favoriteProfessionalIds;
  final Set<String> _busyFavoriteProfessionalIds = <String>{};

  @override
  void initState() {
    super.initState();
    _favoriteProfessionalIds = {...widget.initialFavoriteProfessionalIds};
  }

  Future<void> _toggleFavorite(ProfessionalHighlight professional) async {
    final onToggleFavorite = widget.onToggleFavorite;
    if (onToggleFavorite == null ||
        _busyFavoriteProfessionalIds.contains(professional.id)) {
      return;
    }

    final isFavorite = _favoriteProfessionalIds.contains(professional.id);

    setState(() => _busyFavoriteProfessionalIds.add(professional.id));

    try {
      await onToggleFavorite(professional, !isFavorite);
      if (!mounted) {
        return;
      }

      setState(() {
        final updated = <String>{..._favoriteProfessionalIds};
        if (isFavorite) {
          updated.remove(professional.id);
        } else {
          updated.add(professional.id);
        }
        _favoriteProfessionalIds = updated;
      });
    } catch (error) {
      final errorMessage = error.toString().replaceFirst('Exception: ', '');
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            errorMessage.isEmpty
                ? isFavorite
                      ? 'Não foi possível remover ${professional.name} dos favoritos agora.'
                      : 'Não foi possível salvar ${professional.name} nos favoritos agora.'
                : errorMessage,
          ),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _busyFavoriteProfessionalIds.remove(professional.id));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profissionais')),
      body: AppBackdrop(
        branding: widget.branding,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          children: [
            PremiumBanner(
              eyebrow: widget.salonName,
              title: 'Time em destaque',
              subtitle:
                  'Especialidade, confianca e leitura de agenda organizadas como vitrine premium.',
              imageUrl: widget.heroImageUrl,
              tabletImageUrl: widget.heroTabletImageUrl,
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SalonBrandMark(
                    salonName: widget.salonName,
                    logoUrl: widget.logoUrl,
                    branding: widget.branding,
                    size: 56,
                    borderRadius: 18,
                  ),
                  const SizedBox(width: PremiumSpacing.sm),
                  Text(
                    '${widget.professionals.length} especialistas',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: PremiumSpacing.xl),
            if (widget.professionals.isEmpty)
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
              ...widget.professionals.map(
                (professional) => Padding(
                  padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                  child: PremiumProfessionalCard(
                    name: professional.name,
                    specialty: professional.specialty,
                    availabilityLabel: professional.availabilityLabel,
                    ratingLabel: professional.ratingLabel,
                    imageUrl: professional.imageUrl,
                    ctaLabel: widget.onBook == null
                        ? 'Voltar para agenda'
                        : 'Agendar agora',
                    onBook: widget.onBook == null
                        ? () => Navigator.of(context).maybePop()
                        : () => widget.onBook!(professional),
                    isFavorite: _favoriteProfessionalIds.contains(
                      professional.id,
                    ),
                    favoriteBusy: _busyFavoriteProfessionalIds.contains(
                      professional.id,
                    ),
                    onToggleFavorite: widget.onToggleFavorite == null
                        ? null
                        : () => _toggleFavorite(professional),
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
