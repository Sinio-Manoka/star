import { Check, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelSelector, type ModelOption } from "@/components/model-selector";
import { CommandItem } from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { AI_CONNECTIONS_CHANGED, getAiSelection, listAiConnections, listAiModels, setAiSelection } from "./api";
import { ProviderBrandIcon } from "./ProviderBrandIcon";
import { providerDefinition } from "./providerCatalog";
import type { AiConnection, AiModel } from "./types";

export function ComposerModelPicker({ projectPath }: { projectPath: string }) {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [connectionId, setConnectionId] = useState<string>();
  const [modelId, setModelId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "catalog" | "agent">();
  const [error, setError] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  const loadConnections = useCallback(async () => {
    const next = await listAiConnections();
    const saved = getAiSelection(projectPath);
    const selected = next.find((connection) => connection.id === saved?.connectionId)
      ?? next.find((connection) => connection.active)
      ?? next[0];
    setConnections(next);
    setConnectionId(selected?.id);
    setModelId(selected?.id === saved?.connectionId ? saved.modelId : undefined);
  }, [projectPath]);

  useEffect(() => {
    void loadConnections().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
    const refresh = () => void loadConnections();
    window.addEventListener(AI_CONNECTIONS_CHANGED, refresh);
    return () => window.removeEventListener(AI_CONNECTIONS_CHANGED, refresh);
  }, [loadConnections]);

  useEffect(() => {
    if (!connectionId) { setModels([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError(undefined);
    void listAiModels(connectionId, projectPath).then((result) => {
      if (!active) return;
      setModels(result.models);
      setSource(result.source);
      const connection = connections.find((item) => item.id === connectionId);
      const nextModel = result.models.some((model) => model.id === modelId)
        ? modelId
        : result.models.find((model) => model.id === connection?.model)?.id ?? result.models[0]?.id;
      setModelId(nextModel);
      if (nextModel) setAiSelection(projectPath, { connectionId, modelId: nextModel });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [connectionId, connections, projectPath, refreshKey]);

  const connection = connections.find((item) => item.id === connectionId);
  const provider = connection ? providerDefinition(connection.kind) : undefined;
  const modelOptions = useMemo<ModelOption[]>(() => models.map((model) => ({
    id: model.id,
    name: model.name,
    description: model.ownedBy,
    icon: provider ? <ProviderBrandIcon kind={provider.kind} size={15} /> : undefined,
    keywords: [model.id, model.ownedBy ?? "", provider?.label ?? ""],
  })), [models, provider]);

  const chooseConnection = (nextId: string) => {
    setConnectionId(nextId);
    setModelId(undefined);
  };

  const chooseModel = (nextId: string) => {
    if (!connectionId) return;
    setModelId(nextId);
    setAiSelection(projectPath, { connectionId, modelId: nextId });
  };

  const modelGroupLabel = source === "catalog"
    ? "Models · built-in catalog"
    : source === "agent"
      ? "Models · from agent"
      : "Models";

  return (
    <ModelSelector.Root models={modelOptions} value={modelId} onValueChange={chooseModel} open={open} onOpenChange={setOpen}>
      <ModelSelector.Trigger variant="ghost" size="sm" className="composer-model-picker h-9 max-w-44 gap-1.5 rounded-full px-3.5 text-sm" aria-label={`Model: ${modelOptions.find((model) => model.id === modelId)?.name ?? "Choose model"}`}>
        <ModelSelector.Value placeholder={loading ? "Loading models…" : "Choose model"} />
      </ModelSelector.Trigger>
      <ModelSelector.Content side="top" align="start" className="w-80" searchable>
        <ModelSelector.Search placeholder="Search providers and models…" />
        <ModelSelector.List>
          <ModelSelector.Empty>{error ?? "No models found."}</ModelSelector.Empty>
          <ModelSelector.Group heading="Connections">
            {connections.map((item) => {
              const definition = providerDefinition(item.kind);
              return (
                <CommandItem key={item.id} value={`${item.label} ${definition.description}`} onSelect={() => chooseConnection(item.id)}>
                  <ProviderBrandIcon kind={definition.kind} size={15} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.id === connectionId && <Check />}
                </CommandItem>
              );
            })}
          </ModelSelector.Group>
          <ModelSelector.Separator />
          <ModelSelector.Group heading={modelGroupLabel}>
            {loading && <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Spinner />Loading models…</div>}
            {!loading && modelOptions.map((model) => <ModelSelector.Item key={model.id} model={model} />)}
            {error && <CommandItem onSelect={() => setRefreshKey((value) => value + 1)}><RefreshCw />Retry model discovery</CommandItem>}
          </ModelSelector.Group>
        </ModelSelector.List>
      </ModelSelector.Content>
    </ModelSelector.Root>
  );
}
