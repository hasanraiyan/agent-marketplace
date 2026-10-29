import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * Connects a raw MCP SDK client, which - unlike `@langchain/mcp-adapters` -
 * keeps each tool's `_meta` (including `_meta.ui.resourceUri`). MCP App
 * widgets can only be discovered through this client.
 */
export async function connectMcpAppsClient(mcp, headers) {
  const parsedUrl = new URL(mcp.url);
  const hasHeaders = Object.keys(headers).length > 0;

  const transport =
    mcp.transport === 'sse'
      ? new SSEClientTransport(parsedUrl, { requestInit: hasHeaders ? { headers } : undefined })
      : new StreamableHTTPClientTransport(parsedUrl, {
          requestInit: hasHeaders ? { headers } : undefined,
        });

  const client = new McpClient({
    name: 'agent-marketplace',
    version: '1.0.0',
    capabilities: {
      roots: { listChanged: true },
      sampling: {},
      experimental: { mcp_apps: {} },
    },
  });

  await client.connect(transport);
  return { client, transport };
}

/** Lists every tool on the server that declares an MCP App widget. */
export async function listUiTemplates(mcp, headers) {
  const { client, transport } = await connectMcpAppsClient(mcp, headers);
  try {
    const allTools = [];
    let response;
    do {
      response = await client.listTools({
        ...(response?.nextCursor ? { cursor: response.nextCursor } : {}),
      });
      allTools.push(...(response.tools || []));
    } while (response.nextCursor);

    return allTools
      .filter((tool) => tool._meta?.ui?.resourceUri)
      .map((tool) => ({
        uriTemplate: tool._meta.ui.resourceUri,
        name: tool.name || '',
        description: (tool._meta.ui.description || tool.description || '').substring(0, 200),
        mimeType: tool._meta.ui.mimeType || 'text/html',
        toolName: tool.name,
      }));
  } finally {
    try {
      await transport.close();
    } catch {
      /* best-effort cleanup */
    }
    try {
      await client.close();
    } catch {
      /* best-effort cleanup */
    }
  }
}
