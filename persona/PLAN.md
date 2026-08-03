# persona.hasanraiyan.me Android App — Screen Plan

> Planning document only. No code lives here.
> Backend: Express `/api/v1/*` · Streaming: AG-UI SSE on `/api/v1/agui`
> Auth: Clerk (already wired) · State: Riverpod · Nav: GoRouter

---

## Already Built

| Screen | Route | Status |
|--------|-------|--------|
| SplashScreen | `/` | ✅ done |
| OnboardingPage | `/onboarding` | ✅ done |
| AuthPage (sign-in / sign-up / verify / reset) | `/login` | ✅ done |

---

## Navigation Structure

```
App
├── Auth Shell (no bottom bar)
│   ├── /            → SplashScreen
│   ├── /onboarding  → OnboardingPage
│   └── /login       → AuthPage
│
└── Main Shell (persistent bottom nav — 4 tabs)
    ├── /marketplace  → Tab 1: Marketplace
    ├── /chats        → Tab 2: Chats
    ├── /agents       → Tab 3: My Agents
    └── /profile      → Tab 4: Profile & Settings
```

Bottom nav tabs (left → right):

| # | Label | Icon |
|---|-------|------|
| 1 | Marketplace | compass / explore |
| 2 | Chats | chat bubble |
| 3 | My Agents | sparkle / robot |
| 4 | Profile | person |

---

## Screen Inventory

### Screen 1 — Main Shell
**Route:** `/home` (ShellRoute wrapping all 4 tabs)
**File:** `lib/features/shell/presentation/pages/main_shell.dart`

- Persistent `NavigationBar` (Material 3)
- Separate navigator stack per tab so back-stack is preserved per tab
- FAB visibility controlled per tab

---

### Screen 2 — Marketplace
**Route:** `/marketplace`
**File:** `lib/features/marketplace/presentation/pages/marketplace_screen.dart`
**API:** `POST /agents/search`, `POST /agents/count`

- Search bar at top (debounced, hits `/agents/search`)
- Horizontal scrollable filter chips: All · Productivity · Coding · Creative · Research · Roleplay
- Agent card grid (name, avatar, description, tags, message count)
- Toggle: grid view / list view
- Pull-to-refresh
- Infinite scroll / pagination
- Skeleton loading cards while fetching
- Empty state: "No agents found"

---

### Screen 3 — Agent Detail
**Route:** `/marketplace/agents/:id`
**File:** `lib/features/marketplace/presentation/pages/agent_detail_screen.dart`
**API:** `GET /agents/:id`

- Hero avatar + name + category chip
- Description (expandable read more)
- Tags row
- System prompt preview (collapsed, tap to expand)
- Capabilities section: skills list, MCP servers, knowledge bases
- Model + provider badge
- Primary CTA: **"Start Chat"** → creates thread via `POST /threads` → push ChatScreen
- If user owns this agent: **"Edit"** icon in app bar

---

### Screen 4 — Thread List
**Route:** `/chats`
**File:** `lib/features/threads/presentation/pages/thread_list_screen.dart`
**API:** `GET /threads`

- List of conversation threads (agent avatar, title, last message preview, relative timestamp)
- Swipe-to-delete a thread → `DELETE /threads/:id`
- Long-press → delete / rename options
- "Clear all" button → `DELETE /threads`
- Tap → ChatScreen
- Empty state: "No chats yet — find an agent to talk to"

---

### Screen 5 — Chat
**Route:** `/chats/:threadId`
**File:** `lib/features/chat/presentation/pages/chat_screen.dart`
**API:** `GET /threads/:id/messages`, `POST /agui` (SSE stream), `PATCH /threads/:id/title`

- App bar: agent avatar + name, thread title (editable on long-press)
- Message list: user bubbles right, agent bubbles left
- **Streaming token rendering** — characters/words appear as they arrive via AG-UI SSE
- Tool call chips shown inline: tool name + args summary, status (running / done / error)
- **HITL interrupt banner**: "Agent wants to [tool name] — Approve / Deny"
- Markdown rendering in agent messages (code blocks, bold, lists, tables)
- LaTeX math support
- Input bar: text field + send button — disabled while stream is active
- Scroll-to-bottom FAB when scrolled up
- Loading: three-dot typing indicator before first token arrives
- Error banner on stream failure with retry button

---

### Screen 6 — My Agents
**Route:** `/agents`
**File:** `lib/features/my_agents/presentation/pages/my_agents_screen.dart`
**API:** `POST /agents/search` (filtered to own agents)

- List of user's agents (avatar, name, visibility badge, message count)
- Visibility badge: 🔒 Private · 🔗 Unlisted · 🌐 Public
- Tap → AgentDetailScreen (with edit access)
- Swipe-to-delete → `DELETE /agents/:id`
- FAB "+" → CreateAgentScreen
- Empty state: "You haven't built any agents yet"

---

