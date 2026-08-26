import { createAlibaba } from "@ai-sdk/alibaba";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAnthropicAws } from "@ai-sdk/anthropic-aws";
import { createAzure } from "@ai-sdk/azure";
import { createBaseten } from "@ai-sdk/baseten";
import { createCerebras } from "@ai-sdk/cerebras";
import { createCohere } from "@ai-sdk/cohere";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createFireworks } from "@ai-sdk/fireworks";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogle } from "@ai-sdk/google";
import { createGoogleVertex } from "@ai-sdk/google-vertex";
import { createGroq } from "@ai-sdk/groq";
import { createHuggingFace } from "@ai-sdk/huggingface";
import { createMiniMax } from "@ai-sdk/minimax";
import { createMistral } from "@ai-sdk/mistral";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenResponses } from "@ai-sdk/open-responses";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";
import { generateText } from "ai";
import { GoogleAuth } from "google-auth-library";
import { createOllama } from "ollama-ai-provider-v2";
import { isAgentKind, isConnectionKind, providerDefinition, type ConnectionKind } from "./catalog";

export { isAgentKind } from "./catalog";

export type RuntimeConnection = {
  id?: string;
  kind: string;
  label?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  command?: string;
  region?: string;
  projectId?: string;
};

export type ProviderModel = {
  id: string;
  name: string;
  ownedBy?: string;
};

export type ProviderModelList = {
  models: ProviderModel[];
  source: "live" | "catalog";
  warning?: string;
};

const cleanBase = (value?: string) => value?.trim().replace(/\/+$/, "");

function requiredKind(connection: RuntimeConnection): ConnectionKind {
  if (!isConnectionKind(connection.kind)) throw new Error(`Unsupported AI provider: ${connection.kind}`);
  return connection.kind;
}

export function assertConnectionReady(connection: RuntimeConnection): void {
  const kind = requiredKind(connection);
  const definition = providerDefinition(kind);
  if (definition.category === "agent") {
    if (!connection.command?.trim()) throw new Error(`${definition.label} needs an ACP launch command.`);
    return;
  }
  if (!connection.model?.trim()) throw new Error(`${definition.label} needs a model.`);
  if (definition.keyMode === "required" && !connection.apiKey?.trim()) {
    throw new Error(`${definition.label} needs an API key. Open Settings and update this connection.`);
  }
  if (definition.baseUrlRequired && !connection.baseUrl?.trim()) {
    throw new Error(`${definition.label} needs a base URL.`);
  }
}

function compatible(connection: RuntimeConnection, model: string, defaultBase?: string) {
  const baseURL = cleanBase(connection.baseUrl || defaultBase);
  if (!baseURL) throw new Error("This provider requires a base URL.");
  return createOpenAICompatible({
    name: connection.kind,
    baseURL,
    apiKey: connection.apiKey || "local",
  })(model);
}

function miniMaxGenerationBase(value?: string): string | undefined {
  const base = cleanBase(value);
  if (!base) return undefined;
  if (/\/anthropic\/v1$/i.test(base)) return base;
  if (/^https:\/\/api\.minimax\.io\/v1$/i.test(base)) return "https://api.minimax.io/anthropic/v1";
  return base;
}

