/// Thrown when the SSE stream carries a `RUN_ERROR` event — the backend's
/// own signal that a run failed server-side, distinct from a transport-level
/// (Dio/network) failure.
class PersonaRunErrorException implements Exception {
  const PersonaRunErrorException(this.message, {this.code, this.retryable, this.providerName});

  final String message;
  final String? code;
  final bool? retryable;
  final String? providerName;

  @override
  String toString() => 'PersonaRunErrorException: $message';
}
