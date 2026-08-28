import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  unstable_defaultDirectiveFormatter,
} from "@assistant-ui/react";
import { FileIcon, FolderIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ComposerTriggerPopover } from "@/components/composer-trigger-popover";
import {
  PROJECT_MENTION_CATEGORIES,
  projectMentionCategoryItems,
  searchProjectMentions,
} from "./projectMentions";
import type { ProjectTreeEntry } from "./types";

const PROJECT_MENTION_ICONS = {
  file: FileIcon,
  files: FileIcon,
  folder: FolderIcon,
  folders: FolderIcon,
};

type TriggerAdapter = ComponentProps<typeof ComposerTriggerPopover>["adapter"];

export function ProjectMentionPicker({ projectPath }: { projectPath?: string }) {
  const [entries, setEntries] = useState<readonly ProjectTreeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setEntries([]);
    setError(false);
    if (!projectPath || !isTauri()) return () => { active = false; };

    setLoading(true);
    void invoke<ProjectTreeEntry[]>("scan_project", { rootPath: projectPath })
      .then((nextEntries) => {
        if (active) setEntries(nextEntries);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [projectPath]);

  const adapter = useMemo<TriggerAdapter>(() => ({
    categories: () => PROJECT_MENTION_CATEGORIES,
    categoryItems: (categoryId) => projectMentionCategoryItems(entries, categoryId),
    search: (query) => searchProjectMentions(entries, query),
  }), [entries]);

  if (!projectPath) return null;

  return (
    <ComposerTriggerPopover
      char="#"
      adapter={adapter}
      directive={{ formatter: unstable_defaultDirectiveFormatter }}
      iconMap={PROJECT_MENTION_ICONS}
      fallbackIcon={FileIcon}
      isLoading={loading}
      backLabel="Repository"
      emptyCategoriesLabel={error ? "Could not load repository" : "No repository entries"}
      emptyItemsLabel={error ? "Could not load repository" : "No matching files or folders"}
      loadingLabel="Scanning repository…"
    />
  );
}
