/// Dart client for the Persona AI agent runtime — AG-UI streaming chat,
/// threads, files, memory, and MCP connections. Framework-agnostic, no
/// Flutter dependency.
library;

export 'src/agents/persona_agents_controller.dart';
export 'src/agents/persona_agents_state.dart';
export 'src/chat/chat.dart';
export 'src/common/bulk_delete_result.dart';
export 'src/config.dart';
export 'src/connection/persona_connection_controller.dart';
export 'src/connection/persona_connection_state.dart';
export 'src/controller_base.dart';
export 'src/exceptions.dart';
export 'src/files/persona_files_controller.dart';
export 'src/files/persona_files_state.dart';
export 'src/http/chat_stream.dart' show ChatStreamOpener;
export 'src/mcp/persona_mcp_connections_controller.dart';
export 'src/mcp/persona_mcp_connections_state.dart';
export 'src/memory/persona_memory_controller.dart';
export 'src/memory/persona_memory_state.dart';
export 'src/models/models.dart';
export 'src/threads/persona_threads_controller.dart';
export 'src/threads/persona_threads_state.dart';
export 'src/wire/wire_parsing.dart';
