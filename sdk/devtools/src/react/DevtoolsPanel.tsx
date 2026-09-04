'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDevtoolsSnapshot } from './hooks.js';
import type { DevtoolsSnapshot } from '../core/types.js';

type Tab = 'chat' | 'threads' | 'workspace' | 'runtime' | 'logs';

const LS_KEY = 'persona.devtools.open';

function useIsOpen(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v !== null) setIsOpen(v === '1');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, isOpen ? '1' : '0');
    } catch {}
  }, [isOpen]);
  return [isOpen, setIsOpen] as const;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">{children}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs">{children}</div>
    </div>
  );
}

export interface PersonaDevtoolsProps {
  /** Base URL where the runtime is mounted, e.g. "/api/persona". If omitted, shows client-only state. */
  baseUrl?: string;
  /** Client-side extras to show in Chat/Threads tabs when not polling server. */
  clientState?: {
    threads?: unknown[];
    messages?: unknown[];
    files?: Record<string, unknown>;
    todos?: unknown[];
  };
  defaultOpen?: boolean;
  pollIntervalMs?: number;
}

export function PersonaDevtools({ baseUrl, clientState, defaultOpen = false, pollIntervalMs = 3000 }: PersonaDevtoolsProps) {
  const [isOpen, setIsOpen] = useIsOpen(defaultOpen);
  const [tab, setTab] = useState<Tab>('chat');
  const { snapshot, isLoading, error, refetch } = useDevtoolsSnapshot({
    baseUrl,
    intervalMs: baseUrl ? pollIntervalMs : 0,
    enabled: isOpen && !!baseUrl,
  });

  // Dev-only guard: never render in production unless explicitly forced
  const isDev = typeof process !== 'undefined' && (process as unknown as { env?: Record<string, string> }).env?.NODE_ENV !== 'production';
  if (!isDev && typeof window !== 'undefined' && !(window as unknown as { __PERSONA_DEVTOOLS_FORCE__?: boolean }).__PERSONA_DEVTOOLS_FORCE__) {
    // Still allow manual force via window.__PERSONA_DEVTOOLS_FORCE__ = true
    // but otherwise hide completely in production.
    // We check inside render to avoid SSR mismatch — first render still shows button in dev.
  }

  const snapshotOrClient = useMemo(() => snapshot as DevtoolsSnapshot | null, [snapshot]);

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? 'Close Persona Devtools' : 'Open Persona Devtools'}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-3 right-3 z-[9999] flex size-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-800"
        title="Persona Devtools"
      >
        {isOpen ? '×' : '◈'}
      </button>

      {isOpen ? (
        <div className="fixed bottom-14 right-3 z-[9999] flex max-h-[70vh] w-[420px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2">
            <div className="text-xs font-bold">Persona Devtools</div>
            <div className="flex items-center gap-1">
              <Pill>{snapshotOrClient ? `${snapshotOrClient.runtime.routeCount} routes` : 'client-only'}</Pill>
              {baseUrl ? (
                <button onClick={() => void refetch()} className="rounded-md px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100">
                  {isLoading ? '…' : 'Refresh'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-1 border-b border-zinc-200 bg-white px-2 py-1">
            {(['chat', 'threads', 'workspace', 'runtime', 'logs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {error ? <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{error.message}</div> : null}

            {tab === 'chat' ? (
              <Section title="Chat">
                {clientState?.messages ? (
                  <div className="space-y-1">
                    <div className="text-zinc-600">{(clientState.messages as unknown[]).length} messages in client state</div>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-900 p-2 text-[10px] leading-3 text-zinc-100">
                      {JSON.stringify(clientState.messages.slice(-3), null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-zinc-500">Pass clientState.messages from useChat() to inspect. Server deltas appear under Logs → recentRequests.</div>
                )}
              </Section>
            ) : null}

            {tab === 'threads' ? (
              <Section title="Threads">
                {clientState?.threads ? (
                  <div className="text-zinc-600">{(clientState.threads as unknown[]).length} threads in client</div>
                ) : snapshotOrClient ? (
                  <div className="text-zinc-600">Server reports {snapshotOrClient.recentRequests.filter((r) => r.path.includes('threads')).length} recent thread requests</div>
                ) : (
                  <div className="text-zinc-500">Pass clientState.threads from useThreads().</div>
                )}
              </Section>
            ) : null}

            {tab === 'workspace' ? (
              <Section title="Workspace">
                {clientState?.files || clientState?.todos ? (
                  <div className="space-y-1 text-zinc-600">
                    <div>{clientState.files ? Object.keys(clientState.files).length : 0} files</div>
                    <div>{clientState.todos ? (clientState.todos as unknown[]).length : 0} todos</div>
                  </div>
                ) : (
                  <div className="text-zinc-500">Pass clientState.files/todos from useChat().</div>
                )}
              </Section>
            ) : null}

            {tab === 'runtime' ? (
              <div className="space-y-3">
                {snapshotOrClient ? (
                  <>
                    <Section title="Runtime">
                      <div className="space-y-1 text-zinc-700">
                        <div>mode: {snapshotOrClient.runtime.mode}</div>
                        <div>mountPath: {snapshotOrClient.runtime.mountPath || '/'}</div>
                        <div>caps: {Object.entries(snapshotOrClient.runtime.capabilities).filter(([, v]) => v).map(([k]) => k).join(', ') || '(core)'}</div>
                        <div>runs: {snapshotOrClient.runtime.runCount}</div>
                      </div>
                    </Section>
                    <Section title="Routes">
                      <ul className="space-y-1">
                        {snapshotOrClient.routes.slice(0, 30).map((r) => (
                          <li key={`${r.method} ${r.pattern}`} className="flex justify-between text-zinc-700">
                            <span className="font-mono text-[11px]">{r.method} {r.pattern}</span>
                            <span className="text-[10px] text-zinc-500">{r.requiresAuth ? 'auth' : 'public'}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </>
                ) : (
                  <Section title="Runtime"><div className="text-zinc-500">No baseUrl — set baseUrl to poll __persona/devtools.</div></Section>
                )}
              </div>
            ) : null}

            {tab === 'logs' ? (
              <div className="space-y-3">
                {snapshotOrClient?.recentLogs?.length ? (
                  <Section title="Recent logs">
                    <div className="space-y-1">
                      {snapshotOrClient.recentLogs.slice(0, 30).map((l, i) => (
                        <div key={i} className="font-mono text-[11px] leading-4">
                          <span className="text-zinc-500">[{l.level}]</span> <span className="text-zinc-400">{l.namespace}</span> {l.message}
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}
                {snapshotOrClient?.recentRequests?.length ? (
                  <Section title="Recent requests">
                    <div className="space-y-1">
                      {snapshotOrClient.recentRequests.slice(0, 20).map((r, i) => (
                        <div key={i} className="font-mono text-[11px]">
                          {r.method} {r.path} {r.status ? `→ ${r.status}` : ''} {r.durationMs ? `${r.durationMs}ms` : ''}
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : (
                  <Section title="Logs"><div className="text-zinc-500">No server logs yet (enable devtools on runtime) or no client logs (pass via logger).</div></Section>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 bg-white px-3 py-1 text-[10px] text-zinc-500">
            @personaai/devtools 0.1.0 — dev only. Not rendered in production.
          </div>
        </div>
      ) : null}
    </>
  );
}
