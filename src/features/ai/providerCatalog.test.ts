import { describe, expect, it } from "vitest";
import { providerCatalog, providerDefinition } from "./providerCatalog";

describe("provider catalog", () => {
  it("contains every supported text provider and coding-agent adapter exactly once", () => {
    const kinds = providerCatalog.map((provider) => provider.kind);

    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toEqual(expect.arrayContaining([
      "openrouter", "openai", "azure", "anthropic", "gemini", "vertex", "alibaba",
      "anthropic-aws", "baseten", "huggingface", "minimax", "moonshot", "open-responses", "ollama",
      "groq", "grok", "mistral", "bedrock", "cohere", "fireworks", "deepseek",
      "cerebras", "perplexity", "together", "deepinfra", "byteplus", "llmgateway",
      "vercel-gateway", "compatible", "codex", "claude-code", "opencode", "gemini-cli", "acp",
    ]));
  });

  it("gives every connection a usable label, default model, and lookup entry", () => {
    for (const provider of providerCatalog) {
      expect(provider.label).not.toBe("");
      expect(provider.defaultModel).not.toBe("");
      expect(providerDefinition(provider.kind)).toBe(provider);
    }
  });

  it("requires a custom endpoint for generic OpenAI-compatible connections", () => {
    const compatible = providerDefinition("compatible");

    expect(compatible.baseUrl).toBe(true);
    expect(compatible.baseUrlRequired).toBe(true);
    expect(compatible.keyMode).toBe("optional");
  });
});
