import { AlertCircle, ArrowLeft, Bot, Check, CircleCheck, KeyRound, Link2, MoreHorizontal, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ModelSelector, type ModelOption } from "@/components/model-selector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  detectAiClis, listAiConnections, listAiModels, notifyAiConnectionsChanged,
  removeAiConnection, saveAiConnection, testAiConnection,
} from "./api";
import { ProviderBrandIcon } from "./ProviderBrandIcon";
import { providerCatalog, providerDefinition, type ProviderDefinition } from "./providerCatalog";
import type { AiConnection, AiConnectionKind, CliAvailability } from "./types";

function message(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}

function ProviderGlyph({ provider, size = 18 }: { provider: ProviderDefinition; size?: number }) {
  return (
    <span className="ai-settings-provider-glyph" aria-hidden>
      <ProviderBrandIcon kind={provider.kind} size={size} />
    </span>
  );
}

function ConnectionModelPicker({ connection, onChange, onError }: {
  connection: AiConnection;
  onChange(modelId: string): Promise<void>;
  onError(reason: unknown): void;
}) {
  const provider = providerDefinition(connection.kind);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(connection.model);
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => setValue(connection.model), [connection.model]);

  useEffect(() => {
    if (!open || loaded || loading) return;
    let active = true;
    setLoading(true);
    void listAiModels(connection.id).then((result) => {
      if (!active) return;
      setModels(result.models.map((model) => ({
        id: model.id,
        name: model.name,
        description: model.ownedBy,
        icon: <ProviderBrandIcon className="ai-settings-monochrome-icon" kind={provider.kind} size={15} />,
        keywords: [model.id, model.ownedBy ?? "", provider.label],
      })));
      setLoaded(true);
    }).catch(onError).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [connection.id, loaded, loading, onError, open, provider.kind, provider.label]);

  const fallbackModel = useMemo<ModelOption>(() => ({
    id: connection.model,
    name: connection.model === "default" ? "Agent default" : connection.model,
    icon: <ProviderBrandIcon className="ai-settings-monochrome-icon" kind={provider.kind} size={15} />,
  }), [connection.model, provider.kind]);
  const options = models.length > 0 ? models : [fallbackModel];

  const selectModel = async (modelId: string) => {
    const previous = value;
    setValue(modelId);
    setSaving(true);
    try { await onChange(modelId); }
    catch (reason) { setValue(previous); onError(reason); }
    finally { setSaving(false); }
  };

  return (
    <ModelSelector.Root models={options} value={value} onValueChange={(modelId) => void selectModel(modelId)} open={open} onOpenChange={setOpen}>
      <ModelSelector.Trigger variant="ghost" size="sm" className="ai-settings-model-trigger max-w-64" aria-label={`Default model for ${connection.label}`}>
        <ModelSelector.Value />
        {(loading || saving) && <Spinner />}
      </ModelSelector.Trigger>
      <ModelSelector.Content searchable align="end" className="w-80" />
    </ModelSelector.Root>
  );
}

