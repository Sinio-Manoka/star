import type { Unstable_TriggerItem } from "@assistant-ui/react";
import type { ProjectTreeEntry } from "./types";

export const PROJECT_MENTION_CATEGORIES = [
  { id: "files", label: "Files" },
  { id: "folders", label: "Folders" },
] as const;

const BROWSE_LIMIT = 200;
const SEARCH_LIMIT = 100;

export function projectMentionItem(entry: ProjectTreeEntry): Unstable_TriggerItem {
  return {
    id: entry.relativePath,
    type: entry.kind === "directory" ? "folder" : "file",
    label: entry.name,
    description: entry.relativePath,
    metadata: { icon: entry.kind === "directory" ? "folder" : "file" },
  };
}

export function projectMentionCategoryItems(
  entries: readonly ProjectTreeEntry[],
  categoryId: string,
): readonly Unstable_TriggerItem[] {
  const kind = categoryId === "folders" ? "directory" : "file";
  return entries
    .filter((entry) => entry.kind === kind)
    .slice(0, BROWSE_LIMIT)
    .map(projectMentionItem);
}

export function searchProjectMentions(
  entries: readonly ProjectTreeEntry[],
  query: string,
): readonly Unstable_TriggerItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  return entries
    .filter((entry) => !normalized || entry.relativePath.toLocaleLowerCase().includes(normalized))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
      const leftStarts = left.relativePath.toLocaleLowerCase().startsWith(normalized);
      const rightStarts = right.relativePath.toLocaleLowerCase().startsWith(normalized);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.relativePath.localeCompare(right.relativePath);
    })
    .slice(0, SEARCH_LIMIT)
    .map(projectMentionItem);
}
