import {
  Bot, Boxes, BrainCircuit, Cloud, CloudCog, Cpu, Flame, Gauge, Globe2,
  Network, Orbit, Route, Server, Sparkles, TerminalSquare, Waypoints, Zap,
  type LucideIcon,
} from "lucide-react";
import type { AiConnectionKind } from "./types";

export type ProviderDefinition = {
  kind: AiConnectionKind;
  label: string;
  description: string;
  defaultModel: string;
  category: "provider" | "agent";
  icon: LucideIcon;
  keyMode: "required" | "optional" | "none";
  baseUrl?: boolean;
  region?: boolean;
  project?: boolean;
  projectLabel?: string;
  projectDescription?: string;
  command?: boolean;
  defaultCommand?: string;
  baseUrlRequired?: boolean;
};

export const providerCatalog: ProviderDefinition[] = [
  { kind: "openrouter", label: "OpenRouter", description: "One key for hundreds of hosted models.", defaultModel: "openai/gpt-5-mini", category: "provider", icon: Route, keyMode: "required" },
  { kind: "openai", label: "OpenAI", description: "GPT and reasoning models through the Responses API.", defaultModel: "gpt-5-mini", category: "provider", icon: Sparkles, keyMode: "required", baseUrl: true },
  { kind: "azure", label: "Azure OpenAI", description: "OpenAI models deployed through Azure AI Foundry.", defaultModel: "gpt-5-mini", category: "provider", icon: CloudCog, keyMode: "required", baseUrl: true, baseUrlRequired: true },
  { kind: "anthropic", label: "Anthropic", description: "Claude models with reasoning and tool use.", defaultModel: "claude-sonnet-4-6", category: "provider", icon: BrainCircuit, keyMode: "required", baseUrl: true },
  { kind: "gemini", label: "Google Gemini", description: "Gemini models through Google AI Studio.", defaultModel: "gemini-2.5-flash", category: "provider", icon: Orbit, keyMode: "required" },
  { kind: "vertex", label: "Google Vertex AI", description: "Gemini on Google Cloud or Vertex Express.", defaultModel: "gemini-2.5-flash", category: "provider", icon: CloudCog, keyMode: "optional", region: true, project: true },
  { kind: "alibaba", label: "Alibaba Cloud", description: "Qwen models through Alibaba Cloud Model Studio.", defaultModel: "qwen3.7-max", category: "provider", icon: Cloud, keyMode: "required", baseUrl: true },
  { kind: "anthropic-aws", label: "Claude on AWS", description: "Anthropic's native Messages API hosted on AWS.", defaultModel: "claude-sonnet-4-6", category: "provider", icon: CloudCog, keyMode: "optional", baseUrl: true, region: true, project: true, projectLabel: "Anthropic workspace ID", projectDescription: "Optional when your AWS Anthropic account is not workspace-scoped." },
  { kind: "baseten", label: "Baseten", description: "Production inference for open and custom models.", defaultModel: "moonshotai/Kimi-K2-Thinking", category: "provider", icon: Server, keyMode: "required", baseUrl: true },
  { kind: "huggingface", label: "Hugging Face", description: "Thousands of models through Inference Providers.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct", category: "provider", icon: Boxes, keyMode: "required", baseUrl: true },
  { kind: "minimax", label: "MiniMax", description: "MiniMax M-series reasoning and chat models.", defaultModel: "minimax-m3", category: "provider", icon: BrainCircuit, keyMode: "required", baseUrl: true },
  { kind: "moonshot", label: "Moonshot AI", description: "Kimi chat, reasoning, and coding models.", defaultModel: "kimi-k3", category: "provider", icon: Orbit, keyMode: "required", baseUrl: true },
  { kind: "open-responses", label: "Open Responses", description: "Any endpoint implementing the Open Responses specification.", defaultModel: "default", category: "provider", icon: Network, keyMode: "optional", baseUrl: true, baseUrlRequired: true },
  { kind: "ollama", label: "Ollama", description: "Models installed locally on this computer.", defaultModel: "llama3.2", category: "provider", icon: Server, keyMode: "none", baseUrl: true },
  { kind: "groq", label: "Groq", description: "Low-latency hosted inference.", defaultModel: "llama-3.3-70b-versatile", category: "provider", icon: Zap, keyMode: "required" },
  { kind: "grok", label: "xAI", description: "Grok chat and reasoning models.", defaultModel: "grok-4", category: "provider", icon: Bot, keyMode: "required" },
  { kind: "mistral", label: "Mistral AI", description: "Mistral, Ministral, and Codestral models.", defaultModel: "mistral-large-latest", category: "provider", icon: Boxes, keyMode: "required" },
  { kind: "bedrock", label: "Amazon Bedrock", description: "Claude, Nova, Llama, Mistral, and more on AWS.", defaultModel: "us.anthropic.claude-haiku-4-5-20251001-v1:0", category: "provider", icon: Cloud, keyMode: "optional", region: true },
  { kind: "cohere", label: "Cohere", description: "Command models for agents and enterprise retrieval.", defaultModel: "command-a-03-2025", category: "provider", icon: BrainCircuit, keyMode: "required" },
  { kind: "fireworks", label: "Fireworks AI", description: "Fast serverless inference for open models.", defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct", category: "provider", icon: Flame, keyMode: "required" },
  { kind: "deepseek", label: "DeepSeek", description: "DeepSeek chat and reasoning models.", defaultModel: "deepseek-chat", category: "provider", icon: BrainCircuit, keyMode: "required" },
  { kind: "cerebras", label: "Cerebras", description: "High-speed inference on Cerebras systems.", defaultModel: "llama-3.3-70b", category: "provider", icon: Gauge, keyMode: "required" },
  { kind: "perplexity", label: "Perplexity", description: "Search-grounded Sonar models.", defaultModel: "sonar", category: "provider", icon: Globe2, keyMode: "required" },
  { kind: "together", label: "Together AI", description: "Hosted open models and dedicated endpoints.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", category: "provider", icon: Boxes, keyMode: "required" },
  { kind: "deepinfra", label: "DeepInfra", description: "Serverless inference for open-source models.", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", category: "provider", icon: Server, keyMode: "required" },
  { kind: "byteplus", label: "BytePlus ModelArk", description: "Seed chat models hosted by BytePlus.", defaultModel: "seed-2-0-lite-260428", category: "provider", icon: Network, keyMode: "required", baseUrl: true },
  { kind: "llmgateway", label: "LLM Gateway", description: "A self-hostable gateway for many model providers.", defaultModel: "gpt-5.6-terra", category: "provider", icon: Waypoints, keyMode: "required", baseUrl: true },
  { kind: "vercel-gateway", label: "Vercel AI Gateway", description: "Models from multiple providers through Vercel.", defaultModel: "openai/gpt-5-mini", category: "provider", icon: Cloud, keyMode: "required" },
  { kind: "compatible", label: "OpenAI-compatible", description: "Kimi, LM Studio, vLLM, and any compatible endpoint.", defaultModel: "default", category: "provider", icon: Cpu, keyMode: "optional", baseUrl: true, baseUrlRequired: true },
  { kind: "codex", label: "Codex CLI", description: "Use Codex through its official ACP adapter.", defaultModel: "default", category: "agent", icon: TerminalSquare, keyMode: "none", command: true, defaultCommand: "npx -y @agentclientprotocol/codex-acp" },
  { kind: "claude-code", label: "Claude Code", description: "Use Claude Code through its ACP adapter.", defaultModel: "default", category: "agent", icon: TerminalSquare, keyMode: "none", command: true, defaultCommand: "npx -y @agentclientprotocol/claude-agent-acp" },
  { kind: "opencode", label: "OpenCode", description: "Use OpenCode's built-in ACP server.", defaultModel: "default", category: "agent", icon: TerminalSquare, keyMode: "none", command: true, defaultCommand: "opencode acp" },
  { kind: "gemini-cli", label: "Gemini CLI", description: "Use Gemini CLI's built-in ACP server.", defaultModel: "default", category: "agent", icon: TerminalSquare, keyMode: "none", command: true, defaultCommand: "gemini --acp" },
  { kind: "acp", label: "Other ACP agent", description: "Connect any CLI that supports the Agent Client Protocol.", defaultModel: "default", category: "agent", icon: TerminalSquare, keyMode: "none", command: true },
];

export function providerDefinition(kind: AiConnectionKind) {
  return providerCatalog.find((provider) => provider.kind === kind)!;
}
