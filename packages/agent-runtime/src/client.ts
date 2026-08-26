import type { ResumableClientStorage } from "@assistant-ui/ai-sdk";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/**
 * localStorage-backed resumable stream state, scoped to one conversation.
 * Unlike assistant-ui's sessionStorage helper, this survives a full app restart.
 */
export function createAgentSessionStorage(sessionId: string): ResumableClientStorage {
  const key = `star.agent-runtime.stream.${sessionId}`;

  return {
    getStreamId() {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setStreamId(id) {
      try {
        window.localStorage.setItem(key, id);
        notify(key);
      } catch {
        // A blocked storage backend should not prevent the chat from running.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
        notify(key);
      } catch {
        // A blocked storage backend should not prevent the chat from running.
      }
    },
    subscribe(listener) {
      const subscriptions = listeners.get(key) ?? new Set<() => void>();
      subscriptions.add(listener);
      listeners.set(key, subscriptions);
      return () => {
        subscriptions.delete(listener);
        if (subscriptions.size === 0) listeners.delete(key);
      };
    },
  };
}

export type AgentRunStatus =
  | "queued"
  | "running"
  | "awaiting-approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type AgentRun = {
  id: string;
  sessionId: string;
  projectId?: string;
  projectPath?: string;
  connectionId?: string;
  modelId?: string;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  approval?: { id: string; title: string };
};
