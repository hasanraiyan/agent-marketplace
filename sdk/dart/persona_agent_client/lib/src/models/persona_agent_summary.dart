import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_agent_summary.freezed.dart';
part 'persona_agent_summary.g.dart';

@freezed
abstract class PersonaAgentSummary with _$PersonaAgentSummary {
  const factory PersonaAgentSummary({
    @JsonKey(name: '_id') required String id,
    required String name,
    required String slug,
    String? description,
    String? tagline,
    String? avatar,
  }) = _PersonaAgentSummary;

  factory PersonaAgentSummary.fromJson(Map<String, dynamic> json) =>
      _$PersonaAgentSummaryFromJson(json);
}
