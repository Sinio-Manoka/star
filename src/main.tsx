import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProvider } from "./features/projects/ProjectProvider";
import { ThemeProvider } from "./features/themes/ThemeProvider";
import "./styles.css";

document.documentElement.classList.add("dark");
document.documentElement.dataset.theme = "catppuccin-mocha";

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
