export const connectionKinds = [
  "openrouter", "openai", "azure", "anthropic", "gemini", "vertex",
  "alibaba", "anthropic-aws", "baseten", "huggingface", "minimax",
  "moonshot", "open-responses", "ollama", "groq", "grok", "mistral",
  "bedrock", "cohere", "fireworks", "deepseek", "cerebras", "perplexity",
  "together", "deepinfra", "byteplus", "llmgateway", "vercel-gateway",
  "compatible", "codex", "claude-code", "opencode", "gemini-cli", "acp",
] as const;

export type ConnectionKind = typeof connectionKinds[number];
export type ConnectionCategory = "provider" | "agent";
export type CredentialMode = "required" | "optional" | "none";

export type ProviderDefinition = {
  kind: ConnectionKind;
  label: string;
  description: string;
  defaultModel: string;
  fallbackModels: readonly string[];
  category: ConnectionCategory;
  keyMode: CredentialMode;
  baseUrl?: boolean;
  baseUrlRequired?: boolean;
  baseUrlPlaceholder?: string;
  region?: boolean;
  project?: boolean;
  projectLabel?: string;
  projectDescription?: string;
  command?: boolean;
  defaultCommand?: string;
};

const provider = (
  definition: Omit<ProviderDefinition, "category" | "fallbackModels"> & { fallbackModels?: readonly string[] },
): ProviderDefinition => ({
  ...definition,
  category: "provider",
  fallbackModels: definition.fallbackModels ?? [definition.defaultModel],
});

const agent = (
  definition: Omit<ProviderDefinition, "category" | "keyMode" | "fallbackModels">,
): ProviderDefinition => ({
  ...definition,
  category: "agent",
  keyMode: "none",
  fallbackModels: [definition.defaultModel],
});

