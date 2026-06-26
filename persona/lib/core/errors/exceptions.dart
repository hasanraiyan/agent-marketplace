/// Base class for all domain-layer exceptions.
///
/// Repositories catch HTTP exceptions and rethrow typed [AppException]
/// subclasses. Use-cases and providers catch these typed exceptions and
/// convert them to [Failure] objects for the UI.
sealed class AppException implements Exception {
  const AppException(this.message);

  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

// ── Network ──────────────────────────────────────────────────────────────────

/// Thrown when the device has no internet connection or a timeout occurs.
class NetworkException extends AppException {
  const NetworkException([
    super.message = 'No internet connection. Please try again.',
  ]);
}

// ── HTTP Status ──────────────────────────────────────────────────────────────

/// 401 — token missing or expired.
class UnauthorizedException extends AppException {
  const UnauthorizedException([
    super.message = 'Session expired. Please log in again.',
  ]);
}

/// 403 — authenticated but not allowed.
class ForbiddenException extends AppException {
  const ForbiddenException([
    super.message = 'You do not have permission to perform this action.',
  ]);
}

/// 404 — resource not found.
class NotFoundException extends AppException {
  const NotFoundException([super.message = 'Resource not found.']);
}

/// 400 / 422 — request body failed server-side validation.
class ValidationException extends AppException {
  const ValidationException([super.message = 'Validation failed.']);
}

/// 5xx — backend error.
class ServerException extends AppException {
  const ServerException([
    super.message = 'Server error. Please try again later.',
  ]);
}

// ── Local / Parse ────────────────────────────────────────────────────────────

/// Thrown when JSON decoding or model mapping fails.
class ParseException extends AppException {
  const ParseException([super.message = 'Failed to parse server response.']);
}

/// Thrown when a required value is missing from local storage.
class StorageException extends AppException {
  const StorageException([super.message = 'Local storage error.']);
}

// ── Fallback ─────────────────────────────────────────────────────────────────

/// Catch-all for any exception that doesn't fit the above categories.
class UnexpectedException extends AppException {
  const UnexpectedException([super.message = 'An unexpected error occurred.']);
}