### Screen 7 — Create / Edit Agent (Form)
**Route:** `/agents/new` · `/agents/:id/edit`
**File:** `lib/features/my_agents/presentation/pages/agent_form_screen.dart`
**API:** `POST /agents`, `PATCH /agents/:id`, `POST /upload/avatar`

Single scrollable form in collapsible sections:

**Identity**
- Avatar image picker → upload to `POST /upload/avatar`
- Name (required)
- Slug (auto-generated from name, editable)
- Category dropdown
- Tags chip input
- Description textarea
- Visibility picker: Private / Unlisted / Public

**Intelligence**
- Provider picker → opens ProviderPickerSheet
- Model picker → `GET /providers/:id/models` after provider selected
- System prompt textarea (monospace, character counter)
- Web search enabled toggle

**Capabilities** (each chip row opens a bottom sheet picker)
- Skills → SkillPickerSheet
- MCP Servers → MCPPickerSheet
- Knowledge Bases → KnowledgePickerSheet

**Advanced**
- HITL tool approval toggles (per MCP tool, only shown after MCPs are selected)

- **Save** button pinned at bottom
- Validation: name, provider, system prompt required

---

### Screen 8 — Profile & Settings Hub
**Route:** `/profile`
**File:** `lib/features/profile/presentation/pages/profile_screen.dart`
**API:** `GET /profile`, `PATCH /profile`, `POST /upload/avatar`

- User avatar (tap to replace → `POST /upload/avatar`)
- Display name + email (email read-only from Clerk)
- Bio / summary field (inline edit or sheet)
- Settings list rows:
  - **LLM Providers** → ProvidersScreen
  - **MCP Servers** → MCPListScreen
  - **Skills** → SkillsScreen
  - **Knowledge Bases** → KnowledgeListScreen
- Danger zone section:
  - **Sign Out** → `ClerkAuth.of(context).signOut()`
  - **Delete Account** → `DELETE /profile` (confirmation dialog)

---

### Screen 9 — Providers List
**Route:** `/profile/providers`
**File:** `lib/features/providers/presentation/pages/providers_screen.dart`
**API:** `GET /providers`

- List of LLM providers (label, truncated base URL, default badge)
- Default provider row highlighted
- Tap → ProviderFormScreen (edit mode)
- FAB / "+ Add Provider" → ProviderFormScreen (create mode)
- Empty state: "No providers configured — add one to create agents"

---

### Screen 10 — Add / Edit Provider (Form)
**Route:** `/profile/providers/new` · `/profile/providers/:id`
**File:** `lib/features/providers/presentation/pages/provider_form_screen.dart`
**API:** `POST /providers`, `PUT /providers/:id`, `POST /providers/test-connection`, `GET /providers/:id/models`

- Label field
- Base URL field with preset buttons: OpenAI · Anthropic · Google · Custom
- API key field (obscured, show/hide toggle, stored encrypted)
- Default model field (tap "Fetch models" → `GET /providers/:id/models` → picker)
- Set as default toggle
- **"Test Connection"** button → `POST /providers/test-connection` → inline success/error
- Save / Delete buttons

---

### Screen 11 — MCP List
**Route:** `/profile/mcps`
**File:** `lib/features/mcp/presentation/pages/mcp_list_screen.dart`
**API:** `GET /mcps`

- List of MCP servers (name, URL truncated, connection status dot)
- Tap → MCPFormScreen (edit mode)
- FAB → MCPFormScreen (create mode)
- Empty state

---

### Screen 12 — Add / Edit MCP (Form)
**Route:** `/profile/mcps/new` · `/profile/mcps/:id`
**File:** `lib/features/mcp/presentation/pages/mcp_form_screen.dart`
**API:** `POST /mcps`, `PATCH /mcps/:id`, `DELETE /mcps/:id`, `POST /mcps/:id/test`

- Name field
- Server URL field
- Auth type selector: None / API Key / OAuth
- API key field (shown when auth = API Key)
- **"Test Connection"** → `POST /mcps/:id/test` → inline result
- OAuth section (shown when auth = OAuth): **"Authorize"** button → `GET /mcps/:id/oauth/user/authorize` (opens browser)
- OAuth status row: connected / not connected, disconnect button
- Save / Delete buttons

---

### Screen 13 — Skills List
**Route:** `/profile/skills`
**File:** `lib/features/skills/presentation/pages/skills_screen.dart`
**API:** `GET /skills`, `GET /skills/public`

- Tabs: **My Skills** / **Public Skills**
- Skill card: name, description, public badge
- Tap → SkillFormScreen
- FAB → SkillFormScreen (create mode)
- Empty state

---

### Screen 14 — Add / Edit Skill (Form)
**Route:** `/profile/skills/new` · `/profile/skills/:id`
**File:** `lib/features/skills/presentation/pages/skill_form_screen.dart`
**API:** `POST /skills`, `PATCH /skills/:id`, `DELETE /skills/:id`

- Name field (lowercase letters, numbers, hyphens only)
- Description textarea
- Instructions textarea (SKILL.md content, monospace font)
- Code snippets section: list of filename + code editor blocks, add/remove snippet
- Public toggle
- Save / Delete buttons

