import {
  Bot, Boxes, BrainCircuit, Cloud, CloudCog, Cpu, Flame, Gauge, Globe2,
  Network, Orbit, Route, Server, Sparkles, TerminalSquare, Waypoints, Zap,
  type LucideIcon,
} from "lucide-react";
import {
  providerDefinition as coreProviderDefinition,
  providerDefinitions,
  type ConnectionKind,
  type ProviderDefinition as CoreProviderDefinition,
} from "@star/ai-providers";

export type ProviderDefinition = CoreProviderDefinition & { icon: LucideIcon };

const icons: Record<ConnectionKind, LucideIcon> = {
  openrouter: Route, openai: Sparkles, azure: CloudCog, anthropic: BrainCircuit,
  gemini: Orbit, vertex: CloudCog, alibaba: Cloud, "anthropic-aws": CloudCog,
  baseten: Server, huggingface: Boxes, minimax: BrainCircuit, moonshot: Orbit,
  "open-responses": Network, ollama: Server, groq: Zap, grok: Bot,
  mistral: Boxes, bedrock: Cloud, cohere: BrainCircuit, fireworks: Flame,
  deepseek: BrainCircuit, cerebras: Gauge, perplexity: Globe2, together: Boxes,
  deepinfra: Server, byteplus: Network, llmgateway: Waypoints,
  "vercel-gateway": Cloud, compatible: Cpu, codex: TerminalSquare,
  "claude-code": TerminalSquare, opencode: TerminalSquare,
  "gemini-cli": TerminalSquare, acp: TerminalSquare,
};

export const providerCatalog: readonly ProviderDefinition[] = providerDefinitions.map((definition) => ({
  ...definition,
  icon: icons[definition.kind],
}));

const catalogByKind = new Map(providerCatalog.map((definition) => [definition.kind, definition]));

export function providerDefinition(kind: ConnectionKind): ProviderDefinition {
  coreProviderDefinition(kind);
  return catalogByKind.get(kind)!;
}
