/// Keys used to read/write values in SharedPreferences and SecureStorage.
///
/// Centralising keys here prevents typos and makes refactoring safe.
class StorageKeys {
  StorageKeys._();

  // ── Auth ────────────────────────────────────────────────────────────────────
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String userId = 'user_id';

  // ── User Preferences ────────────────────────────────────────────────────────
  static const String isDarkMode = 'is_dark_mode';
  static const String onboardingComplete = 'onboarding_complete';
  static const String selectedLanguage = 'selected_language';
  static const String notificationsLastSyncAt = 'notifications_last_sync_at';
}
