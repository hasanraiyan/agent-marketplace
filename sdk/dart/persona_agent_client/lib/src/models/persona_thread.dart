import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_thread.freezed.dart';
part 'persona_thread.g.dart';

/// `PersonaThread.agentId` is a bare id string when the thread list wasn't
/// populated, or a summary object when it was — write-once/read-once
/// (decoded from the wire, never mutated), so a plain sealed class rather
/// than a freezed union.
sealed class PersonaAgentRef {
  const PersonaAgentRef();

  factory PersonaAgentRef.fromJson(Object? json) {
    if (json is String) return PersonaAgentRefId(json);
    if (json is Map<String, dynamic>) {
      return PersonaAgentRefSummary(
        id: json['_id'] as String,
        name: json['name'] as String,
        avatar: json['avatar'] as String?,
        slug: json['slug'] as String?,
      );
    }
    throw ArgumentError('Unexpected PersonaAgentRef shape: $json');
  }

  /// The agent id, whichever shape this ref carries it in.
  String get id;
}

final class PersonaAgentRefId extends PersonaAgentRef {
  const PersonaAgentRefId(this.id);

  @override
  final String id;
}

final class PersonaAgentRefSummary extends PersonaAgentRef {
  const PersonaAgentRefSummary({required this.id, required this.name, this.avatar, this.slug});

  @override
  final String id;
  final String name;
  final String? avatar;
  final String? slug;
}

@freezed
abstract class PersonaThread with _$PersonaThread {
  const factory PersonaThread({
    @JsonKey(name: '_id') required String id,
    @JsonKey(fromJson: PersonaAgentRef.fromJson, toJson: _agentRefToJson) required PersonaAgentRef agentId,
    String? title,
    bool? isArchived,
    required String createdAt,
    required String updatedAt,
  }) = _PersonaThread;

  factory PersonaThread.fromJson(Map<String, dynamic> json) => _$PersonaThreadFromJson(json);
}

Object _agentRefToJson(PersonaAgentRef ref) => switch (ref) {
  PersonaAgentRefId(id: final id) => id,
  PersonaAgentRefSummary(id: final id, name: final name, avatar: final avatar, slug: final slug) => {
    '_id': id,
    'name': name,
    if (avatar != null) 'avatar': avatar,
    if (slug != null) 'slug': slug,
  },
};
