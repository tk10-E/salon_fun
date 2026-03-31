import 'dart:async';

import 'package:flutter/material.dart';

import '../../features/home/home_data.dart';
import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../customer_growth_suggestion_card.dart';
import '../cinematic_reveal.dart';
import '../empty_state.dart';
import '../press_feedback.dart';
import '../soft_card.dart';
import 'home_appointment_card.dart';
import 'home_history_brand_header.dart';

class HomeHistoryTab extends StatelessWidget {
  const HomeHistoryTab({
    super.key,
    required this.profile,
    required this.branding,
    required this.appointments,
    required this.onCancelAppointment,
    required this.onConfirmAppointmentPresence,
    required this.onRefresh,
    required this.onWhatsApp,
    this.insightData,
    this.onBookGrowthSuggestion,
    this.onOpenWallet,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<AppointmentItem> appointments;
  final Future<void> Function(AppointmentItem appointment) onCancelAppointment;
  final Future<void> Function(AppointmentItem appointment)
  onConfirmAppointmentPresence;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final HomeData? insightData;
  final Future<void> Function(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion,
  )?
  onBookGrowthSuggestion;
  final VoidCallback? onOpenWallet;

  @override
  Widget build(BuildContext context) {
    if (appointments.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          children: [
            CinematicReveal(
              delay: const Duration(milliseconds: 20),
              child: HomeHistoryBrandHeader(
                profile: profile,
                branding: branding,
                appointmentCount: appointments.length,
                compact: true,
              ),
            ),
            const SizedBox(height: 20),
            EmptyState(
              centered: true,
              icon: Icons.history_toggle_off_rounded,
              eyebrow: 'Nenhum horário ainda',
              title: 'Seu histórico está vazio',
              message:
                  'Quando você fizer um agendamento, ele aparece aqui com status, data e profissional.',
              actionLabel: 'Falar com o salão',
              onAction: onWhatsApp,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        itemCount: appointments.length + 1,
        separatorBuilder: (_, index) => index == 0
            ? const SizedBox(height: 18)
            : const SizedBox(height: 14),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CinematicReveal(
                  delay: const Duration(milliseconds: 20),
                  child: HomeHistoryBrandHeader(
                    profile: profile,
                    branding: branding,
                    appointmentCount: appointments.length,
                    compact: true,
                  ),
                ),
                const SizedBox(height: 20),
                CinematicReveal(
                  delay: const Duration(milliseconds: 90),
                  child: _HistoryJourneyCard(
                    branding: branding,
                    upcomingCount: _upcomingCount,
                    completedCount: _completedCount,
                    cancelledCount: _cancelledCount,
                    walletActive:
                        insightData?.loyaltySummary?.hasVisibleContent == true,
                    hasOffer: _featuredOffer != null,
                  ),
                ),
                ..._buildReturnWidgets(context),
              ],
            );
          }

          final appointment = appointments[index - 1];
          return HomeAppointmentCard(
            appointment: appointment,
            branding: branding,
            onCancelAppointment: onCancelAppointment,
            onConfirmAppointmentPresence: onConfirmAppointmentPresence,
          );
        },
      ),
    );
  }

  bool get _hasUpcomingAppointment => appointments.any(
    (appointment) =>
        (appointment.status == 'pending' ||
            appointment.status == 'confirmed') &&
        appointment.date.isAfter(DateTime.now()),
  );

  int get _upcomingCount => appointments
      .where(
        (appointment) =>
            (appointment.status == 'pending' ||
                appointment.status == 'confirmed') &&
            appointment.date.isAfter(DateTime.now()),
      )
      .length;

  int get _completedCount => appointments
      .where((appointment) => appointment.status == 'completed')
      .length;

  int get _cancelledCount => appointments
      .where((appointment) => appointment.status == 'cancelled')
      .length;

  List<Widget> _buildReturnWidgets(BuildContext context) {
    if (_hasUpcomingAppointment || insightData == null) {
      return const [];
    }

    final widgets = <Widget>[];
    final suggestion = _featuredSuggestion;
    final retentionCard = _buildRetentionCard(context);

    if (suggestion != null) {
      widgets.add(const SizedBox(height: 22));
      widgets.add(
        const _HistoryInlineHeader(
          eyebrow: 'Retorno inteligente',
          title: 'Seu melhor próximo horário',
        ),
      );
      widgets.add(const SizedBox(height: 14));
      widgets.add(
        CustomerGrowthSuggestionCard(
          suggestion: suggestion,
          branding: branding,
          onBook: () {
            final matchedService = _matchedServiceForSuggestion(suggestion);
            if (matchedService == null || onBookGrowthSuggestion == null) {
              onWhatsApp();
              return;
            }

            unawaited(onBookGrowthSuggestion!(matchedService, suggestion));
          },
        ),
      );
    }

    if (retentionCard != null) {
      widgets.add(const SizedBox(height: 18));
      widgets.add(retentionCard);
    }

    return widgets;
  }

  CustomerGrowthSuggestionItem? get _featuredSuggestion {
    final suggestions = insightData?.growthSuggestions?.suggestions;
    if (suggestions == null || suggestions.isEmpty) {
      return null;
    }

    for (final suggestion in suggestions) {
      if (suggestion.hasIncentive || suggestion.isRebooking) {
        return suggestion;
      }
    }

    return suggestions.first;
  }

  ServiceItem? _matchedServiceForSuggestion(
    CustomerGrowthSuggestionItem suggestion,
  ) {
    final services = insightData?.services ?? const <ServiceItem>[];
    for (final service in services) {
      if (service.id == suggestion.serviceId) {
        return service;
      }
    }

    return null;
  }

  SalonOfferItem? get _featuredOffer {
    final offers = insightData?.offers ?? const <SalonOfferItem>[];
    for (final offer in offers) {
      if (offer.isMembership) {
        return offer;
      }
    }

    if (offers.isEmpty) {
      return null;
    }

    return offers.first;
  }

  Widget? _buildRetentionCard(BuildContext context) {
    final loyaltySummary = insightData?.loyaltySummary;
    final featuredOffer = _featuredOffer;

    if (loyaltySummary?.hasVisibleContent != true && featuredOffer == null) {
      return null;
    }

    final title =
        loyaltySummary?.hasVisibleContent == true && featuredOffer != null
        ? 'Sua próxima volta já tem vantagem'
        : loyaltySummary?.hasVisibleContent == true
        ? 'Sua carteira já entrou no jogo'
        : 'O salão já deixou uma vantagem ativa';

    final message =
        loyaltySummary?.hasVisibleContent == true && featuredOffer != null
        ? 'Você já acumulou ${loyaltySummary!.pointsBalance} pontos e ${loyaltySummary.completedVisits} visitas. ${featuredOffer.isMembership ? 'O pacote' : 'A campanha'} ${featuredOffer.title} também pode entrar no seu próximo retorno.'
        : loyaltySummary?.hasVisibleContent == true
        ? 'Seus ${loyaltySummary!.pointsBalance} pontos, visitas e cashback já estão organizados na carteira.'
        : featuredOffer!.highlightText?.trim().isNotEmpty == true
        ? featuredOffer.highlightText!
        : featuredOffer.description?.trim().isNotEmpty == true
        ? featuredOffer.description!
        : 'Fale com o salão para aproveitar ${featuredOffer.title} na sua próxima visita.';

    return _HistoryRetentionCard(
      title: title,
      message: message,
      showWalletAction:
          loyaltySummary?.hasVisibleContent == true && onOpenWallet != null,
      onOpenWallet: onOpenWallet,
      onWhatsApp: onWhatsApp,
    );
  }
}

