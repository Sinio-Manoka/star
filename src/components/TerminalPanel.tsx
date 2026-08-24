import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { FitAddon, init, Terminal } from "ghostty-web";

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

export function TerminalPanel({ cwd }: TerminalPanelProps) {
  const host = useRef<HTMLDivElement>(null);

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
      terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "'Cascadia Code', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        fontSize: 12,
        scrollback: 10_000,
        smoothScrollDuration: 110,
        theme: {
          background: "#0b0b0d",
          foreground: "#c9cbd2",
          cursor: "#f0f0f2",
          cursorAccent: "#0b0b0d",
          selectionBackground: "#34343d",
          black: "#17171a",
          red: "#e06c75",
          green: "#98c379",
          yellow: "#e5c07b",
          blue: "#78a9ff",
          magenta: "#c792ea",
          cyan: "#56b6c2",
          white: "#d4d4d8",
          brightBlack: "#686870",
          brightRed: "#ff7b86",
          brightGreen: "#b4e88d",
          brightYellow: "#f2d18b",
          brightBlue: "#9cc2ff",
          brightMagenta: "#d9a6ff",
          brightCyan: "#7bdde8",
          brightWhite: "#f4f4f5",
        },
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
  }, [cwd]);

  return <div className="terminal-host" ref={host} />;
}
