"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/attachment";
import { File } from "@/components/file";
import { ThreadFollowupSuggestions } from "@/components/follow-up-suggestions";
import { Image } from "@/components/image";
import { MarkdownText } from "@/components/markdown-text";
import { MessageTiming } from "@/components/message-timing";
import {
  ComposerQuotePreview,
  QuoteBlock,
  SelectionToolbar,
} from "@/components/quote";
import { Sources } from "@/components/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/reasoning";
import { PendingToolApprovalDock, ToolFallback } from "@/components/tool-fallback";
import { ComposerTriggerPopover } from "@/components/composer-trigger-popover";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/tool-group";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type ToolCallMessagePartComponent,
  type Unstable_TriggerItem,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BrainIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileSearchIcon,
  HammerIcon,
  ListChecksIcon,
  MessageSquarePlusIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchCodeIcon,
  ShieldCheckIcon,
  SquareIcon,
  TestTube2Icon,
  WandSparklesIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { setAgentConfig } from "@/features/ai/agent-config";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  threadId?: string;
  projectPicker?: ReactNode;
  modelPicker?: ReactNode;
  agentControls?: ReactNode;
  onNewSession?: () => void;
  onCompactSession?: () => void;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className="animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]"
  >
    <span className="sr-only">Loading conversation</span>
    <Skeleton className="ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
    </div>
    <Skeleton className="ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-10/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  threadId,
  projectPicker,
  modelPicker,
  agentControls,
  onNewSession,
  onCompactSession,
}) => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} threadId={threadId} projectPicker={projectPicker} modelPicker={modelPicker} agentControls={agentControls} onNewSession={onNewSession} onCompactSession={onCompactSession} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean; threadId?: string; projectPicker?: ReactNode; modelPicker?: ReactNode; agentControls?: ReactNode; onNewSession?: () => void; onCompactSession?: () => void }> = ({
  isEmpty,
  threadId,
  projectPicker,
  modelPicker,
  agentControls,
  onNewSession,
  onCompactSession,
}) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "40rem",
        ["--composer-bg" as string]: "var(--color-card)",
        ["--composer-radius" as string]: "0.75rem",
        ["--composer-padding" as string]: "12px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="bottom"
        autoScroll
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            isEmpty && "justify-center",
          )}
        >
          <AuiIf condition={isNewChatView}>
            <Welcome />
          </AuiIf>
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-14 flex flex-col gap-y-6 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty &&
                "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
            )}
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <PendingToolApprovalDock threadId={threadId} />
            <Composer threadId={threadId} projectPicker={projectPicker} modelPicker={modelPicker} agentControls={agentControls} onNewSession={onNewSession} onCompactSession={onCompactSession} />
            <AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
              <ThreadSuggestions />
            </AuiIf>
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
      <SelectionToolbar />
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } =
    useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessageComponent />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom render={<TooltipIconButton tooltip="Scroll to bottom" variant="outline" className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible" />}><ArrowDownIcon /></ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mb-8 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-3xl font-semibold tracking-tight duration-200">
        How can I help you today?
      </h1>
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions flex w-full flex-wrap items-center justify-center gap-2 px-4">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send render={<Button variant="ghost" className="aui-thread-welcome-suggestion text-foreground hover:bg-muted border-border/60 h-auto gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors" />}><SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1" /><SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 empty:hidden" /></SuggestionPrimitive.Trigger>
    </div>
  );
};

const COMMAND_ICONS = {
  work: WandSparklesIcon,
  mode: HammerIcon,
  permissions: ShieldCheckIcon,
  session: MessageSquarePlusIcon,
  thinking: BrainIcon,
  review: FileSearchIcon,
  explain: SearchCodeIcon,
  plan: ListChecksIcon,
  fix: WandSparklesIcon,
  test: TestTube2Icon,
  build: HammerIcon,
  new: MessageSquarePlusIcon,
};

type SlashCommand = {
  id: string;
  category: "work" | "mode" | "permissions" | "session" | "thinking";
  label: string;
  description: string;
  icon: keyof typeof COMMAND_ICONS;
  execute: () => void;
};

