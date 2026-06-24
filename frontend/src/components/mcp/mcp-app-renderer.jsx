'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
import { readMcpResource, callMcpTool } from '@/lib/api/mcps';
import { cn } from '@/lib/utils';

function parseJsonObject(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// Most MCP App widgets read `result.structuredContent` in their `ontoolresult`
// handler (it's a real, typed object), not the flattened text the rest of the
// chat UI uses - `tool.structuredResult` is the backend's unflattened copy of
// it (see aguiTranslator's extractStructuredContent). Always include `content`
// too: some widgets fall back to it, and it's required by the CallToolResult shape.
function buildToolResultPayload(tool) {
  const content = [{ type: 'text', text: typeof tool?.resultText === 'string' ? tool.resultText : '' }];
  return tool?.structuredResult !== undefined
    ? { content, structuredContent: tool.structuredResult }
    : { content };
}

/**
 * MCPAppRenderer — renders an MCP App (interactive UI from an MCP server)
 * inside a sandboxed iframe, wired up with the real `AppBridge` protocol from
 * `@modelcontextprotocol/ext-apps`. The widget HTML (fetched from the backend)
 * itself imports the matching `App` class and speaks this same JSON-RPC-over-
 * postMessage protocol - that pairing is what makes buttons/tool calls inside
 * the widget actually work, not just render static markup.
 *
 * This uses a single sandboxed iframe rather than the spec's double-iframe
 * "sandbox proxy on a separate origin" pattern (see modelcontextprotocol/
 * ext-apps' basic-host example). `sandbox="allow-scripts allow-forms"` with NO
 * `allow-same-origin` still gives the widget content a unique opaque origin
 * isolated from this app (no access to our cookies/storage/DOM), which is what
 * actually matters for the threat model here. Move to the separate-origin
 * sandbox proxy if this ever needs to render third-party widgets the platform
 * doesn't otherwise vet (see the build-mcp-app skill's iframe-sandbox notes).
 *
 * @param {Object} props
 * @param {string} props.mcpId - The MCP server ID (to fetch the resource / proxy tool calls)
 * @param {string} props.resourceUri - The ui:// resource URI
 * @param {string} [props.toolName] - Tool name, used only for the iframe's a11y title (not shown visually)
 * @param {Object} [props.tool] - The ToolTrace tool object ({ argumentsText, resultText, status })
 *   whose input/result get forwarded into the widget via sendToolInput/sendToolResult.
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.height=500] - Iframe height in pixels
 * @param {boolean} [props.expanded=false] - Whether to expand to full height
 */
export function MCPAppRenderer({
  mcpId,
  resourceUri,
  toolName,
  tool,
  className,
  height = 500,
  expanded: initialExpanded = true,
}) {
  const iframeRef = useRef(null);
  const bridgeRef = useRef(null);
  const resultSentRef = useRef(false);
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [contentHeight, setContentHeight] = useState(null);

  // Fetch the HTML bundle from the backend.
  useEffect(() => {
    if (!mcpId || !resourceUri) {
      setError('Missing MCP server ID or resource URI');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtml(null);
    setContentHeight(null);

    readMcpResource(mcpId, resourceUri)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (!data?.text) {
          throw new Error('Empty resource response');
        }
        setHtml(data.text);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err.message || 'Failed to load MCP App');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mcpId, resourceUri]);

  // Wire up the real AppBridge once the widget HTML is fetched, then load it
  // into the iframe. Connect the bridge (attaching its postMessage listener)
  // BEFORE setting srcdoc, so the widget's `ui/initialize` request - sent the
  // instant its script runs - can't race ahead of us listening for it.
  useEffect(() => {
    if (!html || !iframeRef.current) return;

    const iframe = iframeRef.current;
    resultSentRef.current = false;

    const bridge = new AppBridge(
      // No live MCP client in the browser - handlers below proxy through our
      // backend instead, which already holds this server's auth (OAuth token /
      // API key) server-side. Never send those credentials to the browser.
      null,
      { name: 'agent-marketplace', version: '1.0.0' },
      {
        openLinks: {},
        serverTools: {},
        serverResources: {},
        updateModelContext: { text: {} },
      },
      {
        hostContext: {
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          platform: 'web',
          displayMode: 'inline',
          availableDisplayModes: ['inline'],
        },
      },
    );

    bridge.oncalltool = async (params) => {
      const res = await callMcpTool(mcpId, params.name, params.arguments || {});
      return res.data?.data;
    };

    bridge.onreadresource = async (params) => {
      const res = await readMcpResource(mcpId, params.uri);
      const data = res.data?.data;
      return {
        contents: [
          { uri: params.uri, mimeType: data?.mimeType || 'text/html', text: data?.text || '' },
        ],
      };
    };

    // Widgets shouldn't be able to navigate the host page directly (the
    // sandbox blocks window.open from inside the iframe) - this is the
    // sanctioned escape hatch for outbound links.
    bridge.onopenlink = async ({ url }) => {
      window.open(url, '_blank', 'noopener,noreferrer');
      return {};
    };

    // Not wired into the chat transcript yet (would need a callback threaded
    // through ToolTrace -> use-agui-chat) - acknowledge so widgets that call
    // these don't get a hard error, but the message/context is dropped.
    bridge.onmessage = async () => ({});
    bridge.onupdatemodelcontext = async () => ({});

    bridge.oninitialized = () => {
      bridge.sendToolInput({ arguments: parseJsonObject(tool?.argumentsText) });
      if (tool?.status === 'completed' && typeof tool?.resultText === 'string') {
        resultSentRef.current = true;
        bridge.sendToolResult(buildToolResultPayload(tool));
      }
    };

    const handleSizeChange = ({ height }) => {
      if (height !== undefined && height !== null) {
        setContentHeight(height);
      }
    };
    bridge.addEventListener('sizechange', handleSizeChange);

    let cancelled = false;
    bridge
      .connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow))
      .then(() => {
        if (cancelled) return;
        iframe.srcdoc = html;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to connect to MCP App');
      });

    bridgeRef.current = bridge;

    return () => {
      cancelled = true;
      bridgeRef.current = null;
      bridge.removeEventListener('sizechange', handleSizeChange);
      bridge.close?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-wire on a new widget load; tool input/result changes are forwarded by the effect below
  }, [html, mcpId]);

  // Forward the tool result once it lands, for the case where the card is
  // expanded (mounting this component) while the tool call is still running.
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge || resultSentRef.current) return;
    if (tool?.status !== 'completed' || typeof tool?.resultText !== 'string') return;
    resultSentRef.current = true;
    bridge.sendToolResult(buildToolResultPayload(tool));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on the primitive fields, not `tool` itself (a new object reference every render) which would refire this on every unrelated update
  }, [tool?.status, tool?.resultText, tool?.structuredResult]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (error) {
    return (
      <div className={cn('rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10', className)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 shrink-0 text-red-500 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              Failed to load MCP App
            </p>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1 font-medium">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('group relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950', className)}>
      {/* Expand/collapse only appears on hover - end users just see the app,
          no "MCP App" branding or internal tool name. */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="absolute right-2 top-2 z-10 size-6 rounded-md flex items-center justify-center bg-white/80 dark:bg-slate-900/80 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
        title={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
      </button>

      {/* Loading skeleton - mimics a generic widget layout (content area +
          a couple of detail rows) so the shimmer reads as "this app is
          drawing in" rather than a generic spinner. */}
      {loading && (
        <div className="space-y-3 p-3" style={{ height: `${height}px` }}>
          <div className="skeleton-shimmer bg-muted h-2/3 w-full rounded-lg" />
          <div className="skeleton-shimmer bg-muted h-5 w-2/3 rounded-md" />
          <div className="skeleton-shimmer bg-muted h-5 w-1/2 rounded-md" />
        </div>
      )}

      {/* Sandboxed iframe - content set imperatively via srcdoc once AppBridge is connected */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms"
        className={cn(
          'w-full border-0 transition-[height] duration-200 ease-in-out',
          loading && 'hidden',
        )}
        style={
          !loading
            ? {
                height: contentHeight !== null ? `${contentHeight}px` : (expanded ? 'calc(100vh - 12rem)' : `${height}px`),
                maxHeight: expanded ? 'calc(100vh - 12rem)' : `${height}px`,
              }
            : undefined
        }
        title={`MCP App: ${toolName || resourceUri}`}
      />
    </div>
  );
}
