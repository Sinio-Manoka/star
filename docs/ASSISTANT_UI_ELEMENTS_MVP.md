# assistant-ui Elements: End-to-End MVP Plan

Status: proposed implementation plan  
Scope: the 37 assistant-ui Elements requested for Star  
Target: every element is connected to real project-agent data, persists when appropriate, honors Star themes, and has automated coverage

## 1. Outcome

This project is complete when Star can render a full agent session—not merely a chat transcript—from one normalized stream of typed events. The composer can invoke commands, attach project context, choose a model, accept voice, and reuse prompts. Runs can expose plans, tools, approvals, subagents, background work, sources, artifacts, structured answers, progress, and traces through the requested assistant-ui Elements.

Installing a registry component is not considered feature completion. Each element must pass these gates:

1. **Installed** — registry source and dependencies compile in Star.
2. **Themed** — hard-coded demo colors and sizes are replaced with Star semantic tokens and work in every theme.
3. **Wired** — the component receives real provider, ACP, project, or runtime data rather than fixtures.
4. **Persistent** — durable state survives reloads and switching projects/conversations where the feature requires it.
5. **Interactive** — actions such as approve, cancel, collect, retry, insert, remove, and open source have real, idempotent effects.
6. **Tested** — contracts, adapters, rendering, accessibility, failure paths, and one end-to-end flow are covered.
7. **Documented** — the event or tool contract and user behavior are recorded.

## 2. Current Star foundation

Star already has much of the lower layer needed by the Elements:

- React 19, Vite, Tailwind CSS v4, shadcn `base-nova`, Base UI, and semantic theme variables.
- assistant-ui thread primitives, Lexical composer, Streamdown rendering, attachments, model selection, voice input, slash commands, and project `#` mentions.
- Vercel AI SDK 7 with a `ToolLoopAgent` for direct providers.
- ACP adapters for Codex CLI, Claude Code, OpenCode, Gemini CLI, and generic ACP agents.
- Project-scoped conversations, durable messages, resumable streams, automatic titles, concurrent sessions, and approval continuation.
- Project tools for reading, listing, searching, writing, replacing, and running commands.
- A durable agent runtime with queued, running, awaiting-approval, completed, failed, cancelled, and interrupted states.
- A Ghostty Web terminal dock. This remains the interactive project shell; `TerminalBlock` will render command output inside a chat message and will not replace it.
- A project graph foundation described in [PROJECT_GRAPH.md](./PROJECT_GRAPH.md).

The main gap is a stable, typed event layer between the runtime and presentation. Several requested Elements can be installed today, but agent plans, traces, subagents, sources, memory, and background work cannot be complete until their underlying events are durable.

## 3. Integration rules

### 3.1 Registry intake

Use the shadcn registry as the source of each component. Before every addition:

```powershell
npx shadcn@latest add "@assistant-ui/elements-<name>" --dry-run
npx shadcn@latest add "@assistant-ui/elements-<name>" --diff
```

Then add the component and selectively merge it. Never overwrite Star's customized primitives without reviewing the diff. Shared dependencies such as `elements-surfaces`, `collapsible`, `command`, and `dialog` are installed once.

Registry code is owned by Star after installation. Normalize it immediately:

- replace raw blue, green, red, gray, white, and black utilities with semantic tokens;
- use the existing density, radius, font, motion, focus, and status variables;
- preserve Base UI APIs rather than importing a second primitive system;
- add `motion-reduce` behavior;
- keep all user-facing strings ready for localization;
- avoid element-specific network calls inside presentation components.

### 3.2 One event model

Add a versioned `@star/agent-events` workspace package. Both direct AI SDK providers and ACP agents translate into this model before events reach React.

