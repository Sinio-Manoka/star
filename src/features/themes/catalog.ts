import type { ThemeDefinition } from "./types";

/**
 * Built-in themes shipped with the app. Each entry is a self-contained
 * palette — pick one, no light/dark toggle. The static CSS files under
 * `src/themes/` define the token block, keyed on `[data-theme="<id>"]`.
 *
 * To add a new built-in theme:
 *   1. Drop a CSS file in `src/themes/` keyed on `[data-theme="<id>"]`.
 *   2. Import it from `src/styles.css`.
 *   3. Append an entry here with the matching `id` and 4–5 swatch colors.
 */
export const builtInThemes: ThemeDefinition[] = [
  // ---- Ayu ----
  {
    id: "ayu-light",
    family: "ayu",
    mode: "light",
    label: "Ayu Light",
    swatches: ["#fcfcfc", "#f29718", "#22a4e6", "#86b300", "#e65050"],
  },
  {
    id: "ayu-dark",
    family: "ayu",
    mode: "dark",
    label: "Ayu Dark",
    swatches: ["#10141c", "#e6b450", "#59c2ff", "#aad94c", "#f07178"],
  },
  {
    id: "ayu-mirage",
    family: "ayu",
    mode: "dark",
    label: "Ayu Mirage",
    swatches: ["#242936", "#ffcc66", "#73d0ff", "#d5ff80", "#ff6666"],
  },

  // ---- Catppuccin ----
  {
    id: "catppuccin-mocha",
    family: "catppuccin",
    mode: "dark",
    label: "Catppuccin Mocha",
    swatches: ["#1e1e2e", "#89b4fa", "#cba6f7", "#a6e3a1", "#f9e2af"],
  },
  {
    id: "catppuccin-macchiato",
    family: "catppuccin",
    mode: "dark",
    label: "Catppuccin Macchiato",
    swatches: ["#24273a", "#8aadf4", "#c6a0f6", "#a6da95", "#eed49f"],
  },
  {
    id: "catppuccin-frappe",
    family: "catppuccin",
    mode: "dark",
    label: "Catppuccin Frappé",
    swatches: ["#303446", "#8caaee", "#ca9ee6", "#a6d189", "#e5c890"],
  },
  {
    id: "catppuccin-latte",
    family: "catppuccin",
    mode: "light",
    label: "Catppuccin Latte",
    swatches: ["#eff1f5", "#1e66f5", "#8839ef", "#40a02b", "#df8e1d"],
  },

  // ---- Midnight ----
  {
    id: "midnight-dark",
    family: "midnight",
    mode: "dark",
    label: "Midnight",
    swatches: ["#1d2738", "#5fb9ff", "#9d7cd8", "#7fd962", "#f7768e"],
  },
  {
    id: "midnight-light",
    family: "midnight",
    mode: "light",
    label: "Midmist",
    swatches: ["#eef2fa", "#3a5fcd", "#7c5fd8", "#3d8b5c", "#cc4f6e"],
  },

  // ---- Solar ----
  {
    id: "solar-dark",
    family: "solar",
    mode: "dark",
    label: "Solar",
    swatches: ["#1a1a1a", "#f6a96b", "#d8a657", "#82c272", "#c45a4f"],
  },
  {
    id: "solar-light",
    family: "solar",
    mode: "light",
    label: "Sol",
    swatches: ["#fdf6e3", "#cb4b16", "#b58900", "#859900", "#dc322f"],
  },

  // ---- Default ----
  {
    id: "default-light",
    family: "default",
    mode: "light",
    label: "Daylight",
    swatches: ["#ffffff", "#171717", "#f5f5f5", "#262626", "#dc2626"],
  },
  {
    id: "default-dark",
    family: "default",
    mode: "dark",
    label: "Midnight Ink",
    swatches: ["#0b0b0d", "#e5e5e5", "#1d1d21", "#f5f5f5", "#f87171"],
  },
];

export const builtInThemeIds = new Set(builtInThemes.map((theme) => theme.id));

export function isBuiltInTheme(themeId: string): boolean {
  return builtInThemeIds.has(themeId);
}