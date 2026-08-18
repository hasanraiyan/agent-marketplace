import 'package:dio/dio.dart';

import '../config.dart';
import '../controller_base.dart';
import '../http/persona_http_client.dart';
import '../models/models.dart';
import '../wire/wire_parsing.dart';
import 'persona_mcp_connections_state.dart';

/// Port of `useMcpConnections` — per-user OAuth connection status for every
/// user-mode MCP an agent has attached, so a UI can show a "Connect"
/// affordance instead of a capability silently not being there.
///
/// [returnTo] has no cross-platform default the way the TS source's
/// `window.location.href` does — pass one explicitly if the OAuth
/// `authorizeUrl` needs to redirect back into this app afterward (e.g. a
/// deep link), or omit it to use the backend's own default.
class PersonaMcpConnectionsController extends PersonaController<PersonaMcpConnectionsState> {
  PersonaMcpConnectionsController({
    required PersonaConfig config,
    String? agentId,
    this.returnTo,
    bool autoFetch = true,
    Dio? dio,
  }) : agentId = agentId ?? config.defaultAgentId,
       _dio = dio ?? createPersonaHttpClient(config),
       super(const PersonaMcpConnectionsState()) {
    if (autoFetch) refetch();
  }

  final String? agentId;
  final String? returnTo;
  final Dio _dio;

  Future<void> refetch() async {
    final id = agentId;
    if (id == null) return;
    emit(state.copyWith(isLoading: true, error: null));
    try {
      final response = await _dio.get<Object?>(
        '/agents/$id/mcp-connections',
        queryParameters: {if (returnTo != null) 'returnTo': returnTo},
      );
      final connections = extractListEnvelope(response.data)
          .map((e) => PersonaMcpConnection.fromJson(e as Map<String, dynamic>))
          .toList();
      emit(state.copyWith(connections: connections, isLoading: false));
    } catch (err) {
      emit(state.copyWith(isLoading: false, error: err));
    }
  }
}
