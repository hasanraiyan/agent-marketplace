# Project Plan: Persona.ai Flutter Mobile App (`persona`)

This document outlines the strategic implementation plan, architecture design, and library stack for the new **Persona.ai** Flutter application (`D:\projects\agent-marketplace\agent-backend\persona`). The design and conventions are adapted from the robust patterns analyzed in `career_simplify_android_app`.

---

## 1. Architectural Strategy

We will adopt a **Feature-First + Clean Architecture** approach, mirroring the successful structure of `career_simplify_android_app`. This ensures that each feature remains self-contained, highly testable, and scale-friendly as the marketplace expands.

### Folder Structure Overview
```text
lib/
  core/                     # Cross-cutting infrastructure
    app/                    # App bootstrapping / lifecycle
    config/                 # Environment configs & system constants
    errors/                 # Standardized app exception types
    network/                # Dio client, headers, and token interceptors
    router/                 # GoRouter navigation & guards
    storage/                # Key-value / secure credential storage
    theme/                  # FlexColorScheme configurations
  shared/                   # Global components & utilities
    design_system/          # Core brand assets, colors, and text styles
    utils/                  # Date formatting, logger, etc.
    widgets/                # Custom common UI widgets (e.g. Loading, Dialogs)
  services/                 # Third-party integrations & background runners
    analytics_service.dart
    onesignal_service.dart
    crash_reporting.dart
  features/                 # Modules grouped by business domain
    auth/
      data/                 # DTOs, API providers, remote datasources
      domain/               # Pure entities, repository interfaces, validators
      application/          # Riverpod controllers, state classes
      presentation/         # Screens, widgets, dialogs
    agent_marketplace/      # Listing, searching, and viewing agents
    chat_thread/            # Real-time chat & LangGraph execution/trace log streaming
    mcp_config/             # Model Context Protocol server configuration
    provider_keys/          # LLM API credentials & rotation setup
    profile/                # Account management and preferences
```

---

## 2. Core Library Stack

To maintain compatibility with the Dart SDK `^3.12.1` specified in `@persona`'s pubspec, we recommend installing the exact, proven package versions used in `career_simplify_android_app`.

### Recommended Dependencies (`pubspec.yaml`)

Add these to your `pubspec.yaml` under `dependencies:`:

| Category | Package | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **State Management** | `flutter_riverpod` | `^3.3.1` | Decoupled business logic and UI state propagation. |
| **Navigation** | `go_router` | `^17.3.0` | Declarative routing with splash/auth redirection guards. |
| **Network Client** | `dio` | `^5.9.2` | HTTP client supporting interceptors for Auth, custom headers, and chunked SSE streaming. |
| **Local Storage** | `shared_preferences` | `^2.5.5` | Persisting light configuration parameters (e.g., onboarding, theme preference). |
| | `flutter_secure_storage` | `^10.3.1` | Encrypted storage for access tokens and LLM API keys. |
| **Responsive UI** | `flutter_screenutil` | `^5.9.3` | Scalable design adaptions across varying screen sizes. |
| | `gap` | `^3.0.1` | Clean structural spacing inside Columns and Rows. |
| | `flex_color_scheme` | `^8.4.0` | Rich, premium theme palettes (Light/Dark themes) out-of-the-box. |
| | `google_fonts` | `^8.1.0` | Dynamic font rendering with fallback local caching. |
| **Aesthetics** | `flutter_animate` | `^4.5.2` | Premium micro-animations for buttons, panels, and loading transitions. |
| | `flutter_svg` | `^2.3.0` | SVG rendering support. |
| | `lucide_icons_flutter` | `^3.1.14+2`| Clean, modern icon outlines. |
| **Content Render** | `flutter_markdown` | `^0.7.7+1` | Renders rich Markdown text from LLM agent responses. |
| | `flutter_markdown_latex` | `^0.3.4` | Enables LaTeX math syntax rendering in chat (critical for code/technical agents). |
| | `markdown` | `^7.3.1` | Core markdown parsing support. |
| **Realtime / Analytics**| `socket_io_client` | `^3.1.5` | WebSocket communication to stream events if the backend supports socket interfaces. |
| | `connectivity_plus` | `^7.1.1` | Graceful offline detection and UI warning banners. |
| | `logger` | `^2.7.0` | Controlled console logging. |
| | `flutter_dotenv` | `^6.0.1` | Loading environment configurations (e.g. backend host IP, test keys). |

