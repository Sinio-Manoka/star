export type AiConnectionKind =
  | "openrouter" | "openai" | "azure" | "anthropic" | "gemini" | "vertex"
  | "alibaba" | "anthropic-aws" | "baseten" | "huggingface" | "minimax"
  | "moonshot" | "open-responses" | "ollama" | "groq" | "grok" | "mistral" | "bedrock" | "cohere"
  | "fireworks" | "deepseek" | "cerebras" | "perplexity" | "together"
  | "deepinfra" | "byteplus" | "llmgateway" | "vercel-gateway" | "compatible"
  | "codex" | "claude-code" | "opencode" | "gemini-cli" | "acp";

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
};

export type AiSelection = {
  connectionId: string;
  modelId: string;
};
