import { exec as execCallback } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import fg from "fast-glob";
import { tool } from "ai";
import { z } from "zod";

const exec = promisify(execCallback);
const DEFAULT_IGNORES = [
  "**/.git/**",
  "**/node_modules/**",
  "**/target/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.cache/**",
];
const MAX_FILE_BYTES = 1_000_000;
const MAX_READ_LINES = 400;
const MAX_LIST_RESULTS = 600;
const MAX_SEARCH_RESULTS = 200;

function assertRelativePath(value) {
  const candidate = value.trim();
  if (!candidate || candidate === ".") return candidate || ".";
  if (path.isAbsolute(candidate) || /^[a-zA-Z]:[\\/]/.test(candidate)) {
    throw new Error("Use a path relative to the selected project.");
  }
  return candidate;
}

function assertInside(root, candidate) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("That path is outside the selected project.");
  }
}

async function projectRoot(projectPath) {
  const root = await realpath(projectPath);
  const info = await stat(root);
  if (!info.isDirectory()) throw new Error("The selected project is not a directory.");
  return root;
}

async function existingProjectPath(projectPath, requestedPath) {
  const root = await projectRoot(projectPath);
  const candidate = path.resolve(root, assertRelativePath(requestedPath));
  assertInside(root, candidate);
  const canonical = await realpath(candidate);
  assertInside(root, canonical);
  return { root, target: canonical };
}

async function writableProjectPath(projectPath, requestedPath) {
  const root = await projectRoot(projectPath);
  const relativePath = assertRelativePath(requestedPath);
  if (relativePath === ".") throw new Error("Choose a file inside the selected project.");
  const target = path.resolve(root, relativePath);
  assertInside(root, target);

  try {
    const canonical = await realpath(target);
    assertInside(root, canonical);
    return { root, target: canonical };
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const unresolvedEntry = await lstat(target).catch((entryError) => {
      if (entryError?.code === "ENOENT") return undefined;
      throw entryError;
    });
    if (unresolvedEntry) throw new Error("Refusing to write through an unresolved project link.");
  }

  let ancestor = path.dirname(target);
  while (true) {
    try {
      const canonical = await realpath(ancestor);
      assertInside(root, canonical);
      return { root, target };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new Error("Could not resolve a safe project path.");
      ancestor = parent;
    }
  }
}

async function readTextFile(projectPath, requestedPath) {
  const { root, target } = await existingProjectPath(projectPath, requestedPath);
  const info = await stat(target);
  if (!info.isFile()) throw new Error("The requested path is not a file.");
  if (info.size > MAX_FILE_BYTES) throw new Error(`File is larger than ${MAX_FILE_BYTES} bytes.`);
  const buffer = await readFile(target);
  if (buffer.includes(0)) throw new Error("Binary files cannot be read as text.");
  return { root, target, text: buffer.toString("utf8") };
}

function displayPath(root, target) {
  return path.relative(root, target).split(path.sep).join("/") || ".";
}

function numberedSlice(text, startLine = 1, endLine = startLine + MAX_READ_LINES - 1) {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, Math.min(startLine, lines.length || 1));
  const end = Math.max(start, Math.min(endLine, start + MAX_READ_LINES - 1, lines.length));
  return {
    startLine: start,
    endLine: end,
    totalLines: lines.length,
    content: lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join("\n"),
  };
}

export function projectAgentInstructions(projectName) {
  return [
    `You are a coding agent working on the selected project${projectName ? ` “${projectName}”` : ""}.`,
    "Use the project tools to inspect real files before making claims or proposing edits.",
    "Paths passed to tools must be relative to the project root.",
    "Prefer targeted replacements over rewriting whole files. Re-read relevant code before changing it.",
    "File mutations and commands require the user's explicit approval. Explain the purpose in your response or tool arguments, then request the tool.",
    "Do not claim a change or command succeeded until its tool result confirms it.",
  ].join("\n");
}

