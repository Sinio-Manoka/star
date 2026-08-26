import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AiConnection, AiModelList, AiRuntimeInfo, AiSelection, CliAvailability } from "./types";

export async function getAiRuntime(): Promise<AiRuntimeInfo> {
  if (!isTauri()) return { endpoint: "http://127.0.0.1:43127/chat", token: "development" };
  return invoke<AiRuntimeInfo>("ai_runtime_info");
}

export async function requestAiRuntime(pathname: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const runtime = await getAiRuntime();
      const url = new URL(pathname, runtime.endpoint);
      return await fetch(url, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          authorization: `Bearer ${runtime.token}`,
        },
      });
    } catch (error) {
      lastError = error;
      if (init?.signal?.aborted) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(100 + attempt * 75, 600)));
    }
  }
  throw lastError;
}

export async function listAiConnections(): Promise<AiConnection[]> {
  if (!isTauri()) return [];
  return invoke<AiConnection[]>("ai_list_connections");
}

export async function saveAiConnection(input: {
  id?: string;
  kind: AiConnection["kind"];
  label: string;
  model: string;
  baseUrl?: string;
  command?: string;
  region?: string;
  projectId?: string;
  apiKey?: string;
  active: boolean;
}): Promise<AiConnection[]> {
  return invoke<AiConnection[]>("ai_save_connection", { input });
}

export async function removeAiConnection(id: string): Promise<AiConnection[]> {
  return invoke<AiConnection[]>("ai_remove_connection", { id });
}

export async function detectAiClis(): Promise<CliAvailability[]> {
  if (!isTauri()) return [];
  return invoke<CliAvailability[]>("ai_detect_clis");
}

export async function listAiModels(connectionId: string, projectPath?: string): Promise<AiModelList> {
  const query = new URLSearchParams({ connectionId, ...(projectPath ? { projectPath } : {}) });
  const response = await requestAiRuntime(`/models?${query}`);
  const value = await response.json() as AiModelList & { error?: string };
  if (!response.ok) throw new Error(value.error || "Could not load models");
  return value;
}

export type AiConnectionTestResult =
  | { ok: true; kind?: "agent"; modelCount?: number }
  | { ok: false; error: string };

/**
 * Cheap reachability check — pings the provider with the stored credentials
 * without sending a full chat request. Returns `{ ok: false, error }` instead
 * of throwing so the UI can show a clean status message.
 */
export async function testAiConnection(connectionId: string): Promise<AiConnectionTestResult> {
  if (!isTauri()) return { ok: true, kind: "agent" };
  const response = await requestAiRuntime("/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  return (await response.json()) as AiConnectionTestResult;
}

export async function respondAiPermission(permissionId: string, optionId: string): Promise<void> {
  const response = await requestAiRuntime(`/permissions/${encodeURIComponent(permissionId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  if (!response.ok) {
    const value = await response.json() as { error?: string };
    throw new Error(value.error || "Could not answer permission request");
  }
}

function fallbackConversationTitle(prompt: string) {
  const compact = prompt.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  const words = compact.split(" ").slice(0, 6).join(" ");
  return `${words.slice(0, 60).trim()}${compact.length > words.length ? "…" : ""}`;
}

export async function generateConversationTitle(input: {
  prompt: string;
  currentTitle?: string;
  connectionId?: string;
  modelId?: string;
}): Promise<string> {
  try {
    const response = await requestAiRuntime("/title", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const value = await response.json() as { title?: string };
    if (response.ok && value.title?.trim()) return value.title.trim();
  } catch {
    // A useful local title is better than leaving the sidebar on "New chat".
  }
  return fallbackConversationTitle(input.prompt);
}

export const AI_CONNECTIONS_CHANGED = "star:ai-connections-changed";
export const AI_SELECTION_CHANGED = "star:ai-selection-changed";

function selectionKey(projectPath: string) {
  return `star.ai.selection.${projectPath}`;
}

export function getAiSelection(projectPath: string): AiSelection | undefined {
  try {
    const value = localStorage.getItem(selectionKey(projectPath));
    return value ? JSON.parse(value) as AiSelection : undefined;
  } catch {
    return undefined;
  }
}

export function setAiSelection(projectPath: string, selection: AiSelection) {
  localStorage.setItem(selectionKey(projectPath), JSON.stringify(selection));
  window.dispatchEvent(new CustomEvent(AI_SELECTION_CHANGED, { detail: { projectPath, selection } }));
}

export function notifyAiConnectionsChanged() {
  window.dispatchEvent(new Event(AI_CONNECTIONS_CHANGED));
}
