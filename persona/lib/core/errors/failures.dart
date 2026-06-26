import 'exceptions.dart';

/// UI-facing representation of a domain error.
///
/// Providers return `AsyncValue.error(Failure)` rather than raw exceptions
/// so that the presentation layer has a clean, displayable message.
sealed class Failure {
  const Failure(this.message);

  final String message;

  /// Converts an [AppException] to the appropriate [Failure] subtype.
  factory Failure.fromException(AppException e) => switch (e) {
    NetworkException() => NetworkFailure(e.message),
    UnauthorizedException() => AuthFailure(e.message),
    ForbiddenException() => AuthFailure(e.message),
    NotFoundException() => NotFoundFailure(e.message),
    ValidationException() => ValidationFailure(e.message),
    ServerException() => ServerFailure(e.message),
    ParseException() => ParseFailure(e.message),
    StorageException() => StorageFailure(e.message),
    UnexpectedException() => UnexpectedFailure(e.message),
  };

  @override
  String toString() => '$runtimeType($message)';
}

// ── Subtypes ─────────────────────────────────────────────────────────────────

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection.']);
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Authentication error.']);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Resource not found.']);
}

class ValidationFailure extends Failure {
  const ValidationFailure([super.message = 'Validation failed.']);
}

class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Server error.']);
}

class ParseFailure extends Failure {
  const ParseFailure([super.message = 'Failed to parse data.']);
}

class StorageFailure extends Failure {
  const StorageFailure([super.message = 'Storage error.']);
}

class UnexpectedFailure extends Failure {
  const UnexpectedFailure([super.message = 'An unexpected error occurred.']);
}
