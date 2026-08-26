import { afterEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { providerDefinitions } from "./catalog";
import {
  assertConnectionReady,
  createProviderModel,
  formatProviderError,
  listProviderModels,
  testProviderConnection,
} from "./runtime";

afterEach(() => vi.unstubAllGlobals());

describe("provider runtime contract", () => {
  it("turns retryable gateway failures into a concise provider message", () => {
    const lastError = Object.assign(new Error("Bad Gateway"), { statusCode: 502 });
    const retryError = Object.assign(new Error("Failed after 3 attempts"), { lastError, errors: [lastError] });

    expect(formatProviderError(retryError, "MiniMax"))
      .toBe("MiniMax is temporarily unavailable (502). Try again shortly or select another provider.");
  });

  it("keeps MiniMax generation on its Anthropic-compatible provider", () => {
    const model = createProviderModel({
      kind: "minimax",
      label: "MiniMax",
      model: "minimax-m3",
      apiKey: "test-key",
      baseUrl: "https://api.minimax.io/v1",
    });

    expect(model.provider).toBe("minimax.messages");
    expect(model.modelId).toBe("minimax-m3");
  });

  it("discovers MiniMax models from the authenticated OpenAI-compatible catalogue", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "MiniMax-M2.7", owned_by: "minimax" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await testProviderConnection({
      kind: "minimax",
      label: "MiniMax",
      model: "minimax-m3",
      apiKey: "secret",
    });

    expect(result).toEqual({ modelCount: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.minimax.io/v1/models",
      expect.objectContaining({ headers: { authorization: "Bearer secret" } }),
    );
  });

  it("executes MiniMax text requests through the Anthropic-compatible endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: "OK" }],
      model: "minimax-m3",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateText({
      model: createProviderModel({
        kind: "minimax",
        label: "MiniMax",
        model: "minimax-m3",
        apiKey: "secret",
      }),
      prompt: "Hello",
    });

    expect(result.text).toBe("OK");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.minimax.io/anthropic/v1/messages");
  });

  it("does not report a fallback catalogue as a successful connection test", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const connection = { kind: "minimax", label: "MiniMax", model: "minimax-m3", apiKey: "bad-key" };

    await expect(testProviderConnection(connection)).rejects.toThrow("rejected model discovery (401)");
    await expect(listProviderModels(connection)).resolves.toMatchObject({ source: "catalog" });
  });

  it("validates credentials from the shared provider definition", () => {
    expect(() => assertConnectionReady({ kind: "minimax", model: "minimax-m3" }))
      .toThrow("MiniMax needs an API key");
    expect(() => assertConnectionReady({ kind: "ollama", model: "qwen3" }))
      .not.toThrow();
  });

  it("has a live discovery strategy for every direct provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "discovered-model", owned_by: "provider" }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    for (const definition of providerDefinitions.filter((item) => item.category === "provider")) {
      const result = await listProviderModels({
        kind: definition.kind,
        label: definition.label,
        model: definition.defaultModel,
        apiKey: "test-key",
        baseUrl: definition.baseUrlRequired ? "https://example.com/v1" : undefined,
      });
      expect(result.source, definition.kind).toBe("live");
      expect(result.models[0]?.id, definition.kind).toBe("discovered-model");
    }
  });
});
