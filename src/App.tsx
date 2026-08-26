import { Brain, Code2, Folder, PanelBottomClose, PanelRightClose, PanelRightOpen, Settings, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { usePanelRef } from "react-resizable-panels";
import { preloadTerminal, TerminalPanel } from "./components/TerminalPanel";
import { TooltipIconButton } from "./components/tooltip-icon-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./components/ui/dialog";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";
import { SidebarProvider } from "./components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ProjectSidebar } from "./features/projects/ProjectSidebar";
import { BrainBaseView, EditorBaseView, ProjectsView } from "./features/projects/ProjectViews";
import { useProjects } from "./features/projects/ProjectProvider";
import { AiSettings } from "./features/ai/AiSettings";
import { ThemeColorPicker } from "./features/themes/ThemeColorPicker";
import { ThemeSettings } from "./features/themes/ThemeSettings";
import { WindowControls } from "./components/WindowControls";

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
  const [settingsTab, setSettingsTab] = useState<"general" | "providers">("providers");
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalStarted, setTerminalStarted] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
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
    const h = initialTerminalHeight();
    setTerminalHeight(h);
    mainRef.current?.style.setProperty("--terminal-height", `${h}px`);
    requestAnimationFrame(() => {
      terminalPanelRef.current?.expand();
      terminalPanelRef.current?.resize(h);
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
        ref={mainRef}
        className="app-shell"
        style={{ "--terminal-height": `${terminalHeight}px` } as CSSProperties}
      >
        <header className="app-topbar">
          <div data-tauri-drag-region className="app-topbar-drag">
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
          </div>
          <WindowControls />
        </header>

        <ResizablePanelGroup className="workspace-row" orientation="horizontal">
          <ResizablePanel id="main-workspace" className="main-workspace-panel" minSize={320} groupResizeBehavior="preserve-relative-size">
            <ResizablePanelGroup className="app-panels" orientation="vertical">
              <ResizablePanel id="workspace" minSize={180} groupResizeBehavior="preserve-relative-size">
                <div className="view-host">
                  <div className="tab-view" hidden={activeTab !== "projects"}>
                    <ProjectsView />
                  </div>
                  {activeTab === "editor" && <div className="tab-view" key="editor"><EditorBaseView /></div>}
                  {activeTab === "brain" && <div className="tab-view" key="brain"><BrainBaseView /></div>}
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
                  // Update the CSS variable directly on <main> during drag —
                  // bypasses React's render cycle so the terminal-control
                  // button (positioned with calc(var(--terminal-height) + 12px))
                  // tracks the divider in real time instead of lagging.
                  mainRef.current?.style.setProperty(
                    "--terminal-height",
                    `${Math.max(0, inPixels)}px`,
                  );
                  // Keep `terminalOpen` in sync (boolean — cheap to re-render).
                  const isOpen = inPixels > 1;
                  if (isOpen !== terminalOpen) setTerminalOpen(isOpen);
                  // Persist size on every drag tick — localStorage writes are
                  // synchronous disk IO but don't trigger React re-renders, so
                  // there's no visible cost during the drag itself.
                  if (inPixels >= 90) {
                    localStorage.setItem(
                      "star.terminal-height",
                      String(Math.round(inPixels)),
                    );
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
              className="floating-control terminal-control"
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
          className="floating-control settings-control"
          onClick={() => setSettingsOpen(true)}
          side="right"
          size="icon"
          tooltip="Settings"
          variant="outline"
        >
          <Settings />
        </TooltipIconButton>
        <div className="theme-switcher-control">
          <ThemeColorPicker className="floating-control" />
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="grid h-[min(900px,calc(100vh-1rem))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-0 bg-background p-0 shadow-none ring-0 sm:max-w-[min(1280px,calc(100vw-2rem))]">
            <DialogHeader className="sr-only">
              <DialogTitle>Workspace settings</DialogTitle>
              <DialogDescription>Configure the workspace appearance, connect model providers, and manage coding agents.</DialogDescription>
            </DialogHeader>
            <Tabs
              value={settingsTab}
              onValueChange={(value) => setSettingsTab(value as "general" | "providers")}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex shrink-0 flex-col bg-background px-7 pt-5">
                <TabsList variant="line" className="w-fit justify-start gap-4">
                  <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                  <TabsTrigger value="providers" className="text-xs">Providers</TabsTrigger>
                </TabsList>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
                <TabsContent
                  value="providers"
                  className="ai-settings-panel flex min-h-0 flex-1 flex-col"
                >
                  <AiSettings />
                </TabsContent>
                <TabsContent
                  value="general"
                  className="ai-settings-panel flex min-h-0 flex-1 flex-col"
                >
                  <ThemeSettings />
                </TabsContent>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  );
}
