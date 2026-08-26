# Architecture

This document describes how Star is put together at runtime. It is aimed at
contributors who need to understand the seams between the desktop shell, the
local Node sidecar, the AI run lifecycle, and the project's data layer.

It complements — and does not replace — the more focused docs:

- [`docs/FEATURES.md`](FEATURES.md) — the product vision and feature surface.
- [`docs/PROJECT_GRAPH.md`](PROJECT_GRAPH.md) — the Project Brain graph model.
- [`packages/agent-runtime/README.md`](../packages/agent-runtime/README.md) —
  the run lifecycle in isolation.
- [`packages/ai-providers/README.md`](../packages/ai-providers/README.md) — the
  shared provider catalog.

---

## 1. High-level shape

Star is a desktop application with three runtime tiers that cooperate over
loopback HTTP and the Tauri IPC bridge:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser-style frontend                                              │
│  React 19 + TypeScript, Vite, Tailwind, shadcn-style UI              │
│  src/                                                                │
│   ├─ App.tsx              ── shell: tabs, panels, terminal dock      │
│   ├─ components/          ── editor, markdown, terminal host, UI     │
│   ├─ features/                                                      │
│   │   ├─ projects/        ── project sidebar, repos, graph model    │
│   │   ├─ ai/              ── provider catalog, settings, picker      │
│   │   └─ themes/          ── theme provider, color override         │
│   └─ lib/                 ── Monaco + Tree-sitter wiring             │
└──────────────────────────────────────────────────────────────────────┘
                │ Tauri commands (invoke / listen)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Rust host (Tauri 2)                                                 │
│  src-tauri/src/                                                      │
│   ├─ main.rs / lib.rs     ── setup, plugins, command handlers        │
│   ├─ ai_runtime.rs        ── spawn sidecar, persist AI connections  │
│   ├─ secret_store.rs      ── keyring + encrypted vault for API keys  │
│   ├─ terminal (in lib.rs) ── portable_pty ConPTY shell session       │
│   └─ project scan (lib.rs)── ignore-based directory enumeration      │
└──────────────────────────────────────────────────────────────────────┘
                │ externalBin spawn (sidecar)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Local Node sidecar ("star-ai")                                      │
│  sidecar/server.mjs                                                  │
│   ├─ HTTP server          ── /chat /title /models /test /runs …      │
│   ├─ @star/agent-runtime  ── durable, provider-independent runs      │
│   ├─ @star/project-agent  ── read/list/search + approval-gated tools │
│   └─ acp.mjs              ── Agent Client Protocol adapter          │
└──────────────────────────────────────────────────────────────────────┘
```

A few things follow directly from this shape:

- The frontend is a normal Vite app. It runs the same in `npm run dev` (browser
  only) and inside the Tauri webview. Code that needs OS facilities goes
  through Tauri commands; everything else stays in plain React.
- AI traffic does **not** cross the Tauri IPC bridge for byte-level data. The
  frontend talks to the sidecar over `http://127.0.0.1:<port>` with a bearer
  token. Tauri only manages the connection metadata (port + token) and the
  process lifecycle.
- The sidecar is intentionally a small, isolated service. It owns AI run
  state and provider I/O. It does not own UI state, file scanning, or shell
  sessions — those stay in the Rust host or the browser.

---

## 2. The desktop shell (`src/`)

### 2.1 App composition

`src/App.tsx` is the entire shell. It owns:

- The top tab bar (`projects`, `editor`, `brain`) with a custom drag region
  (`data-tauri-drag-region`) and custom window controls
  (`src/components/WindowControls.tsx`).
- A horizontal `ResizablePanelGroup` that splits the main workspace from the
  optional right-hand project sidebar (only on the Projects tab).
- A vertical `ResizablePanelGroup` inside the main workspace that splits the
  active view from the optional bottom terminal dock.
- A floating settings dialog (`General` / `Providers`) and a floating theme
  color-picker.

All persistence is intentionally local and synchronous: terminal height
(`star.terminal-height`), project-rail width (`star.project-rail-width`),
selected project (`star.selected-project`), and selected thread
(`star.selected-thread.<projectId>`) all live in `localStorage`. The size
writes are deliberately on the panel-resize tick rather than on a debounced
React effect — `localStorage` writes are synchronous but do not trigger React
re-renders, so the divider stays smooth even while persisting every pixel.

