'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { readMcpResource } from '@/lib/api/mcps';
import { cn } from '@/lib/utils';

/**
 * MCPAppRenderer — renders an MCP App (interactive UI from an MCP server)
 * inside a sandboxed iframe with a bidirectional JSON-RPC bridge over postMessage.
 *
 * This mirrors how Claude Desktop and ChatGPT render MCP Apps: the MCP server
 * declares a `_meta.ui.resourceUri` on a tool, pointing to a `ui://` resource
 * that contains an HTML/JS/CSS bundle. The client fetches it, renders it in a
 * sandboxed iframe, and communicates via postMessage.
 *
 * @param {Object} props
 * @param {string} props.mcpId - The MCP server ID (to fetch the resource)
 * @param {string} props.resourceUri - The ui:// resource URI
 * @param {string} [props.toolName] - Optional tool name for display
 * @param {Function} [props.onToolCall] - Callback when the iframe requests a tool call
 * @param {Function} [props.onContextUpdate] - Callback when the iframe pushes context to the LLM
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.height=500] - Iframe height in pixels
 * @param {boolean} [props.expanded=false] - Whether to expand to full height
 */
export function MCPAppRenderer({
  mcpId,
  resourceUri,
  toolName,
  onToolCall,
  onContextUpdate,
  className,
  height = 500,
  expanded: initialExpanded = false,
}) {
  const iframeRef = useRef(null);
  const bridgeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(initialExpanded);

  // Fetch the HTML bundle from the backend
  useEffect(() => {
    if (!mcpId || !resourceUri) {
      setError('Missing MCP server ID or resource URI');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    readMcpResource(mcpId, resourceUri)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (!data?.text) {
          throw new Error('Empty resource response');
        }

        // Create a blob URL from the HTML content
        const blob = new Blob([data.text], { type: 'text/html' });
        if (iframeRef.current) {
          iframeRef.current.src = URL.createObjectURL(blob);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || err.message || 'Failed to load MCP App');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      // Revoke blob URL if set
      if (iframeRef.current?.src?.startsWith('blob:')) {
        URL.revokeObjectURL(iframeRef.current.src);
      }
    };
  }, [mcpId, resourceUri]);

  // Set up the postMessage JSON-RPC bridge
  useEffect(() => {
    if (loading || error) return;

    const handleMessage = (event) => {
      // Only accept messages from our iframe
      if (event.source !== iframeRef.current?.contentWindow) return;

      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      // JSON-RPC request from the iframe
      if (msg.jsonrpc === '2.0' && msg.method) {
        handleRpcRequest(msg);
        return;
      }

      // Simple event-based protocol (used by some MCP Apps SDKs)
      if (msg.type) {
        handleEventMessage(msg);
      }
    };

    const handleRpcRequest = async (msg) => {
      const { id, method, params } = msg;

      switch (method) {
        case 'ui/initialize':
          // Handshake: acknowledge initialization
          sendToIframe({
            jsonrpc: '2.0',
            id,
            result: { ok: true },
          });
          break;

        case 'ui/callTool':
          try {
            const result = await onToolCall?.(params?.name, params?.arguments);
            sendToIframe({
              jsonrpc: '2.0',
              id,
              result: result ?? { ok: true },
            });
          } catch (err) {
            sendToIframe({
              jsonrpc: '2.0',
              id,
              error: { message: err.message || 'Tool call failed' },
            });
          }
          break;

        case 'ui/updateModelContext':
          onContextUpdate?.(params);
          sendToIframe({
            jsonrpc: '2.0',
            id,
            result: { ok: true },
          });
          break;

        default:
          // Unknown method — respond with error
          sendToIframe({
            jsonrpc: '2.0',
            id,
            error: { message: `Unknown method: ${method}` },
          });
      }
    };

    const handleEventMessage = (msg) => {
      switch (msg.type) {
        case 'ui/initialize':
          // Simple handshake
          sendToIframe({ type: 'ui/initialized', ok: true });
          break;

        case 'ui/callTool':
          onToolCall?.(msg.toolName, msg.args);
          break;

        case 'ui/updateModelContext':
          onContextUpdate?.(msg.params || msg);
          break;
      }
    };

    const sendToIframe = (data) => {
      iframeRef.current?.contentWindow?.postMessage(data, '*');
    };

    window.addEventListener('message', handleMessage);

    // Store bridge ref for cleanup
    bridgeRef.current = { sendToIframe };

    return () => {
      window.removeEventListener('message', handleMessage);
      bridgeRef.current = null;
    };
  }, [loading, error, onToolCall, onContextUpdate]);

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
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              MCP App
            </span>
          </div>
          {toolName && (
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate ml-1">
              {toolName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleExpanded}
            className="size-6 rounded-md flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Loading MCP App...
            </p>
          </div>
        </div>
      )}

      {/* Sandboxed iframe — only rendered when loaded */}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-same-origin"
        className={cn(
          'w-full border-0',
          loading && 'hidden',
          expanded && 'h-[calc(100vh-12rem)]',
        )}
        style={!loading ? { height: expanded ? 'calc(100vh - 12rem)' : `${height}px` } : undefined}
        title={`MCP App: ${toolName || resourceUri}`}
      />
    </div>
  );
}
