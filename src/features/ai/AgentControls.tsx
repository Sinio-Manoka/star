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
  const modeLabel = isBuild ? "Build mode" : "Plan mode";
  const nextModeLabel = isBuild ? "Plan" : "Build";

  return (
    <TooltipIconButton
      type="button"
      size="icon-xs"
      tooltip={`${modeLabel} · switch to ${nextModeLabel}`}
      className="bg-muted text-primary hover:bg-muted hover:text-primary rounded-full"
      aria-label={`${modeLabel}. Switch to ${nextModeLabel} mode`}
      onClick={() => setAgentConfig(threadId, { mode: isBuild ? "plan" : "build" })}
    >
      <ModeIcon />
    </TooltipIconButton>
  );
}