### 2.2 Editor surfaces

Three editor technologies coexist on purpose:

- **Monaco** (`@monaco-editor/react`) drives the main file editor — full
  language services, large file handling, and the standard IDE feel. Wired
  through `src/lib/monaco.ts`.
- **CodeMirror** (`@uiw/react-codemirror`) is used for lightweight
  configuration editing (JSON, Markdown) — cheaper to mount than Monaco and
  easier to embed in dialogs.
- **Shiki** renders pretty code blocks inside AI responses. The
  `PrettyCodeBlock` component handles streaming-friendly code rendering that
  pairs with the assistant-ui Streamdown pipeline.
- **Tree-sitter** (`web-tree-sitter` + `tree-sitter-typescript`) runs in the
  browser. It is wired through `src/lib/treeSitter.ts` and is the foundation
  for the next Project Brain indexing layer (see
  [`docs/PROJECT_GRAPH.md`](PROJECT_GRAPH.md)).

### 2.3 Terminal dock

The terminal is a single pty-backed shell that follows the active project.
The flow:

1. The user opens the dock → `App.tsx` mounts `TerminalPanel` with
   `cwd={selectedProject?.rootPath}`.
2. `TerminalPanel` (`src/components/TerminalPanel.tsx`) initialises the
   Ghostty Web renderer (`ghostty-web`), builds its ANSI palette by reading
   `--term-*` CSS variables (so themes only have to ship a palette — the
   terminal colors derive automatically), and asks the Rust host to start a
   shell via `invoke("terminal_start", { cwd, cols, rows })`.
3. The Rust host opens a ConPTY (`portable_pty::native_pty_system` on
   Windows, POSIX pty elsewhere), spawns `pwsh.exe`/`powershell.exe` on
   Windows or `$SHELL` on Unix with the requested `cwd`, and emits
   `terminal-output` / `terminal-exit` events back to the frontend.
4. Input flows frontend → Rust via `terminal_write`. Resizes flow through
   `terminal_resize`. `terminal_stop` kills the child.

Only one terminal session exists at a time — opening a new shell replaces the
previous one (the old child is killed during `terminal_start`).

### 2.4 Project data layer

`src/features/projects/ProjectProvider.tsx` is the source of truth for the
project list, threads, and the currently selected project/thread. It talks to
a `ProjectRepository` interface, with two implementations:

- `LocalProjectRepository` — `localStorage`-backed, used when the app is
  running in a plain browser (`isTauri()` is false).
- `SqliteProjectRepository` — backed by Tauri `tauri-plugin-sql`, used in the
  desktop app.

The repository selection lives in `src/features/projects/repository.ts` and
runs once per session (`let repository: ProjectRepository | undefined;`).
All CRUD goes through the repository — components never touch storage
directly.

The Project Brain graph storage is a separate concern: nodes and edges live
in `project_graph_nodes` / `project_graph_edges` SQLite tables and are
indexed per project. See [`docs/PROJECT_GRAPH.md`](PROJECT_GRAPH.md) for the
schema and indexing roadmap.

---

## 3. The Rust host (`src-tauri/`)

### 3.1 Entry point and plugins

`src-tauri/src/main.rs` is a thin wrapper that calls `star_lib::run()`.
`lib.rs` is where the Tauri builder lives:

- `tauri_plugin_shell` — used to spawn the `star-ai` sidecar via `externalBin`
  (declared in `tauri.conf.json`).
- `tauri_plugin_dialog` — folder picker for "Add project".
- `tauri_plugin_sql` — SQLite access for the project repository.
- `tauri_plugin_opener` — opening links/files in the OS.

`AiState` is created in `setup`, then `ai_runtime::restart(...)` spawns the
sidecar. `TerminalState` (a `Mutex<Option<TerminalSession>>` plus a
session-id `AtomicU64`) is registered via `manage`.

The single Tauri `Window` is configured in `tauri.conf.json` with
`decorations: false` — the app draws its own topbar and window controls.

### 3.2 Project scanning