function ConnectionRow({ connection, onActivate, onModelChange, onRemove, onTest, onError }: {
  connection: AiConnection;
  onActivate(connection: AiConnection): void;
  onModelChange(connection: AiConnection, modelId: string): Promise<void>;
  onRemove(id: string): void;
  onTest(id: string): Promise<void>;
  onError(reason: unknown): void;
}) {
  const provider = providerDefinition(connection.kind);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verified, setVerified] = useState(false);

  const test = async () => {
    setTesting(true);
    setVerified(false);
    try { await onTest(connection.id); setVerified(true); }
    catch (reason) { onError(reason); }
    finally { setTesting(false); }
  };

  return (
    <>
      <TableRow data-state={connection.active ? "selected" : undefined}>
        <TableCell>
          <div className="flex min-w-0 items-center gap-3">
            <ProviderGlyph provider={provider} />
            <span className="truncate font-medium">{connection.label}</span>
            {connection.active && <span title="Default connection"><Check className="size-3.5 text-muted-foreground" /><span className="sr-only">Default connection</span></span>}
            {verified && <span title="Connection verified"><CircleCheck className="size-3.5 text-muted-foreground" /><span className="sr-only">Connection verified</span></span>}
          </div>
        </TableCell>
        <TableCell>
          <ConnectionModelPicker connection={connection} onChange={(modelId) => onModelChange(connection, modelId)} onError={onError} />
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Manage ${connection.label}`} />}><MoreHorizontal /></DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-44">
              <DropdownMenuGroup>
                {!connection.active && <DropdownMenuItem onClick={() => onActivate(connection)}><Check />Make default</DropdownMenuItem>}
                <DropdownMenuItem disabled={testing} onClick={() => void test()}>
                  {testing ? <Spinner /> : <RefreshCw />}{testing ? "Testing…" : "Test connection"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {!connection.active && <DropdownMenuSeparator />}
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}><Trash2 />Delete connection</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete {connection.label}?</AlertDialogTitle><AlertDialogDescription>The saved connection and its credential will be removed. You can reconnect it later.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onRemove(connection.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ConnectionForm({ provider, onCancel, onSaved }: {
  provider: ProviderDefinition;
  onCancel(): void;
  onSaved(connections: AiConnection[]): void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(provider.kind === "ollama" ? "http://127.0.0.1:11434" : "");
  const [region, setRegion] = useState(["bedrock", "anthropic-aws"].includes(provider.kind) ? "us-east-1" : provider.kind === "vertex" ? "us-central1" : "");
  const [projectId, setProjectId] = useState("");
  const [command, setCommand] = useState(provider.defaultCommand ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const connections = await saveAiConnection({
        kind: provider.kind, label: provider.label, model: provider.defaultModel,
        apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, region: region || undefined,
        projectId: projectId || undefined, command: command || undefined, active: true,
      });
      notifyAiConnectionsChanged();
      onSaved(connections);
    } catch (reason) { setError(message(reason)); }
    finally { setSaving(false); }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" aria-label="Back to providers" onClick={onCancel}><ArrowLeft /></Button>
        <ProviderGlyph provider={provider} size={20} />
        <div><h3 className="font-semibold">Connect {provider.label}</h3><p className="text-sm text-muted-foreground">{provider.description}</p></div>
      </div>
      <Separator />
      <form id="provider-connection-form" className="flex flex-col gap-4" onSubmit={submit}>
        <FieldGroup>
          {provider.keyMode !== "none" && <Field><FieldLabel htmlFor="provider-api-key">API key</FieldLabel><Input id="provider-api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required={provider.keyMode === "required"} /><FieldDescription>{provider.keyMode === "optional" ? "Optional when environment credentials are available. " : ""}Stored in the operating system credential vault.</FieldDescription></Field>}
          {provider.baseUrl && <Field><FieldLabel htmlFor="provider-base-url">Base URL</FieldLabel><Input id="provider-base-url" type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required={provider.baseUrlRequired} placeholder={provider.baseUrlPlaceholder ?? "https://api.example.com/v1"} />{!provider.baseUrlRequired && <FieldDescription>Optional. Leave empty to use the provider default.</FieldDescription>}</Field>}
          {provider.region && <Field><FieldLabel htmlFor="provider-region">Region or location</FieldLabel><Input id="provider-region" value={region} onChange={(event) => setRegion(event.target.value)} /></Field>}
          {provider.project && <Field><FieldLabel htmlFor="provider-project">{provider.projectLabel ?? "Google Cloud project"}</FieldLabel><Input id="provider-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} />{provider.projectDescription && <FieldDescription>{provider.projectDescription}</FieldDescription>}</Field>}
          {provider.command && <Field><FieldLabel htmlFor="provider-command">ACP launch command</FieldLabel><Input id="provider-command" value={command} onChange={(event) => setCommand(event.target.value)} required placeholder="agent --acp" /><FieldDescription>The process must expose ACP over standard input/output.</FieldDescription></Field>}
        </FieldGroup>
        {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Connection failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      </form>
      <Separator />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" form="provider-connection-form" disabled={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          {saving ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </div>
  );
}

export function AiSettings() {
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [clis, setClis] = useState<CliAvailability[]>([]);
  const [addingKind, setAddingKind] = useState<AiConnectionKind>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void Promise.all([listAiConnections(), detectAiClis()])
      .then(([nextConnections, nextClis]) => { setConnections(nextConnections); setClis(nextClis); })
      .catch((reason: unknown) => setError(message(reason))).finally(() => setLoading(false));
  }, []);

  const providers = useMemo(() => providerCatalog.filter((provider) => provider.category === "provider"), []);
  const agents = useMemo(() => providerCatalog.filter((provider) => provider.category === "agent"), []);
  const addingProvider = addingKind ? providerDefinition(addingKind) : undefined;

  const activate = async (connection: AiConnection) => {
    try { setConnections(await saveAiConnection({ ...connection, apiKey: undefined, active: true })); notifyAiConnectionsChanged(); }
    catch (reason) { setError(message(reason)); }
  };
  const updateModel = async (connection: AiConnection, modelId: string) => {
    try { setConnections(await saveAiConnection({ ...connection, apiKey: undefined, model: modelId })); notifyAiConnectionsChanged(); }
    catch (reason) { setError(message(reason)); throw reason; }
  };
  const remove = async (id: string) => {
    try { setConnections(await removeAiConnection(id)); notifyAiConnectionsChanged(); }
    catch (reason) { setError(message(reason)); }
  };
  const test = async (id: string) => {
    const result = await testAiConnection(id);
    if (!result.ok) throw new Error(result.error);
  };

  const providerPanel = (catalog: ProviderDefinition[], title: string, description: string) => {
    const configured = connections.filter((connection) => catalog.some((provider) => provider.kind === connection.kind));
    const isAddingHere = addingProvider && catalog.some((provider) => provider.kind === addingProvider.kind);

    if (isAddingHere) {
      return <ConnectionForm provider={addingProvider} onCancel={() => setAddingKind(undefined)} onSaved={(next) => { setConnections(next); setAddingKind(undefined); }} />;
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-6 py-5"><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>
        <Separator />
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-7 p-6">
            <section className="flex flex-col gap-3">
              <div><h3 className="font-semibold">Configured</h3><p className="text-sm text-muted-foreground">Choose a default model or manage a connection.</p></div>
              {loading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Spinner />Loading connections…</div> : configured.length === 0 ? <Empty className="border"><EmptyHeader><EmptyMedia variant="icon"><KeyRound /></EmptyMedia><EmptyTitle>No configured connections</EmptyTitle><EmptyDescription>Add one from the list below.</EmptyDescription></EmptyHeader></Empty> : (
                <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
                  <Table>
                    <TableHeader><TableRow><TableHead>Connection</TableHead><TableHead>Default model</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>{configured.map((connection) => <ConnectionRow key={connection.id} connection={connection} onActivate={(item) => void activate(item)} onModelChange={updateModel} onRemove={(id) => void remove(id)} onTest={test} onError={(reason) => setError(message(reason))} />)}</TableBody>
                  </Table>
                </div>
              )}
            </section>
            <Separator />
            <section className="flex flex-col gap-3">
              <div><h3 className="font-semibold">Add a connection</h3><p className="text-sm text-muted-foreground">Search the providers supported by this workspace.</p></div>
              <Command className="ai-settings-provider-list rounded-xl ring-1 ring-foreground/10">
                <CommandInput placeholder={`Search ${title.toLocaleLowerCase()}…`} />
                <CommandList className="max-h-none">
                  <CommandEmpty>No matching providers.</CommandEmpty>
                  <CommandGroup>
                    {catalog.map((provider) => {
                      const cli = clis.find((item) => item.kind === provider.kind);
                      const connected = connections.some((connection) => connection.kind === provider.kind);
                      return (
                        <CommandItem key={provider.kind} value={`${provider.label} ${provider.description}`} onSelect={() => setAddingKind(provider.kind)} className={cn("py-3", cli && !cli.installed && "opacity-60")}>
                          <ProviderGlyph provider={provider} />
                          <span className="flex min-w-0 flex-1 flex-col"><span className="font-medium">{provider.label}</span><span className="truncate text-xs text-muted-foreground">{provider.description}</span></span>
                          {connected ? <Check /> : <Plus />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </section>
            {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Settings error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <div className="ai-settings-shell flex min-h-0 flex-1 flex-col">
      <header className="ai-settings-hero px-7 py-6"><h2 className="text-xl font-semibold tracking-tight">Models & providers</h2><p className="text-sm text-muted-foreground">Manage the connections available across your projects.</p></header>
      <Separator />
      <Tabs defaultValue="connections" orientation="vertical" className="min-h-0 flex-1 gap-5 p-5" onValueChange={() => setAddingKind(undefined)}>
        <TabsList variant="line" className="ai-settings-nav w-44 shrink-0 items-stretch justify-start">
          <TabsTrigger value="connections"><KeyRound data-icon="inline-start" />Providers</TabsTrigger>
          <TabsTrigger value="agents"><Bot data-icon="inline-start" />Coding agents</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="min-w-0 overflow-hidden rounded-xl ring-1 ring-foreground/10">{providerPanel(providers, "Model providers", "Hosted, gateway, and local model connections.")}</TabsContent>
        <TabsContent value="agents" className="min-w-0 overflow-hidden rounded-xl ring-1 ring-foreground/10">{providerPanel(agents, "Coding agents", "Project-aware command-line agents connected through ACP.")}</TabsContent>
      </Tabs>
    </div>
  );
}
