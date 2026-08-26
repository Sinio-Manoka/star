# @star/project-agent

Project-scoped tools and instructions for Star's direct model providers.

- Read-only file listing, reading, and text search run automatically.
- File writes, replacements, and commands use the AI SDK approval flow.
- File paths are resolved against the selected project and symlink escapes are rejected.
- Large files, results, command output, and execution time are bounded.

Provider adapters stay in `@star/ai-providers`; this package is deliberately provider-neutral.