`scan_project` (`src-tauri/src/lib.rs`) is a Tauri command that walks a
directory and returns a sorted `Vec<ProjectTreeEntry>`. It uses
`ignore::WalkBuilder` with:

- `max_depth(20)` to bound deeply nested monorepos.
- `follow_links(false)` and a `filter_entry` that skips generated
  directories (`.git`, `.hg`, `.svn`, `node_modules`, `target`, `dist`,
  `build`, `.next`, `.cache`).
- Symlinks and non-regular entries are dropped post-walk.
- A hard cap of 5,000 entries to keep the UI responsive.

The path returned to the frontend is normalised (forward slashes on all
platforms) and rooted relative to the project root, which is what the
Project Brain graph stores.

### 3.3 AI connection state and secrets

`src-tauri/src/ai_runtime.rs` owns three things:

1. **`ai-connections.json`** — the non-secret connection metadata (id, kind,
   label, model, base URL, command, region, project id, active flag). It
   lives in the OS-standard app config dir, resolved via
   `app.path().app_config_dir()`.
2. **API keys** — stored via `secret_store::SecretStore`, a dual-backend store
   that prefers the OS keyring and falls back to an encrypted file vault at
   `ai-secrets.enc` next to the JSON. The keyring entry is always probed
   fresh on every list call so the UI's "has secret" indicator never drifts
   from reality.
3. **The live sidecar process** — `Mutex<Option<CommandChild>>`. The
   `restart()` helper kills any previous child, picks a free loopback port
   (`TcpListener::bind("127.0.0.1:0")`), mints a 48-char random bearer
   token, encodes the current connections (with secrets materialised into a
   `STAR_AI_CONNECTIONS` env var), and spawns the sidecar with
   `STAR_AI_PORT`, `STAR_AI_TOKEN`, `STAR_AI_CONNECTIONS`, and
   `STAR_AGENT_RUNTIME_PATH` set. Stderr from the sidecar is mirrored to the
   host's stderr via `CommandEvent::Stderr`.

`ai_runtime_info` is the one Tauri command the frontend calls to learn the
endpoint and token it needs to talk to the sidecar. That single call is the
bootstrap: from then on, AI traffic is plain HTTP.

Connection mutations (`ai_save_connection`, `ai_remove_connection`) update
both stores and call `restart(...)`, which is cheap because the sidecar is
small and starts in well under a second.

### 3.4 Terminal backend

Already covered in §2.3. The relevant invariants:

- Only one pty child is alive at a time.
- The PTY is opened through `portable_pty`, which uses ConPTY on Windows and
  POSIX `openpty` elsewhere. The Windows shell wrapper enables ANSI
  rendering via `$PSStyle.OutputRendering='Ansi'` and a styled prompt.
- The output thread emits UTF-8 chunks on the `terminal-output` event and a
  single `terminal-exit` event when the child closes.
- `terminal_write` is idempotent against stale sessions: writes to a
  different `sessionId` are silently dropped.

---

## 4. The sidecar (`sidecar/`, `star-ai`)

### 4.1 Build pipeline

`scripts/build-sidecar.mjs` turns the Node source into a standalone
executable that the Tauri host can spawn as `externalBin`:

1. Stop stale sidecars on Windows (a small PowerShell script kills any
   `star-ai.exe` whose executable path matches
   `src-tauri/target/{debug,release}/star-ai.exe`). Without this, the
   previous binary holds a file lock and `pkg` fails to overwrite it.
2. Detect the host tuple via `rustc --print host-tuple` and compute the
   output path `src-tauri/binaries/star-ai-<target>[.exe]`.
3. Bundle `sidecar/server.mjs` with **esbuild** (`bundle: true, platform:
   node, format: cjs, target: node22, minify: true`) into
   `sidecar/dist/server.cjs`.
4. Compile that bundle to a single executable with **`@yao-pkg/pkg`** for the
   appropriate target (`node22-win-x64`, `node22-macos-x64`,
   `node22-linux-x64`).

The Tauri config picks the binary up via `bundle.externalBin:
["binaries/star-ai"]`; Tauri copies the right triple into the bundled app
automatically.

`npm run dev:app` runs this script first, then starts Vite. `npm run
tauri dev` runs `dev:app` and then launches the Rust host. So every Tauri dev
launch starts with a fresh sidecar.

