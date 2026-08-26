# `@star/agent-runtime`

Durable, provider-independent execution for Star conversations.

## Responsibilities

- one active run per conversation, with parallel runs across conversations and projects;
- resumable AI SDK byte streams backed by disk;
- queued, running, awaiting-approval, completed, failed, cancelled, and interrupted states;
- server-side cancellation through `AbortSignal`;
- restart recovery for runs that were active when the desktop runtime stopped;
- localStorage-backed assistant-ui stream discovery on the client;
- run inspection, filtering, cancellation, and stream replay APIs.

## Exports

- `@star/agent-runtime/server`: `AgentRuntime` and `AgentRuntimeConflictError` for the sidecar.
- `@star/agent-runtime/client`: resumable client storage and shared run types for the UI.

Provider SDKs and ACP are adapters. They do not own session lifecycle or persistence.
