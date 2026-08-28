import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

const sessions = new Map();
const pendingPermissions = new Map();

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => { resolve = nextResolve; reject = nextReject; });
  return { promise, resolve, reject };
}

function flattenOptions(option) {
  if (!option || option.type !== "select") return [];
  return option.options.flatMap((item) => Array.isArray(item.options) ? item.options : [item]);
}

function modelOption(record) {
  return record.configOptions?.find((option) => option.type === "select"
    && (option.category === "model" || /model/i.test(`${option.id} ${option.name}`)));
}

function matchingSelectOption(record, patterns) {
  return record.configOptions?.find((option) => option.type === "select"
    && patterns.some((pattern) => pattern.test(`${option.category || ""} ${option.id || ""} ${option.name || ""}`)));
}

async function setSelectOption(record, option, requestedValue) {
  if (!option || option.currentValue === requestedValue) return;
  const match = flattenOptions(option).find((item) => item.value === requestedValue
    || item.name?.toLowerCase() === requestedValue.toLowerCase());
  if (!match) return;
  const result = await record.context.request(acp.methods.agent.session.setConfigOption, {
    sessionId: record.session.sessionId, configId: option.id, value: match.value,
  });
  record.configOptions = result.configOptions || record.configOptions;
}

async function selectAgentConfig(record, config = {}) {
  await setSelectOption(record, matchingSelectOption(record, [/\bmode\b/i]), config.mode === "plan" ? "plan" : "build");
  await setSelectOption(record, matchingSelectOption(record, [/thinking/i, /reasoning/i, /effort/i]), config.thinkingEffort || "medium");
}

function automaticPermissionOption(record, params) {
  const preset = record.agentConfig?.permissions || "ask";
  if (preset === "ask") return undefined;
  const description = `${params.toolCall?.title || ""} ${params.toolCall?.kind || ""}`;
  if (preset === "edits" && !/(write|edit|replace|create|delete|move|rename|file)/i.test(description)) return undefined;
  const options = params.options || [];
  return options.find((option) => option.kind === "allow-always")?.optionId
    || options.find((option) => option.kind === "allow-once")?.optionId;
}

function startRecord(connection, cwd, key) {
  if (!connection.command?.trim()) throw new Error(`No ACP launch command is configured for ${connection.label}.`);
  const ready = deferred();
  const close = deferred();
  const child = spawn(connection.command.trim(), {
    cwd, env: process.env, shell: true, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  const record = { key, child, ready: ready.promise, close, writer: undefined, session: undefined, context: undefined, configOptions: [] };
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-8_000); });
  child.once("error", ready.reject);
  child.once("exit", (code) => {
    if (!record.session) ready.reject(new Error(stderr || `ACP agent exited with code ${code}.`));
    sessions.delete(key);
  });

  const stream = acp.ndJsonStream(Writable.toWeb(child.stdin), Readable.toWeb(child.stdout));
  const app = acp.client({ name: "star" })
    .onRequest(acp.methods.client.session.requestPermission, async ({ params }) => {
      if (!record.writer) return { outcome: { outcome: "cancelled" } };
      const automaticOptionId = automaticPermissionOption(record, params);
      if (automaticOptionId) return { outcome: { outcome: "selected", optionId: automaticOptionId } };
      const permissionId = `acp-permission-${randomUUID()}`;
      record.writer.write({
        type: "tool-input-available", toolCallId: permissionId, toolName: "acp_permission",
        title: params.toolCall.title || "Permission required",
        input: { title: params.toolCall.title || "Permission required", options: params.options },
        providerExecuted: true, dynamic: true,
      });
      const choice = deferred();
      pendingPermissions.set(permissionId, { choice, record });
      record.lifecycle?.awaitingApproval({ id: permissionId, title: params.toolCall.title || "Permission required" });
      const optionId = await choice.promise;
      pendingPermissions.delete(permissionId);
      record.lifecycle?.running();
      record.writer?.write({
        type: "tool-output-available", toolCallId: permissionId,
        output: optionId ? { optionId } : { cancelled: true }, providerExecuted: true, dynamic: true,
      });
      return optionId ? { outcome: { outcome: "selected", optionId } } : { outcome: { outcome: "cancelled" } };
    });

  void app.connectWith(stream, async (context) => {
    record.context = context;
    await context.request(acp.methods.agent.initialize, {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { session: { configOptions: {} } },
    });
    record.session = await context.buildSession(cwd).start();
    record.configOptions = record.session.newSessionResponse.configOptions || [];
    ready.resolve(record);
    await close.promise;
    record.session.dispose();
  }).catch((error) => {
    ready.reject(error);
    record.writer?.write({ type: "error", errorText: error instanceof Error ? error.message : String(error) });
  }).finally(() => {
    if (!child.killed) child.kill();
    sessions.delete(key);
  });
  return record;
}

async function getRecord(connection, cwd, threadId) {
  const key = `${connection.id}:${cwd}:${threadId}`;
  let record = sessions.get(key);
  if (!record) { record = startRecord(connection, cwd, key); sessions.set(key, record); }
  return record.ready;
}

async function selectModel(record, requestedModel) {
  if (!requestedModel || requestedModel === "default") return;
  const option = modelOption(record);
  if (!option || option.currentValue === requestedModel) return;
  if (!flattenOptions(option).some((item) => item.value === requestedModel)) return;
  const result = await record.context.request(acp.methods.agent.session.setConfigOption, {
    sessionId: record.session.sessionId, configId: option.id, value: requestedModel,
  });
  record.configOptions = result.configOptions || record.configOptions;
}

