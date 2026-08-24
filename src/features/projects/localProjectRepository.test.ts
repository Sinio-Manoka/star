import { beforeEach, describe, expect, it } from "vitest";
import { buildFileGraph } from "./graphModel";
import { LocalProjectRepository } from "./localProjectRepository";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("LocalProjectRepository", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });
  });

  it("supports the full project and chat lifecycle", async () => {
    const repository = new LocalProjectRepository();
    const project = await repository.createProject({ name: "Star", rootPath: "C:/code/star" });
    const duplicate = await repository.createProject({ name: "Duplicate", rootPath: "C:/code/star" });
    expect(duplicate.id).toBe(project.id);

    await repository.renameProject(project.id, "Star IDE");
    expect((await repository.listProjects())[0].name).toBe("Star IDE");

    const thread = await repository.createThread(project.id, "Architecture");
    await repository.renameThread(thread.id, "Project architecture");
    await repository.setThreadStatus(thread.id, "archived");
    expect(await repository.listThreads(project.id)).toMatchObject([{ title: "Project architecture", status: "archived" }]);

    await repository.removeThread(thread.id);
    expect(await repository.listThreads(project.id)).toEqual([]);
  });

  it("persists and cascades the project graph", async () => {
    const repository = new LocalProjectRepository();
    const project = await repository.createProject({ name: "Star", rootPath: "C:/code/star" });
    const graph = buildFileGraph(project, [
      { relativePath: "src", name: "src", kind: "directory", depth: 0, size: 0 },
    ]);
    await repository.replaceProjectGraph(project.id, graph);
    expect((await repository.getProjectGraph(project.id)).nodes).toHaveLength(2);

    await repository.removeProject(project.id);
    expect(await repository.listProjects()).toEqual([]);
    expect(await repository.getProjectGraph(project.id)).toEqual({ nodes: [], edges: [] });
  });
});
