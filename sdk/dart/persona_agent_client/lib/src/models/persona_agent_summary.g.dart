// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_agent_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaAgentSummary _$PersonaAgentSummaryFromJson(Map<String, dynamic> json) =>
    _PersonaAgentSummary(
      id: json['_id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      description: json['description'] as String?,
      tagline: json['tagline'] as String?,
      avatar: json['avatar'] as String?,
    );

Map<String, dynamic> _$PersonaAgentSummaryToJson(
  _PersonaAgentSummary instance,
) => <String, dynamic>{
  '_id': instance.id,
  'name': instance.name,
  'slug': instance.slug,
  'description': instance.description,
  'tagline': instance.tagline,
  'avatar': instance.avatar,
};