const SlashCommands: FC<{ threadId?: string; onNewSession?: () => void; onCompactSession?: () => void }> = ({ threadId, onNewSession, onCompactSession }) => {
  const aui = useAui();
  const commands = useMemo<readonly SlashCommand[]>(() => {
    const run = (prompt: string) => {
      queueMicrotask(() => {
        aui.composer.setText(prompt);
        aui.composer.send();
      });
    };
    const configure = (patch: Parameters<typeof setAgentConfig>[1]) => {
      if (threadId) setAgentConfig(threadId, patch);
    };
    return [
      { id: "review", category: "work", label: "Review project", description: "Review the current project changes", icon: "review", execute: () => run("Review the current project changes. Identify important issues and suggest concrete improvements.") },
      { id: "explain", category: "work", label: "Explain code", description: "Explain the relevant code and behavior", icon: "explain", execute: () => run("Explain the relevant code and behavior for my current task in clear terms.") },
      { id: "fix", category: "work", label: "Fix issue", description: "Find and fix the current problem", icon: "fix", execute: () => run("Investigate the current problem, implement the appropriate fix, and verify it.") },
      { id: "test", category: "work", label: "Run checks", description: "Run the relevant project checks", icon: "test", execute: () => run("Run the relevant tests and checks for the current project, then fix any failures caused by the current work.") },
      { id: "mode-build", category: "mode", label: "Build", description: "Implement changes with project tools", icon: "build", execute: () => configure({ mode: "build" }) },
      { id: "mode-plan", category: "mode", label: "Plan", description: "Explore and plan without modifying files", icon: "plan", execute: () => configure({ mode: "plan" }) },
      { id: "permission-ask", category: "permissions", label: "Ask every time", description: "Approve every edit and command", icon: "permissions", execute: () => configure({ permissions: "ask" }) },
      { id: "permission-edits", category: "permissions", label: "Allow file edits", description: "Approve commands, allow project edits", icon: "permissions", execute: () => configure({ permissions: "edits" }) },
      { id: "permission-all", category: "permissions", label: "Allow everything", description: "Allow project edits and commands", icon: "permissions", execute: () => configure({ permissions: "all" }) },
      { id: "session-new", category: "session", label: "New chat", description: "Start a separate agent session", icon: "new", execute: () => onNewSession?.() },
      { id: "session-compact", category: "session", label: "Compact context", description: "Summarize this chat to reduce context", icon: "session", execute: () => onCompactSession?.() },
      { id: "thinking-low", category: "thinking", label: "Low", description: "Fast, concise reasoning", icon: "thinking", execute: () => configure({ thinkingEffort: "low" }) },
      { id: "thinking-medium", category: "thinking", label: "Medium", description: "Balanced reasoning", icon: "thinking", execute: () => configure({ thinkingEffort: "medium" }) },
      { id: "thinking-high", category: "thinking", label: "High", description: "Thorough reasoning and verification", icon: "thinking", execute: () => configure({ thinkingEffort: "high" }) },
    ];
  }, [aui, onCompactSession, onNewSession, threadId]);
  const slash = useMemo(() => {
    const toItem = (command: SlashCommand): Unstable_TriggerItem => ({ id: command.id, type: "command", label: command.label, description: command.description, metadata: { icon: command.icon } });
    const categories = [
      { id: "work", label: "Actions" },
      { id: "mode", label: "Mode" },
      { id: "permissions", label: "Permissions" },
      { id: "session", label: "Session" },
      { id: "thinking", label: "Thinking" },
    ] as const;
    return {
      adapter: {
        categories: () => categories,
        categoryItems: (categoryId: string) => commands.filter((command) => command.category === categoryId).map(toItem),
        search: (query: string) => {
          const value = query.toLowerCase();
          return commands.filter((command) => !value || `${command.label} ${command.description}`.toLowerCase().includes(value)).map(toItem);
        },
      },
      action: { onExecute: (item: Unstable_TriggerItem) => commands.find((command) => command.id === item.id)?.execute(), removeOnExecute: true },
      iconMap: COMMAND_ICONS,
    };
  }, [commands]);

  return <ComposerTriggerPopover char="/" {...slash} />;
};

const Composer: FC<{ threadId?: string; projectPicker?: ReactNode; modelPicker?: ReactNode; agentControls?: ReactNode; onNewSession?: () => void; onCompactSession?: () => void }> = ({ threadId, projectPicker, modelPicker, agentControls, onNewSession, onCompactSession }) => {
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
        <ComposerPrimitive.AttachmentDropzone render={<div data-slot="aui_composer-shell" className="border-border/60 data-[dragging=true]:border-ring focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full cursor-text flex-col gap-1 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]" />}><ComposerQuotePreview /><ComposerAttachments /><AuiIf condition={(s) => s.composer.dictation != null}>
                        <div className="aui-composer-dictation-status bg-muted text-muted-foreground flex min-h-7 items-center gap-2 rounded-lg px-2.5 text-xs" role="status" aria-live="polite">
                          <span className="relative flex size-2" aria-hidden="true">
                            <span className="bg-destructive absolute inline-flex size-full animate-ping rounded-full opacity-60" />
                            <span className="bg-destructive relative inline-flex size-2 rounded-full" />
                          </span>
                          <span className="shrink-0 text-foreground">Listening</span>
                          <ComposerPrimitive.DictationTranscript className="truncate" />
                        </div>
                      </AuiIf><ComposerPrimitive.Input
                      placeholder="Send a message..."
                      className="aui-composer-input caret-primary placeholder:text-muted-foreground/60 max-h-60 min-h-12 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none"
                      rows={1}
                      autoFocus
                      enterKeyHint="send"
                      aria-label="Message input"
                    /><ComposerAction projectPicker={projectPicker} modelPicker={modelPicker} agentControls={agentControls} /></ComposerPrimitive.AttachmentDropzone>
        <SlashCommands threadId={threadId} onNewSession={onNewSession} onCompactSession={onCompactSession} />
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
};

