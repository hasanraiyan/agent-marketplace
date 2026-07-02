import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/storage_keys.dart';

/// Riverpod provider for [LocalStorage].
///
/// Initialise [SharedPreferences] once in [main] via
/// `await SharedPreferences.getInstance()` and override this provider if
/// you need to inject a mock in tests.
final localStorageProvider = Provider<LocalStorage>((ref) {
  throw UnimplementedError(
    'LocalStorage must be initialised before use. '
    'Call LocalStorage.init() in main() and override this provider.',
  );
});

/// Thin wrapper around [SharedPreferences] and [FlutterSecureStorage]
/// that provides a secure, clean, typed API.
class LocalStorage {
  LocalStorage._();

  static late SharedPreferences _prefs;
  static const _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(),
  );

  // In-memory cache for secure tokens to support synchronous reads.
  static String? _accessToken;
  static String? _refreshToken;

  /// Must be called once in `main()` before any storage reads/writes.
  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();

    // Cache secure values into memory during initialization
    _accessToken = await _secureStorage.read(key: StorageKeys.accessToken);
    _refreshToken = await _secureStorage.read(key: StorageKeys.refreshToken);
  }

  // ── String ──────────────────────────────────────────────────────────────────
  static Future<bool> setString(String key, String value) async {
    if (key == StorageKeys.accessToken) {
      _accessToken = value;
      await _secureStorage.write(key: key, value: value);
      return true;
    }
    if (key == StorageKeys.refreshToken) {
      _refreshToken = value;
      await _secureStorage.write(key: key, value: value);
      return true;
    }
    return _prefs.setString(key, value);
  }

  static String? getString(String key) {
    if (key == StorageKeys.accessToken) {
      return _accessToken;
    }
    if (key == StorageKeys.refreshToken) {
      return _refreshToken;
    }
    return _prefs.getString(key);
  }

  // ── Bool ────────────────────────────────────────────────────────────────────
  static Future<bool> setBool(String key, {required bool value}) =>
      _prefs.setBool(key, value);

  static bool? getBool(String key) => _prefs.getBool(key);

  // ── Int ─────────────────────────────────────────────────────────────────────
  static Future<bool> setInt(String key, int value) =>
      _prefs.setInt(key, value);

  static int? getInt(String key) => _prefs.getInt(key);

  // ── Double ──────────────────────────────────────────────────────────────────
  static Future<bool> setDouble(String key, double value) =>
      _prefs.setDouble(key, value);

  static double? getDouble(String key) => _prefs.getDouble(key);

  // ── String List ─────────────────────────────────────────────────────────────
  static Future<bool> setStringList(String key, List<String> value) =>
      _prefs.setStringList(key, value);

  static List<String>? getStringList(String key) => _prefs.getStringList(key);

  // ── Removal ─────────────────────────────────────────────────────────────────
  static Future<bool> remove(String key) async {
    if (key == StorageKeys.accessToken) {
      _accessToken = null;
      await _secureStorage.delete(key: key);
      return true;
    }
    if (key == StorageKeys.refreshToken) {
      _refreshToken = null;
      await _secureStorage.delete(key: key);
      return true;
    }
    return _prefs.remove(key);
  }

  /// Clears **all** stored preferences and secure items. Use with care.
  static Future<bool> clear() async {
    _accessToken = null;
    _refreshToken = null;
    await _secureStorage.deleteAll();
    return _prefs.clear();
  }

  // ── Existence ───────────────────────────────────────────────────────────────
  static bool containsKey(String key) {
    if (key == StorageKeys.accessToken) {
      return _accessToken != null;
    }
    if (key == StorageKeys.refreshToken) {
      return _refreshToken != null;
    }
    return _prefs.containsKey(key);
  }
}