```ts
type StarAgentEvent =
  | RunStatusEvent
  | AgentStatusEvent
  | PlanUpdatedEvent
  | TodoUpdatedEvent
  | ToolStartedEvent
  | ToolProgressEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | ApprovalRequestedEvent
  | ApprovalResolvedEvent
  | SourceDiscoveredEvent
  | CitationAddedEvent
  | MemoryChangedEvent
  | ArtifactUpdatedEvent
  | SubagentChangedEvent
  | HandoffEvent
  | JobProgressEvent
  | TraceSpanEvent;

interface EventEnvelope<TType extends string, TPayload> {
  schemaVersion: 1;
  eventId: string;
  sequence: number;
  type: TType;
  projectId: string;
  threadId: string;
  runId: string;
  agentId: string;
  parentAgentId?: string;
  toolCallId?: string;
  createdAt: string;
  payload: TPayload;
}
```

Required guarantees:

- `eventId` is globally unique and `sequence` is monotonic within a run.
- Replaying a stream produces the same UI state without repeating side effects.
- Approval resolution is keyed by `approvalId` and is idempotent.
- Large outputs and artifacts are stored by reference, not duplicated in every event.
- Unknown event versions render a safe fallback rather than breaking a thread.
- Secrets, environment values, and unredacted command input never enter analytics or traces.

### 3.3 One renderer registry

Create a feature package at `src/features/agent-elements/` with:

```text
agent-elements/
  contracts/
  adapters/
    ai-sdk-adapter.ts
    acp-adapter.ts
  renderers/
    tool-renderer-registry.tsx
    message-part-renderer.tsx
  composer/
  agent/
  knowledge/
  structured/
  observability/
  tests/
```

The renderer registry maps typed parts to one component:

```ts
registerToolRenderer({
  toolName: "run_project_command",
  component: TerminalBlockRenderer,
  inputSchema: RunCommandInput,
  outputSchema: RunCommandOutput,
});
```

Do not infer rich UI by parsing assistant prose. A chart, map, plan, citation, or table appears only when a validated structured part exists. Unknown tools use the generic `ToolCall` fallback.

### 3.4 Shared application commands

Create one `AppCommandRegistry`. Composer slash commands and the settings command palette are two views of the same commands.

```ts
interface AppCommand {
  id: string;
  label: string;
  description?: string;
  group: "thread" | "project" | "agent" | "permissions" | "settings";
  keywords: string[];
  shortcut?: string[];
  children?: AppCommand[];
  isAvailable(ctx: CommandContext): boolean;
  run(ctx: CommandContext): void | Promise<void>;
}
```

This supports nested permissions, Build/Plan mode, new session, compact session, thinking effort, model selection, prompt insertion, and settings navigation without implementing them twice.

## 4. Delivery sequence

### Phase 0 — contracts, fixtures, and visual harness

Goal: make every later component cheap and safe to integrate.

1. Create `@star/agent-events` with Zod schemas, TypeScript types, reducer, serializer, and migration entry point.
2. Extend durable run records to store ordered events and artifact/source references.
3. Add AI SDK and ACP adapters into the normalized schema.
4. Create the renderer registry and safe generic fallback.
5. Add a development-only Elements gallery with fixture states: empty, loading, streaming, complete, failed, cancelled, and approval pending.
6. Add semantic variables for `running`, `approval`, `success`, `warning`, `error`, source accents, chart series, and trace spans.
7. Add feature flags per group so unfinished Elements cannot leak into normal sessions.

Exit criteria:

- Event replay is deterministic and contract-tested.
- An interrupted run resumes with identical event-derived UI.
- The gallery renders in every Star theme with no hard-coded page background.

### Phase 1 — composer and settings foundation (“must start”)

Goal: ship the input surface first because every agent workflow depends on it.

Install the unified assistant-ui composer implementation once, then wire the five documented facets. Preserve Star's current project mentions, provider discovery, Build/Plan control, and voice behavior while moving them behind shared adapters.

Order:

1. Composer attachments.
2. Composer model picker.
3. Composer context.
4. Composer voice.
5. Composer slash commands.
6. Prompt library.
7. Command palette as the settings extra layer.

