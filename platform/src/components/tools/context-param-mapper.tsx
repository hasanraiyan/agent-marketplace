"use client";

import * as React from "react";
import {
  ShieldCheckIcon,
  LightningIcon,
  RobotIcon,
  CheckIcon,
  CaretDownIcon,
  XIcon,
  FileCodeIcon,
  MagnifyingGlassIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

export interface ContextPreset {
  key: string;
  label: string;
  description: string;
  type: "system" | "turn";
  badge: string;
}

export const SYSTEM_CONTEXT_PRESETS: ContextPreset[] = [
  {
    key: "externalUserId",
    label: "externalUserId",
    description: "Verified end-user ID from session / auth token",
    type: "system",
    badge: "Verified System",
  },
  {
    key: "callerPhone",
    label: "callerPhone",
    description: "Caller phone number (E.164) from Twilio / voice stream",
    type: "system",
    badge: "Verified Telephony",
  },
  {
    key: "callSid",
    label: "callSid",
    description: "Twilio Call SID for active voice stream session",
    type: "system",
    badge: "Verified Telephony",
  },
  {
    key: "threadId",
    label: "threadId",
    description: "Active conversation thread identifier",
    type: "system",
    badge: "Verified System",
  },
  {
    key: "agentId",
    label: "agentId",
    description: "Active Agent ID running the execution",
    type: "system",
    badge: "Verified System",
  },
];

export const TURN_CONTEXT_PRESETS: ContextPreset[] = [
  {
    key: "userEmail",
    label: "userEmail",
    description: "End-user email address supplied by host application",
    type: "turn",
    badge: "Turn Context",
  },
  {
    key: "userName",
    label: "userName",
    description: "User display name supplied by host application",
    type: "turn",
    badge: "Turn Context",
  },
  {
    key: "orgId",
    label: "orgId",
    description: "Tenant / Organization ID from host application state",
    type: "turn",
    badge: "Turn Context",
  },
  {
    key: "workspaceId",
    label: "workspaceId",
    description: "Workspace ID from host application state",
    type: "turn",
    badge: "Turn Context",
  },
  {
    key: "locale",
    label: "locale",
    description: "User language or locale (e.g. en-US)",
    type: "turn",
    badge: "Turn Context",
  },
];

export function getContextKeyMeta(key: string): ContextPreset {
  const sys = SYSTEM_CONTEXT_PRESETS.find((p) => p.key === key);
  if (sys) return sys;
  const turn = TURN_CONTEXT_PRESETS.find((p) => p.key === key);
  if (turn) return turn;
  return {
    key,
    label: key,
    description: "Custom turn context variable passed by caller",
    type: "turn",
    badge: "Custom Turn Context",
  };
}

export interface ContextParamItem {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

export interface ContextParamMapperProps {
  params: ContextParamItem[];
  contextKeys: Record<string, string>;
  onChangeKey: (paramName: string, contextKey: string) => void;
  className?: string;
}

export function ContextParamMapper({
  params = [],
  contextKeys = {},
  onChangeKey,
  className = "",
}: ContextParamMapperProps) {
  const [filterQuery, setFilterQuery] = React.useState("");
  const [customKeyInput, setCustomKeyInput] = React.useState<
    Record<string, string>
  >({});
  const [showIntegrationGuide, setShowIntegrationGuide] = React.useState(false);

  const filteredParams = React.useMemo(() => {
    if (!filterQuery.trim()) return params;
    const q = filterQuery.toLowerCase();
    return params.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.type && p.type.toLowerCase().includes(q)),
    );
  }, [params, filterQuery]);

  const mappedCount = React.useMemo(() => {
    return params.filter((p) => (contextKeys[p.name] || "").trim().length > 0)
      .length;
  }, [params, contextKeys]);

  const handleMap = (paramName: string, key: string) => {
    onChangeKey(paramName, key.trim());
  };

  const handleUnmap = (paramName: string) => {
    onChangeKey(paramName, "");
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Parameter Context Inversion
            </h3>
            <Badge variant="secondary" className="text-xs font-mono">
              {mappedCount} / {params.length} Injected
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Parameters mapped to context keys are resolved at runtime and hidden
            from the LLM. Unmapped parameters remain ordinary, model-fillable
            arguments.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
          onClick={() => setShowIntegrationGuide(!showIntegrationGuide)}
        >
          <FileCodeIcon className="size-3.5" />
          {showIntegrationGuide ? "Hide Guide" : "Integration Guide"}
        </Button>
      </div>

      {/* Integration Guide Collapsible */}
      <Collapsible
        open={showIntegrationGuide}
        onOpenChange={setShowIntegrationGuide}
      >
        <CollapsibleContent className="rounded-none border border-border bg-muted/30 p-4 text-xs space-y-3">
          <div className="flex items-start gap-2 text-foreground font-medium">
            <InfoIcon className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span>How runtime context resolution works</span>
              <p className="font-normal text-muted-foreground mt-0.5">
                When an Agent calls an RCP tool, Persona intercepts mapped
                parameters before invoking your service. Values come from either
                verified server state or caller turn-context.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="rounded-none border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <ShieldCheckIcon className="size-3.5 text-blue-500" />
                Verified System Context
              </div>
              <p className="text-[11px] text-muted-foreground">
                Guaranteed by Persona session tokens or telephony gateways.
                Secure for user authentication and tenant identification:
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {SYSTEM_CONTEXT_PRESETS.map((p) => (
                  <code
                    key={p.key}
                    className="rounded-none bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground"
                  >
                    {p.key}
                  </code>
                ))}
              </div>
            </div>

            <div className="rounded-none border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <LightningIcon className="size-3.5 text-amber-500" />
                Caller Turn Context
              </div>
              <p className="text-[11px] text-muted-foreground">
                Sent by your frontend app via SDK or React hooks on each chat
                turn:
              </p>
              <pre className="rounded-none bg-muted p-2 font-mono text-[10px] text-foreground overflow-x-auto">
                {`const { sendMessage } = useChat({
  context: {
    orgId: currentOrg.id,
    userEmail: user.email,
  },
});`}
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filter bar if many params */}
      {params.length > 3 && (
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter parameters by name or type..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/20"
          />
        </div>
      )}

      {/* Parameter Cards List */}
      <div className="space-y-2">
        {filteredParams.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No parameters match filter.
          </p>
        ) : (
          filteredParams.map((param) => {
            const currentMappedKey = (contextKeys[param.name] || "").trim();
            const isMapped = currentMappedKey.length > 0;
            const meta = isMapped ? getContextKeyMeta(currentMappedKey) : null;
            const customVal = customKeyInput[param.name] ?? "";

            return (
              <div
                key={param.name}
                className={`flex flex-col gap-2 rounded-none border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                  isMapped
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                {/* Param Details */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {param.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] px-1.5 py-0"
                    >
                      {param.type || "string"}
                    </Badge>
                    {param.required && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 text-amber-600 dark:text-amber-400 font-medium"
                      >
                        Required
                      </Badge>
                    )}
                    {isMapped ? (
                      <span className="inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <LightningIcon className="size-2.5" />
                        Injected from Context
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        <RobotIcon className="size-2.5" />
                        Model-Fillable
                      </span>
                    )}
                  </div>

                  {param.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {param.description}
                    </p>
                  )}
                </div>

                {/* Mapping Controls */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  {isMapped ? (
                    <div className="flex items-center gap-1.5 bg-background border border-border rounded-none px-2 py-1 shadow-xs">
                      <div className="flex items-center gap-1 text-xs font-mono font-medium text-foreground">
                        {meta?.type === "system" ? (
                          <ShieldCheckIcon className="size-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <LightningIcon className="size-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="max-w-[130px] truncate">
                          {currentMappedKey}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 font-normal ${
                          meta?.type === "system"
                            ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
                            : "border-amber-500/30 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {meta?.badge || "Context"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-5 rounded-none hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleUnmap(param.name)}
                        title="Revert to Model-Fillable argument"
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </div>
                  ) : null}

                  {/* Dropdown to pick preset or insert custom */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant={isMapped ? "outline" : "secondary"}
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium"
                      >
                        {isMapped ? "Change Key" : "Map to Context"}
                        <CaretDownIcon className="size-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-72">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                          <ShieldCheckIcon className="size-3.5" />
                          Verified System Context
                        </DropdownMenuLabel>
                        {SYSTEM_CONTEXT_PRESETS.map((preset) => (
                          <DropdownMenuItem
                            key={preset.key}
                            onClick={() => handleMap(param.name, preset.key)}
                            className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                          >
                            <div className="flex items-center justify-between w-full">
                              <code className="text-xs font-semibold">
                                {preset.key}
                              </code>
                              {currentMappedKey === preset.key && (
                                <CheckIcon className="size-3 text-primary" />
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {preset.description}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>

                      <DropdownMenuSeparator />

                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <LightningIcon className="size-3.5" />
                          Turn Context Presets
                        </DropdownMenuLabel>
                        {TURN_CONTEXT_PRESETS.map((preset) => (
                          <DropdownMenuItem
                            key={preset.key}
                            onClick={() => handleMap(param.name, preset.key)}
                            className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                          >
                            <div className="flex items-center justify-between w-full">
                              <code className="text-xs font-semibold">
                                {preset.key}
                              </code>
                              {currentMappedKey === preset.key && (
                                <CheckIcon className="size-3 text-primary" />
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {preset.description}
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>

                      <DropdownMenuSeparator />

                      {/* Custom context key entry */}
                      <div className="p-2 space-y-2">
                        <span className="text-[10px] font-medium text-muted-foreground block">
                          Custom Variable Name:
                        </span>
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="e.g. courseId, teamId"
                            value={customVal}
                            onChange={(e) =>
                              setCustomKeyInput((prev) => ({
                                ...prev,
                                [param.name]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (customVal.trim()) {
                                  handleMap(param.name, customVal.trim());
                                }
                              }
                            }}
                            className="h-7 text-xs font-mono"
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={!customVal.trim()}
                            onClick={() => {
                              handleMap(param.name, customVal.trim());
                            }}
                          >
                            Set
                          </Button>
                        </div>
                      </div>

                      {isMapped && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleUnmap(param.name)}
                            className="text-destructive focus:text-destructive cursor-pointer text-xs"
                          >
                            Unmap (Make Model-Fillable)
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Security notice footer */}
      <div className="rounded-none bg-muted/30 border border-border/50 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
        <ShieldCheckIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <span>
          <strong>Security Notice:</strong> Turn context keys are
          caller-supplied from your client application. For sensitive
          identification (such as verified user IDs), always map to verified
          system context tokens like{" "}
          <code className="font-mono text-foreground">externalUserId</code>.
        </span>
      </div>
    </div>
  );
}
