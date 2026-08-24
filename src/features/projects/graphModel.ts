import type { Project, ProjectGraphSnapshot, ProjectTreeEntry } from "./types";

function graphId(projectId: string, kind: string, path: string) {
  return `${projectId}:${kind}:${path || "."}`;
}

function parentPath(path: string) {
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
}

export function buildFileGraph(project: Project, entries: ProjectTreeEntry[]): ProjectGraphSnapshot {
  const rootId = graphId(project.id, "project", "");
  const entryKinds = new Map(entries.map((entry) => [entry.relativePath, entry.kind]));
  const nodes: ProjectGraphSnapshot["nodes"] = [{
    id: rootId,
    projectId: project.id,
    kind: "project",
    label: project.name,
    path: project.rootPath,
    metadata: {},
  }];
  const edges: ProjectGraphSnapshot["edges"] = [];

  for (const entry of entries) {
    const nodeId = graphId(project.id, entry.kind, entry.relativePath);
    nodes.push({
      id: nodeId,
      projectId: project.id,
      kind: entry.kind,
      label: entry.name,
      path: entry.relativePath,
      metadata: { depth: entry.depth, size: entry.size },
    });

    const parent = parentPath(entry.relativePath);
    const parentKind = parent ? entryKinds.get(parent) : undefined;
    const sourceId = parentKind ? graphId(project.id, parentKind, parent) : rootId;
    edges.push({
      id: `${sourceId}->${nodeId}:contains`,
      projectId: project.id,
      sourceId,
      targetId: nodeId,
      kind: "contains",
      metadata: {},
    });
  }

  return { nodes, edges };
}
