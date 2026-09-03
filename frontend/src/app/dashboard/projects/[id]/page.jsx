"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  FileText,
  Inbox,
  PanelRightOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { AguiAgentChat, AguiFilesPanel } from "@/components/agents/agui-agent-chat";
import { McpConnectBanner } from "@/components/agents/mcp-connect-banner";
import { useDashboardHeader } from "@/components/dashboard-header-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserThreads } from "@/hooks/use-user-threads";
import { getAgent } from "@/lib/api/agents";
import { getThread, getThreadMessages } from "@/lib/api/threads";
import {
  acceptProjectDeliverable,
  getClientProject,
  respondToProjectRequest,
} from "@/lib/api/client-projects";
import { normaliseLangChainMessages } from "@/lib/agui/normalise-messages";
import { personaRoutes } from "@/lib/studio-routes";
import {
  FirmAvatar,
  ProjectSidePanel,
  StatusBadge,
  apiError,
  idOf,
} from "@/components/firms";
import { cn } from "@/lib/utils";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.persona.hasanraiyan.me/api/v1";
const AGUI_RUNTIME_URL =
  process.env.NEXT_PUBLIC_AGUI_RUNTIME_URL || `${BASE_URL}/agui`;

const POLL_MS = 15000;
const EMPTY_HISTORY = { messages: [], toolCalls: [], conversation: [] };