export function createProjectTools(projectPath) {
  if (!projectPath?.trim()) return {};

  return {
    list_project_files: tool({
      description: "List files in the selected project. Use a glob to focus the result.",
      inputSchema: z.object({
        glob: z.string().default("**/*").describe("A project-relative glob such as src/**/*.ts"),
      }),
      execute: async ({ glob }) => {
        const root = await projectRoot(projectPath);
        const files = await fg(glob || "**/*", {
          cwd: root,
          onlyFiles: true,
          dot: true,
          followSymbolicLinks: false,
          ignore: DEFAULT_IGNORES,
        });
        const sorted = files.sort().slice(0, MAX_LIST_RESULTS);
        return { files: sorted, count: sorted.length, truncated: files.length > sorted.length };
      },
    }),

    read_project_file: tool({
      description: "Read a UTF-8 text file from the selected project with line numbers.",
      inputSchema: z.object({
        path: z.string().describe("Project-relative file path"),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      }),
      execute: async ({ path: filePath, startLine, endLine }) => {
        const file = await readTextFile(projectPath, filePath);
        return { path: displayPath(file.root, file.target), ...numberedSlice(file.text, startLine, endLine) };
      },
    }),

    search_project: tool({
      description: "Search text files in the selected project for a literal string.",
      inputSchema: z.object({
        query: z.string().min(1),
        glob: z.string().default("**/*"),
        caseSensitive: z.boolean().default(false),
      }),
      execute: async ({ query, glob, caseSensitive }) => {
        const root = await projectRoot(projectPath);
        const files = await fg(glob || "**/*", {
          cwd: root,
          onlyFiles: true,
          dot: true,
          followSymbolicLinks: false,
          ignore: DEFAULT_IGNORES,
        });
        const needle = caseSensitive ? query : query.toLocaleLowerCase();
        const matches = [];
        for (const relativePath of files) {
          if (matches.length >= MAX_SEARCH_RESULTS) break;
          const absolutePath = path.resolve(root, relativePath);
          assertInside(root, absolutePath);
          const canonicalPath = await realpath(absolutePath).catch(() => undefined);
          if (!canonicalPath) continue;
          assertInside(root, canonicalPath);
          const info = await stat(canonicalPath).catch(() => undefined);
          if (!info?.isFile() || info.size > MAX_FILE_BYTES) continue;
          const buffer = await readFile(canonicalPath).catch(() => undefined);
          if (!buffer || buffer.includes(0)) continue;
          const lines = buffer.toString("utf8").split(/\r?\n/);
          for (let index = 0; index < lines.length && matches.length < MAX_SEARCH_RESULTS; index += 1) {
            const haystack = caseSensitive ? lines[index] : lines[index].toLocaleLowerCase();
            if (haystack.includes(needle)) matches.push({ path: relativePath.split(path.sep).join("/"), line: index + 1, text: lines[index].slice(0, 500) });
          }
        }
        return { matches, count: matches.length, truncated: matches.length >= MAX_SEARCH_RESULTS };
      },
    }),

    replace_in_project_file: tool({
      description: "Replace one exact, unique text occurrence in a project file. Requires user approval.",
      inputSchema: z.object({
        path: z.string(),
        oldText: z.string().min(1),
        newText: z.string(),
        reason: z.string().describe("A concise explanation shown to the user before approval"),
      }),
      needsApproval: true,
      execute: async ({ path: filePath, oldText, newText }) => {
        const file = await readTextFile(projectPath, filePath);
        const first = file.text.indexOf(oldText);
        if (first < 0) throw new Error("The exact old text was not found; read the file again.");
        if (file.text.indexOf(oldText, first + oldText.length) >= 0) throw new Error("The old text is not unique; provide a larger exact match.");
        const updated = `${file.text.slice(0, first)}${newText}${file.text.slice(first + oldText.length)}`;
        if (Buffer.byteLength(updated) > MAX_FILE_BYTES) throw new Error(`Updated file would exceed ${MAX_FILE_BYTES} bytes.`);
        await writeFile(file.target, updated, "utf8");
        return { path: displayPath(file.root, file.target), changed: true };
      },
    }),

    write_project_file: tool({
      description: "Create or replace a UTF-8 text file in the selected project. Requires user approval.",
      inputSchema: z.object({
        path: z.string(),
        content: z.string().max(MAX_FILE_BYTES),
        reason: z.string().describe("A concise explanation shown to the user before approval"),
      }),
      needsApproval: true,
      execute: async ({ path: filePath, content }) => {
        const { root, target } = await writableProjectPath(projectPath, filePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
        return { path: displayPath(root, target), bytes: Buffer.byteLength(content), changed: true };
      },
    }),

    run_project_command: tool({
      description: "Run a shell command with the selected project as its working directory. Requires user approval.",
      inputSchema: z.object({
        command: z.string().min(1),
        reason: z.string().describe("A concise explanation shown to the user before approval"),
        timeoutSeconds: z.number().int().min(1).max(120).default(60),
      }),
      needsApproval: true,
      execute: async ({ command, timeoutSeconds }) => {
        const root = await projectRoot(projectPath);
        await access(root, constants.R_OK);
        try {
          const result = await exec(command, {
            cwd: root,
            windowsHide: true,
            timeout: timeoutSeconds * 1000,
            maxBuffer: MAX_FILE_BYTES,
          });
          return { command, exitCode: 0, stdout: result.stdout, stderr: result.stderr };
        } catch (error) {
          return {
            command,
            exitCode: typeof error?.code === "number" ? error.code : 1,
            stdout: error?.stdout || "",
            stderr: error?.stderr || error?.message || String(error),
          };
        }
      },
    }),
  };
}
