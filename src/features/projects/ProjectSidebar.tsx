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
import { useProjects } from "./ProjectProvider";
import type { ProjectThread } from "./types";

type ProjectSidebarProps = {
  onOpenProject(): void;
};

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
                {threads.map((thread) => (
                  <SidebarMenuItem
                    key={thread.id}
                    data-current={selectedThread?.id === thread.id}
                  >
                    <SidebarMenuButton
                      isActive={selectedThread?.id === thread.id}
                      onClick={() => {
                        selectThread(thread.id);
                        onOpenProject();
                      }}
                      tooltip={thread.title}
                    >
                      <span>{thread.title}</span>
                    </SidebarMenuButton>
                    <ThreadActions thread={thread} />
                  </SidebarMenuItem>
                ))}
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
