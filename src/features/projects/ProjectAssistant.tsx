import {
  AssistantRuntimeProvider,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { useMemo } from "react";
import { Thread } from "@/components/thread";
import { getAiRuntime, getAiSelection } from "@/features/ai/api";
import { ComposerModelPicker } from "@/features/ai/ComposerModelPicker";
import { ComposerProjectPicker } from "./ComposerProjectPicker";

type ProjectAssistantProps = {
  projectName: string;
  projectPath: string;
  threadId?: string;
};

export function ProjectAssistant({ projectName, projectPath, threadId }: ProjectAssistantProps) {
  const transport = useMemo(() => new AssistantChatTransport({
    api: "http://127.0.0.1/pending/chat",
    body: () => {
      const selection = getAiSelection(projectPath);
      return { projectName, projectPath, conversationId: threadId ?? `draft:${projectPath}`, connectionId: selection?.connectionId, modelId: selection?.modelId };
    },
    fetch: async (_url, init) => {
      const runtimeInfo = await getAiRuntime();
      let lastError: unknown;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          return await fetch(runtimeInfo.endpoint, {
            ...init,
            headers: { ...Object.fromEntries(new Headers(init?.headers)), authorization: `Bearer ${runtimeInfo.token}` },
          });
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => window.setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
      throw lastError;
    },
  }), [projectName, projectPath, threadId]);

  const dictationAdapter = useMemo(() => new WebSpeechDictationAdapter({
    continuous: true,
    interimResults: true,
  }), []);

  const runtime = useChatRuntime({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    adapters: { dictation: dictationAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread projectPicker={<ComposerProjectPicker />} modelPicker={<ComposerModelPicker projectPath={projectPath} />} />
    </AssistantRuntimeProvider>
  );
}
