# Star

> A project-aware IDE that understands your code, your runtime, and everything in between.

**Star** is a Tauri 2 + React + TypeScript desktop IDE built around a single idea: an editor should understand the project as a **software system**, not just a folder of files. Star builds a persistent **Project Brain** — a graph of projects, directories, files, symbols, tools, APIs, databases, runtime traces, and tasks — and wires it into the editor, terminal, AI chat, and (eventually) the database, API explorer, observability, and production simulator.

---

## Table of contents

- [Highlights](#highlights)
- [Repository layout](#repository-layout)
- [Requirements](#requirements)
- [Quickstart](#quickstart)
- [Scripts](#scripts)
- [Architecture](#architecture)
- [Themes & UI](#themes--ui)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [License](#license)

---

## Highlights

- **Project Brain** — a persistent graph of projects, directories, files, symbols, tools, APIs, and relationships, stored in SQLite (`project_graph_nodes` / `project_graph_edges`).
- **Three top-level views** — `Projects`, `Editor`, and `Brain` — switchable from the top tab bar, with resizable, persistent side panels for chats and the terminal.
- **Editor** — Monaco for the main editor, CodeMirror for lightweight configuration editing, Shiki for rendered code, Tree-sitter for syntax context.
- **Terminal** — Ghostty Web for terminal rendering, dockable from the bottom with a remembered height and project-aware `cwd`.
- **Streaming AI** — Streamdown for streaming output, the Vercel AI SDK and `@assistant-ui/*` for chat, and a local Node sidecar (`star-ai`) bundled with `esbuild` and packaged with `@yao-pkg/pkg` for resumable, durable conversation runs.
- **Provider catalog** — a single source of truth (`@star/ai-providers`) for direct model-provider connections, used by both the React settings UI and the sidecar.
- **Project-scoped agent tools** — read-only file listing, reading, and search run automatically; writes, replacements, and commands go through the AI SDK approval flow, with paths locked to the selected project (symlink escapes rejected).
- **Themes** — Light, Dark, Midnight, Solar, Ayu (Light / Dark / Mirage), and Catppuccin, plus a color-picker override.
- **Window chrome** — frameless Tauri window with a custom drag region and window controls.

---

## Repository layout

```
.
├── src/                   React + TypeScript frontend
│   ├── App.tsx            Top-level shell (tabs, panels, terminal, settings)
│   ├── components/       Editor, terminal, markdown, UI primitives
│   ├── features/
│   │   ├── ai/           Provider catalog, settings, model picker
│   │   ├── projects/     Project sidebar, graph model, repositories
│   │   └── themes/       Theme provider, catalog, color picker
│   ├── lib/              Monaco / Tree-sitter wiring
│   └── themes/           Built-in CSS themes
├── src-tauri/             Rust backend, Tauri config, capabilities, icons
├── sidecar/               Local Node sidecar (server, ACP, providers)
├── scripts/              Sidecar build, WASM copy
├── packages/
│   ├── agent-runtime/    Durable, provider-independent run lifecycle
│   ├── ai-providers/     Shared provider catalog & runtime
│   └── project-agent/    Project-scoped tools (file/search/commands)
├── docs/
│   ├── FEATURES.md       Product vision and feature set
│   └── PROJECT_GRAPH.md  Project Brain graph model and indexing plan
└── public/               Bundled WASM (tree-sitter, ghostty-vt) & assets
```

---

## Requirements

- **Node.js 22+** — the sidecar is built for the `node22-*` target.
- **Rust toolchain** — required for the Tauri 2 host build.
- **Platform tooling** for Tauri 2 on your OS:
  - **Windows** — WebView2 (preinstalled on Windows 11; otherwise see [Tauri prerequisites](https://tauri.app/start/prerequisites/)).
  - **macOS** — Xcode Command Line Tools.
  - **Linux** — `webkit2gtk`, `libsoup`, and the usual Tauri deps.
- **PowerShell** — Windows only; used by `scripts/build-sidecar.mjs` to stop stale sidecars.

---

## Quickstart

Install dependencies (this also runs `scripts/copy-wasm.mjs` to bundle the Tree-sitter and Ghostty WebAssembly files):

```bash
npm install
```

### Browser-only development

Runs the Vite dev server without the Tauri shell. Useful for fast UI iteration:

```bash
npm run dev
```

### Desktop development

Builds the sidecar and starts the Tauri dev shell:

```bash
npm run tauri dev
```

`tauri dev` runs `npm run dev:app` first, which calls `npm run sidecar:build` (esbuild → `pkg` → `src-tauri/binaries/star-ai-<target>`) and then starts Vite.

### Type-check, test, and build

```bash
npm run build        # type-check (tsc --noEmit) then vite build
npm run typecheck    # type-check only
npm run test         # vitest run
```

---

## Scripts

| Script                  | What it does                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server (browser only).                                                               |
| `npm run dev:app`       | Build the sidecar, then start Vite.                                                           |
| `npm run sidecar:build` | esbuild-bundle and `pkg`-pack the Node sidecar into `src-tauri/binaries/`.                   |
| `npm run tauri <cmd>`   | Pass-through to the Tauri CLI (`dev`, `build`, …).                                           |
| `npm run build`         | `tsc --noEmit && vite build`.                                                                 |
| `npm run build:app`     | Build the sidecar, then build the frontend.                                                   |
| `npm run typecheck`     | `tsc --noEmit`.                                                                               |
| `npm run test`          | `vitest run`.                                                                                 |
| `npm run preview`       | Preview the production build.                                                                 |
| `postinstall`           | Copies bundled WASM (`tree-sitter`, `tree-sitter-typescript`, `ghostty-vt`) into `public/`.   |

---

## Architecture

### Project Brain graph

Graph data is stored per project in two generic SQLite tables:

- `project_graph_nodes` — projects, directories, files, symbols, tools, memory records.
- `project_graph_edges` — `contains`, `imports`, `calls`, `references`, `uses`, and other relationships.

The filesystem layer (project → directory → file containment) is implemented. Syntax, SCIP, CodeQL, and React Flow rendering layers are planned — see [`docs/PROJECT_GRAPH.md`](docs/PROJECT_GRAPH.md).

### AI runtime

[`@star/agent-runtime`](packages/agent-runtime/README.md) owns the lifecycle of an AI run:

- One active run per conversation; parallel runs across conversations and projects.
- Resumable AI SDK byte streams persisted to disk.
- Run states: `queued`, `running`, `awaiting-approval`, `completed`, `failed`, `cancelled`, `interrupted`.
- Server-side cancellation via `AbortSignal`, plus restart recovery for interrupted runs.
- Client-side stream discovery backed by `localStorage`.

Provider SDKs and the Agent Client Protocol (ACP) adapter are deliberately kept separate — they are adapters, not session owners.

### Sidecar

`sidecar/server.mjs` is bundled by `esbuild` and then compiled to a standalone executable with `@yao-pkg/pkg`. The Rust host loads it as an external binary (`externalBin: "binaries/star-ai"` in `tauri.conf.json`). The provider SDKs and ACP adapter live alongside it in `sidecar/acp.mjs` and `sidecar/providers.test.mjs`.

---

## Themes & UI

Star ships with several built-in themes out of the box:

- Light, Dark, Midnight, Solar
- Ayu Light, Ayu Dark, Ayu Mirage
- Catppuccin

A custom color-picker override is available on top of any theme via `src/features/themes/ThemeColorPicker.tsx`. The window itself is frameless with a custom drag region and custom window controls (`src/components/WindowControls.tsx`).

---

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture: frontend shell, Rust host, sidecar build, agent runtime, and end-to-end data flow.
- [`docs/FEATURES.md`](docs/FEATURES.md) — full product feature set: Project Brain, automatic environment, live DB integration, API World, production simulator, Chaos Mode, runtime-based test generator, developer sessions, automatic documentation, zero-setup observability, personal analytics, project commands, automatic task workspaces.
- [`docs/PROJECT_GRAPH.md`](docs/PROJECT_GRAPH.md) — Project Brain graph model and indexing plan.
- [`packages/agent-runtime/README.md`](packages/agent-runtime/README.md) — durable, provider-independent run lifecycle.
- [`packages/ai-providers/README.md`](packages/ai-providers/README.md) — shared provider catalog and runtime.
- [`packages/project-agent/README.md`](packages/project-agent/README.md) — project-scoped agent tools.

---

## Roadmap

The repository is the foundation; many product features are still in progress or planned. The most relevant work items:

- **Project Brain layers** — filesystem layer ✅, syntax (Tree-sitter) ⏭ next, SCIP / Stack Graphs (optional), CodeQL (optional), React Flow visualization.
- **Database, API, observability, simulator, chaos, sessions, docs, analytics, commands, workspaces** — see [`docs/FEATURES.md`](docs/FEATURES.md) for the full vision and current status of every area.

Contributions that align with these directions are welcome — open an issue first to discuss scope before sending a PR.

---

## License

MIT