### 4.2 HTTP surface

`sidecar/server.mjs` is a plain `http` server on `127.0.0.1:<STAR_AI_PORT>`.
Every request is gated by `Authorization: Bearer <STAR_AI_TOKEN>`. Routes:

| Method | Path                          | Purpose                                                   |
| ------ | ----------------------------- | --------------------------------------------------------- |
| GET    | `/health`                     | Readiness probe; reports `{ ok, sdk: "vercel-ai", acp }`. |
| GET    | `/models`                     | Provider models (direct providers) or ACP agent models.   |
| POST   | `/test`                       | Cheap reachability check for a connection.                |
| POST   | `/chat`                       | Start a new AI run; returns a resumable stream.           |
| POST   | `/title`                      | One-shot `generateText` for auto-titling a conversation.  |
| GET    | `/runs`                       | List runs (filter by `sessionId` / `projectId`).          |
| GET    | `/runs/:id`                   | Get a single run record.                                  |
| GET    | `/runs/:id/stream`            | Resume a stream by run id (resumable-streams protocol).   |
| POST   | `/runs/:id/cancel`            | Abort an active run.                                      |
| POST   | `/permissions/:permissionId`  | Answer an ACP permission prompt.                          |

CORS is wide open (`access-control-allow-origin: *`) because the only caller
is the same-machine webview.

### 4.3 The `/chat` lifecycle

`handleChat` (in `sidecar/server.mjs`) is the most important handler. It:

1. Reads the JSON body (`messages`, `conversationId`, `projectId`,
   `projectPath`, `connectionId`, `modelId`, `tools`, `system`).
2. Looks up the connection by id, or falls back to the active one.
3. If the connection is an **agent kind** (ACP), it runs `runAcpTurn` and
   pipes ACP session updates into a UI message stream via
   `createUIMessageStream`.
4. Otherwise it constructs a `ToolLoopAgent` (from the `ai` SDK) with:
   - The user-provided `frontendTools` (chat-only UI tools wrapped via
     `@assistant-ui/ai-sdk`).
   - The **always-on** `createProjectTools(body.projectPath)` from
     `@star/project-agent` (read-only file ops + approval-gated writes and
     commands, paths locked to the project root).
   - A `projectAgentInstructions(body.projectName)` system prompt.
   - `stopWhen: stepCountIs(20)` as the safety bound.
5. Wraps the agent in `agentRuntime.startRun(...)`. The runtime:
   - Picks an id, persists the run as `queued` → `running`.
   - Hands the agent a `lifecycle` object with `{ signal, awaitingApproval,
     running, failed }` so the run state can be mutated as the agent works.
   - Pipes the upstream `Response` body through
     `createResumableStreamContext` so the stream is durably stored under
     `<STAR_AGENT_RUNTIME_PATH>/streams/<sha256(runId)>.json` with a 7-day
     TTL.
   - Returns a `Response` with the `x-vercel-ai-ui-message-stream: v1`
     header and a resumable-stream id header so the client can resume after
     a reload.

If `startRun` throws `AgentRuntimeConflictError` (the same conversation
already has an active run), the handler responds `409` and the UI surfaces
that to the user.

### 4.4 ACP adapter (`sidecar/acp.mjs`)

For coding-agent connections (Codex, Claude Code, OpenCode, Gemini CLI) Star
speaks the Agent Client Protocol instead of using a provider SDK:

- A long-lived ACP child is spawned once per `(connection.id, cwd, threadId)`
  and reused across turns (`sessions: Map<string, Record>`). A separate
  `pendingPermissions: Map` tracks in-flight permission prompts.
- On every turn, `runAcpTurn` waits for the record to be ready, calls
  `selectModel` if the user picked a non-default model, and feeds the last
  user message into `session.prompt(...)`.
- Session updates are translated into AI-UI message parts:
  `agent_message_chunk` → `text-start` / `text-delta` / `text-end`;
  `agent_thought_chunk` → `reasoning-*`; `tool_call` /
  `tool_call_update` → `tool-input-available` / `tool-output-available` /
  `tool-output-error`.
