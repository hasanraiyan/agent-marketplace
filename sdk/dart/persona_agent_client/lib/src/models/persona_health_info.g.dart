// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_health_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaHealthInfo _$PersonaHealthInfoFromJson(Map<String, dynamic> json) =>
    _PersonaHealthInfo(
      status: json['status'] as String,
      version: json['version'] as String?,
      capabilities: json['capabilities'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$PersonaHealthInfoToJson(_PersonaHealthInfo instance) =>
    <String, dynamic>{
      'status': instance.status,
      'version': instance.version,
      'capabilities': instance.capabilities,
    };
