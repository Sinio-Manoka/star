import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProjectRepository } from "./repository";
import type { Project, ProjectThread } from "./types";

const SELECTED_PROJECT_KEY = "star.selected-project";

function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason;
  return fallback;
}

type ProjectContextValue = {
  projects: Project[];
  threads: ProjectThread[];
  selectedProject?: Project;
  selectedThread?: ProjectThread;
  loading: boolean;
  error?: string;
  addProject(): Promise<void>;
  renameProject(projectId: string, name: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  selectProject(projectId: string): Promise<void>;
  createThread(): Promise<void>;
  selectThread(threadId: string): void;
  renameThread(threadId: string, title: string): Promise<void>;
  archiveThread(threadId: string): Promise<void>;
  removeThread(threadId: string): Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

function projectName(rootPath: string) {
  const segments = rootPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? "Untitled project";
}

function selectedThreadKey(projectId: string) {
  return `star.selected-thread.${projectId}`;
}

async function pickProjectFolder() {
  if (isTauri()) {
    const selected = await open({ directory: true, multiple: false, title: "Open project" });
    return typeof selected === "string" ? selected : null;
  }
  return window.prompt("Project folder path")?.trim() || null;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(getProjectRepository, []);
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<ProjectThread[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(() => localStorage.getItem(SELECTED_PROJECT_KEY) ?? undefined);
  const [selectedThreadId, setSelectedThreadId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const loadThreads = useCallback(async (projectId: string) => {
    const nextThreads = await repository.listThreads(projectId);
    setThreads(nextThreads);
    const savedThreadId = localStorage.getItem(selectedThreadKey(projectId)) ?? undefined;
    setSelectedThreadId((current) => {
      const nextId = nextThreads.some((thread) => thread.id === current)
        ? current
        : nextThreads.some((thread) => thread.id === savedThreadId) ? savedThreadId : nextThreads[0]?.id;
      if (nextId) localStorage.setItem(selectedThreadKey(projectId), nextId);
      else localStorage.removeItem(selectedThreadKey(projectId));
      return nextId;
    });
  }, [repository]);

  useEffect(() => {
    let active = true;
    void repository.initialize().then(async () => {
      const nextProjects = await repository.listProjects();
      if (!active) return;
      setProjects(nextProjects);
      const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY) ?? undefined;
      const nextSelectedId = nextProjects.some((project) => project.id === savedProjectId)
        ? savedProjectId
        : nextProjects[0]?.id;
      setSelectedProjectId(nextSelectedId);
      if (nextSelectedId) {
        await loadThreads(nextSelectedId);
      }
    }).catch((reason: unknown) => {
      if (active) setError(errorMessage(reason, "Could not load projects"));
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadThreads, repository]);

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId);
    localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
    await repository.touchProject(projectId);
    const nextProjects = await repository.listProjects();
    setProjects(nextProjects);
    await loadThreads(projectId);
  }, [loadThreads, repository]);

  const addProject = useCallback(async () => {
    const rootPath = await pickProjectFolder();
    if (!rootPath) return;
    const project = await repository.createProject({ name: projectName(rootPath), rootPath });
    setProjects(await repository.listProjects());
    await selectProject(project.id);
  }, [repository, selectProject]);

  const renameProject = useCallback(async (projectId: string, name: string) => {
    const nextName = name.trim();
    if (!nextName) return;
    await repository.renameProject(projectId, nextName);
    const nextProjects = await repository.listProjects();
    setProjects(nextProjects);
  }, [repository]);

  const removeProject = useCallback(async (projectId: string) => {
    await repository.removeProject(projectId);
    const nextProjects = await repository.listProjects();
    setProjects(nextProjects);

    if (selectedProjectId !== projectId) return;

    const nextProject = nextProjects[0];
    setSelectedProjectId(nextProject?.id);
    setSelectedThreadId(undefined);
    if (nextProject) {
      localStorage.setItem(SELECTED_PROJECT_KEY, nextProject.id);
      await loadThreads(nextProject.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
      setThreads([]);
    }
  }, [loadThreads, repository, selectedProjectId]);

  const createThread = useCallback(async () => {
    if (!selectedProjectId) return;
    const title = threads.length === 0 ? "New chat" : `New chat ${threads.length + 1}`;
    const thread = await repository.createThread(selectedProjectId, title);
    await loadThreads(selectedProjectId);
    setSelectedThreadId(thread.id);
    localStorage.setItem(selectedThreadKey(selectedProjectId), thread.id);
  }, [loadThreads, repository, selectedProjectId, threads.length]);

  const selectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    if (selectedProjectId) localStorage.setItem(selectedThreadKey(selectedProjectId), threadId);
  }, [selectedProjectId]);

  const renameThread = useCallback(async (threadId: string, title: string) => {
    const nextTitle = title.trim();
    if (!nextTitle || !selectedProjectId) return;
    await repository.renameThread(threadId, nextTitle);
    await loadThreads(selectedProjectId);
  }, [loadThreads, repository, selectedProjectId]);

  const archiveThread = useCallback(async (threadId: string) => {
    if (!selectedProjectId) return;
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) return;
    await repository.setThreadStatus(threadId, thread.status === "active" ? "archived" : "active");
    await loadThreads(selectedProjectId);
  }, [loadThreads, repository, selectedProjectId, threads]);

  const removeThread = useCallback(async (threadId: string) => {
    if (!selectedProjectId) return;
    await repository.removeThread(threadId);
    if (selectedThreadId === threadId) localStorage.removeItem(selectedThreadKey(selectedProjectId));
    await loadThreads(selectedProjectId);
  }, [loadThreads, repository, selectedProjectId, selectedThreadId]);

  const value = useMemo<ProjectContextValue>(() => ({
    projects,
    threads,
    selectedProject: projects.find((project) => project.id === selectedProjectId),
    selectedThread: threads.find((thread) => thread.id === selectedThreadId),
    loading,
    error,
    addProject,
    renameProject,
    removeProject,
    selectProject,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    removeThread,
  }), [addProject, archiveThread, createThread, error, loading, projects, removeProject, removeThread, renameProject, renameThread, selectProject, selectedProjectId, selectedThreadId, selectThread, threads]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProjects must be used inside ProjectProvider");
  return value;
}
