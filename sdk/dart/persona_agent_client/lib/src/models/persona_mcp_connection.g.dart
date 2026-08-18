// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'persona_mcp_connection.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PersonaMcpConnection _$PersonaMcpConnectionFromJson(
  Map<String, dynamic> json,
) => _PersonaMcpConnection(
  mcpId: json['mcpId'] as String,
  name: json['name'] as String,
  description: json['description'] as String,
  connected: json['connected'] as bool,
  authorizeUrl: json['authorizeUrl'] as String?,
);

Map<String, dynamic> _$PersonaMcpConnectionToJson(
  _PersonaMcpConnection instance,
) => <String, dynamic>{
  'mcpId': instance.mcpId,
  'name': instance.name,
  'description': instance.description,
  'connected': instance.connected,
  'authorizeUrl': instance.authorizeUrl,
};
