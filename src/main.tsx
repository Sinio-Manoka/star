import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { invoke, isTauri } from "@tauri-apps/api/core";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { ThemeProvider } from "./features/themes/ThemeProvider";
import "./styles.css";

document.documentElement.classList.add("dark");
document.documentElement.dataset.theme = "default-dark";

type NativeTitlebarStatus = {
  active: boolean;
  height: number;
  rightInset: number;
  error?: string;
};

if (isTauri() && navigator.userAgent.includes("Windows")) {
  void invoke<NativeTitlebarStatus>("native_titlebar_status").then((status) => {
    if (!status.active) return;
    const scale = window.devicePixelRatio || 1;
    document.documentElement.classList.add("windows-native-titlebar");
    document.documentElement.style.setProperty("--native-caption-inset", `${status.rightInset / scale}px`);
  });
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <ProjectProvider>
          <App />
        </ProjectProvider>
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
