import { Check, Palette, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { listAllThemes, useThemeStore } from "./themeStore";
import type { ThemeDefinition, ThemeMode } from "./types";

function ThemeSwatch({ theme, active, onSelect }: { theme: ThemeDefinition; active: boolean; onSelect: () => void }) {
  const colors = theme.swatches ?? [];
  return (
    <button
      type="button"
      aria-label={`Apply ${theme.label}`}
      aria-pressed={active}
      onClick={onSelect}
      className={
        "group/swatch relative flex flex-col gap-2 border p-3 text-left transition-colors outline-none " +
        (active
          ? "border-foreground ring-foreground/30 ring-2"
          : "border-border/60 hover:border-foreground/60 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/40")
      }
    >
      <span aria-hidden className="flex h-8 w-full overflow-hidden">
        {colors.length > 0 ? (
          colors.map((color, index) => (
            <span key={`${theme.id}-${index}`} className="h-full flex-1" style={{ background: color }} />
          ))
        ) : (
          <span className="bg-muted h-full w-full" />
        )}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{theme.label}</span>
          {theme.family && (
            <span className="text-muted-foreground truncate text-[10px] uppercase tracking-wide">
              {theme.family}
            </span>
          )}
        </span>
        {active && <Check className="text-foreground size-3.5 shrink-0" />}
      </span>
    </button>
  );
}

export function ThemeSettings() {
  const themeId = useThemeStore((state) => state.themeId);
  const customThemes = useThemeStore((state) => state.customThemes);
  const setThemeId = useThemeStore((state) => state.setThemeId);
  const addCustomTheme = useThemeStore((state) => state.addCustomTheme);
  const removeCustomTheme = useThemeStore((state) => state.removeCustomTheme);

  const themes = useMemo(() => listAllThemes(customThemes), [customThemes]);
  const active = themes.find((theme) => theme.id === themeId);

  const [importOpen, setImportOpen] = useState(false);
  const [importFamily, setImportFamily] = useState("");
  const [importLabel, setImportLabel] = useState("");
  const [importMode, setImportMode] = useState<ThemeMode>("dark");
  const [importCss, setImportCss] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const openImport = (mode: ThemeMode) => {
    setImportFamily("");
    setImportLabel("");
    setImportMode(mode);
    setImportCss("");
    setImportError(null);
    setImportOpen(true);
  };

  const submitImport = () => {
    const family = importFamily.trim().toLowerCase().replace(/\s+/g, "-");
    if (!family) {
      setImportError("Family is required (e.g. midnight-aurora).");
      return;
    }
    if (!importCss.trim()) {
      setImportError("Paste a CSS block that defines the theme tokens.");
      return;
    }
    const theme = addCustomTheme({ family, mode: importMode, label: importLabel, css: importCss });
    setThemeId(theme.id);
    setImportOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-6 px-7 py-6">
          <header className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Theme</h2>
              <p className="text-muted-foreground text-sm">
                Pick a palette. The whole IDE recolors instantly.
              </p>
            </div>
            {active && (
              <span className="border-border/60 bg-muted/40 flex items-center gap-2 border px-3 py-1 text-xs">
                <Palette className="size-3.5" />
                {active.label}
              </span>
            )}
          </header>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <ThemeSwatch
                key={theme.id}
                theme={theme}
                active={theme.id === themeId}
                onSelect={() => setThemeId(theme.id)}
              />
            ))}
          </div>

          {customThemes.length > 0 && (
            <>
              <Separator />
              <FieldGroup>
                <Field>
                  <FieldLabel>Custom themes</FieldLabel>
                  <FieldDescription>
                    Themes you've imported. Remove one to clear it from this list.
                  </FieldDescription>
                  <div className="mt-2 flex flex-col gap-2">
                    {customThemes.map((theme) => (
                      <div
                        key={theme.id}
                        className="border-border/60 flex items-center justify-between gap-2 border px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="flex h-5 w-12 overflow-hidden">
                            {(theme.swatches ?? []).slice(0, 4).map((color, index) => (
                              <span
                                key={`${theme.id}-${index}`}
                                className="h-full flex-1"
                                style={{ background: color }}
                              />
                            ))}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{theme.label}</span>
                            <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                              {theme.family}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCustomTheme(theme.id)}
                          aria-label={`Remove ${theme.label}`}
                        >
                          <Trash2 />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </Field>
              </FieldGroup>
            </>
          )}

          <Separator />

          <FieldGroup>
            <Field>
              <FieldLabel>Import a custom theme</FieldLabel>
              <FieldDescription>
                Paste a CSS block keyed on{" "}
                <code className="bg-muted rounded px-1 py-0.5 text-xs">
                  [data-theme="&lt;family&gt;-&lt;mode&gt;"]
                </code>
                . The block is injected at runtime so you can iterate without rebuilding.
              </FieldDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => openImport("light")}>
                  <Plus />
                  Import light theme
                </Button>
                <Button variant="outline" onClick={() => openImport("dark")}>
                  <Plus />
                  Import dark theme
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </div>
      </ScrollArea>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {importMode} theme</DialogTitle>
            <DialogDescription>
              Provide a family id and a CSS block. The CSS is scoped to the active theme and can override any token.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="theme-family">Family</FieldLabel>
              <Input
                id="theme-family"
                value={importFamily}
                onChange={(event) => setImportFamily(event.target.value)}
                placeholder="midnight-aurora"
                autoComplete="off"
              />
              <FieldDescription>Lowercase identifier shared by the light and dark pair.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="theme-label">Display name</FieldLabel>
              <Input
                id="theme-label"
                value={importLabel}
                onChange={(event) => setImportLabel(event.target.value)}
                placeholder="Midnight Aurora"
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="theme-css">CSS</FieldLabel>
              <Textarea
                id="theme-css"
                value={importCss}
                onChange={(event) => setImportCss(event.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder={`[data-theme="midnight-aurora-${importMode}"] {\n  --background: ...;\n  --foreground: ...;\n}`}
                spellCheck={false}
              />
              {importError && <FieldDescription className="text-destructive">{importError}</FieldDescription>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}