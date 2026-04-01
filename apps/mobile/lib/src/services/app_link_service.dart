import 'dart:async';

import 'package:flutter/services.dart';

enum SalonAppAuthAction { passwordRecovery }

class SalonAppLink {
  const SalonAppLink._(this.uri);

  final Uri uri;

  Map<String, String> get _deepLinkParameters {
    final combined = <String, String>{...uri.queryParameters};
    final fragment = uri.fragment.trim();

    if (fragment.isNotEmpty) {
      try {
        combined.addAll(Uri.splitQueryString(fragment));
      } on FormatException {
        // Ignore fragments that do not follow query-string format.
      }
    }

    return combined;
  }

  static SalonAppLink? parse(String? rawLink) {
    final value = rawLink?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(value);
    if (uri == null) {
      return null;
    }

    return SalonAppLink._(uri);
  }

  bool get isAuthCallback {
    if (uri.scheme.toLowerCase() != 'salonfun') {
      return false;
    }

    if (uri.host.toLowerCase() == 'auth-callback') {
      return true;
    }

    return uri.pathSegments.any(
      (segment) => segment.toLowerCase().trim() == 'auth-callback',
    );
  }

  SalonAppAuthAction? get authAction {
    if (!isAuthCallback) {
      return null;
    }

    final type = _deepLinkParameters['type']?.trim().toLowerCase();
    if (type == 'recovery') {
      return SalonAppAuthAction.passwordRecovery;
    }

    return null;
  }

  bool get isJoinLink {
    if (uri.scheme.toLowerCase() != 'salonfun') {
      return false;
    }

    if (uri.host.toLowerCase() == 'join') {
      return true;
    }

    return uri.pathSegments.any(
      (segment) => segment.toLowerCase().trim() == 'join',
    );
  }

  String? get joinCode {
    if (!isJoinLink) {
      return null;
    }

    final rawCode =
        uri.queryParameters['code'] ??
        uri.queryParameters['joinCode'] ??
        (uri.pathSegments.isEmpty ? null : uri.pathSegments.last);
    final normalizedCode = rawCode?.trim().toUpperCase().replaceAll(
      RegExp(r'[^A-Z0-9]'),
      '',
    );

    if (normalizedCode == null || normalizedCode.isEmpty) {
      return null;
    }

    return normalizedCode;
  }
}

class AppLinkService {
  AppLinkService._();

  static final AppLinkService instance = AppLinkService._();

  static const MethodChannel _methodChannel = MethodChannel(
    'com.salonfun.salon_client/app_links',
  );
  static const EventChannel _eventChannel = EventChannel(
    'com.salonfun.salon_client/app_links/events',
  );

  Stream<SalonAppLink> get linkStream => _eventChannel
      .receiveBroadcastStream()
      .map((event) => SalonAppLink.parse(event as String?))
      .where((link) => link != null)
      .cast<SalonAppLink>();

  Future<SalonAppLink?> getInitialLink() async {
    try {
      final rawLink = await _methodChannel.invokeMethod<String>(
        'getInitialLink',
      );
      return SalonAppLink.parse(rawLink);
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }
}