- Permission requests are forwarded to the frontend as synthetic tool calls
  (`acp_permission`). The user picks an option in the UI → the frontend POSTs
  `/permissions/:permissionId` → `resolveAcpPermission` resumes the waiting
  promise → the ACP SDK returns the chosen outcome to the agent.
- `acpModels` does a best-effort model discovery by booting the agent with
  a `__model-discovery__` threadId, racing against a 4-second timeout, and
  flattening the `model` `configOption` into a `{ id, name }` list. If the
  agent isn't ready in time it returns a single `{ id: "default" }` so the
  picker is never empty.

### 4.5 Provider catalog (`@star/ai-providers`)

The catalog is the single source of truth shared between the React settings
UI and the sidecar. Both import from `@star/ai-providers` — the UI uses the
type-level catalog and brand icons, the sidecar uses the runtime
(`createProviderModel`, `listProviderModels`, `testProviderConnection`,
`assertConnectionReady`, `formatProviderError`, `isAgentKind`) to actually
talk to providers via the `ai` SDK.

Two implementation modes coexist:

- **Direct providers** — OpenAI, Anthropic, Google, OpenAI-compatible, etc.
  Constructed in the sidecar from a connection record. The catalog knows
  the credential shape each one needs.
- **Agent providers** — Codex, Claude Code, OpenCode, Gemini CLI. Identified
  by `isAgentKind(connection.kind)`. The sidecar routes these through the
  ACP adapter rather than the `ai` SDK.

`assertConnectionReady(connection)` is the one validation gate the sidecar
runs before every chat request: it returns 409 if the connection is missing
the field that its kind requires (e.g. `command` for an agent kind).

---

## 5. The agent runtime (`@star/agent-runtime`)

The runtime is intentionally provider-independent. Its job is to turn a
"send a chat request" into a durable, resumable, cancellable run. Two
surfaces: the Node server (`packages/agent-runtime/src/server.mjs`) and the
browser client (`packages/agent-runtime/src/client.ts`).

### 5.1 Run lifecycle

The state machine is documented in the client types and enforced on the
server:

```
queued ──► running ──► awaiting-approval ──► running ──► completed
   │           │                                  └──► failed
   │           └──► cancelled
   └──► interrupted   (the host stopped before completion)
```

`startRun(input, createResponse)`:

1. Calls `waitForSessionHandoff(sessionId)` to make sure no previous run for
   the same conversation is still active. If the previous run is already in
   `awaiting-approval`, the new request throws `AgentRuntimeConflictError`
   immediately.
2. Allocates a run id, persists it as `queued` → `running`, and registers an
   `AbortController` so a later `cancelRun` can abort it.
3. Calls `createResponse({ runId, signal, awaitingApproval, running,
   failed })`. The caller (in `sidecar/server.mjs`) wraps the upstream
   `Response` from the `ai` SDK and uses the lifecycle callbacks to keep
   the run record in sync with the agent's behaviour — most notably, ACP
   `requestPermission` triggers `awaitingApproval`, then `resolveAcpPermission`
   calls `running()` to resume.
4. Hands the upstream `Response.body` to `createResumableStreamContext`. The
   context appends each chunk to a file-backed store keyed by run id, with
   a 7-day TTL.

On startup, `AgentRuntime.initialize()` rehydrates `runs.json` and marks any
`ACTIVE_STATUSES` run as `interrupted` with an explanatory error. Stream
files that lack a final state get a synthetic `{ kind: "error" }` so they
don't leak. This is how runs survive an IDE restart.

### 5.2 Resumable streams

The implementation lives in `FileResumableStreamStore` (in
`packages/agent-runtime/src/server.mjs`). Each stream is a JSON file under
`<storagePath>/streams/<sha256(streamId)>.json` containing a sequence of
base64-encoded chunks plus a `final` marker. `read(streamId, cursor, signal)`
returns chunks after `cursor` and blocks on a `waiters` map until either a
new chunk is appended (`append`) or the stream is finalised.

This gives the frontend two properties it depends on:

- **Restart resilience** — closing and reopening the IDE while a run is in
  flight leaves the stream file on disk. When the user navigates back to
  the conversation, `createAgentSessionStorage(sessionId).getStreamId()`
  reads the last run id from `localStorage` and the chat panel resumes from
  the byte stream with `GET /runs/:id/stream`.