---

## 3. Implementation Roadmap for `persona`

We will implement the frontend to seamlessly integrate with the Express-based **Persona.ai Backend**. Here is the step-by-step roadmap:

### Phase 1: Environment & Base Setup
1. **Dependency Installation**: Run `flutter pub add` with the recommended stack.
2. **Environment Variable Configuration**: Create a `.env` file pointing to the backend API host (e.g. `API_BASE_URL=http://localhost:3000`).
3. **Responsive Design System**: Initialize `ScreenUtilInit` in `lib/main.dart` with a standard base layout design size (e.g., `375x812`).

### Phase 2: Core Infrastructure
1. **Theme Setup**: Define premium custom themes using `FlexColorScheme` in `lib/core/theme/app_theme.dart` (implementing dynamic Dark Mode switches).
2. **Dio API Client**: Create a configured HTTP manager in `lib/core/network/` with an auth interceptor that automatically attaches the user's `accessToken` stored in secure storage.
3. **Base Routing**: Configure `GoRouter` in `lib/core/router/` containing standard routes (`/splash`, `/login`, `/dashboard`). Create redirect guards so that users are automatically pushed to `/login` if no secure token is found.

### Phase 3: Authentication Feature
1. Implement client-side logic to hook into `/profile` endpoints for:
   - User registration & Login (storing the response token to Secure Storage)
   - Profile retrieval & edits
   - User account deletion and credential wiping

### Phase 4: Agent Marketplace & Discovery
1. Hook into `/agent/search` and `/agent/count` endpoints.
2. Build an immersive marketplace home page:
   - Search bar (by name, tags, or description)
   - Agent cards displaying metadata (agent name, creator, description, and execution capabilities)
   - Detailed agent inspect sheets showcasing skills, tools, and a button to initiate a new thread session.

### Phase 5: Real-Time Chat & LangGraph Streaming
This is the heart of the app. Users will chat with agent personas in real-time.
1. **Thread Management**: Connect to the `/thread` REST endpoints to list existing chats (`GET /thread`), create a new session (`POST /thread`), and delete conversation logs.
2. **LangGraph Event Streamer**: Write a custom repository parser in `features/chat_thread/data` to handle Server-Sent Events (SSE) or raw chunked streams from the `/agui` endpoint.
3. **Chat Bubbles & Markdown**: Renders agent messages inside a scrollable layout. Apply `flutter_markdown` and `flutter_markdown_latex` so that formatted code blocks, headers, bullet points, and equations render beautifully.
4. Add micro-animations using `flutter_animate` (fade-in, slide-up) as new chat bubbles appear.

### Phase 6: Agent Management (MCP, Skills, Providers)
Provide control panels for users to customize the execution runtime of their agents:
1. **Provider Keys**: Let users store and update their personal `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. (encrypted locally and synced using `/provider` endpoints).
2. **MCP Configuration**: Build forms to register Model Context Protocol servers via `/mcp` endpoints.
3. **Skills Editor**: Allow users to bind specific custom capabilities to their agents via `/skill` endpoints.

---

## 4. Key Development Best Practices

* **AppResult Wrapper**: Map all network responses and JSON parsing errors to a typed wrapper class like `AppResult<T>`. This avoids unhandled exceptions popping up in presentation files.
* **Keep Presentation Lean**: Ensure screens only handle UI layouts, scroll controllers, and form updates. Keep logic, pagination controllers, and API calls within Riverpod controllers (`StateNotifier` / `AsyncNotifier`).
* **Clean Analyzer**: Frequently run `flutter analyze` and `flutter test` during development to avoid regressions.
