import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

typedef NetworkAction<T> = Future<T> Function();

const _defaultTimeoutMessage =
    'A conexão com o painel demorou para responder. Tente novamente em instantes.';
const _defaultConnectionMessage =
    'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.';

Future<T> runGuardedRead<T>(
  NetworkAction<T> action, {
  Duration timeout = const Duration(seconds: 10),
  int retries = 1,
  Duration retryDelay = const Duration(milliseconds: 350),
  String timeoutMessage = _defaultTimeoutMessage,
  String connectionMessage = _defaultConnectionMessage,
}) async {
  var attempt = 0;
  while (true) {
    try {
      return await action().timeout(timeout);
    } on TimeoutException {
      if (attempt >= retries) {
        throw Exception(timeoutMessage);
      }
    } on SocketException {
      if (attempt >= retries) {
        throw Exception(connectionMessage);
      }
    } on http.ClientException {
      if (attempt >= retries) {
        throw Exception(connectionMessage);
      }
    } on PostgrestException catch (error) {
      if (!_isTransientMessage(error.message) || attempt >= retries) {
        rethrow;
      }
    } catch (error) {
      if (!_isTransientMessage(error.toString()) || attempt >= retries) {
        rethrow;
      }
    }

    attempt += 1;
    await Future<void>.delayed(
      Duration(milliseconds: retryDelay.inMilliseconds * attempt),
    );
  }
}

Future<T> runGuardedWrite<T>(
  NetworkAction<T> action, {
  Duration timeout = const Duration(seconds: 15),
  String timeoutMessage = _defaultTimeoutMessage,
  String connectionMessage = _defaultConnectionMessage,
}) async {
  try {
    return await action().timeout(timeout);
  } on TimeoutException {
    throw Exception(timeoutMessage);
  } on SocketException {
    throw Exception(connectionMessage);
  } on http.ClientException {
    throw Exception(connectionMessage);
  } on PostgrestException catch (error) {
    if (_isTransientMessage(error.message)) {
      throw Exception(connectionMessage);
    }
    rethrow;
  } catch (error) {
    if (_isTransientMessage(error.toString())) {
      throw Exception(connectionMessage);
    }
    rethrow;
  }
}

bool _isTransientMessage(String message) {
  final normalized = message.trim().toLowerCase();
  if (normalized.isEmpty) {
    return false;
  }

  return normalized.contains('timeout') ||
      normalized.contains('timed out') ||
      normalized.contains('socketexception') ||
      normalized.contains('connection closed') ||
      normalized.contains('connection reset') ||
      normalized.contains('connection refused') ||
      normalized.contains('network is unreachable') ||
      normalized.contains('network request failed') ||
      normalized.contains('failed host lookup') ||
      normalized.contains('clientexception') ||
      normalized.contains('fetch failed') ||
      normalized.contains('temporarily unavailable');
}