- **Cancel** — `cancelRun(runId)` calls `controller.abort(...)` and finalises
  the run as `cancelled`. The AI SDK propagates the abort through
  `agent.stream({ abortSignal })`.

### 5.3 Client-side stream discovery

`createAgentSessionStorage(sessionId)` (`packages/agent-runtime/src/client.ts`)
is a tiny `ResumableClientStorage` implementation that backs the stream id
into `localStorage` under `star.agent-runtime.stream.<sessionId>`. It also
fires a per-key listener registry, so the chat panel can react instantly
when a new run id is set. The fallback path (no `localStorage`) is silent —
the chat still works, just without restart-resume.

---

## 6. End-to-end data flow

A chat turn, from "user hits send" to "tool output rendered":

```
[Composer]
   │  (POST /chat)  bearer = runtime.token
   ▼
[sidecar/server.mjs · handleChat]
   │  agentRuntime.startRun(...)
   ▼
[ToolLoopAgent or ACP session]
   │  emits UI-message-stream chunks
   ▼
[createResumableStreamContext]
   │  persists chunks to disk, also streams to HTTP response
   ▼
[frontend fetch]  ──►  [assistant-ui Streamdown]  ──►  [chat panel]
   ▲                                          │
   │                                          └──►  tool calls surface as
   │                                              approval cards / result
   │                                              blocks in the UI
   │
[ACP requestPermission]  ──►  [POST /permissions/:id]  ──►  [sidecar resolves promise]
```

A few notes:

- Tool approval (writes, replacements, shell commands) is handled by
  `@assistant-ui/react` on the client; the chat waits until the user
  approves before the agent actually executes the tool.
- `Project Brain` queries (when wired up) will live entirely in the frontend
  + Rust host + SQLite. They will not touch the sidecar.
- The terminal is its own data flow and never intersects with the AI side:
  keyboard → `terminal_write` → ConPTY → `terminal-output` event →
  Ghostty Web. AI never reads from the terminal stream; it only sees the
  shell's exit code if a tool invokes a command.

---

## 7. Extending the system

Where to make a change when:

| You want to…                              | Touch                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Add a new top-level view                  | `src/features/projects/ProjectViews.tsx` + a new `tab` in `App.tsx`.   |
| Add a new editor surface                  | Mount it inside `src/components/MainEditor.tsx` / `LightweightEditor.tsx`. |
| Add a new theme                           | A CSS file under `src/themes/` registered in `src/features/themes/catalog.ts`. |
| Add a new AI provider                     | Extend `packages/ai-providers/src/catalog.ts` and (if needed) the runtime. |
| Add a new tool the agent can call         | Expose it in `packages/project-agent/src/index.mjs`. Keep writes/commands approval-gated. |
| Add a new sidecar endpoint                | Route in `sidecar/server.mjs`, document it here and in the relevant package README. |
| Add a new Tauri command                   | Add a `#[tauri::command]` in `src-tauri/src/`, register it in `invoke_handler!` in `lib.rs`, expose it via a wrapper in `src/features/`. |
| Change how runs persist or resume         | `packages/agent-runtime/src/server.mjs`. Avoid coupling to a specific provider. |
| Change the Project Brain schema           | Update `docs/PROJECT_GRAPH.md` first, then `src/features/projects/`. |

---

## 8. Open questions / known seams

- **Theme vs. terminal palette coupling.** Today the terminal reads `--term-*`
  CSS variables; themes that don't ship them will get black. A future
  improvement is a default palette in `ThemeProvider` so any theme
  automatically has a usable terminal theme.
- **Provider catalog versioning.** The `ai` SDK moves fast. When a new major
  ships, both the catalog (`@star/ai-providers`) and the sidecar
  (`createProviderModel`) need to be updated together; right now this is a
  manual two-step.
- **Concurrent runs.** The runtime enforces one active run per session, but
  the UI doesn't yet expose a way to start a second conversation while the
  first is still streaming. That's intentional, but a future feature.
- **Project Brain indexing runs in the browser.** When the Tree-sitter and
  SCIP layers come online, heavy indexing will need to move into the Rust
  host or the sidecar to keep the UI responsive on large repos.