export const providerDefinitions: readonly ProviderDefinition[] = [
  provider({ kind: "openrouter", label: "OpenRouter", description: "One key for hundreds of hosted models.", defaultModel: "openai/gpt-5-mini", fallbackModels: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-flash"], keyMode: "required" }),
  provider({ kind: "openai", label: "OpenAI", description: "GPT and reasoning models through the Responses API.", defaultModel: "gpt-5-mini", fallbackModels: ["gpt-5-mini", "gpt-5", "gpt-4.1", "gpt-4.1-mini"], keyMode: "required", baseUrl: true, baseUrlPlaceholder: "https://api.openai.com/v1" }),
  provider({ kind: "azure", label: "Azure OpenAI", description: "OpenAI models deployed through Azure AI Foundry.", defaultModel: "gpt-5-mini", fallbackModels: ["gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"], keyMode: "required", baseUrl: true, baseUrlRequired: true, baseUrlPlaceholder: "https://your-resource.openai.azure.com/openai/v1" }),
  provider({ kind: "anthropic", label: "Anthropic", description: "Claude models with reasoning and tool use.", defaultModel: "claude-sonnet-4-6", fallbackModels: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"], keyMode: "required", baseUrl: true, baseUrlPlaceholder: "https://api.anthropic.com/v1" }),
  provider({ kind: "gemini", label: "Google Gemini", description: "Gemini models through Google AI Studio.", defaultModel: "gemini-2.5-flash", fallbackModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"], keyMode: "required" }),
  provider({ kind: "vertex", label: "Google Vertex AI", description: "Gemini on Google Cloud or Vertex Express.", defaultModel: "gemini-2.5-flash", fallbackModels: ["gemini-2.5-flash", "gemini-2.5-pro"], keyMode: "optional", region: true, project: true }),
  provider({ kind: "alibaba", label: "Alibaba Cloud", description: "Qwen models through Alibaba Cloud Model Studio.", defaultModel: "qwen3.7-max", fallbackModels: ["qwen3.7-max", "qwen3-max", "qwen3-coder-plus", "qwen-flash"], keyMode: "required", baseUrl: true }),
  provider({ kind: "anthropic-aws", label: "Claude on AWS", description: "Anthropic's native Messages API hosted on AWS.", defaultModel: "claude-sonnet-4-6", fallbackModels: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"], keyMode: "optional", baseUrl: true, region: true, project: true, projectLabel: "Anthropic workspace ID", projectDescription: "Optional when your AWS Anthropic account is not workspace-scoped." }),
  provider({ kind: "baseten", label: "Baseten", description: "Production inference for open and custom models.", defaultModel: "moonshotai/Kimi-K2-Thinking", fallbackModels: ["moonshotai/Kimi-K2-Thinking", "openai/gpt-oss-120b", "zai-org/GLM-4.7"], keyMode: "required", baseUrl: true }),
  provider({ kind: "huggingface", label: "Hugging Face", description: "Thousands of models through Inference Providers.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct", fallbackModels: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen3-Coder-480B-A35B-Instruct", "moonshotai/Kimi-K2-Instruct"], keyMode: "required", baseUrl: true }),
  provider({ kind: "minimax", label: "MiniMax", description: "MiniMax M-series reasoning and coding models.", defaultModel: "minimax-m3", fallbackModels: ["minimax-m3", "minimax-m2.7", "minimax-m2.7-highspeed", "minimax-m2.5", "minimax-m2.5-highspeed"], keyMode: "required", baseUrl: true, baseUrlPlaceholder: "https://api.minimax.io/anthropic/v1" }),
  provider({ kind: "moonshot", label: "Moonshot AI", description: "Kimi chat, reasoning, and coding models.", defaultModel: "kimi-k3", fallbackModels: ["kimi-k3", "kimi-k2.7-code", "kimi-k2.7-code-highspeed"], keyMode: "required", baseUrl: true }),
  provider({ kind: "open-responses", label: "Open Responses", description: "Any endpoint implementing the Open Responses specification.", defaultModel: "default", keyMode: "optional", baseUrl: true, baseUrlRequired: true, baseUrlPlaceholder: "https://example.com/v1/responses" }),
  provider({ kind: "ollama", label: "Ollama", description: "Models installed locally on this computer.", defaultModel: "llama3.2", fallbackModels: ["llama3.2", "qwen3", "deepseek-r1"], keyMode: "none", baseUrl: true, baseUrlPlaceholder: "http://127.0.0.1:11434" }),
  provider({ kind: "groq", label: "Groq", description: "Low-latency hosted inference.", defaultModel: "llama-3.3-70b-versatile", fallbackModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], keyMode: "required" }),
  provider({ kind: "grok", label: "xAI", description: "Grok chat and reasoning models.", defaultModel: "grok-4", fallbackModels: ["grok-4", "grok-3-mini"], keyMode: "required" }),
  provider({ kind: "mistral", label: "Mistral AI", description: "Mistral, Ministral, and Codestral models.", defaultModel: "mistral-large-latest", fallbackModels: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"], keyMode: "required" }),
  provider({ kind: "bedrock", label: "Amazon Bedrock", description: "Claude, Nova, Llama, Mistral, and more on AWS.", defaultModel: "us.anthropic.claude-haiku-4-5-20251001-v1:0", fallbackModels: ["us.anthropic.claude-haiku-4-5-20251001-v1:0", "amazon.nova-pro-v1:0"], keyMode: "optional", region: true }),
  provider({ kind: "cohere", label: "Cohere", description: "Command models for agents and enterprise retrieval.", defaultModel: "command-a-03-2025", fallbackModels: ["command-a-03-2025", "command-r-plus-08-2024"], keyMode: "required" }),
  provider({ kind: "fireworks", label: "Fireworks AI", description: "Fast serverless inference for open models.", defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct", keyMode: "required" }),
  provider({ kind: "deepseek", label: "DeepSeek", description: "DeepSeek chat and reasoning models.", defaultModel: "deepseek-chat", fallbackModels: ["deepseek-chat", "deepseek-reasoner"], keyMode: "required" }),
  provider({ kind: "cerebras", label: "Cerebras", description: "High-speed inference on Cerebras systems.", defaultModel: "llama-3.3-70b", fallbackModels: ["llama-3.3-70b", "qwen-3-32b"], keyMode: "required" }),
  provider({ kind: "perplexity", label: "Perplexity", description: "Search-grounded Sonar models.", defaultModel: "sonar", fallbackModels: ["sonar", "sonar-pro", "sonar-reasoning-pro"], keyMode: "required" }),
  provider({ kind: "together", label: "Together AI", description: "Hosted open models and dedicated endpoints.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", fallbackModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen3-235B-A22B-fp8-tput"], keyMode: "required" }),
  provider({ kind: "deepinfra", label: "DeepInfra", description: "Serverless inference for open-source models.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", fallbackModels: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"], keyMode: "required" }),
  provider({ kind: "byteplus", label: "BytePlus ModelArk", description: "Seed chat models hosted by BytePlus.", defaultModel: "seed-2-0-lite-260428", keyMode: "required", baseUrl: true }),
  provider({ kind: "llmgateway", label: "LLM Gateway", description: "A self-hostable gateway for many model providers.", defaultModel: "gpt-5.6-terra", fallbackModels: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4-6"], keyMode: "required", baseUrl: true }),
  provider({ kind: "vercel-gateway", label: "Vercel AI Gateway", description: "Models from multiple providers through Vercel.", defaultModel: "openai/gpt-5-mini", fallbackModels: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"], keyMode: "required" }),
  provider({ kind: "compatible", label: "OpenAI-compatible", description: "Kimi, LM Studio, vLLM, and any compatible endpoint.", defaultModel: "default", fallbackModels: [], keyMode: "optional", baseUrl: true, baseUrlRequired: true, baseUrlPlaceholder: "http://127.0.0.1:1234/v1" }),
  agent({ kind: "codex", label: "Codex CLI", description: "Use Codex through its official ACP adapter.", defaultModel: "default", command: true, defaultCommand: "npx -y @agentclientprotocol/codex-acp" }),
  agent({ kind: "claude-code", label: "Claude Code", description: "Use Claude Code through its ACP adapter.", defaultModel: "default", command: true, defaultCommand: "npx -y @agentclientprotocol/claude-agent-acp" }),
  agent({ kind: "opencode", label: "OpenCode", description: "Use OpenCode's built-in ACP server.", defaultModel: "default", command: true, defaultCommand: "opencode acp" }),
  agent({ kind: "gemini-cli", label: "Gemini CLI", description: "Use Gemini CLI's built-in ACP server.", defaultModel: "default", command: true, defaultCommand: "gemini --acp" }),
  agent({ kind: "acp", label: "Other ACP agent", description: "Connect any CLI that supports the Agent Client Protocol.", defaultModel: "default", command: true }),
];

const definitionsByKind = new Map(providerDefinitions.map((definition) => [definition.kind, definition]));

export function providerDefinition(kind: ConnectionKind): ProviderDefinition {
  const definition = definitionsByKind.get(kind);
  if (!definition) throw new Error(`Unsupported AI provider: ${kind}`);
  return definition;
}

export function isConnectionKind(value: string): value is ConnectionKind {
  return definitionsByKind.has(value as ConnectionKind);
}

export function isAgentKind(kind: string): boolean {
  return isConnectionKind(kind) && providerDefinition(kind).category === "agent";
}
