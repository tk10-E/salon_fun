import 'dart:async';

import 'package:flutter/material.dart';

import '../../features/home/home_data.dart';
import '../../models/app_models.dart';
import '../../theme/salon_branding.dart';
import '../customer_growth_suggestion_card.dart';
import '../empty_state.dart';
import '../soft_card.dart';
import 'home_appointment_card.dart';
import 'home_history_brand_header.dart';
import 'home_section_intro.dart';

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
          padding: const EdgeInsets.all(20),
          children: [
            HomeHistoryBrandHeader(
              profile: profile,
              branding: branding,
              appointmentCount: appointments.length,
            ),
            const SizedBox(height: 20),
            const HomeSectionIntro(
              eyebrow: 'Seu histórico',
              title: 'Seus horários vão aparecer aqui',
              description:
                  'Assim que você fizer um agendamento, será fácil acompanhar serviços, datas, valores e profissional.',
            ),
            const SizedBox(height: 16),
            EmptyState(
              centered: true,
              icon: Icons.history_toggle_off_rounded,
              eyebrow: 'Nenhum horário ainda',
              title: 'Seu histórico está vazio',
              message:
                  'Quando você reservar um atendimento, o app vai guardar serviço, data, valor e profissional para você consultar depois.',
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
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        itemCount: appointments.length + 1,
        separatorBuilder: (_, index) => index == 0
            ? const SizedBox(height: 18)
            : const SizedBox(height: 14),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HomeHistoryBrandHeader(
                  profile: profile,
                  branding: branding,
                  appointmentCount: appointments.length,
                ),
                const SizedBox(height: 20),
                HomeSectionIntro(
                  eyebrow: 'Seu histórico',
                  title: _historyIntroTitle,
                  description: _historyIntroDescription,
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

  String get _historyIntroTitle {
    if (_hasUpcomingAppointment) {
      return 'Acompanhe seus atendimentos com clareza';
    }

    if (insightData?.growthSuggestions?.hasVisibleContent == true) {
      return 'Seu histórico agora ajuda no próximo retorno';
    }

    if (insightData?.loyaltySummary?.hasVisibleContent == true ||
        (insightData?.offers.isNotEmpty ?? false)) {
      return 'Seu histórico agora trabalha a favor da recorrência';
    }

    return 'Acompanhe seus atendimentos com clareza';
  }

  String get _historyIntroDescription {
    if (_hasUpcomingAppointment) {
      return 'Datas, status, valores e profissional organizados para você resolver tudo sem conversa solta.';
    }

    if (insightData?.growthSuggestions?.hasVisibleContent == true) {
      return 'O app usa seu histórico para sugerir o melhor momento de voltar, reservar de novo e recuperar frequência com menos atrito.';
    }

    if (insightData?.loyaltySummary?.hasVisibleContent == true ||
        (insightData?.offers.isNotEmpty ?? false)) {
      return 'Seu histórico, benefícios e campanhas do salão ficam juntos para facilitar seu próximo retorno.';
    }

    return 'Datas, status, valores e profissional organizados para você resolver tudo sem conversa solta.';
  }

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
        const HomeSectionIntro(
          eyebrow: 'Rebook inteligente',
          title: 'O melhor momento para voltar já apareceu no app',
          description:
              'Com base no seu histórico, o app já separou a sugestão com mais chance de virar retorno agora.',
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
        ? 'Seu próximo retorno pode render vantagem dupla'
        : loyaltySummary?.hasVisibleContent == true
        ? 'Sua carteira já pode puxar a próxima visita'
        : 'O salão já tem uma vantagem ativa para sua volta';

    final message =
        loyaltySummary?.hasVisibleContent == true && featuredOffer != null
        ? 'Você já acumulou ${loyaltySummary!.pointsBalance} pontos e ${loyaltySummary.completedVisits} visitas concluídas. Além disso, ${featuredOffer.isMembership ? 'o pacote' : 'a campanha'} ${featuredOffer.title} pode ajudar no seu próximo retorno.'
        : loyaltySummary?.hasVisibleContent == true
        ? 'Seus ${loyaltySummary!.pointsBalance} pontos, visitas e cashback ficam guardados na carteira para você acompanhar desconto progressivo e próximas vantagens.'
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (showWalletAction)
                FilledButton.icon(
                  onPressed: onOpenWallet,
                  icon: const Icon(Icons.account_balance_wallet_outlined),
                  label: const Text('Abrir carteira'),
                ),
              OutlinedButton.icon(
                onPressed: onWhatsApp,
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('Falar com o salão'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
