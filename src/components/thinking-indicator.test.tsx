import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  formatElapsedSeconds,
  formatThinkingToolName,
  ThinkingIndicator,
} from "@/components/thinking-indicator";

describe("ThinkingIndicator", () => {
  it("renders an accessible live status with elapsed time", () => {
    const markup = renderToStaticMarkup(
      <ThinkingIndicator label="Running project search" elapsed="12s" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain("Running project search");
    expect(markup).toContain("12s");
    expect(markup).toContain("--status-running");
  });

  it("formats tool names and elapsed durations for the live label", () => {
    expect(formatThinkingToolName("run_project_command")).toBe(
      "Run project command",
    );
    expect(formatThinkingToolName("searchCode")).toBe("Search Code");
    expect(formatElapsedSeconds(8)).toBe("8s");
    expect(formatElapsedSeconds(65)).toBe("1m 05s");
  });
});
