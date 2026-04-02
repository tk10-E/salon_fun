import 'package:intl/intl.dart';

final NumberFormat _currencyFormatter = NumberFormat.currency(
  locale: 'pt_BR',
  symbol: 'R\$',
);

String formatCurrency(num value) => _currencyFormatter.format(value);

String formatShortDate(DateTime value) {
  return DateFormat('dd/MM', 'pt_BR').format(value);
}

String formatMediumDate(DateTime value) {
  return DateFormat('dd MMM', 'pt_BR').format(value);
}

String formatLongDate(DateTime value) {
  return DateFormat("EEEE, d 'de' MMMM", 'pt_BR').format(value);
}

String formatDateTime(DateTime value) {
  return DateFormat("d MMM • HH:mm", 'pt_BR').format(value);
}

String formatTime(DateTime value) {
  return DateFormat('HH:mm', 'pt_BR').format(value);
}

String formatRelativeFreshness(DateTime value) {
  final difference = DateTime.now().difference(value);

  if (difference.inMinutes <= 0) {
    return 'agora';
  }
  if (difference.inMinutes == 1) {
    return 'há 1 min';
  }
  if (difference.inMinutes < 60) {
    return 'há ${difference.inMinutes} min';
  }
  if (difference.inHours == 1) {
    return 'há 1 hora';
  }
  if (difference.inHours < 24) {
    return 'há ${difference.inHours} horas';
  }
  if (difference.inDays == 1) {
    return 'ontem';
  }

  return DateFormat('dd/MM • HH:mm', 'pt_BR').format(value);
}

String greetingForNow(DateTime now) {
  final hour = now.hour;

  if (hour < 12) {
    return 'Bom dia';
  }
  if (hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

String? buildWhatsAppUrl(String? rawPhone) {
  final onlyDigits = rawPhone?.replaceAll(RegExp(r'\D'), '');
  if (onlyDigits == null || onlyDigits.isEmpty) {
    return null;
  }

  return 'https://wa.me/$onlyDigits';
}
