import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { FitAddon, init, Terminal } from "ghostty-web";
import { useThemeStore } from "@/features/themes/themeStore";

let terminalRuntime: Promise<void> | undefined;

export function preloadTerminal() {
  terminalRuntime ??= init();
  return terminalRuntime;
}

type TerminalPanelProps = {
  cwd?: string;
};

type TerminalOutput = {
  sessionId: number;
  data: string;
};

/**
 * Build the ghostty-web theme object from the active theme's `--term-*`
 * CSS variables. Reading computed styles means themes only have to ship
 * their core palette; the terminal ANSI colors derive automatically.
 */
function readTerminalTheme() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    background: read("--term-bg"),
    foreground: read("--term-fg"),
    cursor: read("--term-cursor"),
    cursorAccent: read("--term-cursor-accent"),
    selectionBackground: read("--term-selection"),
    black: read("--term-black"),
    red: read("--term-red"),
    green: read("--term-green"),
    yellow: read("--term-yellow"),
    blue: read("--term-blue"),
    magenta: read("--term-magenta"),
    cyan: read("--term-cyan"),
    white: read("--term-white"),
    brightBlack: read("--term-bright-black"),
    brightRed: read("--term-bright-red"),
    brightGreen: read("--term-bright-green"),
    brightYellow: read("--term-bright-yellow"),
    brightBlue: read("--term-bright-blue"),
    brightMagenta: read("--term-bright-magenta"),
    brightCyan: read("--term-bright-cyan"),
    brightWhite: read("--term-bright-white"),
  };
}

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const host = useRef<HTMLDivElement>(null);
  const themeId = useThemeStore((state) => state.themeId);

  useEffect(() => {
    let disposed = false;
    let terminal: Terminal | undefined;
    let fit: FitAddon | undefined;
    let sessionId: number | undefined;
    let unlistenOutput: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;
    let inputSubscription: { dispose(): void } | undefined;
    let resizeSubscription: { dispose(): void } | undefined;
    let writeQueue = Promise.resolve();
    const pendingOutput: TerminalOutput[] = [];

    void preloadTerminal().then(async () => {
      if (disposed || !host.current) return;

      const theme = readTerminalTheme();
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        fontSize: 12,
        scrollback: 10_000,
        smoothScrollDuration: 110,
        theme,
      });
      fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(host.current);
      fit.observeResize();
      fit.fit();

      if (!isTauri()) {
        terminal.write("Desktop terminal is available in the Star app.\r\n");
        return;
      }

      unlistenOutput = await listen<TerminalOutput>("terminal-output", ({ payload }) => {
        if (sessionId === undefined) pendingOutput.push(payload);
        else if (payload.sessionId === sessionId) terminal?.write(payload.data);
      });
      unlistenExit = await listen<number>("terminal-exit", ({ payload }) => {
        if (payload === sessionId) terminal?.write("\r\n\x1b[2m[process exited]\x1b[0m\r\n");
      });

      sessionId = await invoke<number>("terminal_start", {
        cwd: cwd ?? null,
        cols: terminal.cols,
        rows: terminal.rows,
      });
      inputSubscription = terminal.onData((data) => {
        if (sessionId === undefined) return;
        writeQueue = writeQueue
          .then(() => invoke<void>("terminal_write", { sessionId, data }))
          .catch((error: unknown) => terminal?.write(`\r\n\x1b[31m${String(error)}\x1b[0m\r\n`));
      });
      resizeSubscription = terminal.onResize(({ cols, rows }) => {
        if (sessionId !== undefined) void invoke("terminal_resize", { sessionId, cols, rows });
      });
      for (const output of pendingOutput) {
        if (output.sessionId === sessionId) terminal.write(output.data);
      }
      terminal.focus();
    }).catch((error: unknown) => {
      terminal?.write(`\r\n\x1b[31mCould not start terminal: ${String(error)}\x1b[0m\r\n`);
    });

    return () => {
      disposed = true;
      inputSubscription?.dispose();
      resizeSubscription?.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      if (sessionId !== undefined) void invoke("terminal_stop", { sessionId });
      fit?.dispose();
      terminal?.dispose();
    };
  }, [cwd, themeId]);

  return <div className="terminal-host" ref={host} />;
}
