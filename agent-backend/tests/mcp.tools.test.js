import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/mcp/mcp-token.service.js', () => ({
  default: {
    getOwnerAccessToken: jest.fn(),
    getUserAccessToken: jest.fn(),
  },
}));

const mockGetTools = jest.fn();
jest.unstable_mockModule('@langchain/mcp-adapters', () => ({
  MultiServerMCPClient: jest.fn().mockImplementation((config) => ({
    config,
    getTools: mockGetTools,
  })),
}));

const mcpTokenService = (await import('../src/modules/mcp/mcp-token.service.js')).default;
const { MultiServerMCPClient } = await import('@langchain/mcp-adapters');
const { resolveMcpTools } = await import('../src/modules/mcp/mcp.tools.js');

describe('resolveMcpTools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns no tools when the agent has no mcps', async () => {
    const { tools, mcpAppMap } = await resolveMcpTools({ mcps: [] }, 'user1');
    expect(tools).toEqual([]);
    expect(mcpAppMap).toEqual({});
    expect(MultiServerMCPClient).not.toHaveBeenCalled();
  });

  it('includes a none-auth server with no headers', async () => {
    mockGetTools.mockResolvedValue([{ name: 'tool_a' }]);

    const agent = {
      mcps: [
        {
          _id: 'mcp1',
          name: 'Public MCP',
          transport: 'http',
          url: 'https://x.com/mcp',
          authType: 'none',
        },
      ],
    };

    const { tools } = await resolveMcpTools(agent, 'user1');

    expect(tools).toEqual([{ name: 'tool_a' }]);
    const [[config]] = MultiServerMCPClient.mock.calls;
    expect(config.prefixToolNameWithServerName).toBe(true);
    expect(config.mcpServers.public_mcp).toEqual({ transport: 'http', url: 'https://x.com/mcp' });
  });

  it('attaches a bearer header for an owner-mode oauth server', async () => {
    mcpTokenService.getOwnerAccessToken.mockResolvedValue('owner-token');
    mockGetTools.mockResolvedValue([]);

    const agent = {
      mcps: [
        {
          _id: 'mcp1',
          name: 'Owner MCP',
          transport: 'sse',
          url: 'https://x.com/mcp',
          authType: 'oauth',
          authMode: 'owner',
        },
      ],
    };

    await resolveMcpTools(agent, 'user1');

    const [[config]] = MultiServerMCPClient.mock.calls;
    expect(config.prefixToolNameWithServerName).toBe(true);
    expect(config.mcpServers.owner_mcp.headers).toEqual({ Authorization: 'Bearer owner-token' });
  });

  it('skips a user-mode oauth server the current user has not connected', async () => {
    mcpTokenService.getUserAccessToken.mockResolvedValue(null);

    const agent = {
      mcps: [
        {
          _id: 'mcp1',
          name: 'User MCP',
          transport: 'http',
          url: 'https://x.com/mcp',
          authType: 'oauth',
          authMode: 'user',
        },
      ],
    };

    const { tools } = await resolveMcpTools(agent, 'user1');

    expect(tools).toEqual([]);
    expect(MultiServerMCPClient).not.toHaveBeenCalled();
  });

  it('forwards the execution context to getUserAccessToken (blueprint Phase 9, PR-48)', async () => {
    mcpTokenService.getUserAccessToken.mockResolvedValue('ext-user-token');
    mockGetTools.mockResolvedValue([]);

    const agent = {
      mcps: [
        {
          _id: 'mcp1',
          name: 'User MCP',
          transport: 'http',
          url: 'https://x.com/mcp',
          authType: 'oauth',
          authMode: 'user',
        },
      ],
    };
    const context = {
      principalType: 'ProjectRuntime',
      domain: 'project-1',
      externalUserId: 'sabik',
    };

    await resolveMcpTools(agent, undefined, context);

    expect(mcpTokenService.getUserAccessToken).toHaveBeenCalledWith(
      agent.mcps[0],
      undefined,
      context
    );
  });

  it('does not let one broken server fail tool resolution for the rest', async () => {
    mcpTokenService.getOwnerAccessToken.mockRejectedValueOnce(new Error('boom'));
    mockGetTools.mockResolvedValue([{ name: 'tool_b' }]);

    const agent = {
      mcps: [
        {
          _id: 'broken',
          name: 'Broken MCP',
          transport: 'http',
          url: 'https://broken.example.com/mcp',
          authType: 'oauth',
          authMode: 'owner',
        },
        {
          _id: 'fine',
          name: 'Fine MCP',
          transport: 'http',
          url: 'https://fine.example.com/mcp',
          authType: 'none',
        },
      ],
    };

    const { tools } = await resolveMcpTools(agent, 'user1');

    expect(tools).toEqual([{ name: 'tool_b' }]);
    const [[config]] = MultiServerMCPClient.mock.calls;
    expect(Object.keys(config.mcpServers)).toEqual(['fine_mcp']);
  });

  it('maps a tool with a resourceTemplate to its MCP App widget', async () => {
    mockGetTools.mockResolvedValue([{ name: 'canva__search-designs' }]);

    const agent = {
      mcps: [
        {
          _id: 'mcp1',
          name: 'Canva',
          transport: 'http',
          url: 'https://x.com/mcp',
          authType: 'none',
          resourceTemplates: [
            { toolName: 'search-designs', uriTemplate: 'ui://widgets/search_designs.html' },
          ],
        },
      ],
    };

    const { mcpAppMap } = await resolveMcpTools(agent, 'user1');

    expect(mcpAppMap).toEqual({
      'canva__search-designs': { resourceUri: 'ui://widgets/search_designs.html', mcpId: 'mcp1' },
    });
  });
});
