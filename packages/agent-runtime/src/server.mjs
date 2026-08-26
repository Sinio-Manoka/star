import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createResumableStreamContext, RESUMABLE_STREAM_ID_HEADER } from "assistant-stream/resumable";

const ACTIVE_STATUSES = new Set(["queued", "running", "awaiting-approval"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "interrupted"]);
const DEFAULT_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  "x-vercel-ai-ui-message-stream": "v1",
};

function safeFileName(id) {
  return createHash("sha256").update(id).digest("hex");
}

function cursorOf(sequence) {
  return sequence.toString(36);
}

function sequenceOf(cursor) {
  if (!cursor) return 0;
  const sequence = Number.parseInt(cursor, 36);
  return Number.isNaN(sequence) ? 0 : sequence;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

class FileResumableStreamStore {
  constructor(directory) {
    this.directory = directory;
    this.states = new Map();
    this.waiters = new Map();
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true });
    for (const file of await readdir(this.directory)) {
      if (!file.endsWith(".json")) continue;
      try {
        const state = JSON.parse(await readFile(path.join(this.directory, file), "utf8"));
        if (!state.final) {
          state.final = { kind: "error", error: "Agent runtime restarted before this stream completed." };
          await this.persist(state);
        }
        this.states.set(state.streamId, state);
      } catch {
        // Ignore an individual corrupt stream; other conversations remain usable.
      }
    }
  }

  filePath(streamId) {
    return path.join(this.directory, `${safeFileName(streamId)}.json`);
  }

  async load(streamId) {
    if (this.states.has(streamId)) return this.states.get(streamId);
    try {
      const state = JSON.parse(await readFile(this.filePath(streamId), "utf8"));
      this.states.set(streamId, state);
      return state;
    } catch {
      return undefined;
    }
  }

  persist(state) {
    const operation = this.writeQueue.then(async () => {
      await writeFile(this.filePath(state.streamId), JSON.stringify(state), "utf8");
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  notify(streamId) {
    const pending = this.waiters.get(streamId) ?? [];
    this.waiters.delete(streamId);
    for (const wake of pending) wake();
  }

  wait(streamId, signal) {
    return new Promise((resolve) => {
      const pending = this.waiters.get(streamId) ?? [];
      let settled = false;
      const wake = () => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", wake);
        const index = pending.indexOf(wake);
        if (index !== -1) pending.splice(index, 1);
        resolve();
      };
      if (signal.aborted) return wake();
      pending.push(wake);
      this.waiters.set(streamId, pending);
      signal.addEventListener("abort", wake, { once: true });
    });
  }

  async acquire(streamId) {
    if (await this.load(streamId)) return "consumer";
    const state = { streamId, nextSequence: 1, entries: [], final: undefined };
    this.states.set(streamId, state);
    await this.persist(state);
    return "producer";
  }

  async append(streamId, chunk) {
    const state = await this.load(streamId);
    if (!state || state.final) throw new Error(`Stream is not writable: ${streamId}`);
    const cursor = cursorOf(state.nextSequence++);
    state.entries.push({ cursor, chunk: Buffer.from(chunk).toString("base64") });
    await this.persist(state);
    this.notify(streamId);
  }

  async finalize(streamId, status, error) {
    const state = await this.load(streamId);
    if (!state || state.final) return;
    state.final = status === "done" ? { kind: "done" } : { kind: "error", error: error || "Stream failed" };
    await this.persist(state);
    this.notify(streamId);
  }

  async *read(streamId, cursor, signal) {
    const state = await this.load(streamId);
    if (!state) throw new Error(`Stream not found: ${streamId}`);
    let index = state.entries.findIndex((entry) => sequenceOf(entry.cursor) > sequenceOf(cursor));
    if (index === -1) index = state.entries.length;

    for (;;) {
      if (signal.aborted) return;
      while (index < state.entries.length) {
        yield { cursor: state.entries[index].cursor, chunk: Uint8Array.from(Buffer.from(state.entries[index].chunk, "base64")) };
        index += 1;
      }
      if (state.final) {
        if (state.final.kind === "error") throw new Error(state.final.error);
        return;
      }
      await this.wait(streamId, signal);
    }
  }

  async status(streamId) {
    const state = await this.load(streamId);
    if (!state) return "missing";
    if (!state.final) return "streaming";
    return state.final.kind === "done" ? "done" : "error";
  }

  async delete(streamId) {
    const state = await this.load(streamId);
    if (!state) return;
    state.final ??= { kind: "done" };
    await this.persist(state);
    this.notify(streamId);
  }
}

export class AgentRuntimeConflictError extends Error {
  constructor(run) {
    super(`Session ${run.sessionId} already has an active run.`);
    this.name = "AgentRuntimeConflictError";
    this.run = run;
  }
}

export class AgentRuntime {
  constructor({ storagePath, now = () => new Date().toISOString(), sessionHandoffMs = 1_000 }) {
    this.storagePath = storagePath;
    this.runsPath = path.join(storagePath, "runs.json");
    this.now = now;
    this.sessionHandoffMs = sessionHandoffMs;
    this.runs = new Map();
    this.controllers = new Map();
    this.persistQueue = Promise.resolve();
    this.store = new FileResumableStreamStore(path.join(storagePath, "streams"));
    this.streams = createResumableStreamContext({
      store: this.store,
      ttlMs: 7 * 24 * 60 * 60 * 1000,
      onAppend: (runId, byteLength) => this.bump(runId, { bytes: (this.runs.get(runId)?.bytes || 0) + byteLength }),
      onFinalize: (runId, status, error) => this.finalize(runId, status === "done" ? "completed" : "failed", error),
      onError: (runId, error) => this.bump(runId, { error: errorMessage(error) }),
    });
  }

  async initialize() {
    await mkdir(this.storagePath, { recursive: true });
    try {
      const records = JSON.parse(await readFile(this.runsPath, "utf8"));
      for (const run of Array.isArray(records) ? records : []) {
        if (ACTIVE_STATUSES.has(run.status)) {
          run.status = "interrupted";
          run.error = "The desktop runtime stopped before this run completed.";
          run.finishedAt = this.now();
          run.updatedAt = run.finishedAt;
          delete run.approval;
        }
        this.runs.set(run.id, run);
      }
    } catch {
      // First start has no run history.
    }
    await this.store.initialize();
    await this.persist();
    return this;
  }

  persist() {
    const records = [...this.runs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 500);
    const operation = this.persistQueue.then(() => writeFile(this.runsPath, JSON.stringify(records, null, 2), "utf8"));
    this.persistQueue = operation.catch(() => undefined);
    return operation;
  }

  bump(runId, changes) {
    const run = this.runs.get(runId);
    if (!run) return;
    Object.assign(run, changes, { updatedAt: this.now() });
    void this.persist();
  }

  finalize(runId, status, error) {
    const run = this.runs.get(runId);
    if (!run || TERMINAL_STATUSES.has(run.status)) return;
    const finishedAt = this.now();
    Object.assign(run, { status, finishedAt, updatedAt: finishedAt });
    delete run.approval;
    if (error) run.error = error;
    this.controllers.delete(runId);
    void this.persist();
  }

  getRun(runId) {
    return this.runs.get(runId);
  }

  listRuns({ sessionId, projectId } = {}) {
    return [...this.runs.values()]
      .filter((run) => !sessionId || run.sessionId === sessionId)
      .filter((run) => !projectId || run.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  activeRun(sessionId) {
    return this.listRuns({ sessionId }).find((run) => ACTIVE_STATUSES.has(run.status));
  }

  async waitForSessionHandoff(sessionId) {
    const deadline = Date.now() + this.sessionHandoffMs;
    for (;;) {
      const active = this.activeRun(sessionId);
      if (!active) return;
      if (active.status === "awaiting-approval") throw new AgentRuntimeConflictError(active);

      const streamStatus = await this.streams.status(active.id);
      if (streamStatus === "done") {
        this.finalize(active.id, "completed");
        continue;
      }
      if (streamStatus === "error") {
        this.finalize(active.id, "failed", active.error || "The previous agent stream failed.");
        continue;
      }
      if (Date.now() >= deadline) throw new AgentRuntimeConflictError(active);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  async startRun(input, createResponse) {
    await this.waitForSessionHandoff(input.sessionId);

    const createdAt = this.now();
    const run = {
      id: randomUUID(),
      sessionId: input.sessionId,
      projectId: input.projectId,
      projectPath: input.projectPath,
      connectionId: input.connectionId,
      modelId: input.modelId,
      status: "queued",
      bytes: 0,
      createdAt,
      updatedAt: createdAt,
    };
    this.runs.set(run.id, run);
    await this.persist();

    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    const startedAt = this.now();
    Object.assign(run, { status: "running", startedAt, updatedAt: startedAt });
    await this.persist();

    let upstream;
    try {
      upstream = await createResponse({
        runId: run.id,
        signal: controller.signal,
        awaitingApproval: (approval) => this.bump(run.id, { status: "awaiting-approval", approval }),
        running: () => this.bump(run.id, { status: "running", approval: undefined }),
        failed: (error) => this.finalize(run.id, "failed", errorMessage(error)),
      });
      if (!upstream.body) throw new Error("The agent returned an empty response stream.");
    } catch (error) {
      this.finalize(run.id, controller.signal.aborted ? "cancelled" : "failed", errorMessage(error));
      throw error;
    }

    run.responseHeaders = Object.fromEntries(upstream.headers);
    await this.persist();
    const stream = await this.streams.run(run.id, () => upstream.body);
    const headers = new Headers({ ...DEFAULT_HEADERS, ...run.responseHeaders });
    headers.set(RESUMABLE_STREAM_ID_HEADER, run.id);
    return { run, response: new Response(stream, { status: 200, headers }) };
  }

  async resumeRun(runId) {
    const run = this.getRun(runId);
    if (!run) return undefined;
    const stream = await this.streams.resume(runId);
    if (!stream) return undefined;
    const headers = new Headers({ ...DEFAULT_HEADERS, ...(run.responseHeaders || {}) });
    headers.set(RESUMABLE_STREAM_ID_HEADER, run.id);
    return new Response(stream, { status: 200, headers });
  }

  async cancelRun(runId) {
    const run = this.getRun(runId);
    if (!run || !ACTIVE_STATUSES.has(run.status)) return false;
    this.controllers.get(runId)?.abort(new Error("Run cancelled by the user."));
    this.finalize(runId, "cancelled");
    return true;
  }

  setApproval(runId, approval) {
    this.bump(runId, { status: "awaiting-approval", approval });
  }

  resolveApproval(runId) {
    this.bump(runId, { status: "running", approval: undefined });
  }

  async flush() {
    await Promise.resolve();
    await Promise.all([this.persistQueue, this.store.writeQueue]);
  }
}
