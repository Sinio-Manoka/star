import { HammerIcon, ListChecksIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import {
  setAgentConfig,
  useAgentConfig,
} from "./agent-config";

export function AgentControls({ threadId }: { threadId: string }) {
  const config = useAgentConfig(threadId);
  const isBuild = config.mode === "build";
  const ModeIcon = isBuild ? HammerIcon : ListChecksIcon;
  const modeLabel = isBuild ? "Build" : "Plan";
  const nextModeLabel = isBuild ? "Plan" : "Build";

  return (
    <TooltipIconButton
      type="button"
      size="sm"
      tooltip={`${modeLabel} mode · switch to ${nextModeLabel}`}
      className="border-primary/30 bg-muted text-primary hover:bg-muted hover:text-primary h-7 rounded-full border px-2 text-xs font-medium"
      aria-label={`${modeLabel} mode. Switch to ${nextModeLabel} mode`}
      onClick={() => setAgentConfig(threadId, { mode: isBuild ? "plan" : "build" })}
    >
      <ModeIcon data-icon="inline-start" />
      <span>{modeLabel}</span>
    </TooltipIconButton>
  );
}
