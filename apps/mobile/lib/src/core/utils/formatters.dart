import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

final NumberFormat _currencyFormatter = NumberFormat.currency(
  locale: 'pt_BR',
  symbol: 'R\$',
);

final DateFormat _shortDateFormatter = DateFormat('dd MMM', 'pt_BR');
final DateFormat _fullDateFormatter = DateFormat("EEEE, d 'de' MMMM", 'pt_BR');
final DateFormat _weekdayShortFormatter = DateFormat('EEE', 'pt_BR');
final DateFormat _timeFormatter = DateFormat('HH:mm', 'pt_BR');

String formatCurrency(num value) => _currencyFormatter.format(value);

String formatShortDate(DateTime value) =>
    _capitalize(_shortDateFormatter.format(value));

String formatFullDate(DateTime value) =>
    _capitalize(_fullDateFormatter.format(value));

String formatWeekdayShort(DateTime value) =>
    _capitalize(_weekdayShortFormatter.format(value).replaceAll('.', ''));

String formatTime(DateTime value) => _timeFormatter.format(value);

String formatCompactDateTime(DateTime value) {
  return '${formatShortDate(value)} • ${formatTime(value)}';
}

String firstName(String value) {
  final parts = value
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty);
  return parts.isEmpty ? 'Cliente' : parts.first;
}

Color parseHexColor(String? value, {Color fallback = const Color(0xFFC86B52)}) {
  final normalized = value?.trim() ?? '';
  if (normalized.isEmpty) {
    return fallback;
  }

  final hex = normalized.replaceFirst('#', '');
  if (hex.length != 6 && hex.length != 8) {
    return fallback;
  }

  final buffer = StringBuffer();
  if (hex.length == 6) {
    buffer.write('ff');
  }
  buffer.write(hex);

  return Color(
    int.tryParse(buffer.toString(), radix: 16) ?? fallback.toARGB32(),
  );
}

String sentenceOrFallback(String? value, String fallback) {
  final normalized = value?.trim() ?? '';
  return normalized.isEmpty ? fallback : normalized;
}

String normalizeJoinCode(String value) => value.trim().toUpperCase();

String orderStatusLabel(String value) {
  switch (value.trim().toLowerCase()) {
    case 'pending':
      return 'Recebido';
    case 'confirmed':
      return 'Confirmado';
    case 'ready':
      return 'Pronto';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Em andamento';
  }
}

String appointmentStatusLabel(String value) {
  switch (value.trim().toLowerCase()) {
    case 'pending':
      return 'Aguardando confirmação';
    case 'confirmed':
      return 'Confirmado';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    case 'no_show':
      return 'Não compareceu';
    default:
      return 'Agendado';
  }
}

String _capitalize(String value) {
  if (value.isEmpty) {
    return value;
  }

  return value[0].toUpperCase() + value.substring(1);
}