function writeUpdate(record, update, state) {
  const writer = record.writer;
  if (!writer) return;
  if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") {
    if (!state.textOpen) { writer.write({ type: "text-start", id: state.textId }); state.textOpen = true; }
    writer.write({ type: "text-delta", id: state.textId, delta: update.content.text });
  } else if (update.sessionUpdate === "agent_thought_chunk" && update.content?.type === "text") {
    if (!state.reasoningOpen) { writer.write({ type: "reasoning-start", id: state.reasoningId }); state.reasoningOpen = true; }
    writer.write({ type: "reasoning-delta", id: state.reasoningId, delta: update.content.text });
  } else if (update.sessionUpdate === "tool_call") {
    state.tools.set(update.toolCallId, update);
    writer.write({
      type: "tool-input-available", toolCallId: update.toolCallId,
      toolName: update.name || `acp_${update.kind || "tool"}`, title: update.title,
      input: update.rawInput ?? { locations: update.locations, content: update.content },
      providerExecuted: true, dynamic: true,
    });
  } else if (update.sessionUpdate === "tool_call_update") {
    state.tools.set(update.toolCallId, { ...(state.tools.get(update.toolCallId) || {}), ...update });
    if (update.status === "completed") writer.write({ type: "tool-output-available", toolCallId: update.toolCallId, output: update.rawOutput ?? update.content ?? "Completed", providerExecuted: true, dynamic: true });
    if (update.status === "failed") writer.write({ type: "tool-output-error", toolCallId: update.toolCallId, errorText: typeof update.rawOutput === "string" ? update.rawOutput : "Tool failed", providerExecuted: true, dynamic: true });
  } else if (update.sessionUpdate === "config_option_update") record.configOptions = update.configOptions;
}

export async function runAcpTurn({ connection, cwd, threadId, model, messages, writer, lifecycle, agentConfig }) {
  if (!cwd) throw new Error("Select a project before starting a coding agent.");
  const record = await getRecord(connection, cwd, threadId || "draft");
  if (record.writer) throw new Error("This coding-agent conversation is already running.");
  await selectModel(record, model);
  record.agentConfig = agentConfig;
  await selectAgentConfig(record, agentConfig);
  const message = [...messages].reverse().find((item) => item.role === "user");
  const userPrompt = (message?.parts || []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const modePrompt = agentConfig?.mode === "plan"
    ? "[Star Plan mode: inspect and plan only. Do not modify files or run mutating commands. End with a concrete implementation plan.]"
    : "[Star Build mode: implement the request and verify the result.]";
  const referencePrompt = "[Star project references: :file[label]{name=path} and :folder[label]{name=path} identify project-relative paths. Inspect referenced paths first.]";
  const prompt = `${modePrompt}\n${referencePrompt}\n\n${userPrompt}`;
  if (!prompt) throw new Error("The coding agent needs a text prompt.");
  const state = { textId: `acp-text-${randomUUID()}`, reasoningId: `acp-reasoning-${randomUUID()}`, textOpen: false, reasoningOpen: false, tools: new Map() };
  record.writer = writer;
  record.lifecycle = lifecycle;
  const cancel = () => {
    for (const pending of pendingPermissions.values()) {
      if (pending.record === record) pending.choice.resolve(undefined);
    }
    void record.context.notify(acp.methods.agent.session.cancel, { sessionId: record.session.sessionId });
  };
  lifecycle?.signal.addEventListener("abort", cancel, { once: true });
  writer.write({ type: "start" });
  writer.write({ type: "start-step" });
  try {
    void record.session.prompt(prompt);
    for (;;) {
      const next = await record.session.nextUpdate();
      if (next.kind === "stop") break;
      writeUpdate(record, next.update, state);
    }
    if (state.textOpen) writer.write({ type: "text-end", id: state.textId });
    if (state.reasoningOpen) writer.write({ type: "reasoning-end", id: state.reasoningId });
    writer.write({ type: "finish-step" });
    writer.write({ type: "finish", finishReason: "stop" });
  } finally {
    lifecycle?.signal.removeEventListener("abort", cancel);
    record.writer = undefined;
    record.lifecycle = undefined;
  }
}

export async function acpModels(connection, cwd) {
  const fallback = { models: [{ id: "default", name: "Agent default" }], source: "agent" };
  if (!cwd) return fallback;
  try {
    const record = await Promise.race([
      getRecord(connection, cwd, "__model-discovery__"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ACP model discovery is still starting")), 4_000)),
    ]);
    const models = flattenOptions(modelOption(record)).map((item) => ({ id: item.value, name: item.name }));
    return { models: models.length ? models : fallback.models, source: "agent" };
  } catch {
    return fallback;
  }
}

export function resolveAcpPermission(permissionId, optionId) {
  const pending = pendingPermissions.get(permissionId);
  if (!pending) return false;
  pending.choice.resolve(optionId || undefined);
  return true;
}

export function closeAcpSessions() {
  for (const pending of pendingPermissions.values()) pending.choice.resolve(undefined);
  pendingPermissions.clear();
  for (const record of sessions.values()) record.close.resolve();
}
