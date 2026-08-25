import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjects } from "./ProjectProvider";

export function ComposerProjectPicker() {
  const { projects, selectedProject, selectProject, addProject } = useProjects();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="composer-project-picker h-9 max-w-48 gap-1.5 rounded-full px-3.5 text-sm"
            aria-label={`Current project: ${selectedProject?.name ?? "None"}`}
          />
        }
      >
        <Folder data-icon="inline-start" />
        <span className="truncate">{selectedProject?.name ?? "Select project"}</span>
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Message project</DropdownMenuLabel>
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => void selectProject(project.id)}
            >
              <Folder />
              <span className="truncate">{project.name}</span>
              {selectedProject?.id === project.id && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void addProject()}>
            <Plus />
            Add project
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
