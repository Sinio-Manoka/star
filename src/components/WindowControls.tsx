import { Minus, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

/**
 * Cross-platform window controls.
 *
 * Renders always so the user can confirm decoration handling. The onClick
 * handlers call the Tauri API directly on click — wrapping in an early
 * `isTauri()` check was the bug: it could evaluate `false` during the initial
 * Tauri bootstrap and permanently disable the buttons.
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

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const platformHint = (
      navigator as Navigator & { userAgentData?: { platform?: string } }
    ).userAgentData?.platform?.toLowerCase();
    if (platformHint === "macos" || ua.includes("mac")) setPlatform("darwin");
    else if (platformHint === "windows" || ua.includes("win")) setPlatform("win32");
    else if (platformHint === "linux" || ua.includes("linux")) setPlatform("linux");
  }, []);

  /**
   * Resolve the Tauri window on every click — direct, no closure tricks, no
   * early `isTauri()` check that can latch to `false`. Browser previews remain
   * harmless, while rejected native commands are logged for diagnosis.
   */
  const runTauri = (
    name: "close" | "minimize" | "toggle maximize",
    action: (win: ReturnType<typeof getCurrentWindow>) => Promise<void>,
  ) => async () => {
    try {
      const win = getCurrentWindow();
      await action(win);
    } catch (error) {
      // Keep browser previews harmless, but surface native integration errors
      // instead of making a rejected Tauri command look like a dead button.
      if ("__TAURI_INTERNALS__" in window) {
        console.error(`Could not ${name} the window`, error);
      }
    }
  };

  const minimize = runTauri("minimize", (win) => win.minimize());
  const toggleMax = runTauri("toggle maximize", (win) => win.toggleMaximize());
  const close = runTauri("close", (win) => win.close());

  if (platform === "darwin") {
    return (
      <div className="window-controls window-controls-mac" role="group" aria-label="Window controls">
        <div className="window-controls-traffic-lights">
          <button type="button" aria-label="Close" className="traffic-light traffic-light-close" onClick={close}>
            <X className="traffic-light-icon" />
          </button>
          <button
            type="button"
            aria-label="Minimize"
            className="traffic-light traffic-light-minimize"
            onClick={minimize}
          >
            <Minus className="traffic-light-icon" />
          </button>
          <button
            type="button"
            aria-label="Maximize"
            className="traffic-light traffic-light-zoom"
            onClick={toggleMax}
          >
            <ZoomIcon />
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
        aria-label="Maximize"
        title="Maximize"
        className="window-control"
        onClick={toggleMax}
      >
        {/* VS Code chrome-restore: two overlapping rounded rectangles (back + front).
            Static icon — no state-dependent swap — for a stable visual. */}
        <MaximizeIcon />
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

/** VS Code chrome-restore icon: two overlapping rounded rectangles. */
function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5.085 4C5.291 3.417 5.847 3 6.5 3H10c1.657 0 3 1.343 3 3v3.5c0 .653-.417 1.209-1 1.415V6c0-1.105-.895-2-2-2H5.085zM4.5 5H9.5c.828 0 1.5.672 1.5 1.5v5c0 .828-.672 1.5-1.5 1.5h-5C3.672 13 3 12.328 3 11.5v-5C3 5.672 3.672 5 4.5 5zm0 1c-.276 0-.5.224-.5.5v5c0 .276.224.5.5.5h5c.276 0 .5-.224.5-.5v-5c0-.276-.224-.5-.5-.5h-5z" />
    </svg>
  );
}

/** macOS-style zoom icon: two overlapping arrows pointing outward (like the "zoom" traffic light). */
function ZoomIcon() {
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
