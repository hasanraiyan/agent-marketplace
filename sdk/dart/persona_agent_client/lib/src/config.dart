import 'dart:async';

/// Reads the current auth token (if any) fresh on every request — mirrors
/// `PersonaProviderProps.getAuthToken`'s TS signature (which may return a
/// string, a promise of one, or nothing). Returning `null` omits the
/// `Authorization` header entirely (a public/anonymous agent).
typedef PersonaGetAuthToken = FutureOr<String?> Function();

/// Configuration for talking to a Persona backend (or a proxy in front of
/// one, e.g. a Next.js/NestJS app's own API mounting `@personaai/express`/
/// `@personaai/nestjs`). Constructed once and passed explicitly into every
/// controller — the Dart equivalent of `<PersonaProvider>`'s config, minus
/// `children`: there's no implicit-context mechanism for a plain (non-widget)
/// class the way React context provides one, so callers build one
/// [PersonaConfig] at app root and hand it to each controller's constructor.
class PersonaConfig {
  PersonaConfig({required String baseUrl, this.getAuthToken, this.defaultAgentId})
    // Trailing slashes stripped once here, matching PersonaContext.tsx's own
    // normalization, so every request path concatenation below can assume
    // no double slash.
    : baseUrl = _stripTrailingSlashes(baseUrl);

  final String baseUrl;
  final PersonaGetAuthToken? getAuthToken;
  final String? defaultAgentId;

  static String _stripTrailingSlashes(String value) {
    var result = value;
    while (result.endsWith('/')) {
      result = result.substring(0, result.length - 1);
    }
    return result;
  }
}
