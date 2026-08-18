import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/models.dart';

part 'persona_mcp_connections_state.freezed.dart';

@freezed
abstract class PersonaMcpConnectionsState with _$PersonaMcpConnectionsState {
  const factory PersonaMcpConnectionsState({
    @Default([]) List<PersonaMcpConnection> connections,
    @Default(false) bool isLoading,
    Object? error,
  }) = _PersonaMcpConnectionsState;

  const PersonaMcpConnectionsState._();

  List<PersonaMcpConnection> get unconnected =>
      connections.where((c) => !c.connected).toList();
}
