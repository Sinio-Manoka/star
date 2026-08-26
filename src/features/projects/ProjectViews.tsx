import { Folder, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ProjectAssistant } from "./ProjectAssistant";
import { useProjects } from "./ProjectProvider";

type AssistantSession = {
  projectId: string;
  projectName: string;
  projectPath: string;
  threadId: string;
  threadTitle: string;
};

export function ProjectsView() {
  const { projects, selectedProject, selectedThread, loading, error, addProject, createThread, loadThreadMessages, saveThreadMessages, renameThread } = useProjects();
  const initializingProject = useRef<string | undefined>(undefined);
  const [sessions, setSessions] = useState<AssistantSession[]>([]);

  useEffect(() => {
    if (!loading && selectedProject && !selectedThread && initializingProject.current !== selectedProject.id) {
      initializingProject.current = selectedProject.id;
      void createThread();
    }
  }, [createThread, loading, selectedProject, selectedThread]);

  useEffect(() => {
    if (!selectedProject || !selectedThread) return;
    const nextSession: AssistantSession = {
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      projectPath: selectedProject.rootPath,
      threadId: selectedThread.id,
      threadTitle: selectedThread.title,
    };
    setSessions((current) => {
      const existing = current.findIndex((session) => session.threadId === selectedThread.id);
      if (existing === -1) return [...current, nextSession];
      const next = [...current];
      next[existing] = nextSession;
      return next;
    });
  }, [selectedProject, selectedThread]);

  if (loading) return <section className="project-empty"><p>Loading projects…</p></section>;

  if (projects.length === 0) {
    return (
      <section className="project-empty" aria-label="Projects">
        <div className="project-empty-icon"><Folder size={15} /></div>
        <h1>Open your first project</h1>
        <p>Choose a folder, then start chatting in its context.</p>
        <button className="primary-action" onClick={() => void addProject()}><Plus size={14} /> Add project</button>
        {error && <p className="error-copy">{error}</p>}
      </section>
    );
  }

  return (
    <section className="project-chat" aria-label={`${selectedProject?.name ?? "Project"} chat`}>
      {sessions.map((session) => {
        const active = selectedProject?.id === session.projectId && selectedThread?.id === session.threadId;
        return (
          <div
            aria-hidden={!active}
            className={cn("h-full min-h-0", !active && "hidden")}
            key={`${session.projectId}:${session.threadId}`}
          >
            <ProjectAssistant
              projectName={session.projectName}
              projectPath={session.projectPath}
              threadId={session.threadId}
              threadTitle={session.threadTitle}
              loadMessages={loadThreadMessages}
              saveMessages={saveThreadMessages}
              renameThread={renameThread}
            />
          </div>
        );
      })}
      {error && <p className="workspace-error error-copy">{error}</p>}
    </section>
  );
}

export function EditorBaseView() {
  const { selectedProject } = useProjects();
  return <section className="base-view quiet-view"><p>{selectedProject ? selectedProject.name : "Select a project first."}</p></section>;
}

export function BrainBaseView() {
  const { selectedProject } = useProjects();
  return <section className="base-view quiet-view"><p>{selectedProject ? `${selectedProject.name} memory` : "Select a project first."}</p></section>;
}