Exit criteria:

- Composer state survives non-destructive thread UI changes.
- Keyboard-only users can reach and operate every control.
- Slash commands and command palette execute the same registered action.
- Attachments, model, mode, context, and voice are included in the outgoing request contract.

### Phase 2 — the core agent loop

Goal: make an ordinary coding run truthful, compact, and actionable.

Order:

1. Thinking Indicator and Agent Status.
2. Tool Call generic renderer.
3. Approval Card.
4. Terminal Block for command tools.
5. Agent Plan and Todo List.
6. Tool Timeline.

Replace the current overlapping custom tool displays only after the new registry covers running, complete, error, denied, and stale/replayed calls. Keep the existing approval dock above the composer, but render it with the new Approval Card and the same idempotent approval endpoint.

Exit criteria:

- A coding request streams status, plan, tools, command output, and approvals without duplicate cards.
- Approval works after switching threads and projects, and one click resolves it once.
- Reloading or resuming does not restart a completed tool.

### Phase 3 — parallel and background agents

Goal: make concurrent work visible without turning the transcript into a dashboard.

Order:

1. Speaker Identity.
2. Subagent List.
3. Agent Handoff.
4. Background Inbox.
5. Recommendation Card.

Runtime additions:

- stable `agentId`, `parentAgentId`, role, model, progress, and status;
- child-run creation and cancellation;
- explicit handoff events with carried context references;
- background run unread/collected/archive state;
- thread-sidebar state derived from the same run store.

Exit criteria:

- Multiple direct or ACP sessions run concurrently across projects.
- Switching away does not stop work.
- Pending approval is not shown as successful/running green.
- Background results can be collected exactly once into the intended thread.

### Phase 4 — sources, research, and project memory

Goal: make factual and project-grounded responses inspectable.

Order:

1. Web Search.
2. Inline Citation.
3. Document Reference.
4. Memory Chips.
5. Research Report.

Backend additions:

- a provider-independent `web_search` tool with normalized result/source objects;
- project document indexing with file identity, revision/hash, page/range anchors, and permission checks;
- project-scoped memory CRUD with provenance, confidence, and deletion;
- source deduplication and stable citation numbering;
- research-section events that reference source IDs rather than copy sources.

Exit criteria:

- Every citation opens the exact source or project file anchor it claims.
- Deleting a memory chip removes the stored memory, not only the chip.
- Research reports resume section-by-section and preserve their sources.

### Phase 5 — structured answers and artifacts

Goal: provide rich results only when a task benefits from them.

Order:

1. Data Table and Spec Sheet.
2. Chart and Score Breakdown.
3. Timeline.
4. Diagram and Flow Graph.
5. Math Block.
6. Map Answer.
7. Artifact Card.

Each result type gets a versioned Zod schema and a tool or typed data-part contract. Rendering must be bounded: row, point, node, edge, event, expression, and artifact-size limits are enforced before React sees the payload.

Exit criteria:

- Invalid structured output falls back to a readable error/fallback, never a blank thread.
- Streaming updates append or revise by stable IDs without duplicating rows or nodes.
- Artifacts are versioned, downloadable/openable, and associated with their project and run.

### Phase 6 — long jobs and observability

Goal: expose progress and diagnostics without leaking sensitive content.

Order:

1. Job Progress.
2. Trace Waterfall.

Add a job service contract with weighted stages, cancellation, retry, ETA metadata, and terminal state. Add nested spans for model calls, tools, retrieval, approvals, subagents, and persistence. Trace payloads contain timing, status, counts, and redacted summaries—not API keys, full prompts, environment values, or sensitive file content.

Exit criteria:

- Cancelling a job reaches the underlying operation and produces a durable cancelled state.
- Trace durations reconcile with run duration and identify failed spans.
- Trace rendering remains responsive with at least 1,000 spans.

### Phase 7 — hardening and release

