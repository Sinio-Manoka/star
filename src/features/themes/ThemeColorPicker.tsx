import { Check, Palette } from "lucide-react";
import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { listAllThemes, useThemeStore } from "./themeStore";
import type { ThemeDefinition } from "./types";

function ThemeSwatch({ theme, active }: { theme: ThemeDefinition; active: boolean }) {
  const swatches = theme.swatches ?? ["#888", "#888", "#888", "#888", "#888"];
  return (
    <button
      type="button"
      aria-label={`Apply ${theme.label}`}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        useThemeStore.getState().setThemeId(theme.id);
      }}
      className={
        "group/swatch relative flex h-12 w-full cursor-pointer overflow-hidden border outline-none transition-all " +
        (active
          ? "border-foreground ring-foreground/40 ring-2"
          : "border-border/60 hover:border-foreground/60 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/40")
      }
      title={theme.label}
    >
      <span aria-hidden className="flex h-full w-full">
        {swatches.map((color, index) => (
          <span
            key={`${theme.id}-${index}`}
            className="h-full flex-1"
            style={{ background: color }}
          />
        ))}
      </span>
      {active && (
        <span
          aria-hidden
          className="bg-background text-foreground absolute right-1 top-1 grid h-4 w-4 place-items-center"
        >
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}

/**
 * Quick theme picker for the topbar. Each theme is presented as a row of
 * color swatches — click one and the whole UI recolors instantly. No
 * light/dark toggle, no mode picker: pick the palette you want.
 */
export function ThemeColorPicker() {
  const themeId = useThemeStore((state) => state.themeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const themes = useMemo(() => listAllThemes(customThemes), [customThemes]);
  const active = themes.find((theme) => theme.id === themeId);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <TooltipIconButton
            aria-label={`Theme: ${active?.label ?? "Choose"}`}
            tooltip={`Theme: ${active?.label ?? "Choose"}`}
            side="bottom"
            variant="outline"
          />
        }
      >
        <Palette />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-72 p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide">Theme</span>
          <span className="text-muted-foreground text-xs">{active?.label ?? "Choose"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {themes.map((theme) => (
            <ThemeSwatch key={theme.id} theme={theme} active={theme.id === themeId} />
          ))}
        </div>
        <div className="text-muted-foreground mt-2 text-[10px] uppercase tracking-wide">
          {themes.length} themes · pick a palette
        </div>
      </PopoverContent>
    </Popover>
  );
}