class _HistoryRetentionCard extends StatelessWidget {
  const _HistoryRetentionCard({
    required this.title,
    required this.message,
    required this.showWalletAction,
    required this.onWhatsApp,
    this.onOpenWallet,
  });

  final String title;
  final String message;
  final bool showWalletAction;
  final VoidCallback onWhatsApp;
  final VoidCallback? onOpenWallet;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: const EdgeInsets.all(18),
      gradient: const LinearGradient(
        colors: [Color(0xFFFFFCF8), Color(0xFFF7EEE6)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: const Color(0xFFE5D7CA),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.88),
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Color(0xFF6F4A32),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HistoryActionPill(
                icon: Icons.bolt_rounded,
                label: 'Menos atrito no retorno',
              ),
              if (showWalletAction)
                const _HistoryActionPill(
                  icon: Icons.account_balance_wallet_outlined,
                  label: 'Carteira ativa',
                ),
              const _HistoryActionPill(
                icon: Icons.chat_bubble_outline_rounded,
                label: 'Contato direto',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (showWalletAction)
                PressFeedback(
                  haptic: true,
                  child: FilledButton.icon(
                    onPressed: onOpenWallet,
                    icon: const Icon(Icons.account_balance_wallet_outlined),
                    label: const Text('Abrir carteira'),
                  ),
                ),
              PressFeedback(
                haptic: true,
                child: OutlinedButton.icon(
                  onPressed: onWhatsApp,
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Falar com o salão'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HistoryJourneyCard extends StatelessWidget {
  const _HistoryJourneyCard({
    required this.branding,
    required this.upcomingCount,
    required this.completedCount,
    required this.cancelledCount,
    required this.walletActive,
    required this.hasOffer,
  });

  final SalonBranding branding;
  final int upcomingCount;
  final int completedCount;
  final int cancelledCount;
  final bool walletActive;
  final bool hasOffer;

  @override
  Widget build(BuildContext context) {
    return SoftCard(
      padding: const EdgeInsets.all(18),
      gradient: LinearGradient(
        colors: [
          Colors.white.withValues(alpha: 0.98),
          branding.highlightBackground.withValues(alpha: 0.7),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline.withValues(alpha: 0.6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sua jornada com o salão em um olhar',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: const Color(0xFF2F231C),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            walletActive || hasOffer
                ? 'Agenda, retorno e benefícios no mesmo resumo.'
                : 'Tudo o que importa para acompanhar sua relação com o salão.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _HistoryMetricCard(
                icon: Icons.event_available_rounded,
                label: 'Próximos',
                value: upcomingCount == 1
                    ? '1 horário'
                    : '$upcomingCount horários',
              ),
              _HistoryMetricCard(
                icon: Icons.verified_rounded,
                label: 'Concluídos',
                value: completedCount == 1
                    ? '1 atendimento'
                    : '$completedCount atendimentos',
              ),
              _HistoryMetricCard(
                icon: Icons.event_busy_rounded,
                label: 'Cancelados',
                value: cancelledCount == 1
                    ? '1 ajuste'
                    : '$cancelledCount ajustes',
              ),
              _HistoryMetricCard(
                icon: walletActive
                    ? Icons.account_balance_wallet_outlined
                    : Icons.loyalty_rounded,
                label: walletActive ? 'Carteira' : 'Retorno',
                value: walletActive
                    ? 'Acompanhando vantagens'
                    : hasOffer
                    ? 'Campanha ativa'
                    : 'Histórico organizado',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HistoryInlineHeader extends StatelessWidget {
  const _HistoryInlineHeader({required this.eyebrow, required this.title});

  final String eyebrow;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: const Color(0xFF8E441F),
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: const Color(0xFF2F231C),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _HistoryMetricCard extends StatelessWidget {
  const _HistoryMetricCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE6D7C8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF6F4A32)),
          const SizedBox(height: 10),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF7A5E4E),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryActionPill extends StatelessWidget {
  const _HistoryActionPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6D7C8)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF6F4A32)),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: const Color(0xFF6F4A32),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
