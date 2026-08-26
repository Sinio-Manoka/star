import http from "node:http";
import { Readable } from "node:stream";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, stepCountIs, ToolLoopAgent } from "ai";
import { frontendTools } from "@assistant-ui/ai-sdk";
import { createProjectTools, projectAgentInstructions } from "@star/project-agent";
import { acpModels, closeAcpSessions, resolveAcpPermission, runAcpTurn } from "./acp.mjs";
import {
  assertConnectionReady,
  createProviderModel,
  isAgentKind,
  listProviderModels,
  testProviderConnection,
} from "@star/ai-providers/runtime";

const port = Number(process.env.STAR_AI_PORT || 43127);
const token = process.env.STAR_AI_TOKEN || "development";
const connections = JSON.parse(process.env.STAR_AI_CONNECTIONS || "[]");

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(value));
}

function authorized(request) {
  return request.headers.authorization === `Bearer ${token}`;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function selectedConnection(id) {
  if (id) return connections.find((connection) => connection.id === id);
  return connections.find((connection) => connection.active) || connections[0];
}

async function sendWebResponse(webResponse, response) {
  response.writeHead(webResponse.status, {
    ...Object.fromEntries(webResponse.headers),
    "access-control-allow-origin": "*",
  });
  if (!webResponse.body) return response.end();
  await new Promise((resolve, reject) => {
    Readable.fromWeb(webResponse.body).once("error", reject).once("end", resolve).pipe(response);
  });
}

async function handleChat(request, response) {
  const body = await readJson(request);
  const connection = selectedConnection(body.connectionId);
  if (!connection) return json(response, 409, { error: "No AI connection is configured. Open Settings and connect a provider or coding agent." });
  let webResponse;
  try {
    assertConnectionReady(connection);
    if (isAgentKind(connection.kind)) {
      const stream = createUIMessageStream({
        originalMessages: body.messages,
        execute: ({ writer }) => runAcpTurn({ connection, cwd: body.projectPath, threadId: body.conversationId || body.id, model: body.modelId, messages: body.messages || [], writer }),
        onError: (error) => error instanceof Error ? error.message : String(error),
      });
      webResponse = createUIMessageStreamResponse({ stream });
    } else {
      const clientTools = body.tools && Object.keys(body.tools).length ? frontendTools(body.tools) : {};
      const tools = { ...clientTools, ...createProjectTools(body.projectPath) };
      const instructions = [body.system, projectAgentInstructions(body.projectName)].filter(Boolean).join("\n\n");
      const agent = new ToolLoopAgent({
        id: "star-project-agent",
        model: createProviderModel(connection, body.modelId),
        instructions,
        tools,
        stopWhen: stepCountIs(20),
      });
      const result = await agent.stream({
        messages: await convertToModelMessages(body.messages || [], { tools }),
      });
      webResponse = result.toUIMessageStreamResponse({
        originalMessages: body.messages,
        onError: (error) => error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(response, 500, { error: `AI runtime error: ${message}` });
  }
  await sendWebResponse(webResponse, response);
}

function cleanTitle(value) {
  return value.replace(/^[\s"'`#*-]+|[\s"'`#*.-]+$/g, "").replace(/\s+/g, " ").slice(0, 64).trim();
}

async function handleTitle(request, response) {
  const body = await readJson(request);
  const requestedConnection = selectedConnection(body.connectionId);
  const connection = requestedConnection && !isAgentKind(requestedConnection.kind)
    ? requestedConnection
    : connections.find((candidate) => !isAgentKind(candidate.kind) && candidate.active)
      || connections.find((candidate) => !isAgentKind(candidate.kind));
  if (!connection) return json(response, 409, { error: "No AI connection is configured." });
  try {
    assertConnectionReady(connection);
    const result = await generateText({
      model: createProviderModel(connection, body.modelId),
      system: "Choose the best concise title for this conversation. Use 3 to 6 words. Keep the current title if it is still accurate; otherwise update it to reflect the conversation's current focus. Return only the title with no quotes, markdown, or ending punctuation.",
      prompt: `Current title: ${String(body.currentTitle || "New chat").slice(0, 100)}\n\nUser messages:\n${String(body.prompt || "New conversation").slice(0, 4_000)}`,
      maxOutputTokens: 32,
    });
    const title = cleanTitle(result.text);
    return title ? json(response, 200, { title }) : json(response, 422, { error: "The provider returned an empty title." });
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" });
      return response.end();
    }
    if (!authorized(request)) return json(response, 401, { error: "Unauthorized" });
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { ok: true, sdk: "vercel-ai", acp: true });
    if (request.method === "GET" && url.pathname === "/models") {
      const connection = selectedConnection(url.searchParams.get("connectionId"));
      if (!connection) return json(response, 404, { error: "Connection not found" });
      const projectPath = url.searchParams.get("projectPath") || undefined;
      return json(response, 200, isAgentKind(connection.kind) ? await acpModels(connection, projectPath) : await listProviderModels(connection));
    }
    if (request.method === "POST" && url.pathname === "/test") {
      const body = await readJson(request);
      const connection = selectedConnection(body.connectionId);
      if (!connection) return json(response, 404, { error: "Connection not found" });
      if (isAgentKind(connection.kind)) {
        return json(response, 200, { ok: true, kind: "agent" });
      }
      try {
        const result = await testProviderConnection(connection);
        return json(response, 200, { ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json(response, 200, { ok: false, error: message });
      }
    }
    if (request.method === "POST" && url.pathname.startsWith("/permissions/")) {
      const body = await readJson(request);
      const permissionId = decodeURIComponent(url.pathname.slice("/permissions/".length));
      return resolveAcpPermission(permissionId, body.optionId)
        ? json(response, 200, { ok: true })
        : json(response, 404, { error: "Permission request expired" });
    }
    if (request.method === "POST" && url.pathname === "/chat") return await handleChat(request, response);
    if (request.method === "POST" && url.pathname === "/title") return await handleTitle(request, response);
    return json(response, 404, { error: "Not found" });
  } catch (error) {
    return json(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, "127.0.0.1", () => process.stdout.write(`ready:${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    closeAcpSessions();
    server.close(() => process.exit(0));
  });
}