function ProgressRing({ value = 0, size = 30 }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      title={`${Math.round(pct)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-zinc-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            pct >= 100 ? "text-emerald-500" : "text-[#1E60FF]",
          )}
        />
      </svg>
      <span className="absolute text-[8.5px] font-bold text-zinc-700 tabular-nums">
        {Math.round(pct)}
      </span>
    </span>
  );
}

export default function ProjectWorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn } = useUser();
  const isMobile = useIsMobile();
  const { refresh: refreshThreads } = useUserThreads();

  const [project, setProject] = useState(null);
  const [agent, setAgent] = useState(null);
  const [initialMessages, setInitialMessages] = useState(EMPTY_HISTORY);
  const [initialState, setInitialState] = useState({});
  const [agentState, setAgentState] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  const [panelTab, setPanelTab] = useState("scope");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [filesTab, setFilesTab] = useState("files");
  const [selectedFile, setSelectedFile] = useState(null);
  const [acceptingIndex, setAcceptingIndex] = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const runningRef = useRef(false);

  // ── Auth token (refreshed so long-running chats keep working) ─────────────
  useEffect(() => {
    const refreshToken = async () => {
      try {
        const token = await getToken();
        if (token) setAuthToken(token);
      } catch (err) {
        console.error("Failed to refresh token:", err);
      }
    };
    refreshToken();
    const interval = setInterval(refreshToken, 40000);
    return () => clearInterval(interval);
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect_url=${personaRoutes.project(id)}`);
    }
  }, [isLoaded, isSignedIn, id, router]);

  const refetchProject = useCallback(async () => {
    try {
      const res = await getClientProject(id);
      const next = res.data?.data;
      if (next) setProject(next);
    } catch (err) {
      console.error("Failed to refresh project:", err);
    }
  }, [id]);

  // ── Initial load: project → lead agent + thread history ───────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        const res = await getClientProject(id);
        const p = res.data?.data;
        if (!p) throw new Error("Project not found");
        if (cancelled) return;
        setProject(p);

        const agentId = idOf(p.leadAgentId);
        const threadId = idOf(p.threadId);

        const [agentRes, , historyRes] = await Promise.all([
          agentId ? getAgent(agentId).catch(() => null) : null,
          threadId ? getThread(threadId).catch(() => null) : null,
          threadId ? getThreadMessages(threadId).catch(() => null) : null,
        ]);
        if (cancelled) return;

        setAgent(
          agentRes?.data?.data ||
            (typeof p.leadAgentId === "object" ? p.leadAgentId : null),
        );

        const {
          messages: rawMessages = [],
          state: rawState = {},
          subagentTraces = {},
        } = historyRes?.data?.data || {};
        setInitialMessages(normaliseLangChainMessages(rawMessages, subagentTraces));
        setInitialState(rawState || {});
        setAgentState(rawState || {});
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404 || err.response?.status === 403) {
          setNotFound(true);
        } else {
          toast.error(apiError(err, "Failed to load project"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [id, isLoaded, isSignedIn]);

  // ── Poll while a run is in flight (and the tab is visible) ────────────────
  useEffect(() => {
    if (!project) return undefined;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!runningRef.current) return;
      refetchProject();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [project, refetchProject]);

  // ── Chat callbacks ────────────────────────────────────────────────────────
  const handleStateChange = useCallback((state) => {
    // State updates only arrive mid-run, so treat them as a "run is live" signal.
    runningRef.current = true;
    setAgentState(state);
  }, []);

  const handleRunFinished = useCallback(() => {
    runningRef.current = false;
    refetchProject();
    refreshThreads?.();
  }, [refetchProject, refreshThreads]);

  const handleOpenFile = useCallback((filePath) => {
    setFilesTab("files");
    setShowFiles(true);
    setSelectedFile(filePath);
  }, []);

  // ── Side-panel actions ────────────────────────────────────────────────────
  const handleAccept = useCallback(
    async (index) => {
      setAcceptingIndex(index);
      try {
        const res = await acceptProjectDeliverable(id, index);
        const next = res.data?.data;
        if (next) setProject(next);
        else await refetchProject();
        toast.success("Deliverable accepted");
      } catch (err) {
        toast.error(apiError(err, "Could not accept this deliverable"));
      } finally {
        setAcceptingIndex(null);
      }
    },
    [id, refetchProject],
  );

  const handleRespond = useCallback(
    async (itemId, response) => {
      setRespondingId(itemId);
      try {
        const res = await respondToProjectRequest(id, itemId, { response });
        const next = res.data?.data;
        if (next) setProject(next);
        else await refetchProject();
        toast.success("Sent to the team");
        return true;
      } catch (err) {
        toast.error(apiError(err, "Could not send your answer"));
        return false;
      } finally {
        setRespondingId(null);
      }
    },
    [id, refetchProject],
  );

  const openPanelTab = useCallback(
    (tab) => {
      setPanelTab(tab);
      if (isMobile) setDrawerOpen(true);
    },
    [isMobile],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const firm = project?.firmId && typeof project.firmId === "object" ? project.firmId : null;
  const openCount = useMemo(
    () => (project?.inbox || []).filter((i) => i.status !== "done").length,
    [project],
  );
  const fileCount = Object.keys(agentState?.files || {}).filter(
    (path) => !path.startsWith("/.versions/") && !path.startsWith(".versions/"),
  ).length;
  const dueText = useMemo(() => {
    if (!project?.dueAt) return null;
    try {
      const due = new Date(project.dueAt);
      const overdue = due < new Date() && project.status !== "done";
      return {
        label: `${overdue ? "Was due" : "Due"} ${formatDistanceToNow(due, { addSuffix: true })}`,
        overdue,
      };
    } catch {
      return null;
    }
  }, [project]);

  const suggestedPrompts = useMemo(() => {
    if (!project) return [];
    return [
      {
        title: "Kick off the project",
        prompt:
          "Let's kick off the project. Walk me through your plan for the scope of work and tell me what you'll start on first.",
      },
      {
        title: "What do you need from me?",
        prompt:
          "Before you start, what do you need from me to do this well?",
      },
    ];
  }, [project]);

  // ── Header ────────────────────────────────────────────────────────────────
  useDashboardHeader(
    {
      title: project?.title || "Project",
      description: firm ? (
        <Link
          href={personaRoutes.firm(firm.slug)}
          className="transition-colors hover:text-zinc-900"
        >
          {firm.name}
        </Link>
      ) : (
        "Project workspace"
      ),
      leading: firm ? <FirmAvatar firm={firm} className="size-8" /> : null,
      actions: project ? (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href={personaRoutes.projects}
            className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <ArrowLeft className="size-4" />
            My Projects
          </Link>
          <StatusBadge status={project.status} className="hidden sm:inline-flex" />
          {dueText && (
            <span
              className={cn(
                "hidden items-center gap-1 text-[11px] font-semibold text-zinc-500 md:inline-flex",
                dueText.overdue && "text-red-500",
              )}
            >
              <CalendarClock className="size-3.5" />
              {dueText.label}
            </span>
          )}
          <ProgressRing value={project.progress || 0} />
          {openCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="relative size-9 rounded-full"
              title="Needed from you"
              onClick={() => openPanelTab("inbox")}
            >
              <Inbox className="size-4" />
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
                {openCount}
              </span>
            </Button>
          )}
          {fileCount > 0 && (
            <Button
              variant={showFiles ? "secondary" : "ghost"}
              size="icon"
              className="relative size-9 rounded-full"
              title="Files"
              onClick={() => {
                setFilesTab("files");
                setShowFiles((v) => !v);
              }}
            >
              <FileText className="size-4" />
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
                {fileCount}
              </span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full md:hidden"
            title="Project panel"
            onClick={() => setDrawerOpen(true)}
          >
            <PanelRightOpen className="size-4" />
          </Button>
        </div>
      ) : null,
    },
    [project, firm, dueText, openCount, fileCount, showFiles, openPanelTab],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="flex-grow overflow-y-auto bg-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Link
            href={personaRoutes.projects}
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            My Projects
          </Link>
          <Empty className="rounded-2xl border border-dashed py-20">
            <EmptyHeader>
              <EmptyTitle>Project not found</EmptyTitle>
              <EmptyDescription>
                It may have been removed, or you don&apos;t have access to it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  if (loading || !project || !isLoaded) {
    return (
      <div className="absolute inset-0 flex overflow-hidden bg-white">
        <div className="flex flex-1 flex-col gap-4 px-6 py-6">
          <Skeleton className="h-6 w-56 rounded-md" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 w-3/4 rounded-2xl" />
          <div className="mt-auto">
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        </div>
        <div className="hidden w-[380px] flex-col gap-3 border-l border-zinc-100 p-4 md:flex">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    );
  }

  const agentId = idOf(project.leadAgentId);
  const threadId = idOf(project.threadId);
  const leadName = agent?.name || project.leadAgentId?.name || "Lead";

  const chat =
    authToken && agentId && threadId ? (
      <AguiAgentChat
        key={threadId}
        agent={agent}
        url={AGUI_RUNTIME_URL}
        agentId={agentId}
        threadId={threadId}
        initialMessages={initialMessages}
        initialState={initialState}
        title={leadName}
        emptyTitle={leadName}
        emptyDescription={`Working on: ${project.outcome || project.title}`}
        emptyStateVariant="simple"
        suggestedPrompts={suggestedPrompts}
        className="min-w-0 flex-1"
        showHeader={false}
        headers={{
          Authorization: `Bearer ${authToken}`,
          "X-Agent-Id": agentId,
          "X-Thread-Id": threadId,
          "X-Project-Id": project._id,
        }}
        onStateChange={handleStateChange}
        onRunFinished={handleRunFinished}
        onOpenFile={handleOpenFile}
      />
    ) : (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        {!threadId || !agentId ? (
          <>
            <p className="text-sm font-semibold text-zinc-800">
              This project has no chat thread yet
            </p>
            <p className="text-xs text-zinc-400">
              The firm owner needs to assign a lead employee.
            </p>
          </>
        ) : (
          <Skeleton className="h-10 w-48 rounded-lg" />
        )}
      </div>
    );

  const panelProps = {
    project,
    tab: panelTab,
    onTabChange: setPanelTab,
    onOpenFile: handleOpenFile,
    onAccept: handleAccept,
    acceptingIndex,
    onRespond: handleRespond,
    respondingId,
  };

  return (
    <div className="@container/main absolute inset-0 flex flex-col overflow-hidden bg-white">
      <McpConnectBanner mcps={agent?.mcps} />

      {/* Mobile: quick access strip */}
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-zinc-100 px-3 py-2 no-scrollbar md:hidden">
        <StatusBadge status={project.status} size="sm" />
        <button
          type="button"
          onClick={() => openPanelTab("scope")}
          className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600"
        >
          Scope · {Math.round(project.progress || 0)}%
        </button>
        <button
          type="button"
          onClick={() => openPanelTab("inbox")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold",
            openCount > 0
              ? "bg-amber-100 text-amber-700"
              : "bg-zinc-100 text-zinc-600",
          )}
        >
          Needed from you{openCount > 0 ? ` · ${openCount}` : ""}
        </button>
        <button
          type="button"
          onClick={() => openPanelTab("activity")}
          className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-600"
        >
          Activity
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {isMobile ? (
          <div className="flex min-h-0 min-w-0 flex-1">{chat}</div>
        ) : (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize={62} minSize={40} className="flex min-w-0">
              {chat}
            </ResizablePanel>
            <ResizableHandle className="w-px bg-zinc-100 after:w-2 hover:bg-[#1E60FF]/40" />
            <ResizablePanel
              defaultSize={38}
              minSize={26}
              maxSize={55}
              className="flex min-w-0"
            >
              <ProjectSidePanel {...panelProps} className="flex-1" />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        <AguiFilesPanel
          state={agentState}
          open={showFiles}
          onOpenChange={setShowFiles}
          tab={filesTab}
          onTabChange={setFilesTab}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      </div>

      {/* Mobile: panel drawer */}
      <Drawer open={isMobile && drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerTitle className="sr-only">Project panel</DrawerTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ProjectSidePanel {...panelProps} className="h-[70vh]" />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
