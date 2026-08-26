import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentRuntime, AgentRuntimeConflictError } from "./server.mjs";

let directory;

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "star-agent-runtime-"));
});

afterEach(async () => {
  if (directory?.startsWith(os.tmpdir())) await rm(directory, { recursive: true, force: true });
});

function completedResponse(text = "done") {
  const bytes = new TextEncoder().encode(`data: {\"type\":\"text-delta\",\"delta\":\"${text}\"}\n\ndata: {\"type\":\"finish\"}\n\n`);
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }), { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } });
}

describe("AgentRuntime", () => {
  it("runs, persists, and replays a completed agent stream", async () => {
    const runtime = await new AgentRuntime({ storagePath: directory }).initialize();
    const started = await runtime.startRun({ sessionId: "chat-1", projectId: "project-1" }, async () => completedResponse("hello"));

    expect(started.response.headers.get("x-resumable-stream-id")).toBe(started.run.id);
    await expect(started.response.text()).resolves.toContain("hello");
    expect(runtime.getRun(started.run.id)?.status).toBe("completed");

    const resumed = await runtime.resumeRun(started.run.id);
    await expect(resumed?.text()).resolves.toContain("hello");
    await runtime.flush();
  });

  it("keeps a provider stream error marked as failed after the response closes", async () => {
    const runtime = await new AgentRuntime({ storagePath: directory }).initialize();
    const started = await runtime.startRun({ sessionId: "chat-failed", projectId: "project-1" }, async (lifecycle) => {
      lifecycle.failed("MiniMax is temporarily unavailable (502).");
      return completedResponse("provider error event");
    });

    await started.response.text();
    await runtime.flush();
    expect(runtime.getRun(started.run.id)).toMatchObject({
      status: "failed",
      error: "MiniMax is temporarily unavailable (502).",
    });
  });

  it("allows parallel projects but prevents two active runs in one conversation", async () => {
    const runtime = await new AgentRuntime({ storagePath: directory, sessionHandoffMs: 5 }).initialize();
    const pendingResponse = ({ signal }) => new Response(new ReadableStream({
      start(controller) {
        signal.addEventListener("abort", () => controller.close(), { once: true });
      },
    }), { headers: { "content-type": "text/event-stream" } });

    const first = await runtime.startRun({ sessionId: "chat-1", projectId: "project-1" }, pendingResponse);
    await expect(runtime.startRun({ sessionId: "chat-1", projectId: "project-1" }, pendingResponse)).rejects.toBeInstanceOf(AgentRuntimeConflictError);
    const second = await runtime.startRun({ sessionId: "chat-2", projectId: "project-2" }, async () => completedResponse("parallel"));
    await second.response.text();

    expect(runtime.getRun(second.run.id)?.status).toBe("completed");
    await expect(runtime.cancelRun(first.run.id)).resolves.toBe(true);
    await first.response.text();
    await runtime.flush();
    expect(runtime.getRun(first.run.id)?.status).toBe("cancelled");
  });

  it("hands an approval continuation to the next run after the finish chunk is visible", async () => {
    const runtime = await new AgentRuntime({ storagePath: directory, sessionHandoffMs: 250 }).initialize();
    const bytes = new TextEncoder().encode('data: {"type":"finish"}\n\n');
    const first = await runtime.startRun({ sessionId: "chat-approval", projectId: "project-1" }, async () => new Response(new ReadableStream({
      async start(controller) {
        controller.enqueue(bytes);
        await new Promise((resolve) => setTimeout(resolve, 60));
        controller.close();
      },
    }), { headers: { "content-type": "text/event-stream" } }));

    const firstRead = first.response.text();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const continuation = await runtime.startRun(
      { sessionId: "chat-approval", projectId: "project-1" },
      async () => completedResponse("continued"),
    );

    await firstRead;
    await expect(continuation.response.text()).resolves.toContain("continued");
    await runtime.flush();
    expect(runtime.getRun(first.run.id)?.status).toBe("completed");
    expect(runtime.getRun(continuation.run.id)?.status).toBe("completed");
  });

  it("recovers unfinished persisted runs as interrupted", async () => {
    const createdAt = "2026-08-26T10:00:00.000Z";
    await writeFile(path.join(directory, "runs.json"), JSON.stringify([{
      id: "old-run",
      sessionId: "chat-1",
      status: "running",
      createdAt,
      updatedAt: createdAt,
    }]), "utf8");

    const runtime = await new AgentRuntime({ storagePath: directory }).initialize();
    expect(runtime.getRun("old-run")).toMatchObject({
      status: "interrupted",
      error: "The desktop runtime stopped before this run completed.",
    });
  });
});
