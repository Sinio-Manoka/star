import Database from "@tauri-apps/plugin-sql";
import type { CreateProjectInput, Project, ProjectGraphEdge, ProjectGraphNode, ProjectGraphSnapshot, ProjectRepository, ProjectThread } from "./types";

type ProjectRow = {
  id: string;
  name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
};

type ThreadRow = {
  id: string;
  project_id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type GraphNodeRow = {
  id: string;
  project_id: string;
  kind: ProjectGraphNode["kind"];
  label: string;
  path: string | null;
  metadata_json: string;
};

type GraphEdgeRow = {
  id: string;
  project_id: string;
  source_id: string;
  target_id: string;
  kind: ProjectGraphEdge["kind"];
  metadata_json: string;
};

const mapProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  rootPath: row.root_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at,
});

const mapThread = (row: ThreadRow): ProjectThread => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SqliteProjectRepository implements ProjectRepository {
  private db?: Database;
  private initialization?: Promise<void>;

  private get database() {
    if (!this.db) throw new Error("Project database has not been initialized");
    return this.db;
  }

  async initialize() {
    this.initialization ??= this.initializeSchema().catch((error) => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  private async initializeSchema() {
    this.db = await Database.load("sqlite:star.db");
    await this.database.execute("PRAGMA busy_timeout = 5000");
    await this.database.execute("PRAGMA foreign_keys = ON");
    await this.database.execute(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    )`);
    await this.database.execute(`CREATE TABLE IF NOT EXISTS project_threads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await this.database.execute("CREATE INDEX IF NOT EXISTS project_threads_project_id ON project_threads(project_id, updated_at DESC)");
    await this.database.execute(`CREATE TABLE IF NOT EXISTS project_graph_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      path TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )`);
    await this.database.execute(`CREATE TABLE IF NOT EXISTS project_graph_edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_id TEXT NOT NULL REFERENCES project_graph_nodes(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES project_graph_nodes(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}'
    )`);
    await this.database.execute("CREATE INDEX IF NOT EXISTS project_graph_nodes_project_id ON project_graph_nodes(project_id, kind)");
    await this.database.execute("CREATE INDEX IF NOT EXISTS project_graph_edges_project_id ON project_graph_edges(project_id, kind)");
  }

  async listProjects() {
    const rows = await this.database.select<ProjectRow[]>("SELECT * FROM projects ORDER BY last_opened_at DESC");
    return rows.map(mapProject);
  }

  async createProject(input: CreateProjectInput) {
    const existing = await this.database.select<ProjectRow[]>("SELECT * FROM projects WHERE root_path = $1", [input.rootPath]);
    if (existing[0]) return mapProject(existing[0]);

    const now = new Date().toISOString();
    const project: Project = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now, lastOpenedAt: now };
    await this.database.execute(
      "INSERT INTO projects (id, name, root_path, created_at, updated_at, last_opened_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [project.id, project.name, project.rootPath, project.createdAt, project.updatedAt, project.lastOpenedAt],
    );
    return project;
  }

  async removeProject(projectId: string) {
    await this.database.execute("DELETE FROM projects WHERE id = $1", [projectId]);
  }

  async renameProject(projectId: string, name: string) {
    await this.database.execute("UPDATE projects SET name = $1, updated_at = $2 WHERE id = $3", [name, new Date().toISOString(), projectId]);
  }

  async touchProject(projectId: string) {
    const now = new Date().toISOString();
    await this.database.execute("UPDATE projects SET updated_at = $1, last_opened_at = $1 WHERE id = $2", [now, projectId]);
  }

  async listThreads(projectId: string) {
    const rows = await this.database.select<ThreadRow[]>(
      "SELECT * FROM project_threads WHERE project_id = $1 ORDER BY updated_at DESC",
      [projectId],
    );
    return rows.map(mapThread);
  }

  async createThread(projectId: string, title = "New chat") {
    const now = new Date().toISOString();
    const thread: ProjectThread = {
      id: crypto.randomUUID(), projectId, title, status: "active", createdAt: now, updatedAt: now,
    };
    await this.database.execute(
      "INSERT INTO project_threads (id, project_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [thread.id, thread.projectId, thread.title, thread.status, thread.createdAt, thread.updatedAt],
    );
    return thread;
  }

  async renameThread(threadId: string, title: string) {
    await this.database.execute("UPDATE project_threads SET title = $1, updated_at = $2 WHERE id = $3", [title, new Date().toISOString(), threadId]);
  }

  async setThreadStatus(threadId: string, status: ProjectThread["status"]) {
    await this.database.execute("UPDATE project_threads SET status = $1, updated_at = $2 WHERE id = $3", [status, new Date().toISOString(), threadId]);
  }

  async removeThread(threadId: string) {
    await this.database.execute("DELETE FROM project_threads WHERE id = $1", [threadId]);
  }

  async replaceProjectGraph(projectId: string, snapshot: ProjectGraphSnapshot) {
    await this.database.execute("DELETE FROM project_graph_edges WHERE project_id = $1", [projectId]);
    await this.database.execute("DELETE FROM project_graph_nodes WHERE project_id = $1", [projectId]);
    for (let offset = 0; offset < snapshot.nodes.length; offset += 100) {
        const nodes = snapshot.nodes.slice(offset, offset + 100);
        const placeholders = nodes.map((_, row) => {
          const start = row * 6 + 1;
          return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
        }).join(", ");
        await this.database.execute(
          `INSERT INTO project_graph_nodes (id, project_id, kind, label, path, metadata_json) VALUES ${placeholders}`,
          nodes.flatMap((node) => [node.id, node.projectId, node.kind, node.label, node.path ?? null, JSON.stringify(node.metadata)]),
        );
    }
    for (let offset = 0; offset < snapshot.edges.length; offset += 100) {
        const edges = snapshot.edges.slice(offset, offset + 100);
        const placeholders = edges.map((_, row) => {
          const start = row * 6 + 1;
          return `($${start}, $${start + 1}, $${start + 2}, $${start + 3}, $${start + 4}, $${start + 5})`;
        }).join(", ");
        await this.database.execute(
          `INSERT INTO project_graph_edges (id, project_id, source_id, target_id, kind, metadata_json) VALUES ${placeholders}`,
          edges.flatMap((edge) => [edge.id, edge.projectId, edge.sourceId, edge.targetId, edge.kind, JSON.stringify(edge.metadata)]),
        );
    }
  }

  async getProjectGraph(projectId: string) {
    const nodes = await this.database.select<GraphNodeRow[]>("SELECT * FROM project_graph_nodes WHERE project_id = $1", [projectId]);
    const edges = await this.database.select<GraphEdgeRow[]>("SELECT * FROM project_graph_edges WHERE project_id = $1", [projectId]);
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        projectId: node.project_id,
        kind: node.kind,
        label: node.label,
        path: node.path ?? undefined,
        metadata: JSON.parse(node.metadata_json) as Record<string, unknown>,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        projectId: edge.project_id,
        sourceId: edge.source_id,
        targetId: edge.target_id,
        kind: edge.kind,
        metadata: JSON.parse(edge.metadata_json) as Record<string, unknown>,
      })),
    };
  }
}
