import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createGoogleVertex } from "@ai-sdk/google-vertex";
import { createGroq } from "@ai-sdk/groq";
import { createXai } from "@ai-sdk/xai";
import { createMistral } from "@ai-sdk/mistral";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createCohere } from "@ai-sdk/cohere";
import { createFireworks } from "@ai-sdk/fireworks";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createCerebras } from "@ai-sdk/cerebras";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createAlibaba } from "@ai-sdk/alibaba";
import { createAnthropicAws } from "@ai-sdk/anthropic-aws";
import { createBaseten } from "@ai-sdk/baseten";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { createMiniMax } from "@ai-sdk/minimax";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenResponses } from "@ai-sdk/open-responses";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider-v2";

export const agentKinds = new Set(["codex", "claude-code", "opencode", "gemini-cli", "acp"]);

const fallbackModels = {
  openrouter: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-flash"],
  openai: ["gpt-5-mini", "gpt-5", "gpt-4.1", "gpt-4.1-mini"],
  azure: ["gpt-5-mini", "gpt-4.1", "gpt-4.1-mini"],
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  vertex: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  alibaba: ["qwen3.7-max", "qwen3-max", "qwen3-coder-plus", "qwen-flash"],
  "anthropic-aws": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
  baseten: ["moonshotai/Kimi-K2-Thinking", "openai/gpt-oss-120b", "zai-org/GLM-4.7"],
  huggingface: ["meta-llama/Llama-3.3-70B-Instruct", "Qwen/Qwen3-Coder-480B-A35B-Instruct", "moonshotai/Kimi-K2-Instruct"],
  minimax: ["minimax-m3", "minimax-m2.7", "minimax-m2.7-highspeed"],
  moonshot: ["kimi-k3", "kimi-k2.7-code", "kimi-k2.7-code-highspeed"],
  "open-responses": ["default"],
  ollama: ["llama3.2", "qwen3", "deepseek-r1"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  grok: ["grok-4", "grok-3-mini"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  bedrock: ["us.anthropic.claude-sonnet-4-6-v1", "amazon.nova-pro-v1:0"],
  cohere: ["command-a-03-2025", "command-r-plus-08-2024"],
  fireworks: ["accounts/fireworks/models/llama-v3p3-70b-instruct"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  cerebras: ["llama-3.3-70b", "qwen-3-32b"],
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning-pro"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen3-235B-A22B-fp8-tput"],
  deepinfra: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"],
  byteplus: ["seed-2-0-lite-260428"],
  llmgateway: ["openai/gpt-5-mini", "anthropic/claude-sonnet-4-6"],
  "vercel-gateway": ["openai/gpt-5-mini", "anthropic/claude-sonnet-4.6", "google/gemini-2.5-flash"],
  compatible: [],
};

const cleanBase = (value) => value?.replace(/\/$/, "");

function compatible(connection, model, defaultBase) {
  const baseURL = cleanBase(connection.baseUrl || defaultBase);
  if (!baseURL) throw new Error("This provider requires a base URL.");
  return createOpenAICompatible({
    name: connection.kind,
    baseURL,
    apiKey: connection.apiKey || "local",
  })(model);
}

export function providerModel(connection, requestedModel) {
  const model = requestedModel || connection.model;
  switch (connection.kind) {
    case "openrouter": return createOpenRouter({ apiKey: connection.apiKey })(model);
    case "openai": return createOpenAI({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "azure": return createAzure({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "anthropic": return createAnthropic({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "gemini": return createGoogle({ apiKey: connection.apiKey })(model);
    case "vertex": return createGoogleVertex({
      apiKey: connection.apiKey || undefined,
      project: connection.projectId || undefined,
      location: connection.region || "us-central1",
    })(model);
    case "alibaba": return createAlibaba({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "anthropic-aws": return createAnthropicAws({
      apiKey: connection.apiKey || undefined,
      region: connection.region || "us-east-1",
      workspaceId: connection.projectId || undefined,
      baseURL: connection.baseUrl || undefined,
    })(model);
    case "baseten": return createBaseten({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "huggingface": return createHuggingFace({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "minimax": return createMiniMax({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "moonshot": return createMoonshotAI({ apiKey: connection.apiKey, baseURL: connection.baseUrl })(model);
    case "open-responses": {
      if (!connection.baseUrl) throw new Error("An Open Responses endpoint URL is required.");
      return createOpenResponses({ url: connection.baseUrl, name: connection.label || "open-responses", apiKey: connection.apiKey || undefined })(model);
    }
    case "ollama": {
      const root = cleanBase(connection.baseUrl || "http://127.0.0.1:11434");
      return createOllama({ baseURL: root.endsWith("/api") ? root : `${root}/api` })(model);
    }
    case "groq": return createGroq({ apiKey: connection.apiKey })(model);
    case "grok": return createXai({ apiKey: connection.apiKey })(model);
    case "mistral": return createMistral({ apiKey: connection.apiKey })(model);
    case "bedrock": return createAmazonBedrock({ apiKey: connection.apiKey || undefined, region: connection.region || "us-east-1" })(model);
    case "cohere": return createCohere({ apiKey: connection.apiKey })(model);
    case "fireworks": return createFireworks({ apiKey: connection.apiKey })(model);
    case "deepseek": return createDeepSeek({ apiKey: connection.apiKey })(model);
    case "cerebras": return createCerebras({ apiKey: connection.apiKey })(model);
    case "perplexity": return createPerplexity({ apiKey: connection.apiKey })(model);
    case "together": return createTogetherAI({ apiKey: connection.apiKey })(model);
    case "deepinfra": return createDeepInfra({ apiKey: connection.apiKey })(model);
    case "byteplus": return compatible(connection, model, "https://ark.ap-southeast.bytepluses.com/api/v3");
    case "llmgateway": return compatible(connection, model, "https://api.llmgateway.io/v1");
    case "vercel-gateway": return createGateway({ apiKey: connection.apiKey })(model);
    case "compatible": return compatible(connection, model);
    default: throw new Error(`Unsupported AI provider: ${connection.kind}`);
  }
}

export function normalizeModels(payload) {
  const values = Array.isArray(payload?.data) ? payload.data
    : Array.isArray(payload?.models) ? payload.models
    : Array.isArray(payload) ? payload
    : [];
  const seen = new Set();
  return values.flatMap((value) => {
    const rawId = typeof value === "string" ? value : value?.id || value?.name || value?.model;
    if (typeof rawId !== "string") return [];
    const id = rawId.startsWith("models/") ? rawId.slice(7) : rawId;
    if (!id || seen.has(id)) return [];
    if (value?.supportedGenerationMethods && !value.supportedGenerationMethods.includes("generateContent")) return [];
    seen.add(id);
    return [{
      id,
      name: typeof value?.displayName === "string" ? value.displayName : id,
      ownedBy: value?.owned_by || value?.ownedBy || value?.provider || undefined,
    }];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

async function liveModels(connection) {
  const bearer = connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : {};
  let url;
  let headers = bearer;
  switch (connection.kind) {
    case "openrouter": url = "https://openrouter.ai/api/v1/models"; break;
    case "openai": url = `${cleanBase(connection.baseUrl) || "https://api.openai.com/v1"}/models`; break;
    case "anthropic":
      url = `${cleanBase(connection.baseUrl) || "https://api.anthropic.com/v1"}/models`;
      headers = { "x-api-key": connection.apiKey, "anthropic-version": "2023-06-01" };
      break;
    case "gemini": url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(connection.apiKey)}`; headers = {}; break;
    case "alibaba": url = `${cleanBase(connection.baseUrl) || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"}/models`; break;
    case "baseten": url = `${cleanBase(connection.baseUrl) || "https://inference.baseten.co/v1"}/models`; break;
    case "huggingface": url = `${cleanBase(connection.baseUrl) || "https://router.huggingface.co/v1"}/models`; break;
    case "moonshot": url = `${cleanBase(connection.baseUrl) || "https://api.moonshot.ai/v1"}/models`; break;
    case "ollama": url = `${cleanBase(connection.baseUrl) || "http://127.0.0.1:11434"}/api/tags`; headers = {}; break;
    case "groq": url = "https://api.groq.com/openai/v1/models"; break;
    case "grok": url = "https://api.x.ai/v1/models"; break;
    case "mistral": url = "https://api.mistral.ai/v1/models"; break;
    case "cohere": url = "https://api.cohere.com/v1/models"; break;
    case "fireworks": url = "https://api.fireworks.ai/inference/v1/models"; break;
    case "deepseek": url = "https://api.deepseek.com/models"; break;
    case "cerebras": url = "https://api.cerebras.ai/v1/models"; break;
    case "perplexity": url = "https://api.perplexity.ai/models"; break;
    case "together": url = "https://api.together.xyz/v1/models"; break;
    case "deepinfra": url = "https://api.deepinfra.com/v1/openai/models"; break;
    case "byteplus": url = `${cleanBase(connection.baseUrl) || "https://ark.ap-southeast.bytepluses.com/api/v3"}/models`; break;
    case "llmgateway": url = `${cleanBase(connection.baseUrl) || "https://api.llmgateway.io/v1"}/models`; break;
    case "vercel-gateway": url = "https://ai-gateway.vercel.sh/v1/models"; headers = {}; break;
    case "compatible": url = `${cleanBase(connection.baseUrl)}/models`; break;
    default: return [];
  }
  const result = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
  if (!result.ok) throw new Error(`Model discovery failed (${result.status})`);
  return normalizeModels(await result.json());
}

export async function providerModels(connection) {
  let models = [];
  let source = "live";
  try {
    models = await liveModels(connection);
  } catch {
    source = "catalog";
  }
  if (models.length === 0) {
    source = "catalog";
    models = normalizeModels(fallbackModels[connection.kind] || [connection.model].filter(Boolean));
  }
  return { models, source };
}
