import { describe, expect, it } from "vitest";
import { createSpeakerMetadata } from "./speaker-metadata.mjs";

describe("createSpeakerMetadata", () => {
  it("records the provider label and selected model", () => {
    expect(createSpeakerMetadata(
      { label: "MiniMax", kind: "minimax", model: "fallback" },
      "minimax-m3",
    )).toEqual({
      agentName: "MiniMax",
      model: "minimax-m3",
      connectionKind: "minimax",
    });
  });

  it("omits an unhelpful default model and provides a safe name", () => {
    expect(createSpeakerMetadata({ kind: "acp", model: "default" })).toEqual({
      agentName: "Assistant",
      connectionKind: "acp",
    });
  });
});
