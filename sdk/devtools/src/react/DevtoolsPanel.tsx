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
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600" style={{ background: '#f4f4f5', padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 600 }}>{children}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2" style={{ marginBottom: 12 }}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#71717a', marginBottom: 6 }}>{title}</div>
      <div className="rounded-xl border border-zinc-200 bg-white p-3 text-xs" style={{ border: '1px solid #e4e4e7', borderRadius: 12, background: 'white', padding: 12, fontSize: 12 }}>{children}</div>
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

export function PersonaDevtools({ baseUrl, clientState, defaultOpen = false, pollIntervalMs = 0 }: PersonaDevtoolsProps) {
  const [isOpen, setIsOpen] = useIsOpen(defaultOpen);
  const [tab, setTab] = useState<Tab>('chat');
  // Client-only by default — no server polling unless caller explicitly sets pollIntervalMs > 0.
  const { snapshot, isLoading, error, refetch } = useDevtoolsSnapshot({
    baseUrl,
    intervalMs: baseUrl && pollIntervalMs > 0 ? pollIntervalMs : 0,
    enabled: isOpen && !!baseUrl && pollIntervalMs > 0,
  });

  const hasAnyClientState = !!(clientState?.messages || clientState?.threads || clientState?.files || clientState?.todos);
  const snapshotOrClient = useMemo(() => snapshot as DevtoolsSnapshot | null, [snapshot]);

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? 'Close Persona Devtools' : 'Open Persona Devtools'}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-3 right-3 z-[9999] flex size-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg hover:bg-zinc-800"
        style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 9999, width: 36, height: 36, borderRadius: 9999, background: '#18181b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
        title="Persona Devtools"
      >
        {isOpen ? '×' : '◈'}
      </button>

      {isOpen ? (
        <div
          className="fixed bottom-14 right-3 z-[9999] flex max-h-[70vh] w-[420px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl"
          style={{ position: 'fixed', bottom: 56, right: 12, zIndex: 9999, width: 420, maxWidth: '92vw', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 16, border: '1px solid #e4e4e7', background: '#fafafa', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        >
          <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e4e7', background: 'white', padding: '8px 12px' }}>
            <div className="text-xs font-bold" style={{ fontSize: 12, fontWeight: 700 }}>Persona Devtools</div>
            <div className="flex items-center gap-1" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pill>{snapshotOrClient ? `${snapshotOrClient.runtime.routeCount} routes` : hasAnyClientState ? 'client' : 'no data'}</Pill>
              {baseUrl && pollIntervalMs > 0 ? (
                <button onClick={() => void refetch()} className="rounded-md px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-100" style={{ padding: '4px 8px', fontSize: 11, color: '#52525b' }}>
                  {isLoading ? '…' : 'Refresh'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex gap-1 border-b border-zinc-200 bg-white px-2 py-1" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e4e4e7', background: 'white', padding: '4px 8px' }}>
            {(['chat', 'threads', 'workspace', 'runtime', 'logs'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                style={tab === t ? { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 9999, background: '#18181b', color: 'white', textTransform: 'capitalize' } : { padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 9999, color: '#52525b', textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-3" style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            {/* Only show red error if it's not a 404 (404 is handled as client-only) */}
            {error ? <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700" style={{ background: '#fef2f2', padding: 12, borderRadius: 12, fontSize: 12, color: '#b91c1c', marginBottom: 12 }}>{error.message}</div> : null}

            {/* Welcome / usage hint when no data at all */}
            {!hasAnyClientState && !snapshotOrClient && (tab === 'chat' || tab === 'threads' || tab === 'workspace') ? (
              <Section title="Setup">
                <div className="space-y-2 text-zinc-600" style={{ color: '#52525b', lineHeight: 1.5 }}>
                  <p>Devtools is running in <strong>client-only</strong> mode. Pass live hook state:</p>
                  <pre className="rounded-lg bg-zinc-900 p-2 text-[10px] leading-3 text-zinc-100" style={{ background: '#18181b', color: '#f4f4f5', padding: 8, borderRadius: 8, fontSize: 10, overflow: 'auto', marginTop: 8 }}>
{`'use client';
import { useChat, useThreads } from '@personaai/nextjs';
import { PersonaDevtools } from '@personaai/devtools/react';

function Devtools() {
  const { threads } = useThreads();
  const { messages, files, todos } = useChat();
  return <PersonaDevtools clientState={{ threads, messages, files, todos }} />;
}`}
                  </pre>
                  <p className="text-[11px] text-zinc-500" style={{ fontSize: 11, color: '#71717a', marginTop: 8 }}>No <code>baseUrl</code> needed. Add <code>baseUrl="/api/persona"</code> + <code>pollIntervalMs={3000}</code> only if you mount a custom <code>__persona/devtools</code> route.</p>
                </div>
              </Section>
            ) : null}

            {tab === 'chat' ? (
              <Section title="Chat">
                {clientState?.messages ? (
                  <div className="space-y-1">
                    <div className="text-zinc-600" style={{ color: '#52525b' }}>{(clientState.messages as unknown[]).length} messages in client state</div>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-900 p-2 text-[10px] leading-3 text-zinc-100" style={{ maxHeight: 160, overflow: 'auto', background: '#18181b', color: '#f4f4f5', padding: 8, borderRadius: 8, fontSize: 10 }}>
                      {JSON.stringify(clientState.messages.slice(-3), null, 2)}
                    </pre>
                  </div>
                ) : hasAnyClientState ? (
                  <div className="text-zinc-500" style={{ color: '#71717a' }}>No messages yet — send a message to see it here.</div>
                ) : null}
              </Section>
            ) : null}

            {tab === 'threads' ? (
              <Section title="Threads">
                {clientState?.threads ? (
                  <div className="text-zinc-600" style={{ color: '#52525b' }}>{(clientState.threads as unknown[]).length} threads in client</div>
                ) : snapshotOrClient ? (
                  <div className="text-zinc-600" style={{ color: '#52525b' }}>Server reports {snapshotOrClient.recentRequests.filter((r) => r.path.includes('threads')).length} recent thread requests</div>
                ) : hasAnyClientState ? (
                  <div className="text-zinc-500" style={{ color: '#71717a' }}>No threads in clientState.</div>
                ) : null}
              </Section>
            ) : null}

            {tab === 'workspace' ? (
              <Section title="Workspace">
                {clientState?.files || clientState?.todos ? (
                  <div className="space-y-1 text-zinc-600" style={{ color: '#52525b' }}>
                    <div>{clientState.files ? Object.keys(clientState.files).length : 0} files</div>
                    <div>{clientState.todos ? (clientState.todos as unknown[]).length : 0} todos</div>
                  </div>
                ) : hasAnyClientState ? (
                  <div className="text-zinc-500" style={{ color: '#71717a' }}>Workspace empty.</div>
                ) : null}
              </Section>
            ) : null}

            {tab === 'runtime' ? (
              <div className="space-y-3">
                {snapshotOrClient ? (
                  <>
                    <Section title="Runtime">
                      <div className="space-y-1 text-zinc-700" style={{ color: '#3f3f46' }}>
                        <div>mode: {snapshotOrClient.runtime.mode}</div>
                        <div>mountPath: {snapshotOrClient.runtime.mountPath || '/'}</div>
                        <div>caps: {Object.entries(snapshotOrClient.runtime.capabilities).filter(([, v]) => v).map(([k]) => k).join(', ') || '(core)'}</div>
                        <div>runs: {snapshotOrClient.runtime.runCount}</div>
                      </div>
                    </Section>
                    <Section title="Routes">
                      <ul className="space-y-1">
                        {snapshotOrClient.routes.slice(0, 30).map((r) => (
                          <li key={`${r.method} ${r.pattern}`} className="flex justify-between text-zinc-700" style={{ display: 'flex', justifyContent: 'space-between', color: '#3f3f46' }}>
                            <span className="font-mono text-[11px]" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.method} {r.pattern}</span>
                            <span className="text-[10px] text-zinc-500" style={{ fontSize: 10, color: '#71717a' }}>{r.requiresAuth ? 'auth' : 'public'}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  </>
                ) : (
                  <Section title="Runtime"><div className="text-zinc-500" style={{ color: '#71717a' }}>Client-only mode. No server snapshot — devtools works without <code>baseUrl</code>. Add <code>baseUrl</code> + custom <code>__persona/devtools</code> route to see runtime routes here.</div></Section>
                )}
              </div>
            ) : null}

            {tab === 'logs' ? (
              <div className="space-y-3">
                {snapshotOrClient?.recentLogs?.length ? (
                  <Section title="Recent logs">
                    <div className="space-y-1">
                      {snapshotOrClient.recentLogs.slice(0, 30).map((l, i) => (
                        <div key={i} className="font-mono text-[11px] leading-4" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          <span className="text-zinc-500" style={{ color: '#71717a' }}>[{l.level}]</span> <span className="text-zinc-400" style={{ color: '#a1a1aa' }}>{l.namespace}</span> {l.message}
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : null}
                {snapshotOrClient?.recentRequests?.length ? (
                  <Section title="Recent requests">
                    <div className="space-y-1">
                      {snapshotOrClient.recentRequests.slice(0, 20).map((r, i) => (
                        <div key={i} className="font-mono text-[11px]" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                          {r.method} {r.path} {r.status ? `→ ${r.status}` : ''} {r.durationMs ? `${r.durationMs}ms` : ''}
                        </div>
                      ))}
                    </div>
                  </Section>
                ) : (
                  <Section title="Logs"><div className="text-zinc-500" style={{ color: '#71717a' }}>No server logs (client-only). Pass a custom logger to <code>PersonaProvider</code> to see client logs here in a future version.</div></Section>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 bg-white px-3 py-1 text-[10px] text-zinc-500" style={{ borderTop: '1px solid #e4e4e7', background: 'white', padding: '4px 12px', fontSize: 10, color: '#71717a' }}>
            @personaai/devtools 0.1.2 — dev only. Pass <code>clientState</code> to see data.
          </div>
        </div>
      ) : null}
    </>
  );
}
