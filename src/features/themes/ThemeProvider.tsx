import { useEffect, useMemo } from "react";
import { findTheme, useThemeStore } from "./themeStore";
import type { ThemeDefinition } from "./types";

const CUSTOM_STYLE_ID = "star-theme-custom-styles";

function ensureCustomStyleTag(): HTMLStyleElement | null {
  if (typeof document === "undefined") return null;
  let tag = document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = CUSTOM_STYLE_ID;
    document.head.appendChild(tag);
  }
  return tag;
}

function applyTheme(theme: ThemeDefinition | undefined): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme?.id ?? "default-dark";
  root.classList.toggle("dark", theme?.mode === "dark");

  const tag = ensureCustomStyleTag();
  if (!tag) return;
  tag.textContent = theme?.custom && theme.css ? theme.css : "";
}

/**
 * Side-effect-only provider. Wires the Zustand theme store to the DOM by:
 *   - setting `<html data-theme>` to the active theme id,
 *   - toggling the `.dark` class based on the theme's own mode,
 *   - injecting the active custom theme's CSS into a managed <style> tag.
 *
 * Renders its children unchanged; nothing here needs to participate in the
 * React tree.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeId = useThemeStore((state) => state.themeId);
  const customThemes = useThemeStore((state) => state.customThemes);

  const theme = useMemo(() => findTheme(themeId, customThemes), [themeId, customThemes]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return <>{children}</>;
}