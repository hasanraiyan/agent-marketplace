import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// All API-related constants, loaded from environment files (.env).
class ApiConstants {
  ApiConstants._();

  /// Base API URL for the Persona.ai backend.
  static String get baseUrl {
    try {
      final url = dotenv.env['API_BASE_URL'] ?? 'http://localhost:3000/api/v1';
      if (!kIsWeb && Platform.isAndroid) {
        if (url.contains('localhost')) {
          return url.replaceAll('localhost', '10.0.2.2');
        } else if (url.contains('127.0.0.1')) {
          return url.replaceAll('127.0.0.1', '10.0.2.2');
        }
      }
      return url;
    } catch (_) {
      return 'http://localhost:3000/api/v1';
    }
  }

  /// Connection timeout in seconds.
  static const int connectTimeoutSeconds = 30;

  /// Receive timeout in seconds.
  static const int receiveTimeoutSeconds = 30;

  // ── Endpoints ───────────────────────────────────────────────────────────────
  
  // Profile (Clerk Synced User Profiles)
  static const String profile = '/profile';
  
  // Agents (Marketplace & Custom Agents)
  static const String agentsSearch = '/agents/search';
  static const String agentsCount = '/agents/count';
  static const String agents = '/agents'; // GET /agents/:id, POST, PATCH, DELETE

  // Chat Threads
  static const String threads = '/threads'; // GET /threads, POST, DELETE /threads/:id
  static const String threadMessages = '/threads/{id}/messages'; // GET messages in thread

  // LangGraph / AGUI Realtime Stream
  static const String aguiStream = '/agui'; // POST /agui with thread headers

  // Provider Credentials
  static const String providers = '/providers'; // LLM keys (OpenAI, Anthropic, etc.)

  // MCP Servers
  static const String mcps = '/mcps'; // Model Context Protocol setups

  // Skills
  static const String skills = '/skills'; // Bindable agent skills

  // Knowledge
  static const String knowledge = '/knowledge'; // Agent knowledge bases

  // File Upload
  static const String upload = '/upload'; // Media & files
}
