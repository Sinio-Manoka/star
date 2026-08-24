import { Folder, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { ProjectAssistant } from "./ProjectAssistant";
import { useProjects } from "./ProjectProvider";

export function ProjectsView() {
  const { projects, selectedProject, selectedThread, loading, error, addProject, createThread } = useProjects();
  const initializingProject = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!loading && selectedProject && !selectedThread && initializingProject.current !== selectedProject.id) {
      initializingProject.current = selectedProject.id;
      void createThread();
    }
  }, [createThread, loading, selectedProject, selectedThread]);

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
      {selectedProject && (
        <ProjectAssistant
          key={`${selectedProject.id}:${selectedThread?.id ?? "draft"}`}
          projectName={selectedProject.name}
          projectPath={selectedProject.rootPath}
          threadId={selectedThread?.id}
        />
      )}
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
