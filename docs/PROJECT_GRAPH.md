# Project graph foundation

Star stores graph data per project in two generic SQLite tables:

- `project_graph_nodes`: projects, directories, files, symbols, tools, and memory records
- `project_graph_edges`: contains, imports, calls, references, uses, and general relationships

The project scan currently writes the deterministic project → directory → file containment graph. Removing a project cascades through its chats, nodes, and edges.

## Planned indexing layers

1. **Filesystem layer — implemented**
   - Fast project hierarchy and stable file/folder nodes.
   - Respects ignore files and skips common generated folders.

2. **Syntax layer — next**
   - Use the existing Tree-sitter runtime for language-neutral syntax trees and symbol extraction.
   - Store classes, functions, methods, imports, and their source ranges as graph nodes and edges.

3. **Precise code-intelligence layer — optional per language**
   - Import SCIP indexes when an indexer is available. SCIP is language agnostic and models definitions and references.
   - Tree-sitter Stack Graphs can provide name-resolution graphs, but requires language-specific graph rules.

4. **Deep analysis layer — optional**
   - CodeQL databases expose AST, control-flow, and data-flow representations. This is valuable for security and impact analysis, but too heavyweight for the default project-open path.

5. **Visualization layer — later**
   - React Flow is the preferred renderer for the Brain UI. It provides interactive nodes, edges, pan, zoom, selection, and custom React nodes. It is a renderer, not the source of graph truth.

## Sources

- Tree-sitter Stack Graphs: https://docs.rs/tree-sitter-stack-graphs/latest/tree_sitter_stack_graphs/
- SCIP: https://scip-code.org/
- CodeQL databases: https://codeql.github.com/docs/codeql-overview/about-codeql/
- React Flow: https://reactflow.dev/
