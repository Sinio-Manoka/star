import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AiConnection, AiModelList, AiRuntimeInfo, AiSelection, CliAvailability } from "./types";

export async function getAiRuntime(): Promise<AiRuntimeInfo> {
  if (!isTauri()) return { endpoint: "http://127.0.0.1:43127/chat", token: "development" };
  return invoke<AiRuntimeInfo>("ai_runtime_info");
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
  const runtime = await getAiRuntime();
  const url = new URL(runtime.endpoint);
  url.pathname = "/models";
  url.search = new URLSearchParams({ connectionId, ...(projectPath ? { projectPath } : {}) }).toString();
  const response = await fetch(url, { headers: { authorization: `Bearer ${runtime.token}` } });
  const value = await response.json() as AiModelList & { error?: string };
  if (!response.ok) throw new Error(value.error || "Could not load models");
  return value;
}

export async function respondAiPermission(permissionId: string, optionId: string): Promise<void> {
  const runtime = await getAiRuntime();
  const url = new URL(runtime.endpoint);
  url.pathname = `/permissions/${encodeURIComponent(permissionId)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${runtime.token}`, "content-type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  if (!response.ok) {
    const value = await response.json() as { error?: string };
    throw new Error(value.error || "Could not answer permission request");
  }
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
