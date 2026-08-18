import 'package:freezed_annotation/freezed_annotation.dart';

part 'persona_mcp_connection.freezed.dart';
part 'persona_mcp_connection.g.dart';

@freezed
abstract class PersonaMcpConnection with _$PersonaMcpConnection {
  const factory PersonaMcpConnection({
    required String mcpId,
    required String name,
    required String description,
    required bool connected,
    String? authorizeUrl,
  }) = _PersonaMcpConnection;

  factory PersonaMcpConnection.fromJson(Map<String, dynamic> json) =>
      _$PersonaMcpConnectionFromJson(json);
}
