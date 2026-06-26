import 'package:flutter/foundation.dart';

/// Lightweight logging and error tracking service.
///
/// In production, this can be wired up to Firebase Crashlytics, Sentry, or Bugsnag.
/// In local development, it falls back to print and debug console outputs.
class CrashReportingService {
  CrashReportingService._();

  static final CrashReportingService instance = CrashReportingService._();

  bool _isEnabled = false;

  bool get isEnabled => _isEnabled;

  Future<void> init() async {
    // Stub initialization. Can integrate Firebase.initializeApp() later.
    _isEnabled = true;
    if (kDebugMode) {
      print('[CrashReportingService] Initialized (Console Logging Active)');
    }
  }

  void installFlutterErrorHandlers() {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      recordFlutterFatalError(details);
    };

    PlatformDispatcher.instance.onError = (error, stackTrace) {
      recordError(
        error,
        stackTrace,
        fatal: true,
      );
      return true;
    };
  }

  Future<void> recordFlutterFatalError(FlutterErrorDetails details) async {
    if (!_isEnabled) return;
    if (kDebugMode) {
      print('[FATAL ERROR] Flutter Error: ${details.exceptionAsString()}');
    }
  }

  Future<void> recordError(
    Object error,
    StackTrace? stackTrace, {
    bool fatal = false,
    String? reason,
  }) async {
    if (!_isEnabled) return;
    if (kDebugMode) {
      print('[ERROR] ${fatal ? "FATAL " : ""}App Error: $error');
      if (reason != null) {
        print('Reason: $reason');
      }
      if (stackTrace != null) {
        print('StackTrace:\n$stackTrace');
      }
    }
  }

  Future<void> log(String message) async {
    if (!_isEnabled) return;
    if (kDebugMode) {
      print('[LOG] $message');
    }
  }

  Future<void> setUserId(String? userId) async {
    if (!_isEnabled) return;
    if (kDebugMode) {
      print('[USER ID] Associated: $userId');
    }
  }
}
