import { Brain, Code2, Folder, PanelBottomClose, PanelRightClose, PanelRightOpen, Settings, SquareTerminal } from "lucide-react";
import { useEffect, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { usePanelRef } from "react-resizable-panels";
import { preloadTerminal, TerminalPanel } from "./components/TerminalPanel";
import { TooltipIconButton } from "./components/tooltip-icon-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";
import { SidebarProvider } from "./components/ui/sidebar";
import { ProjectSidebar } from "./features/projects/ProjectSidebar";
import { BrainBaseView, EditorBaseView, ProjectsView } from "./features/projects/ProjectViews";
import { useProjects } from "./features/projects/ProjectProvider";
import { AiSettings } from "./features/ai/AiSettings";

type Tab = "projects" | "editor" | "brain";

const tabs: Array<{ id: Tab; icon: ReactNode }> = [
  { id: "projects", icon: <Folder /> },
  { id: "editor", icon: <Code2 /> },
  { id: "brain", icon: <Brain /> },
];

function initialTerminalHeight() {
  const saved = Number(localStorage.getItem("star.terminal-height"));
  return Number.isFinite(saved) && saved >= 90 ? saved : 170;
}

function initialProjectWidth() {
  const saved = Number(localStorage.getItem("star.project-rail-width"));
  return Number.isFinite(saved) && saved >= 220 ? saved : 248;
}

export default function App() {
  const { selectedProject } = useProjects();
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalStarted, setTerminalStarted] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(0);
  const terminalPanelRef = usePanelRef();
  const projectPanelRef = usePanelRef();
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    void preloadTerminal();
  }, []);

  useEffect(() => {
    if (activeTab === "projects" && projectSidebarOpen) {
      projectPanelRef.current?.expand();
      projectPanelRef.current?.resize(initialProjectWidth());
    } else {
      projectPanelRef.current?.collapse();
    }
  }, [activeTab, projectPanelRef, projectSidebarOpen]);

  const openTerminal = () => {
    setTerminalStarted(true);
    setTerminalOpen(true);
    requestAnimationFrame(() => {
      terminalPanelRef.current?.expand();
      terminalPanelRef.current?.resize(initialTerminalHeight());
    });
  };

  const closeTerminal = () => terminalPanelRef.current?.collapse();

  const trackDividerGlow = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--divider-x", `${event.clientX - bounds.left}px`);
  };

  return (
    <SidebarProvider
      defaultOpen
      className="h-full min-h-0"
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
      <main
        className="app-shell"
        style={{ "--terminal-height": `${terminalHeight}px` } as CSSProperties}
      >
        <header className="app-topbar" data-tauri-drag-region>
          <nav className="top-tabs" aria-label="Main navigation" style={{ "--active-index": activeIndex } as CSSProperties}>
            {tabs.map((tab) => {
              const label = tab.id[0].toUpperCase() + tab.id.slice(1);
              return (
                <button
                  aria-label={label}
                  aria-pressed={activeTab === tab.id}
                  className={activeTab === tab.id ? "active" : ""}
                  data-tooltip={label}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={label}
                >
                  {tab.icon}
                </button>
              );
            })}
          </nav>
        </header>

        <ResizablePanelGroup className="workspace-row" orientation="horizontal">
          <ResizablePanel id="main-workspace" className="main-workspace-panel" minSize={320} groupResizeBehavior="preserve-relative-size">
            <ResizablePanelGroup className="app-panels" orientation="vertical">
              <ResizablePanel id="workspace" minSize={180} groupResizeBehavior="preserve-relative-size">
                <div className="view-host">
                  <div className="tab-view" key={activeTab}>
                    {activeTab === "projects" && <ProjectsView />}
                    {activeTab === "editor" && <EditorBaseView />}
                    {activeTab === "brain" && <BrainBaseView />}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle
                aria-label="Resize terminal"
                className={terminalOpen ? "terminal-resizer" : "terminal-resizer is-hidden"}
                disabled={!terminalOpen}
                onPointerMove={trackDividerGlow}
              />
              <ResizablePanel
                id="terminal"
                className="terminal-panel"
                panelRef={terminalPanelRef}
                collapsible
                collapsedSize={0}
                defaultSize={0}
                minSize={90}
                maxSize="60%"
                groupResizeBehavior="preserve-pixel-size"
                onResize={({ inPixels }) => {
                  const isOpen = inPixels > 1;
                  setTerminalOpen(isOpen);
                  setTerminalHeight(Math.max(0, inPixels));
                  if (inPixels >= 90) {
                    localStorage.setItem("star.terminal-height", String(Math.round(inPixels)));
                  }
                }}
              >
                {terminalStarted && (
                  <section className={terminalOpen ? "terminal-dock is-open" : "terminal-dock"} aria-label="Terminal">
                    <TerminalPanel cwd={selectedProject?.rootPath} />
                  </section>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
            <TooltipIconButton
              aria-label={terminalOpen ? "Close terminal" : "Open terminal"}
              className="terminal-control"
              onClick={terminalOpen ? closeTerminal : openTerminal}
              onPointerEnter={() => setTerminalStarted(true)}
              side="top"
              size="icon"
              tooltip={terminalOpen ? "Close terminal" : "Open terminal"}
              variant="outline"
            >
              {terminalOpen ? <PanelBottomClose /> : <SquareTerminal />}
            </TooltipIconButton>
            {activeTab === "projects" && (
              <TooltipIconButton
                aria-label={projectSidebarOpen ? "Close project navigation" : "Open project navigation"}
                className="project-navigation-control"
                onClick={() => setProjectSidebarOpen((open) => !open)}
                side="left"
                size="icon"
                tooltip={projectSidebarOpen ? "Close chats" : "Open chats"}
                variant="outline"
              >
                {projectSidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}
              </TooltipIconButton>
            )}
          </ResizablePanel>
          <ResizableHandle
            aria-label="Resize project navigation"
            className={activeTab === "projects" && projectSidebarOpen ? "project-resizer" : "project-resizer is-hidden"}
            disabled={activeTab !== "projects" || !projectSidebarOpen}
          />
          <ResizablePanel
            id="project-navigation"
            panelRef={projectPanelRef}
            collapsible
            collapsedSize={0}
            defaultSize={initialProjectWidth()}
            minSize={220}
            maxSize="55%"
            groupResizeBehavior="preserve-pixel-size"
            onResize={({ inPixels }) => {
              if (activeTab !== "projects") return;
              const open = inPixels > 1;
              setProjectSidebarOpen(open);
              if (inPixels >= 220) {
                localStorage.setItem("star.project-rail-width", String(Math.round(inPixels)));
              }
            }}
          >
            {activeTab === "projects" && <ProjectSidebar onOpenProject={() => setActiveTab("projects")} />}
          </ResizablePanel>
        </ResizablePanelGroup>
        <TooltipIconButton
          aria-label="Settings"
          className="settings-control"
          onClick={() => setSettingsOpen(true)}
          side="right"
          size="icon"
          tooltip="Settings"
          variant="outline"
        >
          <Settings />
        </TooltipIconButton>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="grid h-[min(900px,calc(100vh-1rem))] grid-rows-[minmax(0,1fr)] overflow-hidden p-0 sm:max-w-[min(1280px,calc(100vw-2rem))]">
            <DialogHeader className="sr-only">
              <DialogTitle>AI workspace settings</DialogTitle>
              <DialogDescription>Connect model providers and coding agents, then choose a model from each project chat.</DialogDescription>
            </DialogHeader>
            <AiSettings />
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
