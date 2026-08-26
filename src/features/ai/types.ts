import type { ConnectionKind } from "@star/ai-providers";

export type AiConnectionKind = ConnectionKind;

export type AiConnection = {
  id: string;
  kind: AiConnectionKind;
  label: string;
  model: string;
  baseUrl?: string;
  command?: string;
  region?: string;
  projectId?: string;
  active: boolean;
  hasSecret: boolean;
};

export type AiRuntimeInfo = {
  endpoint: string;
  token: string;
};

export type CliAvailability = {
  kind: Extract<AiConnectionKind, "codex" | "claude-code" | "opencode" | "gemini-cli">;
  label: string;
  installed: boolean;
  path?: string;
};

export type AiModel = {
  id: string;
  name: string;
  ownedBy?: string;
};

export type AiModelList = {
  models: AiModel[];
  source: "live" | "catalog" | "agent";
  warning?: string;
};

export type AiSelection = {
  connectionId: string;
  modelId: string;
};
