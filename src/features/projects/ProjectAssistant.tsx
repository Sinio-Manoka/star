import {
  AssistantRuntimeProvider,
  WebSpeechDictationAdapter,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { useEffect, useMemo, useRef } from "react";
import { Thread } from "@/components/thread";
import { ComposerProjectPicker } from "./ComposerProjectPicker";

type ProjectAssistantProps = {
  projectName: string;
  threadId?: string;
  createThread(): Promise<void>;
};

export function ProjectAssistant({ projectName, threadId, createThread }: ProjectAssistantProps) {
  const hasProjectThread = useRef(Boolean(threadId));

  useEffect(() => {
    if (threadId) hasProjectThread.current = true;
  }, [threadId]);

  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async run({ abortSignal }) {
      if (!hasProjectThread.current) {
        hasProjectThread.current = true;
        try {
          await createThread();
        } catch (error) {
          hasProjectThread.current = false;
          throw error;
        }
      }

      if (abortSignal.aborted) return { content: [] };

      return {
        content: [{
          type: "text",
          text: `The assistant interface is ready for **${projectName}**. Connect your model to the project runtime to begin generating AI responses.`,
        }],
      };
    },
  }), [createThread, projectName]);

  const dictationAdapter = useMemo(() => new WebSpeechDictationAdapter({
    continuous: true,
    interimResults: true,
  }), []);

  const runtime = useLocalRuntime(modelAdapter, {
    adapters: { dictation: dictationAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread projectPicker={<ComposerProjectPicker />} />
    </AssistantRuntimeProvider>
  );
}
