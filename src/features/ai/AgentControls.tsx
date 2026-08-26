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

  return (
    <TooltipIconButton
      type="button"
      size="icon-sm"
      tooltip={modeLabel}
      aria-label={`${modeLabel}. Switch to ${isBuild ? "Plan" : "Build"} mode`}
      onClick={() => setAgentConfig(threadId, { mode: isBuild ? "plan" : "build" })}
    >
      <ModeIcon />
    </TooltipIconButton>
  );
}