export function createProviderModel(connection: RuntimeConnection, requestedModel?: string) {
  assertConnectionReady(connection);
  const model = requestedModel?.trim() || connection.model?.trim();
  if (!model) throw new Error(`${connection.label || connection.kind} needs a model.`);

  switch (requiredKind(connection)) {
    case "openrouter": return createOpenRouter({ apiKey: connection.apiKey })(model);
    case "openai": return createOpenAI({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "azure": return createAzure({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "anthropic": return createAnthropic({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "gemini": return createGoogle({ apiKey: connection.apiKey })(model);
    case "vertex": return createGoogleVertex({ apiKey: connection.apiKey || undefined, project: connection.projectId || undefined, location: connection.region || "us-central1" })(model);
    case "alibaba": return createAlibaba({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "anthropic-aws": return createAnthropicAws({ apiKey: connection.apiKey || undefined, region: connection.region || "us-east-1", workspaceId: connection.projectId || undefined, baseURL: cleanBase(connection.baseUrl) })(model);
    case "baseten": return createBaseten({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "huggingface": return createHuggingFace({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "minimax": return createMiniMax({ apiKey: connection.apiKey, baseURL: miniMaxGenerationBase(connection.baseUrl) })(model);
    case "moonshot": return createMoonshotAI({ apiKey: connection.apiKey, baseURL: cleanBase(connection.baseUrl) })(model);
    case "open-responses": return createOpenResponses({ url: cleanBase(connection.baseUrl)!, name: connection.label || "open-responses", apiKey: connection.apiKey || undefined })(model);
    case "ollama": {
      const root = cleanBase(connection.baseUrl || "http://127.0.0.1:11434")!;
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
    default:
      throw new Error(`${connection.label || connection.kind} is a coding agent, not a model provider.`);
  }
}

export function normalizeModels(payload: unknown): ProviderModel[] {
  const body = payload as {
    data?: unknown[];
    models?: unknown[];
    modelSummaries?: unknown[];
    publisherModels?: unknown[];
    value?: unknown[];
  } | unknown[] | null;
  const values = Array.isArray(body) ? body
    : Array.isArray(body?.data) ? body.data
      : Array.isArray(body?.models) ? body.models
        : Array.isArray(body?.modelSummaries) ? body.modelSummaries
          : Array.isArray(body?.publisherModels) ? body.publisherModels
            : Array.isArray(body?.value) ? body.value
        : [];
  const seen = new Set<string>();
  return values.flatMap((raw) => {
    const value = raw as Record<string, unknown>;
    const generationMethods = value?.supportedGenerationMethods;
    if (Array.isArray(generationMethods) && !generationMethods.includes("generateContent")) return [];
    const outputModalities = value?.outputModalities;
    if (Array.isArray(outputModalities) && !outputModalities.includes("TEXT")) return [];
    const rawId = typeof raw === "string" ? raw : value?.id ?? value?.modelId ?? value?.name ?? value?.model;
    if (typeof rawId !== "string") return [];
    const id = rawId.startsWith("models/") ? rawId.slice(7) : rawId;
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const displayName = typeof value?.displayName === "string" ? value.displayName
      : typeof value?.modelName === "string" ? value.modelName
        : id;
    const owner = value?.owned_by ?? value?.ownedBy ?? value?.provider ?? value?.providerName;
    return [{ id, name: displayName, ownedBy: typeof owner === "string" ? owner : undefined }];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

type DiscoveryRequest = { url: string; headers?: Record<string, string> };

function miniMaxModelsUrl(value?: string): string {
  const base = cleanBase(value);
  if (!base) return "https://api.minimax.io/v1/models";
  if (/\/anthropic\/v1$/i.test(base)) return `${base.slice(0, -"/anthropic/v1".length)}/v1/models`;
  if (/\/v1$/i.test(base)) return `${base}/models`;
  return `${base}/v1/models`;
}

function appendModelsPath(value: string): string {
  const base = cleanBase(value)!;
  if (/\/responses$/i.test(base)) return `${base.slice(0, -"/responses".length)}/models`;
  return /\/models$/i.test(base) ? base : `${base}/models`;
}

function azureModelsUrl(value: string): string {
  const base = cleanBase(value)!;
  if (/\/openai\/v1$/i.test(base)) return `${base}/models`;
  return `${base}/openai/v1/models`;
}

function bedrockModelsRequest(connection: RuntimeConnection): DiscoveryRequest {
  const region = connection.region?.trim() || "us-east-1";
  return {
    url: `https://bedrock.${region}.amazonaws.com/foundation-models`,
    headers: connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : undefined,
  };
}

function discoveryRequest(connection: RuntimeConnection): DiscoveryRequest | undefined {
  const bearer = connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : undefined;
  const base = cleanBase(connection.baseUrl);
  switch (requiredKind(connection)) {
    case "openrouter": return { url: "https://openrouter.ai/api/v1/models", headers: bearer };
    case "openai": return { url: `${base || "https://api.openai.com/v1"}/models`, headers: bearer };
    case "azure": return { url: azureModelsUrl(base!), headers: { "api-key": connection.apiKey! } };
    case "anthropic": return { url: `${base || "https://api.anthropic.com/v1"}/models`, headers: { "x-api-key": connection.apiKey!, "anthropic-version": "2023-06-01" } };
    case "gemini": return { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(connection.apiKey || "")}` };
    case "vertex": return { url: `https://aiplatform.googleapis.com/v1beta1/publishers/google/models${connection.apiKey ? `?key=${encodeURIComponent(connection.apiKey)}` : ""}` };
    case "alibaba": return { url: `${base || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"}/models`, headers: bearer };
    case "anthropic-aws": return base
      ? { url: appendModelsPath(base), headers: bearer }
      : bedrockModelsRequest(connection);
    case "baseten": return { url: `${base || "https://inference.baseten.co/v1"}/models`, headers: bearer };
    case "huggingface": return { url: `${base || "https://router.huggingface.co/v1"}/models`, headers: bearer };
    case "minimax": return { url: miniMaxModelsUrl(connection.baseUrl), headers: bearer };
    case "moonshot": return { url: `${base || "https://api.moonshot.ai/v1"}/models`, headers: bearer };
    case "open-responses": return { url: appendModelsPath(base!), headers: bearer };
    case "ollama": return { url: `${base || "http://127.0.0.1:11434"}/api/tags` };
    case "groq": return { url: "https://api.groq.com/openai/v1/models", headers: bearer };
    case "grok": return { url: "https://api.x.ai/v1/models", headers: bearer };
    case "mistral": return { url: "https://api.mistral.ai/v1/models", headers: bearer };
    case "bedrock": return bedrockModelsRequest(connection);
    case "cohere": return { url: "https://api.cohere.com/v1/models", headers: bearer };
    case "fireworks": return { url: "https://api.fireworks.ai/inference/v1/models", headers: bearer };
    case "deepseek": return { url: "https://api.deepseek.com/models", headers: bearer };
    case "cerebras": return { url: "https://api.cerebras.ai/v1/models", headers: bearer };
    case "perplexity": return { url: "https://api.perplexity.ai/models", headers: bearer };
    case "together": return { url: "https://api.together.xyz/v1/models", headers: bearer };
    case "deepinfra": return { url: "https://api.deepinfra.com/v1/openai/models", headers: bearer };
    case "byteplus": return { url: `${base || "https://ark.ap-southeast.bytepluses.com/api/v3"}/models`, headers: bearer };
    case "llmgateway": return { url: `${base || "https://api.llmgateway.io/v1"}/models`, headers: bearer };
    case "vercel-gateway": return { url: "https://ai-gateway.vercel.sh/v1/models", headers: bearer };
    case "compatible": return { url: `${base}/models`, headers: bearer };
    default: return undefined;
  }
}

async function fetchLiveModels(connection: RuntimeConnection): Promise<ProviderModel[]> {
  assertConnectionReady(connection);
  const kind = requiredKind(connection);
  if ((kind === "bedrock" || (kind === "anthropic-aws" && !cleanBase(connection.baseUrl))) && !connection.apiKey) {
    const client = new BedrockClient({ region: connection.region?.trim() || "us-east-1" });
    const payload = await client.send(new ListFoundationModelsCommand({ byOutputModality: "TEXT" }));
    const models = normalizeModels(payload);
    if (!models.length) throw new Error(`${connection.label || connection.kind} returned no usable text models.`);
    return models;
  }
  const request = discoveryRequest(connection);
  if (!request) throw new Error(`${connection.label || connection.kind} does not expose model discovery.`);
  let headers = request.headers;
  if (kind === "vertex" && !connection.apiKey) {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    headers = { ...headers, ...await client.getRequestHeaders(request.url) };
  }
  const response = await fetch(request.url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300).trim();
    throw new Error(`${connection.label || connection.kind} rejected model discovery (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  let models = normalizeModels(await response.json());
  if (kind === "vertex") {
    models = models.map((model) => {
      const marker = model.id.lastIndexOf("/models/");
      if (marker < 0) return model;
      const id = model.id.slice(marker + "/models/".length);
      return { ...model, id, name: model.name === model.id ? id : model.name };
    });
  }
  if (!models.length) throw new Error(`${connection.label || connection.kind} returned no usable text models.`);
  return models;
}

export async function listProviderModels(connection: RuntimeConnection): Promise<ProviderModelList> {
  const kind = requiredKind(connection);
  try {
    return { models: await fetchLiveModels(connection), source: "live" };
  } catch (error) {
    const definition = providerDefinition(kind);
    const fallback = normalizeModels(definition.fallbackModels);
    if (!fallback.length && connection.model) fallback.push({ id: connection.model, name: connection.model });
    return {
      models: fallback,
      source: "catalog",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function testProviderConnection(connection: RuntimeConnection): Promise<{ modelCount?: number }> {
  assertConnectionReady(connection);
  if (isAgentKind(connection.kind)) return {};
  const request = discoveryRequest(connection);
  if (request) return { modelCount: (await fetchLiveModels(connection)).length };

  await generateText({
    model: createProviderModel(connection),
    prompt: "Reply with OK.",
    maxOutputTokens: 2,
  });
  return {};
}
