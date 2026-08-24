import { describe, expect, it } from "vitest";
import { buildFileGraph } from "./graphModel";
import type { Project, ProjectTreeEntry } from "./types";

const project: Project = {
  id: "project-1",
  name: "star",
  rootPath: "C:/code/star",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastOpenedAt: "2026-01-01T00:00:00.000Z",
};

describe("buildFileGraph", () => {
  it("creates stable project, directory, file, and containment records", () => {
    const entries: ProjectTreeEntry[] = [
      { relativePath: "src", name: "src", kind: "directory", depth: 0, size: 0 },
      { relativePath: "src/App.tsx", name: "App.tsx", kind: "file", depth: 1, size: 120 },
    ];

    const graph = buildFileGraph(project, entries);

    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes.find((node) => node.path === "src/App.tsx")).toMatchObject({
      kind: "file",
      label: "App.tsx",
      metadata: { depth: 1, size: 120 },
    });
    expect(graph.edges[1]).toMatchObject({
      sourceId: "project-1:directory:src",
      targetId: "project-1:file:src/App.tsx",
      kind: "contains",
    });
  });

  it("attaches an orphaned entry safely to the project root", () => {
    const graph = buildFileGraph(project, [
      { relativePath: "missing/file.ts", name: "file.ts", kind: "file", depth: 1, size: 1 },
    ]);

    expect(graph.edges[0].sourceId).toBe("project-1:project:.");
  });
});
