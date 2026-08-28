export function createSpeakerMetadata(connection, requestedModel) {
  const model = String(requestedModel || connection?.model || "").trim();
  return {
    agentName: String(connection?.label || "Assistant").trim() || "Assistant",
    ...(model && model !== "default" ? { model } : {}),
    ...(connection?.kind ? { connectionKind: String(connection.kind) } : {}),
  };
}
