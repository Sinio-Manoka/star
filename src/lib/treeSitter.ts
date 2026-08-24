import { Language, Parser } from "web-tree-sitter";

let parserPromise: Promise<Parser> | undefined;

export function getTypeScriptParser(): Promise<Parser> {
  parserPromise ??= (async () => {
    await Parser.init({ locateFile: () => "/tree-sitter.wasm" });
    const parser = new Parser();
    const language = await Language.load("/tree-sitter-typescript.wasm");
    parser.setLanguage(language);
    return parser;
  })();
  return parserPromise;
}

export async function getSyntaxSummary(source: string) {
  const parser = await getTypeScriptParser();
  const tree = parser.parse(source);
  if (!tree) return { root: "unknown", nodes: 0, hasErrors: true };

  let nodes = 0;
  const cursor = tree.walk();
  while (true) {
    nodes += 1;
    if (cursor.gotoFirstChild()) continue;
    if (cursor.gotoNextSibling()) continue;
    while (cursor.gotoParent()) {
      if (cursor.gotoNextSibling()) break;
    }
    if (cursor.currentNode.id === tree.rootNode.id) break;
  }

  const summary = {
    root: tree.rootNode.type,
    nodes,
    hasErrors: tree.rootNode.hasError,
  };
  cursor.delete();
  tree.delete();
  return summary;
}
