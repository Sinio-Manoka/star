import { describe, expect, it } from "vitest";
import { normalizeModels, providerModel } from "./providers.mjs";

describe("Vercel AI SDK provider registry", () => {
  it("normalizes provider-specific model catalogs", () => {
    expect(normalizeModels({ models: [
      { name: "models/gemini-test", displayName: "Gemini Test", supportedGenerationMethods: ["generateContent"] },
      { name: "models/embed-test", supportedGenerationMethods: ["embedContent"] },
    ] })).toEqual([{ id: "gemini-test", name: "Gemini Test", ownedBy: undefined }]);
  });

  it("constructs every configured direct provider through the AI SDK", () => {
    const kinds = [
      "openrouter", "openai", "azure", "anthropic", "gemini", "vertex", "ollama",
      "alibaba", "anthropic-aws", "baseten", "huggingface", "minimax", "moonshot",
      "open-responses", "groq", "grok", "mistral", "bedrock", "cohere", "fireworks", "deepseek",
      "cerebras", "perplexity", "together", "deepinfra", "byteplus", "llmgateway",
      "vercel-gateway", "compatible",
    ];
    for (const kind of kinds) {
      expect(() => providerModel({
        kind, model: "test-model", apiKey: "test-key", baseUrl: ["compatible", "open-responses"].includes(kind) ? "http://127.0.0.1:9999/v1" : undefined,
      })).not.toThrow();
    }
  });
});
