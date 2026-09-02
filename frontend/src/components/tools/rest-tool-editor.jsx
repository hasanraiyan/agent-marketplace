"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  Save,
} from "lucide-react";
import {
  createProjectRestTool,
  updateProjectRestTool,
  testProjectRestTool,
} from "@/lib/api/projects";
import { developerRoutes } from "@/lib/developer-routes";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SecretPicker } from "./secret-picker";
import { CurlPasteDialog } from "./curl-paste-dialog";

const RESERVED_TOKENS = ["externalUserId"];
const TOKEN_PATTERN = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

function extractTokenNames(text) {
  if (!text) return [];
  const names = [];
  let m;
  TOKEN_PATTERN.lastIndex = 0;
  while ((m = TOKEN_PATTERN.exec(text))) names.push(m[1]);
  return names;
}

function collectTokens(form) {
  const texts = [
    form.url,
    ...form.queryParams.map((p) => p.valueTemplate),
    ...form.headers.map((h) => h.valueTemplate),
    form.bodyMode === "json" ? form.bodyTemplate : null,
  ];
  const reserved = [];
  const agent = [];
  const seenReserved = new Set();
  const seenAgent = new Set();
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

function emptyForm() {
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

function VariableInsertMenu({ agentTokens, onInsert }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0" title="Insert variable">
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Reserved</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onInsert("{{externalUserId}}")}>
          <code className="text-xs">{"{{externalUserId}}"}</code>
          <span className="ml-auto text-[10px] text-muted-foreground">
            resolved by Persona
          </span>
        </DropdownMenuItem>
        {agentTokens.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Agent-fillable</DropdownMenuLabel>
            {agentTokens.map((name) => (
              <DropdownMenuItem key={name} onClick={() => onInsert(`{{${name}}}`)}>
                <code className="text-xs">{`{{${name}}}`}</code>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            const name = window.prompt("New variable name (letters, numbers, _)");
            if (name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
              onInsert(`{{${name}}}`);
            } else if (name) {
              toast.error("Invalid variable name");
            }
          }}
        >
          <Plus className="size-3.5" />
          New variable…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ParamRows({ rows, onChange, agentTokens, placeholder }) {
  const update = (idx, patch) => {
    const next = rows.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { key: "", valueTemplate: "", description: "", required: true }]);

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
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
                onInsert={(token) => update(idx, { valueTemplate: (row.valueTemplate || "") + token })}
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
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1.5 size-3.5" />
        Add parameter
      </Button>
    </div>
  );
}

export function RestApiToolEditor({ projectId, tool, mode = "new" }) {
  const router = useRouter();
  const isCreating = mode === "new";

  const [form, setForm] = useState(() => {
    if (!tool) return emptyForm();
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
  });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testValues, setTestValues] = useState({});

  const { reserved: reservedTokens, agent: agentTokens } = useMemo(
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
  // edits and dropping descriptors for tokens no longer referenced.
  useEffect(() => {
    setForm((prev) => {
      const existing = new Map(prev.paramDescriptors.map((d) => [d.name, d]));
      const next = agentTokens.map(
        (name) => existing.get(name) || { name, in: "body", type: "string", description: "", required: true }
      );
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

  const updateDescriptor = (name, patch) => {
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.url.trim()) {
      toast.error("URL is required");
      return;
    }
    if (form.authType === "bearerSecret" && !form.secretRef) {
      toast.error("Select or create a secret for Bearer auth");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isCreating) {
        await createProjectRestTool(projectId, payload);
        toast.success("REST API tool created.");
      } else {
        await updateProjectRestTool(projectId, tool._id || tool.id, payload);
        toast.success("REST API tool updated.");
      }
      router.push(developerRoutes.project(projectId));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save tool.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.url.trim()) {
      toast.error("URL is required to test");
      return;
    }
    setTesting(true);
    try {
      const res = await testProjectRestTool(projectId, {
        draft: buildPayload(),
        testValues,
      });
      setTestResult(res.data?.data);
      toast.success(`Request sent — status ${res.data?.data?.status}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Test call failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleCurlParsed = (parsed) => {
    setForm((prev) => ({
      ...prev,
      method: parsed.method,
      url: parsed.url,
      queryParams: parsed.queryParams.map((q) => ({ ...q, description: "", required: true })),
      headers: parsed.headers.map((h) => ({ ...h, description: "", required: true })),
      bodyMode: parsed.body ? "json" : prev.bodyMode,
      bodyTemplate: parsed.body || prev.bodyTemplate,
    }));
  };

  const addMapping = () =>
    setForm((prev) => ({
      ...prev,
      responseMappings: [...prev.responseMappings, { field: "", path: "" }],
    }));
  const updateMapping = (idx, patch) =>
    setForm((prev) => ({
      ...prev,
      responseMappings: prev.responseMappings.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    }));
  const removeMapping = (idx) =>
    setForm((prev) => ({
      ...prev,
      responseMappings: prev.responseMappings.filter((_, i) => i !== idx),
    }));

  const steps = ["Basics", "Set up the API call", "Response mapping"];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            {isCreating ? "New REST API Tool" : `Edit ${tool?.name || ""}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Define a no-code REST tool this Project&apos;s Agents can call.
          </p>
        </div>
        <Link
          href={developerRoutes.project(projectId)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <Tabs value={String(step)} onValueChange={(v) => setStep(Number(v))}>
        <TabsList>
          {steps.map((label, idx) => (
            <TabsTrigger key={idx} value={String(idx)}>
              {idx + 1}. {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="mt-4">
          <CardContent className="space-y-6 p-6">
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
                    <p className="text-sm text-muted-foreground">
                      Available for this Project&apos;s Agents to attach.
                    </p>
                  </div>
                  <Switch
                    checked={form.isEnabled}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, isEnabled: checked }))}
                  />
                </div>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="1" className="space-y-4">
              <div className="flex gap-2">
                <Select value={form.method} onValueChange={(v) => setForm((p) => ({ ...p, method: v }))}>
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
                  className="font-mono text-xs"
                />
                <VariableInsertMenu
                  agentTokens={agentTokens}
                  onInsert={(token) => setForm((p) => ({ ...p, url: (p.url || "") + token }))}
                />
                <Button type="button" variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Send</span>
                </Button>
              </div>

              {reservedTokens.length > 0 && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
                  <Badge variant="secondary">{"{{externalUserId}}"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Resolved automatically from the calling end-user&apos;s session — never
                    editable by the agent. To test, supply a stand-in below.
                  </span>
                  <Input
                    placeholder="Test externalUserId"
                    value={testValues.externalUserId || ""}
                    onChange={(e) =>
                      setTestValues((p) => ({ ...p, externalUserId: e.target.value }))
                    }
                    className="ml-auto max-w-48 text-xs"
                  />
                </div>
              )}

              <CurlPasteDialog onParsed={handleCurlParsed} />

              <Tabs defaultValue="path">
                <TabsList variant="line">
                  <TabsTrigger value="path">Path</TabsTrigger>
                  <TabsTrigger value="params">Params</TabsTrigger>
                  <TabsTrigger value="headers">Headers</TabsTrigger>
                  <TabsTrigger value="auth">Auth</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                </TabsList>

                <TabsContent value="path" className="pt-4">
                  {form.paramDescriptors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No <code>{"{{variables}}"}</code> yet — insert one from the URL, a param,
                      a header, or the body using the variable menu.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.paramDescriptors.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 rounded-lg border p-3">
                          <code className="w-32 shrink-0 text-xs font-semibold">{`{{${d.name}}}`}</code>
                          <Select
                            value={d.type}
                            onValueChange={(v) => updateDescriptor(d.name, { type: v })}
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
                            onChange={(e) => updateDescriptor(d.name, { description: e.target.value })}
                            className="flex-1 text-xs"
                          />
                          <div className="flex items-center gap-1.5 text-xs">
                            <Switch
                              checked={d.required !== false}
                              onCheckedChange={(v) => updateDescriptor(d.name, { required: v })}
                            />
                            Required
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="params" className="pt-4">
                  <ParamRows
                    rows={form.queryParams}
                    onChange={(rows) => setForm((p) => ({ ...p, queryParams: rows }))}
                    agentTokens={agentTokens}
                  />
                </TabsContent>

                <TabsContent value="headers" className="pt-4">
                  <ParamRows
                    rows={form.headers}
                    onChange={(rows) => setForm((p) => ({ ...p, headers: rows }))}
                    agentTokens={agentTokens}
                  />
                </TabsContent>

                <TabsContent value="auth" className="space-y-4 pt-4">
                  <Field>
                    <FieldLabel>Auth type</FieldLabel>
                    <Select
                      value={form.authType}
                      onValueChange={(v) => setForm((p) => ({ ...p, authType: v }))}
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
                      Sent as <code>Authorization: Bearer &lt;secret&gt;</code> so your endpoint
                      can verify the call came from Persona.
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

                <TabsContent value="body" className="space-y-3 pt-4">
                  <Field>
                    <FieldLabel>Body</FieldLabel>
                    <Select
                      value={form.bodyMode}
                      onValueChange={(v) => setForm((p) => ({ ...p, bodyMode: v }))}
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

            <TabsContent value="2" className="space-y-4">
              <div>
                <FieldLabel>Last test response</FieldLabel>
                {testResult ? (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border bg-muted/20 p-3 text-xs">
                    {JSON.stringify(testResult.body, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Hit &quot;Send&quot; on the previous step to see a live response here.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {form.responseMappings.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border p-3">
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
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addMapping}>
                  <Plus className="mr-1.5 size-3.5" />
                  Add field mapping
                </Button>
              </div>
              <FieldDescription>
                Leave empty to return the raw JSON response to the agent unmapped.
              </FieldDescription>
            </TabsContent>
          </CardContent>

          <CardFooter className="flex justify-between border-t p-6">
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
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="!bg-[#1E60FF] !text-white shadow-md shadow-[#1E60FF]/15 transition-all duration-300 hover:scale-[1.02] hover:!bg-[#154ed0] active:scale-[0.98]"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {isCreating ? "Create tool" : "Save changes"}
            </Button>
          </CardFooter>
        </Card>
      </Tabs>
    </div>
  );
}
