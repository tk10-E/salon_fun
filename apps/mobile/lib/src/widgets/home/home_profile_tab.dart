import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../features/home/home_data.dart';
import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../cinematic_reveal.dart';
import '../press_feedback.dart';
import '../salon_brand_mark.dart';
import '../soft_card.dart';

class HomeProfileTab extends StatelessWidget {
  const HomeProfileTab({
    super.key,
    required this.profile,
    required this.branding,
    required this.data,
    required this.unreadNotificationsCount,
    required this.clientExperienceCount,
    required this.professionalHighlightsCount,
    required this.productHighlightsCount,
    required this.onRefresh,
    required this.onOpenProfile,
    required this.onOpenWallet,
    required this.onOpenNotifications,
    required this.onOpenSalonProfile,
    required this.onOpenProfessionals,
    required this.onOpenProducts,
    required this.onWhatsApp,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final HomeData data;
  final int unreadNotificationsCount;
  final int clientExperienceCount;
  final int professionalHighlightsCount;
  final int productHighlightsCount;
  final Future<void> Function() onRefresh;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenWallet;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenSalonProfile;
  final VoidCallback onOpenProfessionals;
  final VoidCallback onOpenProducts;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    final upcomingAppointment = data.appointments
        .where(
          (appointment) =>
              (appointment.status == 'confirmed' ||
                  appointment.status == 'pending') &&
              appointment.date.isAfter(DateTime.now()),
        )
        .cast<AppointmentItem?>()
        .firstWhere((appointment) => appointment != null, orElse: () => null);
    final favoriteServices = data.services
        .where((service) => data.favoriteServiceIds.contains(service.id))
        .toList();
    final bodyTheme = Theme.of(context).textTheme;
    final loyaltySummary = data.loyaltySummary;
    final referralSummary = data.referralSummary;
    final currencyFormatter = NumberFormat.currency(
      locale: 'pt_BR',
      symbol: 'R\$',
    );
    final walletSummary = loyaltySummary?.hasVisibleContent == true
        ? '${loyaltySummary!.pointsBalance} pts • ${currencyFormatter.format(loyaltySummary.cashbackBalance)}'
        : referralSummary?.hasVisibleContent == true
        ? '${referralSummary!.qualifiedCount} indicacoes qualificadas'
        : 'Fidelidade, cashback e indicacao no mesmo lugar.';
    final showcaseSignals = [
      if (data.services.isNotEmpty) '${data.services.length} serviços',
      if (data.posts.isNotEmpty) '${data.posts.length} posts',
      if (data.offers.isNotEmpty) '${data.offers.length} campanhas',
    ];
    final showcaseSummary = showcaseSignals.isEmpty
        ? 'Catálogo, benefícios e conteúdo do salão no mesmo app.'
        : showcaseSignals.join(' • ');
    final notificationSummary = unreadNotificationsCount > 0
        ? '$unreadNotificationsCount alerta${unreadNotificationsCount == 1 ? '' : 's'} novo${unreadNotificationsCount == 1 ? '' : 's'} para você.'
        : data.notifications.isNotEmpty
        ? '${data.notifications.length} aviso${data.notifications.length == 1 ? '' : 's'} no seu histórico.'
        : 'Sua central de avisos fica pronta para push, confirmações e novidades.';
    final productsSummary = productHighlightsCount > 0
        ? '$productHighlightsCount produto${productHighlightsCount == 1 ? '' : 's'} em destaque no app.'
        : 'Coleção do salão pronta para aparecer quando a curadoria for ativada.';
    final professionalsSummary = professionalHighlightsCount > 0
        ? '$professionalHighlightsCount profissional${professionalHighlightsCount == 1 ? '' : 's'} com presença no app.'
        : 'A equipe ganha destaque aqui conforme o salão reforça especialidades e portfólio.';

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 160),
        children: [
          CinematicReveal(
            delay: const Duration(milliseconds: 20),
            child: SoftCard(
              padding: EdgeInsets.zero,
              borderColor: branding.shellCardBorder,
              backgroundColor: branding.shellCardBackground,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.fromLTRB(18, 18, 18, 20),
                    decoration: BoxDecoration(
                      gradient: branding.heroGradient,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SalonBrandMark(
                          salonName: profile.salonName,
                          logoUrl: profile.salonLogoUrl,
                          branding: branding,
                          size: 56,
                          borderRadius: 18,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                profile.name,
                                style: bodyTheme.headlineSmall?.copyWith(
                                  color: branding.onPrimary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                profile.salonTagline ??
                                    'Carteira, agenda e contato no mesmo app.',
                                style: bodyTheme.bodyMedium?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.84),
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            _ProfileMetricChip(
                              branding: branding,
                              label: 'Histórico',
                              value: '${data.appointments.length} atendimentos',
                            ),
                            _ProfileMetricChip(
                              branding: branding,
                              label: 'Favoritos',
                              value: favoriteServices.isEmpty
                                  ? 'Nenhum salvo'
                                  : '${favoriteServices.length} salvos',
                            ),
                            _ProfileMetricChip(
                              branding: branding,
                              label: 'Carteira',
                              value:
                                  data.loyaltySummary?.hasVisibleContent == true
                                  ? 'Ativa'
                                  : 'Em breve',
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            FilledButton.icon(
                              onPressed: onOpenProfile,
                              icon: const Icon(Icons.person_outline_rounded),
                              label: const Text('Editar perfil'),
                            ),
                            OutlinedButton.icon(
                              onPressed: onOpenWallet,
                              icon: const Icon(
                                Icons.account_balance_wallet_outlined,
                              ),
                              label: const Text('Minha carteira'),
                            ),
                            TextButton.icon(
                              onPressed: onWhatsApp,
                              icon: const Icon(
                                Icons.chat_bubble_outline_rounded,
                              ),
                              label: const Text('WhatsApp'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 22),
          CinematicReveal(
            delay: const Duration(milliseconds: 90),
            child: _ProfileSectionHeader(
              title: 'Tudo o que seu app libera',
              subtitle:
                  '$clientExperienceCount frentes ativas entre agenda, vitrine, fidelidade e comunicação.',
              branding: branding,
            ),
          ),
          const SizedBox(height: 16),
          CinematicReveal(
            delay: const Duration(milliseconds: 130),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 620;
                final cardWidth = isCompact
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 12) / 2;

                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    SizedBox(
                      width: cardWidth,
                      child: _ProfileFeatureCard(
                        branding: branding,
                        eyebrow: 'Benefícios',
                        title: 'Carteira e fidelidade',
                        subtitle: walletSummary,
                        badge: loyaltySummary?.isVip == true
                            ? 'VIP'
                            : referralSummary?.availableRewardsCount != null &&
                                  referralSummary!.availableRewardsCount > 0
                            ? 'Recompensas'
                            : 'Ativa',
                        icon: Icons.account_balance_wallet_outlined,
                        onTap: onOpenWallet,
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: _ProfileFeatureCard(
                        branding: branding,
                        eyebrow: 'Comunicação',
                        title: 'Alertas e avisos',
                        subtitle: notificationSummary,
                        badge: unreadNotificationsCount > 0
                            ? '$unreadNotificationsCount novos'
                            : 'Em dia',
                        icon: Icons.notifications_active_outlined,
                        onTap: onOpenNotifications,
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: _ProfileFeatureCard(
                        branding: branding,
                        eyebrow: 'Marca',
                        title: 'Vitrine do salão',
                        subtitle: showcaseSummary,
                        badge: data.posts.isNotEmpty ? 'Ao vivo' : 'Catálogo',
                        icon: Icons.storefront_outlined,
                        onTap: onOpenSalonProfile,
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: _ProfileFeatureCard(
                        branding: branding,
                        eyebrow: 'Equipe',
                        title: 'Profissionais em destaque',
                        subtitle: professionalsSummary,
                        badge: professionalHighlightsCount > 0
                            ? 'Equipe'
                            : 'Curadoria',
                        icon: Icons.groups_2_outlined,
                        onTap: onOpenProfessionals,
                      ),
                    ),
                    SizedBox(
                      width: cardWidth,
                      child: _ProfileFeatureCard(
                        branding: branding,
                        eyebrow: 'Coleção',
                        title: 'Produtos da marca',
                        subtitle: productsSummary,
                        badge: productHighlightsCount > 0
                            ? 'Shop'
                            : 'Seleção',
                        icon: Icons.shopping_bag_outlined,
                        onTap: onOpenProducts,
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 22),
          if (upcomingAppointment != null) ...[
            CinematicReveal(
              delay: const Duration(milliseconds: 90),
              child: _ProfileSectionHeader(
                title: 'Próximo horário',
                branding: branding,
              ),
            ),
            const SizedBox(height: 16),
            CinematicReveal(
              delay: const Duration(milliseconds: 130),
              child: _ProfileSnapshotCard(
                branding: branding,
                title: upcomingAppointment.serviceName,
                subtitle:
                    '${DateFormat('dd/MM • HH:mm').format(upcomingAppointment.date)} com ${upcomingAppointment.staffMemberName}',
                toneLabel: upcomingAppointment.status == 'confirmed'
                    ? 'Confirmado'
                    : 'Pendente',
              ),
            ),
            const SizedBox(height: 22),
          ],
          if (favoriteServices.isNotEmpty) ...[
            _ProfileSectionHeader(title: 'Serviços salvos', branding: branding),
            const SizedBox(height: 16),
            ...favoriteServices
                .take(4)
                .map(
                  (service) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ProfileSnapshotCard(
                      branding: branding,
                      title: service.name,
                      subtitle: service.description?.trim().isNotEmpty == true
                          ? service.description!
                          : '${service.duration} min • ${NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$').format(service.price)}',
                      toneLabel: service.category ?? 'Favorito',
                    ),
                  ),
                ),
            const SizedBox(height: 10),
          ],
          if ((profile.preferences?.trim().isNotEmpty ?? false) ||
              (profile.allergies?.trim().isNotEmpty ?? false) ||
              (profile.beautyProducts?.trim().isNotEmpty ?? false)) ...[
            _ProfileSectionHeader(
              title: 'Ficha do cliente',
              branding: branding,
            ),
            const SizedBox(height: 16),
            if (profile.preferences?.trim().isNotEmpty ?? false)
              _ProfileSnapshotCard(
                branding: branding,
                title: 'Preferências',
                subtitle: profile.preferences!,
                toneLabel: 'Perfil',
              ),
            if (profile.allergies?.trim().isNotEmpty ?? false)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _ProfileSnapshotCard(
                  branding: branding,
                  title: 'Alergias e cuidados',
                  subtitle: profile.allergies!,
                  toneLabel: 'Atenção',
                ),
              ),
            if (profile.beautyProducts?.trim().isNotEmpty ?? false)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: _ProfileSnapshotCard(
                  branding: branding,
                  title: 'Produtos de beleza',
                  subtitle: profile.beautyProducts!,
                  toneLabel: 'Rotina',
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ProfileMetricChip extends StatelessWidget {
  const _ProfileMetricChip({
    required this.branding,
    required this.label,
    required this.value,
  });

  final SalonBranding branding;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: branding.shellCardSoftBackground,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: branding.shellCardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: branding.shellMutedForeground,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: branding.shellForeground,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileSectionHeader extends StatelessWidget {
  const _ProfileSectionHeader({
    required this.title,
    required this.branding,
    this.subtitle,
  });

  final String title;
  final SalonBranding branding;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: branding.shellForeground,
            fontWeight: FontWeight.w900,
          ),
        ),
        if (subtitle?.trim().isNotEmpty == true) ...[
          const SizedBox(height: 6),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: branding.shellMutedForeground,
              height: 1.5,
            ),
          ),
        ],
      ],
    );
  }
}

class _ProfileFeatureCard extends StatelessWidget {
  const _ProfileFeatureCard({
    required this.branding,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.icon,
    required this.onTap,
  });

  final SalonBranding branding;
  final String eyebrow;
  final String title;
  final String subtitle;
  final String badge;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return PressFeedback(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(28),
          child: SoftCard(
            backgroundColor: branding.shellCardBackground,
            borderColor: branding.shellCardBorder,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: branding.shellIconSurface,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(icon, color: branding.shellForeground),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            eyebrow,
                            style: textTheme.labelMedium?.copyWith(
                              color: branding.shellMutedForeground,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            title,
                            style: textTheme.titleMedium?.copyWith(
                              color: branding.shellForeground,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: branding.shellIconSurface,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: branding.shellCardBorder),
                      ),
                      child: Text(
                        badge,
                        style: textTheme.labelMedium?.copyWith(
                          color: branding.shellForeground,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  subtitle,
                  style: textTheme.bodyMedium?.copyWith(
                    color: branding.shellMutedForeground,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Abrir',
                  style: textTheme.labelLarge?.copyWith(
                    color: branding.shellForeground,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfileSnapshotCard extends StatelessWidget {
  const _ProfileSnapshotCard({
    required this.branding,
    required this.title,
    required this.subtitle,
    required this.toneLabel,
  });

  final SalonBranding branding;
  final String title;
  final String subtitle;
  final String toneLabel;

  @override
  Widget build(BuildContext context) {
    return PressFeedback(
      child: SoftCard(
        backgroundColor: branding.shellCardBackground,
        borderColor: branding.shellCardBorder,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: branding.shellIconSurface,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                Icons.auto_awesome_rounded,
                color: branding.shellForeground,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: branding.shellForeground,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: branding.shellMutedForeground,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: branding.shellIconSurface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: branding.shellCardBorder),
              ),
              child: Text(
                toneLabel,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: branding.shellForeground,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
