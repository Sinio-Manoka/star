import type { ComponentType, SVGProps } from "react";
import AlibabaCloud from "@lobehub/icons/es/AlibabaCloud/components/Color.js";
import Anthropic from "@lobehub/icons/es/Anthropic/components/Mono.js";
import Aws from "@lobehub/icons/es/Aws/components/Color.js";
import AzureAI from "@lobehub/icons/es/AzureAI/components/Color.js";
import Baseten from "@lobehub/icons/es/Baseten/components/Mono.js";
import Bedrock from "@lobehub/icons/es/Bedrock/components/Color.js";
import ByteDance from "@lobehub/icons/es/ByteDance/components/Color.js";
import Cerebras from "@lobehub/icons/es/Cerebras/components/Color.js";
import ClaudeCode from "@lobehub/icons/es/ClaudeCode/components/Color.js";
import Codex from "@lobehub/icons/es/Codex/components/Color.js";
import Cohere from "@lobehub/icons/es/Cohere/components/Color.js";
import DeepInfra from "@lobehub/icons/es/DeepInfra/components/Color.js";
import DeepSeek from "@lobehub/icons/es/DeepSeek/components/Color.js";
import Fireworks from "@lobehub/icons/es/Fireworks/components/Color.js";
import Gemini from "@lobehub/icons/es/Gemini/components/Color.js";
import GeminiCLI from "@lobehub/icons/es/GeminiCLI/components/Color.js";
import Grok from "@lobehub/icons/es/Grok/components/Mono.js";
import Groq from "@lobehub/icons/es/Groq/components/Mono.js";
import HuggingFace from "@lobehub/icons/es/HuggingFace/components/Color.js";
import LlmApi from "@lobehub/icons/es/LlmApi/components/Color.js";
import Minimax from "@lobehub/icons/es/Minimax/components/Color.js";
import Mistral from "@lobehub/icons/es/Mistral/components/Color.js";
import Moonshot from "@lobehub/icons/es/Moonshot/components/Mono.js";
import Ollama from "@lobehub/icons/es/Ollama/components/Mono.js";
import OpenAI from "@lobehub/icons/es/OpenAI/components/Mono.js";
import OpenCode from "@lobehub/icons/es/OpenCode/components/Mono.js";
import OpenRouter from "@lobehub/icons/es/OpenRouter/components/Color.js";
import Perplexity from "@lobehub/icons/es/Perplexity/components/Color.js";
import Together from "@lobehub/icons/es/Together/components/Color.js";
import Vercel from "@lobehub/icons/es/Vercel/components/Mono.js";
import VertexAI from "@lobehub/icons/es/VertexAI/components/Color.js";
import type { AiConnectionKind } from "./types";
import { providerDefinition } from "./providerCatalog";

type BrandIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

const brandIcons: Partial<Record<AiConnectionKind, BrandIcon>> = {
  openrouter: OpenRouter,
  openai: OpenAI,
  azure: AzureAI,
  anthropic: Anthropic,
  gemini: Gemini,
  vertex: VertexAI,
  alibaba: AlibabaCloud,
  "anthropic-aws": Aws,
  baseten: Baseten,
  huggingface: HuggingFace,
  minimax: Minimax,
  moonshot: Moonshot,
  "open-responses": OpenAI,
  ollama: Ollama,
  groq: Groq,
  grok: Grok,
  mistral: Mistral,
  bedrock: Bedrock,
  cohere: Cohere,
  fireworks: Fireworks,
  deepseek: DeepSeek,
  cerebras: Cerebras,
  perplexity: Perplexity,
  together: Together,
  deepinfra: DeepInfra,
  byteplus: ByteDance,
  llmgateway: LlmApi,
  "vercel-gateway": Vercel,
  compatible: OpenAI,
  codex: Codex,
  "claude-code": ClaudeCode,
  opencode: OpenCode,
  "gemini-cli": GeminiCLI,
};

export function ProviderBrandIcon({ kind, size = 20, className }: {
  kind: AiConnectionKind;
  size?: number;
  className?: string;
}) {
  const Brand = brandIcons[kind];
  if (Brand) return <Brand aria-hidden className={className} size={size} />;
  const Fallback = providerDefinition(kind).icon;
  return <Fallback aria-hidden className={className} size={size} />;
}