1. Run migrations against copied production-like local databases.
2. Add virtualization for large timelines, traces, tool histories, tables, and research reports.
3. Audit focus order, screen-reader labels, live regions, contrast, reduced motion, and high zoom.
4. Test all themes and Windows scaling at 100%, 125%, 150%, and 200%.
5. Add payload limits, cancellation cleanup, source validation, content sanitization, and secret redaction.
6. Measure time-to-first-token, rerender count, memory use, replay time, and persisted event size.
7. Remove feature flags only after the group passes its release gate.

## 5. Element implementation matrix

### 5.1 Composer and settings

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Composer Slash Commands](https://www.assistant-ui.com/elements/composer-slash-commands) | Unified `elements-composer`; `AppCommandRegistry` adapter | Replace the local static list; filter on `/`; support nested commands for permissions, mode, thinking, thread, project, and settings; preserve keyboard navigation | Typing `/` opens a theme-safe menu; selecting a leaf executes once; subcommands work; unavailable commands are hidden; tests cover mouse and keyboard |
| [Composer Attachments](https://www.assistant-ui.com/elements/composer-attachments) | Unified `elements-composer`; existing assistant-ui attachment adapter | Add upload/read progress, cancellation, error/retry, file-size/type policy, and project-file references; avoid duplicating project files when a reference is enough | A file stages with progress, can be removed/retried, appears on the sent message, and remains readable after reload |
| [Composer Model Picker](https://www.assistant-ui.com/elements/composer-model-picker) | Unified `elements-composer`; existing dynamic provider discovery | Bind read/write model context to project/thread selection; retain provider and ACP discovery; show loading/error/fallback clearly | Model changes persist per project, affect the next run, never require typing an ID, and recover from failed discovery |
| [Composer Voice](https://www.assistant-ui.com/elements/composer-voice) | Unified `elements-composer`; `WebSpeechDictationAdapter` initially | Detect support; display waveform/transcribing state; allow cancel/accept; later permit a pluggable local/cloud transcription adapter | Unsupported systems hide/disable cleanly; accepted transcript enters the composer without sending automatically; permission errors are explained |
| [Composer Context](https://www.assistant-ui.com/elements/composer-context) | Unified `elements-composer`; thread token metadata | Return provider-aware used/max tokens from runtime; include attachments, selected project references, and compacted context; warn near limit | Ring updates during the conversation, uses the selected model limit, and compacting immediately reduces displayed usage |
| [Prompt Library](https://www.assistant-ui.com/elements/prompt-library) | `elements-prompt-library` | Store global and project prompts, searchable metadata, variables, validation, insert action, CRUD, and import/export | Users can save, find, parameterize, insert, edit, and delete prompts; project prompts do not leak across projects |
| [Command Palette](https://www.assistant-ui.com/elements/command-palette) | `elements-command-palette`; settings overlay | Expose `AppCommandRegistry`; add global shortcut; group by scope; include settings pages and connection actions; support nested permissions | Palette opens above settings and app content, searches all permitted commands, shows shortcuts, restores focus, and shares behavior with slash commands |

### 5.2 Core agent experience

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Thinking Indicator](https://www.assistant-ui.com/elements/thinking-indicator) | `elements-thinking-indicator` | Derive current label from pending tool or agent status; maintain monotonic elapsed time; stop on terminal state | Shows only while active, changes label without duplicating messages, survives resume, and respects reduced motion |
| [Agent Status](https://www.assistant-ui.com/elements/agent-status) | `elements-agent-status` | Map normalized queued/running/approval/complete/fail/cancel states to semantic status tokens | Status and duration are accurate; approval has its own non-green state; terminal state does not keep ticking |
| [Tool Call](https://www.assistant-ui.com/elements/tool-call) | `elements-tool-call`; generic fallback renderer | Replace the old duplicate fallback; validate input/result; concise request/result disclosure; register specialty renderers by tool name | Exactly one surface exists per `toolCallId`; running, result, denied, error, and replay states render correctly |
| [Approval Card](https://www.assistant-ui.com/elements/approval-card) | `elements-approval-card`; current approval endpoint/dock | Adapt tool and ACP permission requests; allow/deny with optional reason; disable while resolving; persist resolution | One click resolves once, switching threads does not loop, stale approvals cannot execute, and denial reaches the agent |
| [Terminal Block](https://www.assistant-ui.com/elements/terminal-block) | `elements-terminal-block`; `run_project_command` renderer | Stream stdout/stderr as ordered chunks; exit code/signal/duration; truncate/archive large logs; copy action | Output streams without page scroll glitches, distinguishes stderr, ends with truthful status, and replays after reload |
| [Agent Plan](https://www.assistant-ui.com/elements/agent-plan) | `elements-agent-plan` | Add plan revisions and stable step IDs/states; connect Build/Plan transition recommendations; keep plan separate from prose | Plan streams and revises without duplicate steps; progress is derived; “Start building” changes mode through an explicit action |
| [Todo List](https://www.assistant-ui.com/elements/todo-list) | `elements-todo-list` | Normalize provider-native todo tools and Star todo events; stable item IDs; distinction from user project tasks | Agent can add/reorder/revise/complete items mid-run; state replays; unsupported providers can use Star's todo tool |
| [Tool Timeline](https://www.assistant-ui.com/elements/tool-timeline) | `elements-tool-timeline` | Derive concise verb, target, status, duration, file stats from tool events; recent-tail mode | Timeline follows actual event order, updates while streaming, expands to history, and does not duplicate generic tool cards |

### 5.3 Parallel and background work

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Speaker Identity](https://www.assistant-ui.com/elements/speaker-identity) | `elements-speaker-identity` | Carry speaker kind, name, agent ID, role, and optional model on message parts | Identity appears only when ambiguity exists and correctly distinguishes user, main agent, subagent, and tool |
| [Subagent List](https://www.assistant-ui.com/elements/subagent-list) | `elements-subagent-list` | Add parent/child run relationships, model, progress, result summary, cancellation, and child navigation | Parallel workers update independently; selecting one opens details; failure/cancel does not mark siblings failed |
| [Agent Handoff](https://www.assistant-ui.com/elements/agent-handoff) | `elements-agent-handoff` | Define from/to agent, reason, context references, settled state, and acceptance semantics | Handoff names both agents, explains why, carries valid references, and cannot be accepted twice |
| [Background Inbox](https://www.assistant-ui.com/elements/background-inbox) | `elements-background-inbox`; durable run store | Query runs outside current thread; unread and collected state; collect/archive/cancel actions; project filters | Ongoing, completed, and failed runs appear across threads/projects; collection inserts one durable result in the right thread |
| [Recommendation Card](https://www.assistant-ui.com/elements/recommendation-card) | `elements-recommendation-card` | Typed recommendation with rationale, confidence, alternatives, accept/reject/edit; use for plan/build transitions and optional changes | An accepted recommendation performs its registered action, rejection is reported to the agent, and no side effect occurs before consent |

### 5.4 Sources, documents, and memory

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Web Search](https://www.assistant-ui.com/elements/web-search) | `elements-web-search`; normalized `web_search` tool | Provider/tool adapter, streamed results, source IDs, favicon/domain metadata, safe external opening, dedupe | Query and results stream in order; every result opens safely; failures and empty results are explicit |
| [Inline Citation](https://www.assistant-ui.com/elements/inline-citation) | `elements-inline-citation`; Streamdown/source renderer | Stable per-message numbering, source preview, mutual exclusion, keyboard access, source resolution | Numbering is stable after streaming/reload; hover/focus preview matches the source; missing sources degrade visibly |
| [Document Reference](https://www.assistant-ui.com/elements/document-reference) | `elements-document-reference`; project document index | Store document ID/hash, quote, page or line range, revision, URI; open Monaco/PDF/browser at anchor | Quote and anchor are validated against the indexed revision; clicking opens the correct location; changed files show staleness |
| [Memory Chips](https://www.assistant-ui.com/elements/memory-chips) | `elements-memory-chips`; project memory service | Project-scoped memory CRUD, provenance, confidence, consent/policy, dedupe, removal; graph link | New memories appear once, persist for the project, can be removed for real, and record their source run |
| [Research Report](https://www.assistant-ui.com/elements/research-report) | `elements-research-report`; section/source events | Plan sections, stream section content/status, attach source IDs, resume/cancel, export artifact | Sections fill independently with citations; interrupted reports resume; export preserves structure and sources |

### 5.5 Structured answers and artifacts

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Data Table](https://www.assistant-ui.com/elements/data-table) | `elements-data-table`; typed result renderer | Column/row schema, stable keys, cell types, bounds, copy/export, responsive overflow | Valid tables stream without shifting keys, remain usable at narrow widths, and reject oversized/unsafe cells |
| [Spec Sheet](https://www.assistant-ui.com/elements/spec-sheet) | `elements-spec-sheet` | Labeled row schema, groups, deciding row, value/unit formatting | One structured object renders consistently; important row is semantic, not color-only; unknown values are explicit |
| [Chart](https://www.assistant-ui.com/elements/chart) | `elements-chart` | Series/point schema, line/area/bar choice, semantic palette, streaming points, accessible table fallback | Points append by ID, axes and units are correct, themes remain legible, and underlying values are keyboard/screen-reader accessible |
| [Score Breakdown](https://www.assistant-ui.com/elements/score-breakdown) | `elements-score-breakdown` | Criterion, weight, score, explanation, denominator and total validation | Arithmetic reconciles, missing denominators do not crash, and color is not the only pass/fail signal |
| [Timeline](https://www.assistant-ui.com/elements/timeline) | `elements-timeline` | Event IDs, timestamps/ranges, past/current/future states, timezone and sorting | Events are chronologically stable, timezone is visible, streaming updates revise by ID, and invalid dates fall back safely |
| [Diagram](https://www.assistant-ui.com/elements/diagram) | `elements-diagram`; sanitized SVG/image/artifact renderer | Safe rendering pipeline, zoom/reset/full-bleed, size bounds, downloadable source | Untrusted SVG is sanitized, controls are keyboard accessible, and large diagrams do not escape their surface |
| [Flow Graph](https://www.assistant-ui.com/elements/flow-graph) | `elements-flow-graph`; graph layout adapter | Node/edge schema, stable IDs, layout, branches/rejoins, pan/zoom, project graph link | Branches and joins are readable, cycles do not hang layout, node selection opens valid details, and graph is bounded |
| [Math Block](https://www.assistant-ui.com/elements/math-block) | `elements-math-block`; existing Streamdown math capability | Expression/derivation schema, safe TeX, ordered steps, copy source, fallback text | Expressions and derivations render during streaming, invalid TeX shows source text, and content works with screen readers |
| [Map Answer](https://www.assistant-ui.com/elements/map-answer) | `elements-map-answer`; map adapter selected during implementation | Pin/route schema, tile/provider decision, API-key policy, attribution, privacy, list fallback | Pins and route match the list, attribution is present, missing map service still shows the locations, and secrets remain backend-only |
| [Artifact Card](https://www.assistant-ui.com/elements/artifact-card) | `elements-artifact-card`; artifact store | Artifact ID/type/version/status, streamed content reference, preview/open/download, revisions, project ownership | Live writing updates one card, versions remain accessible, actions open the correct editor/viewer, and reload preserves it |

### 5.6 Jobs and observability

| Element | Registry/integration | Required work | MVP acceptance |
|---|---|---|---|
| [Job Progress](https://www.assistant-ui.com/elements/job-progress) | `elements-job-progress`; job service | Weighted stages, current/total, ETA metadata, cancel/retry, terminal state, background link | Progress never moves backward without a declared retry, cancel stops work, ETA is labeled as estimate, and state survives reload |
| [Trace Waterfall](https://www.assistant-ui.com/elements/trace-waterfall) | `elements-trace-waterfall`; normalized spans | Parent/child spans, start/end/duration/status, model/tool/retrieval categories, redaction, virtualization | Nested timing aligns, failed span is obvious, 1,000 spans remain responsive, and no secret or raw sensitive content is exposed |

## 6. Persistence changes

Add or migrate storage for these logical records. Exact SQL belongs in the implementation phase after the current repository adapter is reviewed.

| Record | Key fields | Retention |
|---|---|---|
| `agent_run_events` | event ID, run/thread/project, sequence, type, schema version, payload reference, timestamp | Conversation lifetime; compact after terminal state while preserving replay |
| `agent_artifacts` | artifact ID, project/thread/run, type, version, content URI/hash, metadata | Until user deletes project/artifact |
| `agent_sources` | source ID, project, URI/file ID, title, revision/hash, anchor metadata | Deduplicated per project; reference counted |
| `project_memories` | memory ID, project, text/structured value, provenance, confidence, timestamps | Until user removes it; auditable deletion |
| `background_runs` | run ID, parent/agent, status, unread/collected, result reference | Until collected/archived according to policy |
| `saved_prompts` | prompt ID, scope, project ID, title, body, variables, timestamps | Until user deletes it |
| `trace_spans` | span/parent/run IDs, kind, timing, status, redacted attributes | Configurable; shorter than conversation retention by default |

Migration rules:

- migrations are transactional, versioned, and restart-safe;
- the sidecar owns writes so Tauri and Node do not contend for the same SQLite transaction;
- busy timeout/WAL policy remains centralized;
- old conversations without events continue to render through a legacy adapter;
- event payload schema migrations are pure functions with fixture tests.

## 7. Testing strategy

### 7.1 Contract tests

- Validate every event and structured result with success and malformed fixtures.
- Verify AI SDK and ACP inputs normalize to identical semantic events.
- Verify replay, deduplication, monotonic sequence, and schema migrations.
- Verify secret-redaction rules.

### 7.2 Component tests

For every Element, cover empty, loading/running, partial streaming, success, failure, cancellation, and replay where applicable. Test keyboard navigation, focus return, accessible labels/live regions, reduced motion, and theme tokens.

### 7.3 Runtime integration tests

- Start a direct-provider run and an ACP run with equivalent tool events.
- Switch threads/projects while both run.
- Resolve an approval from a background thread exactly once.
- Interrupt/restart the sidecar and resume both UIs from durable events.
- Cancel a command, subagent, research report, and long job.

### 7.4 End-to-end release journeys

1. **Composer:** choose project/model/mode, attach a file, mention a repo file, dictate text, run a slash command, and send.
2. **Coding agent:** plan, request Build mode, use tools, request approval, stream terminal output, update todos, finish, and replay.
3. **Parallel work:** launch two subagents in different threads/projects, switch away, observe sidebar states, collect one background result, and hand off.
4. **Research:** search the web and project documents, produce cited sections, store/remove a memory, and export the report artifact.
5. **Structured result:** stream a table and chart, open a diagram/flow graph, inspect a math derivation/map/timeline, and version an artifact.
6. **Operations:** run a cancellable staged job, inspect its trace, retry a failed stage, reload, and confirm state.

### 7.5 Performance budgets

- No full-thread rerender for a single streamed event.
- Batch high-frequency terminal, trace, and chart updates per animation frame.
- Virtualize histories beyond agreed thresholds.
- Keep the composer interactive while runs stream.
- Bound persisted payloads and move large content to artifact storage.

## 8. Definition of done by release group

A phase is released only when:

- every element in the phase passes all seven completion gates;
- direct providers and ACP have either real parity or an explicit capability-disabled state;
- switching project/thread and reloading preserves truthful state;
- themes, accessibility, scale, reduced motion, and narrow layouts pass;
- errors render inside the relevant surface and do not turn the application white;
- the old implementation is removed only after migrated conversations remain readable;
- documentation names the data owner, renderer, supported actions, and fallback for each element.

## 9. Recommended implementation batches

Keep pull requests reviewable and releasable:

1. `agent-events` contracts, reducer, persistence, adapters, gallery.
2. Unified composer attachments/model/context/voice.
3. Command registry, slash commands, prompt library, settings command palette.
4. Status/thinking/tool-call/approval/terminal renderers.
5. Plan/todo/tool timeline and Build/Plan recommendation.
6. Speaker/subagent/handoff/background inbox.
7. Sources/search/citations/document references/memory.
8. Research report and artifacts.
9. Table/spec/chart/score/timeline.
10. Diagram/flow/math/map.
11. Job progress and trace waterfall.
12. Hardening, migration cleanup, legacy removal, and full release audit.

Each batch should leave the app shippable. Components behind an unfinished contract remain feature-flagged and visible only in the gallery.

## 10. Source index

Official assistant-ui documentation used for this plan:

- Agent feedback: [Thinking Indicator](https://www.assistant-ui.com/elements/thinking-indicator), [Agent Status](https://www.assistant-ui.com/elements/agent-status), [Speaker Identity](https://www.assistant-ui.com/elements/speaker-identity)
- Tools: [Tool Call](https://www.assistant-ui.com/elements/tool-call), [Tool Timeline](https://www.assistant-ui.com/elements/tool-timeline), [Terminal Block](https://www.assistant-ui.com/elements/terminal-block), [Approval Card](https://www.assistant-ui.com/elements/approval-card)
- Knowledge: [Web Search](https://www.assistant-ui.com/elements/web-search), [Inline Citation](https://www.assistant-ui.com/elements/inline-citation), [Document Reference](https://www.assistant-ui.com/elements/document-reference), [Memory Chips](https://www.assistant-ui.com/elements/memory-chips), [Research Report](https://www.assistant-ui.com/elements/research-report)
- Agent coordination: [Agent Plan](https://www.assistant-ui.com/elements/agent-plan), [Todo List](https://www.assistant-ui.com/elements/todo-list), [Subagent List](https://www.assistant-ui.com/elements/subagent-list), [Agent Handoff](https://www.assistant-ui.com/elements/agent-handoff), [Background Inbox](https://www.assistant-ui.com/elements/background-inbox), [Recommendation Card](https://www.assistant-ui.com/elements/recommendation-card)
- Structured results: [Data Table](https://www.assistant-ui.com/elements/data-table), [Spec Sheet](https://www.assistant-ui.com/elements/spec-sheet), [Chart](https://www.assistant-ui.com/elements/chart), [Score Breakdown](https://www.assistant-ui.com/elements/score-breakdown), [Timeline](https://www.assistant-ui.com/elements/timeline), [Diagram](https://www.assistant-ui.com/elements/diagram), [Flow Graph](https://www.assistant-ui.com/elements/flow-graph), [Math Block](https://www.assistant-ui.com/elements/math-block), [Map Answer](https://www.assistant-ui.com/elements/map-answer), [Artifact Card](https://www.assistant-ui.com/elements/artifact-card)
- Operations: [Job Progress](https://www.assistant-ui.com/elements/job-progress), [Trace Waterfall](https://www.assistant-ui.com/elements/trace-waterfall)
- Composer/settings: [Slash Commands](https://www.assistant-ui.com/elements/composer-slash-commands), [Attachments](https://www.assistant-ui.com/elements/composer-attachments), [Model Picker](https://www.assistant-ui.com/elements/composer-model-picker), [Voice](https://www.assistant-ui.com/elements/composer-voice), [Context](https://www.assistant-ui.com/elements/composer-context), [Prompt Library](https://www.assistant-ui.com/elements/prompt-library), [Command Palette](https://www.assistant-ui.com/elements/command-palette)

