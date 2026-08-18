import 'dart:async';

import '../models/models.dart';

/// Per-call overrides for `sendMessage`. Mirrors `SendMessageOverride`'s TS
/// shape, including `threadId`'s `string | Promise<string|undefined>`
/// duality — `FutureOr<String?>` is Dart's exact structural equivalent, and
/// `sendMessage` awaits it directly (works on a plain value or a `Future`
/// without special-casing), preserving the "optimistic UI commits
/// synchronously, the real thread id resolves lazily right before the
/// request body is built" behavior verbatim.
class SendMessageOverride {
  const SendMessageOverride({this.agentId, this.threadId, this.resume});

  final String? agentId;
  final FutureOr<String?>? threadId;
  final PersonaResumeValue? resume;
}
