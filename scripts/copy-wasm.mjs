import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = [
  ["node_modules/ghostty-web/ghostty-vt.wasm", "public/ghostty-vt.wasm"],
  ["node_modules/web-tree-sitter/web-tree-sitter.wasm", "public/tree-sitter.wasm"],
  [
    "node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm",
    "public/tree-sitter-typescript.wasm",
  ],
];

for (const [source, destination] of assets) {
  const target = resolve(root, destination);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(root, source), target);
}
