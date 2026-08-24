import http from "node:http";
import { Readable } from "node:stream";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText } from "ai";
import { frontendTools } from "@assistant-ui/ai-sdk";
import { acpModels, closeAcpSessions, resolveAcpPermission, runAcpTurn } from "./acp.mjs";
import { agentKinds, providerModel, providerModels } from "./providers.mjs";

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
  return connections.find((connection) => connection.id === id)
    || connections.find((connection) => connection.active)
    || connections[0];
}

async function sendWebResponse(webResponse, response) {
  response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers));
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
  if (agentKinds.has(connection.kind)) {
    const stream = createUIMessageStream({
      originalMessages: body.messages,
      execute: ({ writer }) => runAcpTurn({ connection, cwd: body.projectPath, threadId: body.conversationId || body.id, model: body.modelId, messages: body.messages || [], writer }),
      onError: (error) => error instanceof Error ? error.message : String(error),
    });
    webResponse = createUIMessageStreamResponse({ stream });
  } else {
    const tools = body.tools && Object.keys(body.tools).length ? frontendTools(body.tools) : undefined;
    const result = streamText({
      model: providerModel(connection, body.modelId),
      system: body.system,
      messages: await convertToModelMessages(body.messages || [], { tools }),
      tools,
      stopWhen: stepCountIs(10),
    });
    webResponse = result.toUIMessageStreamResponse({ originalMessages: body.messages });
  }
  await sendWebResponse(webResponse, response);
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
      return json(response, 200, agentKinds.has(connection.kind) ? await acpModels(connection, projectPath) : await providerModels(connection));
    }
    if (request.method === "POST" && url.pathname.startsWith("/permissions/")) {
      const body = await readJson(request);
      const permissionId = decodeURIComponent(url.pathname.slice("/permissions/".length));
      return resolveAcpPermission(permissionId, body.optionId)
        ? json(response, 200, { ok: true })
        : json(response, 404, { error: "Permission request expired" });
    }
    if (request.method === "POST" && url.pathname === "/chat") return await handleChat(request, response);
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
