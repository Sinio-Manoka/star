import type { CreateProjectInput, Project, ProjectGraphEdge, ProjectGraphNode, ProjectGraphSnapshot, ProjectRepository, ProjectThread } from "./types";

const PROJECTS_KEY = "star.projects";
const THREADS_KEY = "star.project-threads";
const THREAD_MESSAGES_KEY = "star.project-thread-messages";
const GRAPH_NODES_KEY = "star.project-graph-nodes";
const GRAPH_EDGES_KEY = "star.project-graph-edges";

function read<T>(key: string): T[] {
  const value = localStorage.getItem(key);
  return value ? (JSON.parse(value) as T[]) : [];
}

function write<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

type StoredThreadMessages = { threadId: string; messages: unknown[] };

export class LocalProjectRepository implements ProjectRepository {
  async initialize() {}

  async listProjects() {
    return read<Project>(PROJECTS_KEY).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  }

  async createProject(input: CreateProjectInput) {
    const projects = read<Project>(PROJECTS_KEY);
    const existing = projects.find((project) => project.rootPath === input.rootPath);
    if (existing) return existing;

    const now = new Date().toISOString();
    const project: Project = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now, lastOpenedAt: now };
    write(PROJECTS_KEY, [...projects, project]);
    return project;
  }

  async removeProject(projectId: string) {
    const removedThreadIds = new Set(read<ProjectThread>(THREADS_KEY).filter((thread) => thread.projectId === projectId).map((thread) => thread.id));
    write(PROJECTS_KEY, read<Project>(PROJECTS_KEY).filter((project) => project.id !== projectId));
    write(THREADS_KEY, read<ProjectThread>(THREADS_KEY).filter((thread) => thread.projectId !== projectId));
    write(THREAD_MESSAGES_KEY, read<StoredThreadMessages>(THREAD_MESSAGES_KEY).filter((entry) => !removedThreadIds.has(entry.threadId)));
    write(GRAPH_NODES_KEY, read<ProjectGraphNode>(GRAPH_NODES_KEY).filter((node) => node.projectId !== projectId));
    write(GRAPH_EDGES_KEY, read<ProjectGraphEdge>(GRAPH_EDGES_KEY).filter((edge) => edge.projectId !== projectId));
  }

  async renameProject(projectId: string, name: string) {
    const now = new Date().toISOString();
    write(PROJECTS_KEY, read<Project>(PROJECTS_KEY).map((project) => (
      project.id === projectId ? { ...project, name, updatedAt: now } : project
    )));
  }

  async touchProject(projectId: string) {
    const now = new Date().toISOString();
    write(PROJECTS_KEY, read<Project>(PROJECTS_KEY).map((project) => (
      project.id === projectId ? { ...project, updatedAt: now, lastOpenedAt: now } : project
    )));
  }

  async listThreads(projectId: string) {
    return read<ProjectThread>(THREADS_KEY)
      .filter((thread) => thread.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createThread(projectId: string, title = "New chat") {
    const now = new Date().toISOString();
    const thread: ProjectThread = {
      id: crypto.randomUUID(), projectId, title, status: "active", createdAt: now, updatedAt: now,
    };
    write(THREADS_KEY, [...read<ProjectThread>(THREADS_KEY), thread]);
    return thread;
  }

  async loadThreadMessages(threadId: string) {
    return read<StoredThreadMessages>(THREAD_MESSAGES_KEY).find((entry) => entry.threadId === threadId)?.messages ?? [];
  }

  async saveThreadMessages(threadId: string, messages: unknown[]) {
    const entries = read<StoredThreadMessages>(THREAD_MESSAGES_KEY);
    const nextEntry = { threadId, messages };
    write(THREAD_MESSAGES_KEY, entries.some((entry) => entry.threadId === threadId)
      ? entries.map((entry) => entry.threadId === threadId ? nextEntry : entry)
      : [...entries, nextEntry]);
    const now = new Date().toISOString();
    write(THREADS_KEY, read<ProjectThread>(THREADS_KEY).map((thread) => thread.id === threadId ? { ...thread, updatedAt: now } : thread));
  }

  async renameThread(threadId: string, title: string) {
    const now = new Date().toISOString();
    write(THREADS_KEY, read<ProjectThread>(THREADS_KEY).map((thread) => (
      thread.id === threadId ? { ...thread, title, updatedAt: now } : thread
    )));
  }

  async setThreadStatus(threadId: string, status: ProjectThread["status"]) {
    const now = new Date().toISOString();
    write(THREADS_KEY, read<ProjectThread>(THREADS_KEY).map((thread) => (
      thread.id === threadId ? { ...thread, status, updatedAt: now } : thread
    )));
  }

  async removeThread(threadId: string) {
    write(THREADS_KEY, read<ProjectThread>(THREADS_KEY).filter((thread) => thread.id !== threadId));
    write(THREAD_MESSAGES_KEY, read<StoredThreadMessages>(THREAD_MESSAGES_KEY).filter((entry) => entry.threadId !== threadId));
  }

  async replaceProjectGraph(projectId: string, snapshot: ProjectGraphSnapshot) {
    const otherNodes = read<ProjectGraphNode>(GRAPH_NODES_KEY).filter((node) => node.projectId !== projectId);
    const otherEdges = read<ProjectGraphEdge>(GRAPH_EDGES_KEY).filter((edge) => edge.projectId !== projectId);
    write(GRAPH_NODES_KEY, [...otherNodes, ...snapshot.nodes]);
    write(GRAPH_EDGES_KEY, [...otherEdges, ...snapshot.edges]);
  }

  async getProjectGraph(projectId: string) {
    return {
      nodes: read<ProjectGraphNode>(GRAPH_NODES_KEY).filter((node) => node.projectId === projectId),
      edges: read<ProjectGraphEdge>(GRAPH_EDGES_KEY).filter((edge) => edge.projectId === projectId),
    };
  }
}
