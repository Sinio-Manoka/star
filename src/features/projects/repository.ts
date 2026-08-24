import { isTauri } from "@tauri-apps/api/core";
import { LocalProjectRepository } from "./localProjectRepository";
import { SqliteProjectRepository } from "./sqliteProjectRepository";
import type { ProjectRepository } from "./types";

let repository: ProjectRepository | undefined;

export function getProjectRepository() {
  repository ??= isTauri() ? new SqliteProjectRepository() : new LocalProjectRepository();
  return repository;
}
