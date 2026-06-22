import { createMcpSchema, updateMcpSchema } from '../src/validators/mcp.validator.js';

describe('Mcp Validator', () => {
  describe('createMcpSchema', () => {
    it('should validate a none-auth MCP server', () => {
      const result = createMcpSchema.safeParse({
        name: 'My MCP',
        transport: 'http',
        url: 'https://example.com/mcp',
      });

      expect(result.success).toBe(true);
      expect(result.data.authType).toBe('none');
      expect(result.data.authMode).toBe('owner');
    });

    it('should validate an oauth MCP server with credentials', () => {
      const result = createMcpSchema.safeParse({
        name: 'My MCP',
        transport: 'sse',
        url: 'https://example.com/mcp',
        authType: 'oauth',
        authMode: 'user',
        oauth: { clientId: 'abc', clientSecret: 'shh' },
      });

      expect(result.success).toBe(true);
    });

    it('should fail if authType is oauth but oauth config is missing', () => {
      const result = createMcpSchema.safeParse({
        name: 'My MCP',
        transport: 'http',
        url: 'https://example.com/mcp',
        authType: 'oauth',
      });

      expect(result.success).toBe(false);
    });

    it('should fail with an invalid transport', () => {
      const result = createMcpSchema.safeParse({
        name: 'My MCP',
        transport: 'stdio',
        url: 'https://example.com/mcp',
      });

      expect(result.success).toBe(false);
    });

    it('should fail with an invalid URL', () => {
      const result = createMcpSchema.safeParse({
        name: 'My MCP',
        transport: 'http',
        url: 'not-a-url',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateMcpSchema', () => {
    it('should allow partial updates', () => {
      const result = updateMcpSchema.safeParse({ name: 'Renamed' });
      expect(result.success).toBe(true);
    });

    it('should allow updating just the auth type', () => {
      const result = updateMcpSchema.safeParse({ authType: 'none' });
      expect(result.success).toBe(true);
    });

    it('should fail with an invalid transport', () => {
      const result = updateMcpSchema.safeParse({ transport: 'stdio' });
      expect(result.success).toBe(false);
    });
  });
});
