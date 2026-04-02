import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AppCacheStore {
  const AppCacheStore();

  Future<Map<String, dynamic>?> read(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final rawValue = preferences.getString(key);
    if (rawValue == null || rawValue.isEmpty) {
      return null;
    }

    final decoded = jsonDecode(rawValue);
    if (decoded is! Map) {
      return null;
    }

    return Map<String, dynamic>.from(decoded);
  }

  Future<void> write(String key, Map<String, dynamic> value) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(key, jsonEncode(value));
  }

  Future<void> remove(String key) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(key);
  }

  Future<void> removeWhere(bool Function(String key) predicate) async {
    final preferences = await SharedPreferences.getInstance();
    for (final key in preferences.getKeys()) {
      if (predicate(key)) {
        await preferences.remove(key);
      }
    }
  }
}
