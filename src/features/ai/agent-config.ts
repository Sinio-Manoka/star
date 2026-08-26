import { useSyncExternalStore } from "react";

export type AgentMode = "build" | "plan";
export type AgentPermissionPreset = "ask" | "edits" | "all";
export type AgentThinkingEffort = "low" | "medium" | "high";

export type AgentConfig = {
  mode: AgentMode;
  permissions: AgentPermissionPreset;
  thinkingEffort: AgentThinkingEffort;
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  mode: "build",
  permissions: "ask",
  thinkingEffort: "medium",
};

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, AgentConfig>();

const storageKey = (threadId: string) => `star.agent-config.${threadId}`;

function normalizeAgentConfig(value: Partial<AgentConfig> | undefined): AgentConfig {
  return {
    mode: value?.mode === "plan" ? "plan" : "build",
    permissions: value?.permissions === "edits" || value?.permissions === "all"
      ? value.permissions
      : "ask",
    thinkingEffort: value?.thinkingEffort === "low" || value?.thinkingEffort === "high"
      ? value.thinkingEffort
      : "medium",
  };
}

export function getAgentConfig(threadId: string): AgentConfig {
  const cached = cache.get(threadId);
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(storageKey(threadId));
    const config = normalizeAgentConfig(stored ? JSON.parse(stored) as Partial<AgentConfig> : undefined);
    cache.set(threadId, config);
    return config;
  } catch {
    cache.set(threadId, DEFAULT_AGENT_CONFIG);
    return DEFAULT_AGENT_CONFIG;
  }
}

export function setAgentConfig(threadId: string, patch: Partial<AgentConfig>) {
  const config = normalizeAgentConfig({ ...getAgentConfig(threadId), ...patch });
  cache.set(threadId, config);
  localStorage.setItem(storageKey(threadId), JSON.stringify(config));
  listeners.get(threadId)?.forEach((listener) => listener());
  return config;
}

export function useAgentConfig(threadId: string) {
  return useSyncExternalStore(
    (listener) => {
      const threadListeners = listeners.get(threadId) ?? new Set<() => void>();
      threadListeners.add(listener);
      listeners.set(threadId, threadListeners);
      return () => {
        threadListeners.delete(listener);
        if (threadListeners.size === 0) listeners.delete(threadId);
      };
    },
    () => getAgentConfig(threadId),
    () => DEFAULT_AGENT_CONFIG,
  );
}
