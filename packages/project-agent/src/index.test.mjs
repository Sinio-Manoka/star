import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProjectTools, projectAgentInstructions } from "./index.mjs";

let root;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "star-project-agent-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "src", "main.ts"), "const greeting = 'hello';\nexport { greeting };\n", "utf8");
});

afterEach(async () => {
  if (root?.startsWith(os.tmpdir())) await rm(root, { recursive: true, force: true });
});

describe("project agent tools", () => {
  it("lists, reads, and searches only project files", async () => {
    const tools = createProjectTools(root);
    await expect(tools.list_project_files.execute({ glob: "src/**/*.ts" })).resolves.toMatchObject({
      files: ["src/main.ts"],
      count: 1,
    });
    await expect(tools.read_project_file.execute({ path: "src/main.ts" })).resolves.toMatchObject({
      path: "src/main.ts",
      content: expect.stringContaining("1: const greeting"),
    });
    await expect(tools.search_project.execute({ query: "greeting", glob: "**/*", caseSensitive: false })).resolves.toMatchObject({
      count: 2,
    });
  });

  it("rejects paths outside the selected project", async () => {
    const tools = createProjectTools(root);
    await expect(tools.read_project_file.execute({ path: "../outside.txt" })).rejects.toThrow("outside the selected project");
  });

  it("marks every mutation and command as approval-gated", () => {
    const tools = createProjectTools(root);
    expect(tools.replace_in_project_file.needsApproval).toBe(true);
    expect(tools.write_project_file.needsApproval).toBe(true);
    expect(tools.run_project_command.needsApproval).toBe(true);
    expect(projectAgentInstructions("Demo")).toContain("coding agent");
  });
});
