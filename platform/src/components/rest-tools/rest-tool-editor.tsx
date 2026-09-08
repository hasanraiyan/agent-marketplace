"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  FloppyDiskIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createProjectRestTool,
  updateProjectRestTool,
  testProjectRestTool,
} from "@/lib/api/projects";
import { cacheKey, deleteCachedByPrefix } from "@/lib/cache";
import { SecretPicker } from "./secret-picker";
import { CurlPasteDialog } from "./curl-paste-dialog";

const RESERVED_TOKENS = ["externalUserId"];
const TOKEN_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

interface ParamRow {
  key: string;
  valueTemplate: string;
  description: string;
  required: boolean;
}

interface ParamDescriptor {
  name: string;
  in: "path" | "query" | "header" | "body";
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
}

interface ResponseMapping {
  field: string;
  path: string;
}

interface RestApiTool {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  method: string;
  url: string;
  queryParams?: ParamRow[];
  headers?: ParamRow[];
  bodyMode?: "none" | "json";
  bodyTemplate?: string;
  paramDescriptors?: ParamDescriptor[];
  authType?: "none" | "bearerSecret";
  secretRef?: string | null;
  responseMappings?: ResponseMapping[];
  isEnabled?: boolean;
}

interface ToolForm {
  name: string;
  description: string;
  method: string;
  url: string;
  queryParams: ParamRow[];
  headers: ParamRow[];
  bodyMode: "none" | "json";
  bodyTemplate: string;
  paramDescriptors: ParamDescriptor[];
  authType: "none" | "bearerSecret";
  secretRef: string | null;
  responseMappings: ResponseMapping[];
  isEnabled: boolean;
}

function extractTokenNames(text: string | null | undefined): string[] {
  if (!text) return [];
  const names: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_PATTERN.lastIndex = 0;
  while ((m = TOKEN_PATTERN.exec(text))) names.push(m[1]);
  return names;
}

function collectTokens(form: {
  url: string;
  queryParams: ParamRow[];
  headers: ParamRow[];
  bodyMode: "none" | "json";
  bodyTemplate: string;
}) {
  const texts = [
    form.url,
    ...form.queryParams.map((p) => p.valueTemplate),
    ...form.headers.map((h) => h.valueTemplate),
    form.bodyMode === "json" ? form.bodyTemplate : null,
  ];
  const reserved: string[] = [];
  const agent: string[] = [];
  const seenReserved = new Set<string>();
  const seenAgent = new Set<string>();
  for (const text of texts) {
    for (const name of extractTokenNames(text)) {
      if (RESERVED_TOKENS.includes(name)) {
        if (!seenReserved.has(name)) {
          seenReserved.add(name);
          reserved.push(name);
        }
      } else if (!seenAgent.has(name)) {
        seenAgent.add(name);
        agent.push(name);
      }
    }
  }
  return { reserved, agent };
}

function emptyForm(): ToolForm {
  return {
    name: "",
    description: "",
    method: "GET",
    url: "",
    queryParams: [],
    headers: [],
    bodyMode: "none",
    bodyTemplate: "",
    paramDescriptors: [],
    authType: "none",
    secretRef: null,
    responseMappings: [],
    isEnabled: true,
  };
}

function formFromTool(tool: RestApiTool): ToolForm {
  return {
    name: tool.name || "",
    description: tool.description || "",
    method: tool.method || "GET",
    url: tool.url || "",
    queryParams: tool.queryParams || [],
    headers: tool.headers || [],
    bodyMode: tool.bodyMode || "none",
    bodyTemplate: tool.bodyTemplate || "",
    paramDescriptors: tool.paramDescriptors || [],
    authType: tool.authType || "none",
    secretRef: tool.secretRef || null,
    responseMappings: tool.responseMappings || [],
    isEnabled: tool.isEnabled !== false,
  };
}

