import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import '../theme/service_category_visual.dart';
import 'soft_card.dart';

class CustomerGrowthSuggestionCard extends StatelessWidget {
  const CustomerGrowthSuggestionCard({
    super.key,
    required this.suggestion,
    required this.branding,
    required this.onBook,
  });

  final CustomerGrowthSuggestionItem suggestion;
  final SalonBranding branding;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');
    final serviceVisual = resolveServiceCategoryVisual(
      category: suggestion.serviceCategory,
      name: suggestion.serviceName,
    );

    return SoftCard(
      padding: const EdgeInsets.all(20),
      borderColor: branding.outline.withValues(alpha: 0.76),
      gradient: LinearGradient(
        colors: [
          _accentColor.withValues(alpha: 0.18),
          _accentColor.withValues(alpha: 0.08),
          Colors.white.withValues(alpha: 0.98),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(_icon, color: _accentColor),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _eyebrow,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: _accentColor,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _title,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF2F231C),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            _description,
            style: theme.textTheme.bodyLarge?.copyWith(
              color: const Color(0xFF705A4B),
              height: 1.45,
            ),
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _GrowthInfoChip(
                icon: serviceVisual.icon,
                label: suggestion.serviceName,
                branding: branding,
                foregroundColor: _accentColor,
              ),
              if (suggestion.servicePrice != null)
                _GrowthInfoChip(
                  icon: Icons.sell_rounded,
                  label: currency.format(suggestion.servicePrice),
                  branding: branding,
                  foregroundColor: _accentColor,
                ),
              if (suggestion.serviceDuration != null)
                _GrowthInfoChip(
                  icon: Icons.schedule_rounded,
                  label: '${suggestion.serviceDuration} min',
                  branding: branding,
                  foregroundColor: _accentColor,
                ),
              if (suggestion.recommendedIntervalDays != null)
                _GrowthInfoChip(
                  icon: Icons.replay_rounded,
                  label: '${suggestion.recommendedIntervalDays} dias',
                  branding: branding,
                  foregroundColor: _accentColor,
                ),
              if (suggestion.recommendedBookingDate != null)
                _GrowthInfoChip(
                  icon: Icons.event_available_rounded,
                  label:
                      'Ideal em ${DateFormat('dd/MM').format(suggestion.recommendedBookingDate!)}',
                  branding: branding,
                  foregroundColor: _accentColor,
                ),
              if (suggestion.hasIncentive)
                _GrowthInfoChip(
                  icon: Icons.local_offer_rounded,
                  label: '${suggestion.incentivePercent}% OFF',
                  branding: branding,
                  foregroundColor: const Color(0xFF9A4A1F),
                ),
              if (suggestion.isHabitBased)
                _GrowthInfoChip(
                  icon: Icons.auto_awesome_rounded,
                  label:
                      '${suggestion.habitWeekday ?? 'Seu melhor dia'}${suggestion.habitPeriod != null ? ' ${suggestion.habitPeriod}' : ''}',
                  branding: branding,
                  foregroundColor: _accentColor,
                ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onBook,
              style: FilledButton.styleFrom(
                backgroundColor: _accentColor,
                foregroundColor: _onAccentColor,
              ),
              icon: Icon(_buttonIcon),
              label: Text(_buttonLabel),
            ),
          ),
        ],
      ),
    );
  }

  Color get _accentColor {
    if (suggestion.hasIncentive) {
      return const Color(0xFFC56B43);
    }

    if (suggestion.isCombo) {
      return const Color(0xFF6D8B74);
    }

    return branding.primary;
  }

  Color get _onAccentColor =>
      ThemeData.estimateBrightnessForColor(_accentColor) == Brightness.dark
      ? Colors.white
      : const Color(0xFF2E1B12);

  IconData get _icon {
    if (suggestion.hasIncentive) {
      return Icons.campaign_rounded;
    }

    if (suggestion.isCombo) {
      return Icons.auto_awesome_rounded;
    }

    return Icons.event_repeat_rounded;
  }

  IconData get _buttonIcon => suggestion.isCombo
      ? Icons.add_circle_outline_rounded
      : Icons.calendar_month_rounded;

  String get _buttonLabel =>
      suggestion.isCombo ? 'Agendar esse combo' : 'Agendar próximo horário';

  String get _eyebrow {
    if (suggestion.hasIncentive) {
      return 'Recuperação inteligente';
    }

    if (suggestion.isHabitBased) {
      return 'Rebook pelo seu hábito';
    }

    if (suggestion.isCombo) {
      return 'Sugestão de combo';
    }

    switch (suggestion.urgency) {
      case 'due_now':
        return 'Hora de voltar';
      case 'due_soon':
        return 'Próximo cuidado';
      default:
        return 'Planeje seu retorno';
    }
  }

  String get _title {
    if (suggestion.hasIncentive) {
      return 'Seu próximo ${suggestion.serviceName} pode sair com ${suggestion.incentivePercent}% OFF';
    }

    if (suggestion.isHabitBased && !suggestion.isCombo) {
      return 'Você costuma reservar ${suggestion.serviceName} ${suggestion.habitWeekday ?? 'no melhor dia'}';
    }

    if (suggestion.isCombo) {
      return 'Aproveite e encaixe ${suggestion.serviceName}';
    }

    switch (suggestion.urgency) {
      case 'due_now':
        return 'Seu próximo ${suggestion.serviceName} já entrou na janela ideal';
      case 'due_soon':
        return 'Vale deixar ${suggestion.serviceName} reservado';
      default:
        return 'Quer deixar ${suggestion.serviceName} previsto agora?';
    }
  }

  String get _description {
    if (suggestion.hasIncentive) {
      return 'Você está há ${suggestion.inactiveDays ?? 30} dias sem vir. Reserve ${suggestion.serviceName} e aproveite o incentivo para voltar.';
    }

    if (suggestion.isCombo) {
      if (suggestion.isHabitBased) {
        return 'Depois de ${suggestion.basedOnServiceName}, esse complemento combina com a visita que você costuma fazer ${suggestion.habitWeekday ?? 'no melhor dia'}${suggestion.habitPeriod != null ? ' ${suggestion.habitPeriod}' : ''}.';
      }

      return 'Depois de ${suggestion.basedOnServiceName}, esse complemento costuma combinar bem com a próxima visita.';
    }

    switch (suggestion.urgency) {
      case 'due_now':
        if (suggestion.isHabitBased) {
          return 'Seu ciclo ideal já abriu. Reservar agora ajuda a pegar ${suggestion.habitWeekday ?? 'o melhor dia'}${suggestion.habitPeriod != null ? ' ${suggestion.habitPeriod}' : ''} antes de lotar.';
        }

        return 'Seu último ${suggestion.basedOnServiceName} já passou da janela ideal de ${suggestion.recommendedIntervalDays ?? 30} dias. Reservar agora ajuda a pegar os melhores horários.';
      case 'due_soon':
        if (suggestion.isHabitBased) {
          return 'Seu próximo ${suggestion.basedOnServiceName} está chegando e o app puxou o padrão que você costuma seguir ${suggestion.habitWeekday ?? 'no melhor dia'}${suggestion.habitPeriod != null ? ' ${suggestion.habitPeriod}' : ''}.';
        }

        return 'O ciclo ideal para ${suggestion.basedOnServiceName} fecha em breve. Se quiser, já dá para deixar sua próxima visita encaminhada.';
      default:
        final recommendedDate = suggestion.recommendedBookingDate;
        if (recommendedDate != null) {
          if (suggestion.isHabitBased) {
            return 'Você costuma voltar ${suggestion.habitWeekday ?? 'no melhor dia'}${suggestion.habitPeriod != null ? ' ${suggestion.habitPeriod}' : ''}. O app já pode deixar esse horário encaminhado para ${DateFormat('dd/MM').format(recommendedDate)}.';
          }

          return 'O app já pode deixar seu retorno previsto para ${DateFormat('dd/MM').format(recommendedDate)}.';
        }

        return 'O app identificou um bom momento para você voltar.';
    }
  }
}

class _GrowthInfoChip extends StatelessWidget {
  const _GrowthInfoChip({
    required this.icon,
    required this.label,
    required this.branding,
    required this.foregroundColor,
  });

  final IconData icon;
  final String label;
  final SalonBranding branding;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: branding.outline.withValues(alpha: 0.58)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: foregroundColor),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
