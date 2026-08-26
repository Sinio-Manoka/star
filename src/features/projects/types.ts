export type Project = {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
};

export type ProjectThread = {
  id: string;
  projectId: string;
  title: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ProjectTreeEntry = {
  relativePath: string;
  name: string;
  kind: "file" | "directory";
  depth: number;
  size: number;
};

export type ProjectGraphNode = {
  id: string;
  projectId: string;
  kind: "project" | "directory" | "file" | "symbol" | "tool" | "memory";
  label: string;
  path?: string;
  metadata: Record<string, unknown>;
};

export type ProjectGraphEdge = {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  kind: "contains" | "imports" | "calls" | "references" | "uses" | "relates_to";
  metadata: Record<string, unknown>;
};

export type ProjectGraphSnapshot = {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
};

export type CreateProjectInput = Pick<Project, "name" | "rootPath">;

export interface ProjectRepository {
  initialize(): Promise<void>;
  listProjects(): Promise<Project[]>;
  createProject(input: CreateProjectInput): Promise<Project>;
  renameProject(projectId: string, name: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  touchProject(projectId: string): Promise<void>;
  listThreads(projectId: string): Promise<ProjectThread[]>;
  createThread(projectId: string, title?: string): Promise<ProjectThread>;
  loadThreadMessages(threadId: string): Promise<unknown[]>;
  saveThreadMessages(threadId: string, messages: unknown[]): Promise<void>;
  renameThread(threadId: string, title: string): Promise<void>;
  setThreadStatus(threadId: string, status: ProjectThread["status"]): Promise<void>;
  removeThread(threadId: string): Promise<void>;
  replaceProjectGraph(projectId: string, snapshot: ProjectGraphSnapshot): Promise<void>;
  getProjectGraph(projectId: string): Promise<ProjectGraphSnapshot>;
}
