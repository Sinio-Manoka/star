import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

/**
 * Cross-platform window controls.
 *
 * Always renders so the user can confirm decoration handling. The onClick
 * handlers no-op when not running inside Tauri.
 *
 *   - **macOS** (`darwin`): traffic-light dots on the LEFT.
 *   - **Windows / Linux** (`win32` / `linux`): min/max/close on the RIGHT.
 *
 * Native window decorations are disabled in `tauri.conf.json`, so these HTML
 * buttons are the only way to manipulate the window. They start transparent and
 * pick up the theme's surface tokens on hover; Close turns destructive.
 */
export function WindowControls() {
  const [platform, setPlatform] = useState<"darwin" | "win32" | "linux" | "other">("win32");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      const platformHint = (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform?.toLowerCase();
      if (platformHint === "macos" || ua.includes("mac")) setPlatform("darwin");
      else if (platformHint === "windows" || ua.includes("win")) setPlatform("win32");
      else if (platformHint === "linux" || ua.includes("linux")) setPlatform("linux");
    }
    if (!isTauri()) return;
    const win = getCurrentWindow();
    void win.isMaximized().then(setIsMaximized);
    const unlisten = win.onResized(() => {
      void win.isMaximized().then(setIsMaximized);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const win = isTauri() ? getCurrentWindow() : null;
  const isMac = platform === "darwin";

  const minimize = () => void win?.minimize();
  const toggleMax = () => void win?.toggleMaximize();
  const close = () => void win?.close();

  if (isMac) {
    return (
      <div className="window-controls window-controls-mac" role="group" aria-label="Window controls">
        <div className="window-controls-traffic-lights">
          <button type="button" aria-label="Close" className="traffic-light traffic-light-close" onClick={close}>
            <X className="traffic-light-icon" />
          </button>
          <button type="button" aria-label="Minimize" className="traffic-light traffic-light-minimize" onClick={minimize}>
            <Minus className="traffic-light-icon" />
          </button>
          <button
            type="button"
            aria-label={isMaximized ? "Restore" : "Zoom"}
            className="traffic-light traffic-light-zoom"
            onClick={toggleMax}
          >
            {isMaximized ? (
              <Square className="traffic-light-icon traffic-light-icon-restore" />
            ) : (
              <PlusIconInside />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="window-controls window-controls-other" role="group" aria-label="Window controls">
      <button type="button" aria-label="Minimize" className="window-control" onClick={minimize}>
        <Minus />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className="window-control"
        onClick={toggleMax}
      >
        {isMaximized ? (
          /* VS Code chrome-restore: two overlapping rounded rectangles (back + front) */
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M5.085 4C5.291 3.417 5.847 3 6.5 3H10c1.657 0 3 1.343 3 3v3.5c0 .653-.417 1.209-1 1.415V6c0-1.105-.895-2-2-2H5.085zM4.5 5H9.5c.828 0 1.5.672 1.5 1.5v5c0 .828-.672 1.5-1.5 1.5h-5C3.672 13 3 12.328 3 11.5v-5C3 5.672 3.672 5 4.5 5zm0 1c-.276 0-.5.224-.5.5v5c0 .276.224.5.5.5h5c.276 0 .5-.224.5-.5v-5c0-.276-.224-.5-.5-.5h-5z" />
          </svg>
        ) : (
          /* VS Code chrome-maximize: rounded rectangle ring */
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M2 4.5C2 3.119 3.119 2 4.5 2H11.5C12.881 2 14 3.119 14 4.5V11.5c0 1.381-1.119 2.5-2.5 2.5H4.5C3.119 14 2 12.881 2 11.5V4.5zM4.5 3C3.672 3 3 3.672 3 4.5V11.5c0 .828.672 1.5 1.5 1.5H11.5c.828 0 1.5-.672 1.5-1.5V4.5c0-.828-.672-1.5-1.5-1.5H4.5z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        aria-label="Close"
        className="window-control window-control-close"
        onClick={close}
      >
        <X />
      </button>
    </div>
  );
}

/** macOS-style zoom icon (overlapping squares) drawn with CSS so it follows the theme. */
function PlusIconInside() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="traffic-light-icon"
      aria-hidden
    >
      <path d="M5 1.5h5.5V7" />
      <path d="M7 1.5l3.5 3.5" />
      <path d="M1.5 5v5.5H7" />
      <path d="M1.5 7l3.5 -3.5" />
    </svg>
  );
}