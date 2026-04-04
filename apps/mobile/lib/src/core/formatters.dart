import 'package:intl/intl.dart';

final NumberFormat _currencyFormatter = NumberFormat.currency(
  locale: 'pt_BR',
  symbol: 'R\$',
);

String formatCurrency(num value) => _currencyFormatter.format(value);

String _twoDigits(int value) => value.toString().padLeft(2, '0');

String _safeIntlFormat(
  DateTime value, {
  required String pattern,
  required String fallback,
}) {
  try {
    return DateFormat(pattern, 'pt_BR').format(value);
  } catch (_) {
    switch (fallback) {
      case 'short_date':
      case 'medium_date':
        return '${_twoDigits(value.day)}/${_twoDigits(value.month)}';
      case 'long_date':
        return '${_twoDigits(value.day)}/${_twoDigits(value.month)}/${value.year}';
      case 'date_time':
        return '${_twoDigits(value.day)}/${_twoDigits(value.month)} • ${_twoDigits(value.hour)}:${_twoDigits(value.minute)}';
      case 'time':
        return '${_twoDigits(value.hour)}:${_twoDigits(value.minute)}';
      default:
        return value.toIso8601String();
    }
  }
}

String formatShortDate(DateTime value) {
  return _safeIntlFormat(value, pattern: 'dd/MM', fallback: 'short_date');
}

String formatMediumDate(DateTime value) {
  return _safeIntlFormat(value, pattern: 'dd MMM', fallback: 'medium_date');
}

String formatOfferLifecycle(DateTime? startsOn, DateTime? endsOn) {
  if (startsOn != null && endsOn != null) {
    return '${formatShortDate(startsOn)} até ${formatShortDate(endsOn)}';
  }

  if (startsOn != null) {
    return 'Ativo desde ${formatShortDate(startsOn)}';
  }

  if (endsOn != null) {
    return 'Válido até ${formatShortDate(endsOn)}';
  }

  return 'Ativo agora';
}

String formatLongDate(DateTime value) {
  return _safeIntlFormat(
    value,
    pattern: "EEEE, d 'de' MMMM",
    fallback: 'long_date',
  );
}

String formatDateTime(DateTime value) {
  return _safeIntlFormat(
    value,
    pattern: "d MMM • HH:mm",
    fallback: 'date_time',
  );
}

String formatTime(DateTime value) {
  return _safeIntlFormat(value, pattern: 'HH:mm', fallback: 'time');
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

  return _safeIntlFormat(
    value,
    pattern: 'dd/MM • HH:mm',
    fallback: 'date_time',
  );
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

String? formatPhoneNumber(String? rawPhone) {
  final onlyDigits = rawPhone?.replaceAll(RegExp(r'\D'), '');
  if (onlyDigits == null || onlyDigits.isEmpty) {
    return null;
  }

  if (onlyDigits.length == 11) {
    return '(${onlyDigits.substring(0, 2)}) ${onlyDigits.substring(2, 7)}-${onlyDigits.substring(7)}';
  }

  if (onlyDigits.length == 10) {
    return '(${onlyDigits.substring(0, 2)}) ${onlyDigits.substring(2, 6)}-${onlyDigits.substring(6)}';
  }

  return onlyDigits;
}
