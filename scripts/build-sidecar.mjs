import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";

function stopStaleWindowsSidecars() {
  if (process.platform !== "win32") return;

  const runtimePaths = [
    resolve("src-tauri", "target", "debug", "star-ai.exe"),
    resolve("src-tauri", "target", "release", "star-ai.exe"),
  ];
  const script = `
$ErrorActionPreference = "Stop"
$expected = $env:STAR_SIDECAR_RUNTIME_PATHS -split [char]10 | ForEach-Object { [IO.Path]::GetFullPath($_.Trim()) }
Get-CimInstance Win32_Process -Filter "Name = 'star-ai.exe'" | ForEach-Object {
  if ($_.ExecutablePath -and ($expected -icontains [IO.Path]::GetFullPath($_.ExecutablePath))) {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
    Wait-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
  }
}`;

  execFileSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ], {
    stdio: "inherit",
    env: { ...process.env, STAR_SIDECAR_RUNTIME_PATHS: runtimePaths.join("\n") },
  });
}

stopStaleWindowsSidecars();

const target = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim();
const extension = process.platform === "win32" ? ".exe" : "";
const output = `src-tauri/binaries/star-ai-${target}${extension}`;
mkdirSync("sidecar/dist", { recursive: true });
mkdirSync("src-tauri/binaries", { recursive: true });
await build({
  entryPoints: ["sidecar/server.mjs"],
  outfile: "sidecar/dist/server.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  minify: true,
  sourcemap: false,
});
rmSync(output, { force: true });
execFileSync(process.execPath, [
  "node_modules/@yao-pkg/pkg/lib-es5/bin.js",
  "sidecar/dist/server.cjs",
  "--targets",
  process.platform === "win32" ? "node22-win-x64" : process.platform === "darwin" ? "node22-macos-x64" : "node22-linux-x64",
  "--output",
  output,
], { stdio: "inherit" });
console.log(`Built ${output}`);