const ComposerAction: FC<{ projectPicker?: ReactNode; modelPicker?: ReactNode; agentControls?: ReactNode }> = ({ projectPicker, modelPicker, agentControls }) => {
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <div className="flex min-w-0 items-center gap-1.5">
        <ComposerAddAttachment />
        {projectPicker}
        {modelPicker}
        {agentControls}
      </div>
      <div className="flex items-center gap-1.5">
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate render={<TooltipIconButton tooltip="Record voice" side="bottom" type="button" variant="ghost" size="icon-xs" className="aui-composer-dictate text-muted-foreground hover:text-foreground rounded-full" aria-label="Start voice recording" />}><MicIcon className="aui-composer-dictate-icon" /></ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation render={<TooltipIconButton tooltip="Stop recording" side="bottom" type="button" variant="ghost" size="icon-xs" className="aui-composer-stop-dictation text-destructive rounded-full" aria-label="Stop voice recording" />}><SquareIcon className="aui-composer-stop-dictation-icon animate-pulse fill-current" /></ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send render={<TooltipIconButton tooltip="Send message" side="bottom" type="button" variant="default" size="icon-xs" className="aui-composer-send rounded-full" aria-label="Send message" />}><ArrowUpIcon className="aui-composer-send-icon" /></ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel render={<Button type="button" variant="default" size="icon-xs" className="aui-composer-cancel rounded-full" aria-label="Stop generating" />}><SquareIcon className="aui-composer-cancel-icon fill-current" /></ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  const {
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    ReasoningGroup,
  } = useContext(ThreadComponentsContext);

  const ACTION_BAR_PT = "pt-1.5";
  // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground px-2 leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (ReasoningGroup) {
                  return (
                    <ReasoningGroup group={part}>{children}</ReasoningGroup>
                  );
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "text":
                return <MarkdownText />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data":
                return part.dataRendererUI;
              case "file":
                return (
                  <div data-slot="aui_assistant-message-file" className="py-1">
                    <File {...part} />
                  </div>
                );
              case "image":
                return (
                  <div data-slot="aui_assistant-message-image" className="py-1">
                    <Image {...part} />
                  </div>
                );
              case "source":
                return <Sources {...part} />;
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className="animate-pulse font-sans"
                    aria-label="Assistant is working"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      <ActionBarPrimitive.Copy render={<TooltipIconButton tooltip="Copy" />}><AuiIf condition={(s) => s.message.isCopied}>
                      <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
                    </AuiIf><AuiIf condition={(s) => !s.message.isCopied}>
                      <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
                    </AuiIf></ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload render={<TooltipIconButton tooltip="Refresh" />}><RefreshCwIcon /></ActionBarPrimitive.Reload>
      <MessageTiming side="top" />
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger render={<TooltipIconButton tooltip="More" className="data-[state=open]:bg-accent" />}><MoreHorizontalIcon /></ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className="aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-xl border p-1.5"
        >
          <ActionBarPrimitive.ExportMarkdown render={<ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none" />}><DownloadIcon className="size-4" />Export as Markdown
                              </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-file" className="py-1">
    <File {...part} />
  </div>
);

const UserImagePart: ImageMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-image" className="py-1">
    <Image {...part} />
  </div>
);

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
          <MessagePrimitive.Quote>
            {(quote) => <QuoteBlock {...quote} />}
          </MessagePrimitive.Quote>
          <MessagePrimitive.Parts
            components={{ File: UserFilePart, Image: UserImagePart }}
          />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit render={<TooltipIconButton tooltip="Edit" className="aui-user-action-edit" />}><PencilIcon /></ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg)">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel render={<Button variant="ghost" size="sm" className="h-8 rounded-full px-3.5" />}>Cancel
                              </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send render={<Button size="sm" className="h-8 rounded-full px-3.5" />}>Update
                              </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous render={<TooltipIconButton tooltip="Previous" />}><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next render={<TooltipIconButton tooltip="Next" />}><ChevronRightIcon /></BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
