# @star/ai-providers

Star's provider feature package. It is the single source of truth for direct
model-provider connections used by both the React settings UI and the local
Node sidecar.

## Owns

- Provider metadata, configuration fields, defaults, and fallback models
- Connection validation and credential requirements
- Vercel AI SDK provider construction
- Live model discovery and strict connection testing
- Normalization of provider-specific model catalogues

Coding-agent process management remains in `sidecar/acp.mjs`; those agents use
the shared catalogue and category checks from this package.

## Adding a provider

1. Add its definition and fallback models to `src/catalog.ts`.
2. Add its SDK constructor and discovery endpoint to `src/runtime.ts`.
3. Add its visual icon mapping in `src/features/ai/providerCatalog.ts`.
4. Extend the provider contract tests before exposing it in Settings.