---

### Screen 15 — Knowledge Bases List
**Route:** `/profile/knowledge`
**File:** `lib/features/knowledge/presentation/pages/knowledge_list_screen.dart`
**API:** `GET /knowledge`

- List of knowledge bases (name, document count, description)
- Tap → KnowledgeDetailScreen
- FAB → CreateKnowledgeSheet (name + description) → `POST /knowledge`
- Empty state

---

### Screen 16 — Knowledge Base Detail
**Route:** `/profile/knowledge/:id`
**File:** `lib/features/knowledge/presentation/pages/knowledge_detail_screen.dart`
**API:** `GET /knowledge/:id`, `GET /knowledge/:id/documents`, `POST /knowledge/:id/upload`, `DELETE /knowledge/:id/documents/:sourceName`, `POST /knowledge/:id/search`

- KB name + description (tap to edit → `PATCH /knowledge/:id`)
- Document list (filename, size, upload date)
- Swipe-to-delete document → `DELETE /knowledge/:id/documents/:sourceName`
- **Upload FAB** → file picker (PDF, TXT, MD, JSON, CSV ≤ 20 MB) → upload progress bar
- Search bar → `POST /knowledge/:id/search` → preview matching chunks in a results panel
- Delete entire KB button (danger, with confirmation)

---

## Bottom Sheets

| Sheet | Opened from | Purpose |
|-------|-------------|---------|
| ProviderPickerSheet | AgentFormScreen | Pick one of the user's providers |
| ModelPickerSheet | AgentFormScreen | Pick model after provider is selected |
| SkillPickerSheet | AgentFormScreen | Multi-select skills to attach |
| MCPPickerSheet | AgentFormScreen | Multi-select MCP servers to attach |
| KnowledgePickerSheet | AgentFormScreen | Multi-select knowledge bases to attach |
| ThreadTitleSheet | ChatScreen | Rename a conversation thread |
| CreateKnowledgeSheet | KnowledgeListScreen | Name + description for a new KB |

---

## Full Route Table

```
/                               SplashScreen
/onboarding                     OnboardingPage
/login                          AuthPage

/home                           MainShell  (ShellRoute)
  /marketplace                  MarketplaceScreen
  /marketplace/agents/:id       AgentDetailScreen

  /chats                        ThreadListScreen
  /chats/:threadId              ChatScreen

  /agents                       MyAgentsScreen
  /agents/new                   AgentFormScreen  (create)
  /agents/:id/edit              AgentFormScreen  (edit)

  /profile                      ProfileScreen
  /profile/providers            ProvidersScreen
  /profile/providers/new        ProviderFormScreen  (create)
  /profile/providers/:id        ProviderFormScreen  (edit)
  /profile/mcps                 MCPListScreen
  /profile/mcps/new             MCPFormScreen  (create)
  /profile/mcps/:id             MCPFormScreen  (edit)
  /profile/skills               SkillsScreen
  /profile/skills/new           SkillFormScreen  (create)
  /profile/skills/:id           SkillFormScreen  (edit)
  /profile/knowledge            KnowledgeListScreen
  /profile/knowledge/:id        KnowledgeDetailScreen
```

---

## Feature Folder Structure

```
lib/features/
├── auth/           ✅ exists
├── onboarding/     ✅ exists
├── shell/          NEW
├── marketplace/    NEW
├── chat/           NEW
├── threads/        NEW
├── my_agents/      NEW
├── profile/        NEW
├── providers/      NEW
├── mcp/            NEW
├── skills/         NEW
└── knowledge/      NEW
```

Each feature uses clean architecture:

```
feature/
├── data/
│   ├── datasources/    remote_datasource.dart
│   ├── models/         model.dart  (fromJson / toJson)
│   └── repositories/   repository_impl.dart
├── domain/
│   ├── entities/       entity.dart
│   └── repositories/   repository.dart  (abstract)
└── presentation/
    ├── pages/          screen.dart
    ├── widgets/        feature-specific widgets
    └── providers/      riverpod notifiers + state
```

---

## Count Summary

| Category | Count |
|----------|-------|
| Already built | 3 |
| New full screens | 15 |
| New bottom sheets | 7 |
| **Total** | **25** |

---

## Suggested Build Order

1. **MainShell** — bottom nav shell, unlocks all tab routing
2. **MarketplaceScreen + AgentDetailScreen** — first visible value, uses public data
3. **ChatScreen** — core product loop (AG-UI SSE streaming)
4. **ThreadListScreen** — pairs with Chat
5. **ProfileScreen** — settings hub (needed before adding agents)
6. **ProvidersScreen + ProviderFormScreen** — needed to create agents
7. **MyAgentsScreen + AgentFormScreen** — agent creation
8. **MCPListScreen + MCPFormScreen** — power user feature
9. **SkillsScreen + SkillFormScreen** — power user feature
10. **KnowledgeListScreen + KnowledgeDetailScreen** — power user feature
