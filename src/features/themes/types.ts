/**
 * Theme system types and helpers.
 *
 * A `themeId` is the unique identifier of a single, self-contained palette —
 * e.g. `default-dark`, `ayu-dark`, `catppuccin-mocha`, or a user-imported
 * `midnight-aurora`. Each theme owns its colors; there is no separate
 * light/dark mode toggle. Built-in families are registered in
 * `catalog.ts`; user-defined families are stored in the Zustand theme store.
 */

export type ThemeMode = "light" | "dark";

/**
 * Shape of a theme entry. Built-in themes don't ship CSS — the static
 * files under `src/themes/` define their token block. Custom themes
 * include raw CSS that the ThemeProvider injects at runtime so users can
 * re-skin the IDE without rebuilding.
 */
export interface ThemeDefinition {
  id: string;
  family: string;
  mode: ThemeMode;
  label: string;
  description?: string;
  /** Required for custom themes; ignored for built-ins. */
  css?: string;
  /** True for themes authored by the user. */
  custom?: boolean;
  /**
   * Up to five hex colors used to render the swatch in the picker. Optional
   * for custom themes; the picker falls back to the active CSS variables.
   */
  swatches?: string[];
}

export function splitThemeId(themeId: string): { family: string; mode: ThemeMode } | null {
  const idx = themeId.lastIndexOf("-");
  if (idx <= 0) return null;
  const family = themeId.slice(0, idx);
  const mode = themeId.slice(idx + 1);
  if (mode !== "light" && mode !== "dark") return null;
  return { family, mode };
}

export function makeThemeId(family: string, mode: ThemeMode): string {
  return `${family}-${mode}`;
}