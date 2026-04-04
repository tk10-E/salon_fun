String buildPixCopyPaste({
  required String pixKey,
  required String merchantName,
  required String merchantCity,
  required double amount,
  String? description,
  String? transactionId,
}) {
  final normalizedKey = pixKey.trim();
  if (normalizedKey.isEmpty) {
    throw ArgumentError.value(pixKey, 'pixKey', 'A chave Pix é obrigatória.');
  }

  final normalizedMerchantName = _sanitizeMerchantText(
    merchantName,
    maxLength: 25,
  );
  final normalizedMerchantCity = _sanitizeMerchantText(
    merchantCity,
    maxLength: 15,
  );

  if (normalizedMerchantName.isEmpty || normalizedMerchantCity.isEmpty) {
    throw ArgumentError(
      'Informe favorecido e cidade para montar o Pix copia e cola.',
    );
  }

  final accountFields = <String>[
    _emvField('00', 'BR.GOV.BCB.PIX'),
    _emvField('01', normalizedKey),
  ];
  final normalizedDescription = _sanitizeMerchantText(
    description ?? '',
    maxLength: 72,
  );

  if (normalizedDescription.isNotEmpty) {
    accountFields.add(_emvField('02', normalizedDescription));
  }

  final normalizedTxid = _sanitizeTxid(transactionId);
  final additionalData = _emvField('05', normalizedTxid);
  final payload = <String>[
    _emvField('00', '01'),
    _emvField('26', accountFields.join()),
    _emvField('52', '0000'),
    _emvField('53', '986'),
    if (amount > 0) _emvField('54', amount.toStringAsFixed(2)),
    _emvField('58', 'BR'),
    _emvField('59', normalizedMerchantName),
    _emvField('60', normalizedMerchantCity),
    _emvField('62', additionalData),
    '6304',
  ].join();

  return '$payload${_crc16(payload)}';
}

String buildPixTransactionId(String appointmentId) {
  final normalized = appointmentId
      .replaceAll(RegExp(r'[^A-Za-z0-9]'), '')
      .toUpperCase();

  if (normalized.isEmpty) {
    return 'SALONFUN';
  }

  final end = normalized.length > 23 ? 23 : normalized.length;
  return 'SF${normalized.substring(0, end)}';
}

String _emvField(String id, String value) {
  return '$id${value.length.toString().padLeft(2, '0')}$value';
}

String _sanitizeTxid(String? value) {
  final normalized = (value ?? '').trim().toUpperCase().replaceAll(
    RegExp(r'[^A-Z0-9]'),
    '',
  );

  if (normalized.isEmpty) {
    return 'SALONFUN';
  }

  final end = normalized.length > 25 ? 25 : normalized.length;
  return normalized.substring(0, end);
}

String _sanitizeMerchantText(String value, {required int maxLength}) {
  final normalized = _stripAccents(value)
      .toUpperCase()
      .replaceAll(RegExp(r'[^A-Z0-9 ]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();

  if (normalized.isEmpty) {
    return '';
  }

  final end = normalized.length > maxLength ? maxLength : normalized.length;
  return normalized.substring(0, end);
}

String _stripAccents(String value) {
  const replacements = <String, String>{
    'Á': 'A',
    'À': 'A',
    'Â': 'A',
    'Ã': 'A',
    'Ä': 'A',
    'á': 'A',
    'à': 'A',
    'â': 'A',
    'ã': 'A',
    'ä': 'A',
    'É': 'E',
    'È': 'E',
    'Ê': 'E',
    'Ë': 'E',
    'é': 'E',
    'è': 'E',
    'ê': 'E',
    'ë': 'E',
    'Í': 'I',
    'Ì': 'I',
    'Î': 'I',
    'Ï': 'I',
    'í': 'I',
    'ì': 'I',
    'î': 'I',
    'ï': 'I',
    'Ó': 'O',
    'Ò': 'O',
    'Ô': 'O',
    'Õ': 'O',
    'Ö': 'O',
    'ó': 'O',
    'ò': 'O',
    'ô': 'O',
    'õ': 'O',
    'ö': 'O',
    'Ú': 'U',
    'Ù': 'U',
    'Û': 'U',
    'Ü': 'U',
    'ú': 'U',
    'ù': 'U',
    'û': 'U',
    'ü': 'U',
    'Ç': 'C',
    'ç': 'C',
    'Ñ': 'N',
    'ñ': 'N',
  };

  final buffer = StringBuffer();
  for (final rune in value.runes) {
    final character = String.fromCharCode(rune);
    buffer.write(replacements[character] ?? character);
  }
  return buffer.toString();
}

String _crc16(String value) {
  var crc = 0xFFFF;

  for (final codeUnit in value.codeUnits) {
    crc ^= codeUnit << 8;
    for (var bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) != 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }

  return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
}
