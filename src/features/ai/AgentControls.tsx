import { BrainIcon, HammerIcon, ListChecksIcon, Settings2Icon, ShieldCheckIcon } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  setAgentConfig,
  useAgentConfig,
  type AgentMode,
  type AgentPermissionPreset,
  type AgentThinkingEffort,
} from "./agent-config";

export function AgentControls({ threadId }: { threadId: string }) {
  const config = useAgentConfig(threadId);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tabs
        value={config.mode}
        onValueChange={(value) => setAgentConfig(threadId, { mode: value as AgentMode })}
        aria-label="Agent mode"
      >
        <TabsList variant="line">
          <TabsTrigger value="build">
            <HammerIcon data-icon="inline-start" />
            Build
          </TabsTrigger>
          <TabsTrigger value="plan">
            <ListChecksIcon data-icon="inline-start" />
            Plan
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label="Agent options" />}>
          <Settings2Icon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel>Agent options</DropdownMenuLabel>
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
          <p className="text-muted-foreground px-1.5 py-1 text-xs">Options apply to this chat.</p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