function VariableInsertMenu({
  agentTokens,
  onInsert,
}: {
  agentTokens: string[];
  onInsert: (token: string) => void;
}) {
  const insertNew = () => {
    const name = window.prompt("New variable name (letters, numbers, _)");
    if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      onInsert(`{{${name}}}`);
    } else if (name) {
      window.alert("Invalid variable name — use letters, numbers, and _ only.");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            title="Insert variable"
            aria-label="Insert variable"
          >
            <CaretDownIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Reserved</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onInsert("{{externalUserId}}")}>
          <code className="text-xs">{"{{externalUserId}}"}</code>
          <span className="ml-auto text-[10px] text-muted-foreground">resolved by Persona</span>
        </DropdownMenuItem>
        {agentTokens.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Agent-fillable</DropdownMenuLabel>
            {agentTokens.map((name) => (
              <DropdownMenuItem key={name} onClick={() => onInsert(`{{${name}}`)}>
                <code className="text-xs">{`{{${name}}}`}</code>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={insertNew}>
          <PlusIcon className="size-3.5" />
          New variable…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ParamRows({
  rows,
  onChange,
  agentTokens,
  placeholder,
}: {
  rows: ParamRow[];
  onChange: (rows: ParamRow[]) => void;
  agentTokens: string[];
  placeholder?: string;
}) {
  const update = (idx: number, patch: Partial<ParamRow>) => {
    const next = rows.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () =>
    onChange([...rows, { key: "", valueTemplate: "", description: "", required: true }]);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-start gap-2 rounded-none border p-3">
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Input
              placeholder="Key"
              value={row.key}
              onChange={(e) => update(idx, { key: e.target.value })}
            />
            <div className="flex gap-1.5">
              <Input
                placeholder={placeholder || "Value or {{token}}"}
                value={row.valueTemplate}
                onChange={(e) => update(idx, { valueTemplate: e.target.value })}
                className="font-mono text-xs"
              />
              <VariableInsertMenu
                agentTokens={agentTokens}
                onInsert={(token) =>
                  update(idx, { valueTemplate: (row.valueTemplate || "") + token })
                }
              />
            </div>
            <Input
              placeholder="Description (optional)"
              value={row.description}
              onChange={(e) => update(idx, { description: e.target.value })}
              className="col-span-2 text-xs"
            />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
            <TrashIcon className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={add}>
        <PlusIcon data-icon="inline-start" className="size-3.5" />
        Add parameter
      </Button>
    </div>
  );
}

/**
 * No-code REST API Tool Builder — define a URL + auth + param mapping that
 * this Project's Agents can call. Mirrors the legacy developer-studio
 * editor, adapted to the platform's UI primitives and error handling.
 */
function RestApiToolEditor({
  projectId,
  tool,
  mode = "new",
}: {
  projectId: string;
  tool: RestApiTool | null;
  mode?: "new" | "edit";
}) {
  const router = useRouter();
  const isCreating = mode === "new";
  const backHref = `/projects/${projectId}/rest-tools`;

  const [form, setForm] = React.useState<ToolForm>(() => (tool ? formFromTool(tool) : emptyForm()));
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ status?: number; body?: unknown } | null>(null);
  const [testValues, setTestValues] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);

  const { reserved: reservedTokens, agent: agentTokens } = React.useMemo(
    () =>
      collectTokens({
        url: form.url,
        queryParams: form.queryParams,
        headers: form.headers,
        bodyMode: form.bodyMode,
        bodyTemplate: form.bodyTemplate,
      }),
    [form.url, form.queryParams, form.headers, form.bodyMode, form.bodyTemplate]
  );

  // Auto-derive paramDescriptors from whatever agent-fillable tokens are
  // currently referenced, preserving existing description/type/required
  // edits and dropping descriptors for tokens no longer referenced. The
  // synchronous functional update is intentional (keeps user edits on the
  // descriptors, drops stale ones) — derived-but-mutable state.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => {
      const existing = new Map(prev.paramDescriptors.map((d) => [d.name, d]));
      const fallback: ParamDescriptor = {
        name: "",
        in: "body",
        type: "string",
        description: "",
        required: true,
      };
      const next: ParamDescriptor[] = agentTokens.map((name) => {
        const existingDesc = existing.get(name);
        if (existingDesc) return existingDesc;
        return { ...fallback, name };
      });
      if (
        next.length === prev.paramDescriptors.length &&
        next.every((d, i) => d.name === prev.paramDescriptors[i]?.name)
      ) {
        return prev;
      }
      return { ...prev, paramDescriptors: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentTokens.join(",")]);

  const updateDescriptor = (name: string, patch: Partial<ParamDescriptor>) => {
    setForm((prev) => ({
      ...prev,
      paramDescriptors: prev.paramDescriptors.map((d) => (d.name === name ? { ...d, ...patch } : d)),
    }));
  };

  const buildPayload = () => ({
    name: form.name,
    description: form.description || undefined,
    method: form.method,
    url: form.url,
    queryParams: form.queryParams,
    headers: form.headers,
    bodyMode: form.bodyMode,
    bodyTemplate: form.bodyMode === "json" ? form.bodyTemplate : "",
    paramDescriptors: form.paramDescriptors,
    authType: form.authType,
    ...(form.authType === "bearerSecret" ? { secretRef: form.secretRef } : {}),
    responseMappings: form.responseMappings,
    isEnabled: form.isEnabled,
  });

  const errorMessage = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!form.url.trim()) {
      setFormError("URL is required");
      return;
    }
    if (form.authType === "bearerSecret" && !form.secretRef) {
      setFormError("Select or create a secret for Bearer auth");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = buildPayload();
      if (isCreating) {
        await createProjectRestTool(projectId, payload);
      } else {
        await updateProjectRestTool(projectId, (tool?.id ?? tool?._id) as string, payload);
      }
      deleteCachedByPrefix(cacheKey.resource(projectId, "rest-tools"));
      router.push(backHref);
    } catch (err) {
      setFormError(errorMessage(err, "Failed to save tool."));
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.url.trim()) {
      setTestError("URL is required to test");
      return;
    }
    setTesting(true);
    setTestError(null);
    try {
      const res = await testProjectRestTool(projectId, {
        draft: buildPayload(),
        testValues,
      });
      setTestResult(res.data?.data);
    } catch (err) {
      setTestError(errorMessage(err, "Test call failed."));
    } finally {
      setTesting(false);
    }
  };

  const handleCurlParsed = (parsed: {
    method: string;
    url: string;
    queryParams: { key: string; value: string }[];
    headers: { key: string; value: string }[];
    body: string | null;
  }) => {
    setForm((prev) => ({
      ...prev,
      method: parsed.method,
      url: parsed.url,
      queryParams: parsed.queryParams.map((q) => ({
        key: q.key,
        valueTemplate: q.value,
        description: "",
        required: true,
      })),
      headers: parsed.headers.map((h) => ({
        key: h.key,
        valueTemplate: h.value,
        description: "",
        required: true,
      })),
      bodyMode: parsed.body ? "json" : prev.bodyMode,
      bodyTemplate: parsed.body || prev.bodyTemplate,
    }));
  };

  const addMapping = () =>
    setForm((prev) => ({
      ...prev,
      responseMappings: [...prev.responseMappings, { field: "", path: "" }],
    }));
  const updateMapping = (idx: number, patch: Partial<ResponseMapping>) =>
    setForm((prev) => ({
      ...prev,
      responseMappings: prev.responseMappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  const removeMapping = (idx: number) =>
    setForm((prev) => ({
      ...prev,
      responseMappings: prev.responseMappings.filter((_, i) => i !== idx),
    }));

  const steps = ["Basics", "Set up the API call", "Response mapping"];

  return (
    <div className="flex w-full flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {isCreating ? "New REST API Tool" : `Edit ${tool?.name || ""}`}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Define a no-code REST tool this Project&apos;s Agents can call.
          </p>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" render={<a href={backHref} />}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" />
          Back
        </Button>
      </div>

      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList className="w-fit">
          {steps.map((label, idx) => (
            <TabsTrigger key={idx} value={String(idx)}>
              {idx + 1}. {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-4">
          <CardContent className="flex flex-col gap-6 p-6">
            <TabsContent value="0">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="tool-name">Name</FieldLabel>
                  <Input
                    id="tool-name"
                    placeholder="e.g. Get learner profile"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    maxLength={100}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="tool-desc">Description</FieldLabel>
                  <Textarea
                    id="tool-desc"
                    placeholder="What does this tool do? Shown to the agent as the tool's description."
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    rows={3}
                    maxLength={500}
                  />
                </Field>
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium">Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      Available for this Project&apos;s Agents to attach.
                    </p>
                  </div>
                  <Switch
                    checked={form.isEnabled}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, isEnabled: !!checked }))}
                  />
                </div>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="1" className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Select
                  value={form.method}
                  onValueChange={(v) => setForm((p) => ({ ...p, method: v ?? "GET" }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="https://api.example.com/users/{{userId}}"
                  value={form.url}
                  onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                  className="min-w-0 flex-1 font-mono text-xs"
                />
                <VariableInsertMenu
                  agentTokens={agentTokens}
                  onInsert={(token) => setForm((p) => ({ ...p, url: (p.url || "") + token }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="shrink-0"
                >
                  {testing ? (
                    <SpinnerIcon className="size-4 animate-spin" />
                  ) : (
                    <PlayIcon className="size-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Send</span>
                </Button>
              </div>
              {testError && <FieldError>{testError}</FieldError>}

              {reservedTokens.length > 0 && (
                <div className="flex flex-col gap-2 rounded-none border bg-muted/20 p-3 sm:flex-row sm:items-center">
                  <Badge variant="secondary">{"{{externalUserId}}"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Resolved automatically from the calling end-user&apos;s session — never editable
                    by the agent. To test, supply a stand-in below.
                  </span>
                  <Input
                    placeholder="Test externalUserId"
                    value={testValues.externalUserId || ""}
                    onChange={(e) =>
                      setTestValues((p) => ({ ...p, externalUserId: e.target.value }))
                    }
                    className="font-mono text-xs sm:ml-auto sm:w-48"
                  />
                </div>
              )}

              <CurlPasteDialog onParsed={handleCurlParsed} />

              <Tabs defaultValue="path" className="flex flex-col gap-2">
                <TabsList variant="line" className="w-fit">
                  <TabsTrigger value="path">Path</TabsTrigger>
                  <TabsTrigger value="params">Params</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="auth">Auth</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                </TabsList>

                <TabsContent value="path" className="flex flex-col gap-3">
                  {form.paramDescriptors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No <code>{"{{variables}}"}</code> yet — insert one from the URL, a param, a
                      header, or the body using the variable menu.
                    </p>
                  ) : (
                    form.paramDescriptors.map((d) => (
                      <div key={d.name} className="flex flex-col gap-2 rounded-none border p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <code className="w-32 shrink-0 text-xs font-semibold">{`{{${d.name}}}`}</code>
                          <Select
                            value={d.type}
                            onValueChange={(v) =>
                              updateDescriptor(d.name, { type: (v ?? "string") as ParamDescriptor["type"] })
                            }
                          >
                            <SelectTrigger className="w-28 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="boolean">boolean</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Description for the agent"
                            value={d.description}
                            onChange={(e) =>
                              updateDescriptor(d.name, { description: e.target.value })
                            }
                            className="min-w-0 flex-1 text-xs"
                          />
                          <div className="flex items-center gap-1.5 text-xs">
                            <Switch
                              checked={d.required !== false}
                              onCheckedChange={(v) => updateDescriptor(d.name, { required: !!v })}
                            />
                            Required
                          </div>
                        </div>
                        <Input
                          placeholder={`Test value for {{${d.name}}} (used by "Send" only)`}
                          value={testValues[d.name] || ""}
                          onChange={(e) =>
                            setTestValues((p) => ({ ...p, [d.name]: e.target.value }))
                          }
                          className="font-mono text-xs sm:ml-[8.5rem]"
                        />
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="params" className="flex flex-col gap-3">
                  <ParamRows
                    rows={form.queryParams}
                    onChange={(rows) => setForm((p) => ({ ...p, queryParams: rows }))}
                    agentTokens={agentTokens}
                  />
                </TabsContent>

                <TabsContent value="headers" className="flex flex-col gap-3">
                  <ParamRows
                    rows={form.headers}
                    onChange={(rows) => setForm((p) => ({ ...p, headers: rows }))}
                    agentTokens={agentTokens}
                  />
                </TabsContent>

                <TabsContent value="auth" className="flex flex-col gap-4">
                  <Field>
                    <FieldLabel>Auth type</FieldLabel>
                    <Select
                      value={form.authType}
                      onValueChange={(v) => setForm((p) => ({ ...p, authType: (v ?? "none") as ToolForm["authType"] }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bearerSecret">Bearer token (project secret)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Sent as <code>Authorization: Bearer &lt;secret&gt;</code> so your endpoint can
                      verify the call came from Persona.
                    </FieldDescription>
                  </Field>
                  {form.authType === "bearerSecret" && (
                    <SecretPicker
                      projectId={projectId}
                      value={form.secretRef}
                      onChange={(secretId) => setForm((p) => ({ ...p, secretRef: secretId }))}
                    />
                  )}
                </TabsContent>

                <TabsContent value="body" className="flex flex-col gap-3">
                  <Field>
                    <FieldLabel>Body</FieldLabel>
                    <Select
                      value={form.bodyMode}
                      onValueChange={(v) => setForm((p) => ({ ...p, bodyMode: (v ?? "none") as ToolForm["bodyMode"] }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {form.bodyMode === "json" && (
                    <div className="flex gap-1.5">
                      <Textarea
                        rows={8}
                        placeholder={'{\n  "name": "{{name}}"\n}'}
                        value={form.bodyTemplate}
                        onChange={(e) => setForm((p) => ({ ...p, bodyTemplate: e.target.value }))}
                        className="font-mono text-xs"
                      />
                      <VariableInsertMenu
                        agentTokens={agentTokens}
                        onInsert={(token) =>
                          setForm((p) => ({ ...p, bodyTemplate: (p.bodyTemplate || "") + token }))
                        }
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="2" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <FieldLabel>Last test response</FieldLabel>
                {testResult ? (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-none border bg-muted/20 p-3 text-xs">
                    {JSON.stringify(testResult.body, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Hit &quot;Send&quot; on the previous step to see a live response here.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {form.responseMappings.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-none border p-3">
                    <Input
                      placeholder="field name"
                      value={m.field}
                      onChange={(e) => updateMapping(idx, { field: e.target.value })}
                    />
                    <Input
                      placeholder="@data.user.name"
                      value={m.path}
                      onChange={(e) => updateMapping(idx, { path: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeMapping(idx)}>
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addMapping}>
                  <PlusIcon data-icon="inline-start" className="size-3.5" />
                  Add field mapping
                </Button>
              </div>
              <FieldDescription>
                Leave empty to return the raw JSON response to the agent unmapped.
              </FieldDescription>
            </TabsContent>
          </CardContent>

          <CardFooter className="flex flex-col items-stretch justify-between gap-3 border-t p-6 sm:flex-row sm:items-center">
            {formError && <FieldError className="flex-1">{formError}</FieldError>}
            <div className="flex gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < steps.length - 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(step + 1)}>
                  Next
                </Button>
              )}
            </div>
            <Button type="button" onClick={handleSave} disabled={saving} className="shadow-sm">
              {saving && <SpinnerIcon className="mr-2 size-4 animate-spin" />}
              <FloppyDiskIcon data-icon={saving ? undefined : "inline-start"} className={saving ? "hidden" : ""} />
              {isCreating ? "Create tool" : "Save changes"}
            </Button>
          </CardFooter>
        </Card>
      </Tabs>
    </div>
  );
}

export { RestApiToolEditor };