import {
  AssistantRuntimeProvider,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { createAgentSessionStorage } from "@star/agent-runtime/client";
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Thread } from "@/components/thread";
import {
  generateConversationTitle,
  getAiSelection,
  requestAiRuntime,
} from "@/features/ai/api";
import { ComposerModelPicker } from "@/features/ai/ComposerModelPicker";

type ProjectAssistantProps = {
  projectId: string;
  projectName: string;
  projectPath: string;
  threadId?: string;
  threadTitle?: string;
  loadMessages(threadId: string): Promise<unknown[]>;
  saveMessages(threadId: string, messages: unknown[]): Promise<void>;
  renameThread(threadId: string, title: string): Promise<void>;
};

type ProjectAssistantRuntimeProps = ProjectAssistantProps & {
  initialMessages: UIMessage[];
};

function conversationTitleContext(messages: UIMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .slice(-6)
    .map((message) => message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join(" ").trim())
    .filter(Boolean)
    .join("\n");
}

function ProjectAssistantRuntime({
  projectId,
  projectName,
  projectPath,
  threadId,
  threadTitle,
  initialMessages,
  saveMessages,
  renameThread,
}: ProjectAssistantRuntimeProps) {
  const messageSaveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const titleQueue = useRef<Promise<unknown>>(Promise.resolve());
  const currentTitle = useRef(threadTitle ?? "New chat");
  const lastTitledUserMessageId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (threadTitle) currentTitle.current = threadTitle;
  }, [threadTitle]);

  const resumableStorage = useMemo(
    () => createAgentSessionStorage(threadId ?? `draft:${projectPath}`),
    [projectPath, threadId],
  );

  const transport = useMemo(() => new AssistantChatTransport({
    api: "http://127.0.0.1/pending/chat",
    resumable: {
      storage: resumableStorage,
      resumeApi: (runId) => `http://127.0.0.1/pending/runs/${encodeURIComponent(runId)}/stream`,
    },
    body: () => {
      const selection = getAiSelection(projectPath);
      return {
        projectName,
        projectId,
        projectPath,
        conversationId: threadId ?? `draft:${projectPath}`,
        connectionId: selection?.connectionId,
        modelId: selection?.modelId,
      };
    },
    fetch: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const pathname = url.pathname.startsWith("/pending/")
        ? url.pathname.slice("/pending".length)
        : url.pathname;
      const response = await requestAiRuntime(`${pathname}${url.search}`, init);
      const runId = response.headers.get("x-resumable-stream-id");
      if (runId && init?.signal) {
        const cancelRun = () => {
          if (resumableStorage.getStreamId() !== runId) return;
          void requestAiRuntime(`/runs/${encodeURIComponent(runId)}/cancel`, {
            method: "POST",
          }).catch(() => undefined);
        };
        init.signal.addEventListener("abort", cancelRun, { once: true });
      }
      return response;
    },
  }), [projectId, projectName, projectPath, resumableStorage, threadId]);

  const dictationAdapter = useMemo(() => new WebSpeechDictationAdapter({
    continuous: true,
    interimResults: true,
  }), []);

  const runtime = useChatRuntime({
    messages: initialMessages,
    transport,
    onFinish: ({ messages }) => {
      if (!threadId) return;
      const snapshot = structuredClone(messages);
      messageSaveQueue.current = messageSaveQueue.current
        .catch(() => undefined)
        .then(() => saveMessages(threadId, snapshot));

      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const prompt = conversationTitleContext(messages);
      if (lastUserMessage && lastTitledUserMessageId.current !== lastUserMessage.id && prompt) {
        lastTitledUserMessageId.current = lastUserMessage.id;
        const selection = getAiSelection(projectPath);
        titleQueue.current = titleQueue.current
          .catch(() => undefined)
          .then(async () => {
            const title = await generateConversationTitle({
              prompt,
              currentTitle: currentTitle.current,
              connectionId: selection?.connectionId,
              modelId: selection?.modelId,
            });
            if (title !== currentTitle.current) {
              await renameThread(threadId, title);
              currentTitle.current = title;
            }
          })
          .catch(() => undefined);
      }
    },
    sendAutomaticallyWhen: async ({ messages }) => {
      if (!lastAssistantMessageIsCompleteWithApprovalResponses({ messages })) return false;
      if (!threadId) return true;

      // An approved tool may edit this app's own watched files and trigger HMR
      // before the continuation finishes. Persist the approval response first
      // so a reload can never restore the unresolved approval and ask again.
      const snapshot = structuredClone(messages);
      messageSaveQueue.current = messageSaveQueue.current
        .catch(() => undefined)
        .then(() => saveMessages(threadId, snapshot));
      await messageSaveQueue.current;
      return true;
    },
    adapters: { dictation: dictationAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        threadId={threadId}
        modelPicker={<ComposerModelPicker projectPath={projectPath} />}
      />
    </AssistantRuntimeProvider>
  );
}

export function ProjectAssistant(props: ProjectAssistantProps) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>();

  useEffect(() => {
    let current = true;
    setInitialMessages(undefined);
    if (!props.threadId) {
      setInitialMessages([]);
      return () => { current = false; };
    }

    void props.loadMessages(props.threadId)
      .then((messages) => {
        if (current) setInitialMessages(messages as UIMessage[]);
      })
      .catch(() => {
        if (current) setInitialMessages([]);
      });
    return () => { current = false; };
  }, [props.loadMessages, props.threadId]);

  if (initialMessages === undefined) {
    return <div className="project-chat-loading" aria-label="Loading conversation" />;
  }

  return <ProjectAssistantRuntime {...props} initialMessages={initialMessages} />;
}
