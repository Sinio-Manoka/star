import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { builtInThemes, isBuiltInTheme } from "./catalog";
import { makeThemeId, type ThemeDefinition, type ThemeMode } from "./types";

const STORAGE_KEY = "star.theme";

/**
 * Build a unique theme id for a custom theme family + mode. Falls back to
 * a numeric suffix when collisions occur (e.g. user re-imports the same
 * theme twice).
 */
function customThemeId(family: string, mode: ThemeMode, used: Set<string>): string {
  const base = makeThemeId(family, mode);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${family}-${mode}-${counter}`)) counter++;
  return `${family}-${mode}-${counter}`;
}

export interface ThemeStoreState {
  /** Id of the active theme. Each theme is a complete palette. */
  themeId: string;
  /** User-authored themes, layered on top of the built-in catalog. */
  customThemes: ThemeDefinition[];

  setThemeId: (themeId: string) => void;
  addCustomTheme: (input: {
    family: string;
    mode: ThemeMode;
    label?: string;
    css: string;
    swatches?: string[];
  }) => ThemeDefinition;
  removeCustomTheme: (themeId: string) => void;
}

function sanitizeCustomThemes(themes: ThemeDefinition[]): ThemeDefinition[] {
  const seen = new Set<string>();
  return themes
    .filter((theme) => theme?.id && theme?.family && (theme.mode === "light" || theme.mode === "dark"))
    .filter((theme) => {
      if (seen.has(theme.id)) return false;
      seen.add(theme.id);
      return true;
    });
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      themeId: "catppuccin-mocha",
      customThemes: [],

      setThemeId: (themeId) => set({ themeId }),

      addCustomTheme: ({ family, mode, label, css, swatches }) => {
        const used = new Set<string>([
          ...builtInThemes.map((theme) => theme.id),
          ...get().customThemes.map((theme) => theme.id),
        ]);
        const id = customThemeId(family, mode, used);
        const theme: ThemeDefinition = {
          id,
          family,
          mode,
          label: label?.trim() || `${family} ${mode}`,
          css,
          swatches,
          custom: true,
        };
        set((state) => ({ customThemes: [...state.customThemes, theme] }));
        return theme;
      },

      removeCustomTheme: (themeId) => {
        if (isBuiltInTheme(themeId)) return;
        set((state) => ({
          customThemes: state.customThemes.filter((theme) => theme.id !== themeId),
          themeId: state.themeId === themeId ? "catppuccin-mocha" : state.themeId,
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({
        themeId: state.themeId,
        customThemes: state.customThemes,
      }),
      migrate: (persisted, _version) => {
        // v1 stored a `preference` and a `themeId` like `default-light` or
        // `default-dark`. The v2 schema drops `preference` entirely — each
        // theme is now self-contained — and renames the default to one of
        // the popular Catppuccin variants.
        const state = (persisted ?? {}) as Partial<ThemeStoreState> & {
          preference?: unknown;
        };
        const legacyThemeId = typeof state.themeId === "string" ? state.themeId : undefined;
        const migrated: Partial<ThemeStoreState> = {
          themeId: legacyThemeId && (legacyThemeId.includes("-") || builtInThemes.some((t) => t.id === legacyThemeId))
            ? legacyThemeId
            : "catppuccin-mocha",
          customThemes: state.customThemes ?? [],
        };
        return migrated as ThemeStoreState;
      },
      merge: (persisted, current) => {
        const persistedState = (persisted ?? {}) as Partial<ThemeStoreState>;
        const customThemes = sanitizeCustomThemes(persistedState.customThemes ?? []);
        const themeId =
          persistedState.themeId && (isBuiltInTheme(persistedState.themeId) || customThemes.some((t) => t.id === persistedState.themeId))
            ? persistedState.themeId
            : current.themeId;
        return {
          ...current,
          ...persistedState,
          customThemes,
          themeId,
        };
      },
    },
  ),
);

/**
 * All themes available to the picker, with built-ins first and then custom
 * themes sorted by family + mode for a stable order.
 */
export function listAllThemes(customThemes: ThemeDefinition[]): ThemeDefinition[] {
  const orderedCustom = [...customThemes].sort((a, b) => {
    if (a.family === b.family) return a.mode === b.mode ? 0 : a.mode < b.mode ? -1 : 1;
    return a.family.localeCompare(b.family);
  });
  return [...builtInThemes, ...orderedCustom];
}

export function findTheme(
  themeId: string,
  customThemes: ThemeDefinition[],
): ThemeDefinition | undefined {
  return (
    builtInThemes.find((theme) => theme.id === themeId) ??
    customThemes.find((theme) => theme.id === themeId)
  );
}