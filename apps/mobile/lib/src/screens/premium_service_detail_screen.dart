import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_brand_config.dart';
import '../theme/salon_branding.dart';
import '../theme/tenant_theme.dart';
import '../widgets/premium_banner.dart';
import '../widgets/premium_professional_card.dart';
import '../widgets/premium_section_header.dart';

class PremiumServiceDetailScreen extends StatelessWidget {
  const PremiumServiceDetailScreen({
    super.key,
    required this.profile,
    required this.branding,
    required this.service,
    this.professionals = const <StaffMemberItem>[],
    this.relatedPosts = const <SalonPost>[],
    this.onBook,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final ServiceItem service;
  final List<StaffMemberItem> professionals;
  final List<SalonPost> relatedPosts;
  final VoidCallback? onBook;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final brandConfig = SalonBrandConfig.fromProfile(
      profile,
      services: [service],
      posts: relatedPosts,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Detalhe do servico')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          PremiumBanner(
            eyebrow: profile.salonName,
            title: service.name,
            subtitle: service.description?.trim().isNotEmpty == true
                ? service.description!
                : 'Servico com leitura premium, clareza comercial e CTA direto para agenda.',
            imageUrl: service.imageUrl,
            primaryActionLabel: 'Agendar',
            onPrimaryAction: onBook,
            badges: [
              _Badge(label: '${service.duration} min'),
              _Badge(label: currency.format(service.price)),
            ],
          ),
          const SizedBox(height: PremiumSpacing.xl),
          PremiumSectionHeader(
            title: 'O que esperar',
            subtitle:
                'Descricao, tempo e contexto do atendimento em uma leitura curta.',
          ),
          const SizedBox(height: PremiumSpacing.md),
          _DetailBlock(
            title: 'Descricao',
            body: service.description?.trim().isNotEmpty == true
                ? service.description!
                : 'Experiencia desenhada para manter alto valor percebido sem perder objetividade.',
            bullets: [
              'Duracao estimada de ${service.duration} minutos',
              'Valor base de ${currency.format(service.price)}',
              if (service.category?.trim().isNotEmpty == true)
                'Categoria ${service.category}',
            ],
          ),
          if (professionals.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Profissionais disponiveis',
              subtitle:
                  'Quem atende este servico dentro da agenda premium do app.',
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
                  onBook: onBook,
                ),
              ),
            ),
          ],
          if (relatedPosts.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.xl),
            PremiumSectionHeader(
              title: 'Resultados e avaliacoes visuais',
              subtitle:
                  'Use a galeria como prova visual da qualidade entregue.',
            ),
            const SizedBox(height: PremiumSpacing.md),
            _DetailBlock(
              title: relatedPosts.first.title,
              body: relatedPosts.first.caption ?? brandConfig.slogan,
              bullets: [
                if (relatedPosts.first.staffMemberName != null)
                  'Assinado por ${relatedPosts.first.staffMemberName}',
                '${relatedPosts.first.likeCount} curtidas',
                '${relatedPosts.first.commentCount} comentarios',
              ],
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: FilledButton(
          onPressed: onBook,
          child: const Text('Agendar este servico'),
        ),
      ),
    );
  }
}

class _DetailBlock extends StatelessWidget {
  const _DetailBlock({
    required this.title,
    required this.body,
    required this.bullets,
  });

  final String title;
  final String body;
  final List<String> bullets;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(PremiumSpacing.lg),
      decoration: BoxDecoration(
        color: context.premiumTheme.surfacePrimary,
        borderRadius: BorderRadius.circular(PremiumRadius.card),
        border: Border.all(color: context.premiumTheme.strokeSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: PremiumSpacing.sm),
          Text(body),
          if (bullets.isNotEmpty) ...[
            const SizedBox(height: PremiumSpacing.md),
            ...bullets.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: PremiumSpacing.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 7),
                      child: Icon(Icons.circle, size: 6),
                    ),
                    const SizedBox(width: PremiumSpacing.sm),
                    Expanded(child: Text(item)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: Colors.white),
      ),
    );
  }
}
