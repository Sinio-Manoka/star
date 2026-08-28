import { describe, expect, it } from "vitest";
import { projectMentionCategoryItems, searchProjectMentions } from "./projectMentions";
import type { ProjectTreeEntry } from "./types";

const entries: ProjectTreeEntry[] = [
  { relativePath: "src", name: "src", kind: "directory", depth: 0, size: 0 },
  { relativePath: "src/main.ts", name: "main.ts", kind: "file", depth: 1, size: 12 },
  { relativePath: "README.md", name: "README.md", kind: "file", depth: 0, size: 24 },
];

describe("project mentions", () => {
  it("creates distinct file and folder directives", () => {
    expect(projectMentionCategoryItems(entries, "folders")).toEqual([
      expect.objectContaining({ id: "src", type: "folder", label: "src" }),
    ]);
    expect(projectMentionCategoryItems(entries, "files")).toEqual([
      expect.objectContaining({ id: "src/main.ts", type: "file", label: "main.ts" }),
      expect.objectContaining({ id: "README.md", type: "file", label: "README.md" }),
    ]);
  });

  it("searches repository-relative paths case-insensitively", () => {
    expect(searchProjectMentions(entries, "MAIN")).toEqual([
      expect.objectContaining({ id: "src/main.ts", type: "file" }),
    ]);
  });
});
