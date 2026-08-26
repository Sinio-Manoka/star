import { BrainIcon, CheckIcon, HammerIcon, ListChecksIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  setAgentConfig,
  useAgentConfig,
  type AgentMode,
  type AgentPermissionPreset,
  type AgentThinkingEffort,
} from "./agent-config";

export function AgentControls({ threadId }: { threadId: string }) {
  const config = useAgentConfig(threadId);
  const ModeIcon = config.mode === "build" ? HammerIcon : ListChecksIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground h-7 gap-1.5 rounded-full px-2.5" />}>
        <ModeIcon className="size-3.5" />
        <span className="capitalize">{config.mode}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>Agent</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={config.mode} onValueChange={(value) => setAgentConfig(threadId, { mode: value as AgentMode })}>
          <DropdownMenuRadioItem value="build"><HammerIcon />Build</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="plan"><ListChecksIcon />Plan</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><BrainIcon />Thinking <span className="text-muted-foreground ml-auto mr-2 capitalize">{config.thinkingEffort}</span></DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            <DropdownMenuRadioGroup value={config.thinkingEffort} onValueChange={(value) => setAgentConfig(threadId, { thinkingEffort: value as AgentThinkingEffort })}>
              <DropdownMenuRadioItem value="low">Low</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high">High</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><ShieldCheckIcon />Permissions</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup value={config.permissions} onValueChange={(value) => setAgentConfig(threadId, { permissions: value as AgentPermissionPreset })}>
              <DropdownMenuRadioItem value="ask">Ask every time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="edits">Allow file edits</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="all">Allow everything</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <div className="text-muted-foreground flex items-center gap-1.5 px-1.5 py-1 text-[11px]">
          <CheckIcon className="size-3" /> Settings apply to this chat
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
