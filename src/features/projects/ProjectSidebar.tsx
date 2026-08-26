import {
  Archive,
  ArchiveRestore,
  Check,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { listAgentRuns } from "@/features/ai/api";
import { APPROVAL_STATUS_EVENT, hasPendingApproval } from "@/features/ai/approval-status";
import type { AgentRun } from "@star/agent-runtime/client";
import { useProjects } from "./ProjectProvider";
import type { ProjectThread } from "./types";

type ProjectSidebarProps = {
  onOpenProject(): void;
};

const TERMINAL_RUN_STATUSES = new Set<AgentRun["status"]>([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
]);

function seenRunKey(threadId: string) {
  return `star.agent-runtime.seen.${threadId}`;
}

function runStatusLabel(status: AgentRun["status"]) {
  return {
    queued: "Agent queued",
    running: "Agent working",
    "awaiting-approval": "Approval required",
    completed: "Agent finished",
    failed: "Agent failed",
    interrupted: "Agent was interrupted",
    cancelled: "Agent stopped",
  }[status];
}

function ThreadActions({ thread }: { thread: ProjectThread }) {
  const { renameThread, archiveThread, removeThread } = useProjects();

  const rename = () => {
    const title = window.prompt("Chat title", thread.title)?.trim();
    if (title && title !== thread.title) void renameThread(thread.id, title);
  };

  const remove = () => {
    if (window.confirm(`Delete “${thread.title}”?`)) void removeThread(thread.id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuAction showOnHover aria-label={`Manage ${thread.title}`} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={rename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void archiveThread(thread.id)}>
            {thread.status === "archived" ? <ArchiveRestore /> : <Archive />}
            {thread.status === "archived" ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={remove}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProjectSidebar({ onOpenProject }: ProjectSidebarProps) {
  const {
    projects,
    threads,
    selectedProject,
    selectedThread,
    loading,
    addProject,
    removeProject,
    selectProject,
    createThread,
    selectThread,
  } = useProjects();
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [seenRevision, setSeenRevision] = useState(0);
  const [, setApprovalRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setApprovalRevision((revision) => revision + 1);
    window.addEventListener(APPROVAL_STATUS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(APPROVAL_STATUS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setAgentRuns([]);
      return;
    }

    let active = true;
    let timeout: number | undefined;
    const refresh = async () => {
      try {
        const runs = await listAgentRuns({ projectId: selectedProject.id });
        if (active) setAgentRuns(runs);
      } catch {
        // A sidecar restart should not remove the last known run indicators.
      } finally {
        if (active) timeout = window.setTimeout(refresh, 900);
      }
    };
    void refresh();
    return () => {
      active = false;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [selectedProject]);

  const latestRunByThread = useMemo(() => {
    const latest = new Map<string, AgentRun>();
    for (const run of agentRuns) {
      if (!latest.has(run.sessionId)) latest.set(run.sessionId, run);
    }
    return latest;
  }, [agentRuns]);

  const markRunSeen = useCallback((threadId: string, run?: AgentRun) => {
    if (!run || !TERMINAL_RUN_STATUSES.has(run.status)) return;
    localStorage.setItem(seenRunKey(threadId), run.id);
    setSeenRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (!selectedThread) return;
    markRunSeen(selectedThread.id, latestRunByThread.get(selectedThread.id));
  }, [latestRunByThread, markRunSeen, selectedThread]);

  const visibleRun = useCallback((threadId: string) => {
    const run = latestRunByThread.get(threadId);
    if (!run) return undefined;
    if (!TERMINAL_RUN_STATUSES.has(run.status)) return run;
    return localStorage.getItem(seenRunKey(threadId)) === run.id ? undefined : run;
  }, [latestRunByThread, seenRevision]);

  const newChat = async () => {
    await createThread();
    onOpenProject();
  };

  const removeSelectedProject = () => {
    if (!selectedProject) return;
    if (window.confirm(`Remove ${selectedProject.name} from Star? The folder itself will not be deleted.`)) {
      void removeProject(selectedProject.id);
    }
  };

  return (
    <Sidebar
      collapsible="none"
      className="project-sidebar !w-full border-0"
    >
      <SidebarHeader className="project-sidebar-header p-2">
        <SidebarGroup className="project-selector-group p-0">
          <SidebarGroupLabel>Current project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="project-picker-trigger w-full justify-between" />}>
                    <span className="min-w-0 truncate">{selectedProject?.name ?? "Choose a project"}</span>
                    <ChevronDown data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" className="project-picker-menu w-(--anchor-width)">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Projects</DropdownMenuLabel>
                      {projects.map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => {
                            void selectProject(project.id);
                            onOpenProject();
                          }}
                        >
                          <span className="truncate">{project.name}</span>
                          {selectedProject?.id === project.id && <Check className="ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => void addProject()}>
                        <Plus />
                        Add project
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    {selectedProject && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem variant="destructive" onClick={removeSelectedProject}>
                            <Trash2 />
                            Remove project
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        {selectedProject && (
          <SidebarGroup className="conversation-group">
            <SidebarGroupLabel>Conversations</SidebarGroupLabel>
            <SidebarGroupAction
              className="conversation-new-action"
              onClick={() => void newChat()}
              aria-label="New chat"
            >
              <Plus />
              <span className="sr-only">New chat</span>
            </SidebarGroupAction>
            <SidebarGroupContent className="conversation-list-content">
              <SidebarMenu className="project-chat-list">
                {loading && (
                  <>
                    <SidebarMenuSkeleton showIcon />
                    <SidebarMenuSkeleton showIcon />
                  </>
                )}
                {threads.map((thread) => {
                  const run = visibleRun(thread.id);
                  const runStatus = hasPendingApproval(thread.id) ? "awaiting-approval" : run?.status;
                  return (
                    <SidebarMenuItem
                      key={thread.id}
                      data-current={selectedThread?.id === thread.id}
                      data-run-status={runStatus}
                      title={runStatus ? runStatusLabel(runStatus) : undefined}
                    >
                      <SidebarMenuButton
                        isActive={selectedThread?.id === thread.id}
                        onClick={() => {
                          markRunSeen(thread.id, latestRunByThread.get(thread.id));
                          selectThread(thread.id);
                          onOpenProject();
                        }}
                        tooltip={thread.title}
                      >
                        <span>{thread.title}</span>
                      </SidebarMenuButton>
                      {runStatus && <span className="sr-only" role="status">{runStatusLabel(runStatus)}</span>}
                      <ThreadActions thread={thread} />
                    </SidebarMenuItem>
                  );
                })}
                {!loading && threads.length === 0 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => void newChat()}>
                      <span>Start a chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
