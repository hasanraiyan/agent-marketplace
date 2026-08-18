import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_interrupt.freezed.dart';
part 'persona_interrupt.g.dart';

@freezed
abstract class PersonaHitlActionRequest with _$PersonaHitlActionRequest {
  const factory PersonaHitlActionRequest({required String name, Object? args}) =
      _PersonaHitlActionRequest;

  factory PersonaHitlActionRequest.fromJson(Map<String, dynamic> json) =>
      _$PersonaHitlActionRequestFromJson(json);
}

@freezed
abstract class PersonaClarificationQuestion with _$PersonaClarificationQuestion {
  const factory PersonaClarificationQuestion({
    required String id,
    required String text,
    required List<String> options,
    required bool required,
    required bool allowCustom,
  }) = _PersonaClarificationQuestion;

  factory PersonaClarificationQuestion.fromJson(Map<String, dynamic> json) =>
      _$PersonaClarificationQuestionFromJson(json);
}

/// A paused run awaiting either human-in-the-loop tool approval or answers
/// to clarification questions. Write-once/read-once (built directly from a
/// decoded `hitl_request`/`clarification_request` CUSTOM event, or from the
/// `{kind,value}` envelope `GET /threads/:id/messages`'s `pendingInterrupt`
/// carries), pattern-matched immediately — a plain sealed class needs no
/// `copyWith`, unlike the freezed models above.
sealed class PersonaInterrupt {
  const PersonaInterrupt();

  /// Builds from the flattened `{kind, value}` envelope both the live
  /// `CUSTOM` events and `pendingInterrupt`'s reload-path shape share.
  factory PersonaInterrupt.fromEnvelope(String kind, Map<String, dynamic> value) => switch (kind) {
    'hitl' => PersonaHitlInterrupt(
      actionRequests: (value['actionRequests'] as List<dynamic>? ?? [])
          .map((e) => PersonaHitlActionRequest.fromJson(e as Map<String, dynamic>))
          .toList(),
      reviewConfigs: (value['reviewConfigs'] as List<dynamic>?) ?? const [],
    ),
    'clarification' => PersonaClarificationInterrupt(
      questions: (value['questions'] as List<dynamic>? ?? [])
          .map((e) => PersonaClarificationQuestion.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    _ => throw ArgumentError('Unknown PersonaInterrupt kind: $kind'),
  };
}

final class PersonaHitlInterrupt extends PersonaInterrupt {
  const PersonaHitlInterrupt({required this.actionRequests, required this.reviewConfigs});

  final List<PersonaHitlActionRequest> actionRequests;
  final List<Object?> reviewConfigs;
}

final class PersonaClarificationInterrupt extends PersonaInterrupt {
  const PersonaClarificationInterrupt({required this.questions});

  final List<PersonaClarificationQuestion> questions;
}

/// What the caller sends back to unpause a [PersonaInterrupt] — outbound
/// only (built by the caller, serialized into `sendMessage`'s request body),
/// so this only needs [toJson], never a `fromJson`.
sealed class PersonaResumeValue {
  const PersonaResumeValue();

  Map<String, dynamic> toJson();
}

enum PersonaHitlDecisionType { approve, reject }

class PersonaHitlDecision {
  const PersonaHitlDecision({required this.type, this.message});

  final PersonaHitlDecisionType type;
  final String? message;

  Map<String, dynamic> toJson() => {
    'type': type == PersonaHitlDecisionType.approve ? 'approve' : 'reject',
    if (message != null) 'message': message,
  };
}

final class PersonaDecisionsResume extends PersonaResumeValue {
  const PersonaDecisionsResume(this.decisions);

  final List<PersonaHitlDecision> decisions;

  @override
  Map<String, dynamic> toJson() => {'decisions': decisions.map((d) => d.toJson()).toList()};
}

final class PersonaAnswersResume extends PersonaResumeValue {
  const PersonaAnswersResume(this.answers, {this.text});

  final List<Object?> answers;
  final String? text;

  @override
  Map<String, dynamic> toJson() => {'answers': answers, if (text != null) 'text': text};
}
