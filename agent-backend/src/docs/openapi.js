const openapiSpecification = {
  openapi: '3.0.0',
  info: {
    title: 'Persona.ai Backend API',
    version: '1.0.0',
    description:
      'REST API for the Persona.ai intelligent agent orchestration platform.\n\n' +
      'Authentication is handled by **Clerk**. Send the Clerk session token as an `Authorization: Bearer <token>` header.\n' +
      'Some endpoints (agent search, get) work with optional auth — unauthenticated requests see only public data.\n' +
      'Admin endpoints require the user to have `role: admin`.',
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3000}`, description: 'Local server' }],
  components: {
    securitySchemes: {
      clerkAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Clerk session token (send as Bearer token or via __session cookie)',
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'number', example: 200 },
          message: { type: 'string' },
          data: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          status: { type: 'string', example: 'error' },
          statusCode: { type: 'number', example: 400 },
          message: { type: 'string' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          statusCode: { type: 'number' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              items: { type: 'array', items: { type: 'object' } },
              pagination: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  pages: { type: 'integer' },
                },
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['normal', 'admin'] },
          username: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          clerkId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Agent: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ownerId: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          systemPrompt: { type: 'string' },
          modelName: { type: 'string' },
          webSearchEnabled: { type: 'boolean' },
          visibility: { type: 'string', enum: ['private', 'unlisted', 'public'] },
          category: { type: 'string', enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'] },
          isMainAgent: { type: 'boolean' },
          messageCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Thread: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          agentId: { type: 'string' },
          userId: { type: 'string' },
          threadId: { type: 'string' },
          title: { type: 'string' },
          lastMessageAt: { type: 'string', format: 'date-time' },
          isArchived: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ownerId: { type: 'string' },
          label: { type: 'string' },
          baseURL: { type: 'string' },
          defaultModel: { type: 'string' },
          isDefault: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Skill: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ownerId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          isPublic: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Mcp: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ownerId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          transport: { type: 'string', enum: ['http', 'sse'] },
          url: { type: 'string' },
          authType: { type: 'string', enum: ['none', 'oauth', 'apiKey'] },
          authMode: { type: 'string', enum: ['owner', 'user'] },
          isEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      KnowledgeBase: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          ownerId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          isPublic: { type: 'boolean' },
          documentCount: { type: 'integer' },
          chunkCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // ── Root ────────────────────────────────────────────────
    '/': {
      get: {
        tags: ['Root'],
        summary: 'API welcome page',
        description: 'Returns server status and database connection state',
        responses: { 200: { description: 'Welcome message with DB status' } },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['Root'],
        summary: 'OpenAPI spec JSON',
        responses: { 200: { description: 'OpenAPI specification' } },
      },
    },

    // ── Health ──────────────────────────────────────────────
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Server health check',
        responses: {
          200: {
            description: 'Server is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
        },
      },
    },
    '/api/v1/health/db': {
      get: {
        tags: ['Health'],
        summary: 'Database health check',
        responses: {
          200: { description: 'Database connected' },
          503: { description: 'Database disconnected' },
        },
      },
    },

    // ── Profile ─────────────────────────────────────────────
    '/api/v1/profile': {
      get: {
        tags: ['Profile'],
        summary: 'Get authenticated user profile',
        security: [{ clerkAuth: [] }],
        responses: {
          200: { description: 'Profile retrieved', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          401: { description: 'Unauthorized' },
        },
      },
      patch: {
        tags: ['Profile'],
        summary: 'Update profile fields',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 2, maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Profile updated' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
      delete: {
        tags: ['Profile'],
        summary: 'Delete own account',
        security: [{ clerkAuth: [] }],
        responses: {
          200: { description: 'Account deleted' },
          401: { description: 'Unauthorized' },
        },
      },
    },

    // ── Admin ───────────────────────────────────────────────
    '/api/v1/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'List all users',
        security: [{ clerkAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          200: { description: 'Users listed', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - Admin access required' },
        },
      },
    },
    '/api/v1/admin/users/{id}': {
      delete: {
        tags: ['Admin'],
        summary: 'Permanently delete a user',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'User permanently deleted' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden - Admin access required' },
          404: { description: 'User not found' },
        },
      },
    },

    // ── Providers ───────────────────────────────────────────
    '/api/v1/providers': {
      get: {
        tags: ['Providers'],
        summary: 'List user providers',
        security: [{ clerkAuth: [] }],
        responses: {
          200: { description: 'Providers list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Providers'],
        summary: 'Create a provider',
        security: [{ clerkAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['label', 'baseURL', 'apiKey', 'defaultModel'],
                properties: {
                  label: { type: 'string' },
                  baseURL: { type: 'string' },
                  apiKey: { type: 'string', description: 'Plaintext API key (encrypted at rest)' },
                  defaultModel: { type: 'string' },
                  isDefault: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Provider created' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/providers/test-connection': {
      post: {
        tags: ['Providers'],
        summary: 'Test provider credentials',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { baseURL: { type: 'string' }, apiKey: { type: 'string' }, model: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Connection test result' } },
      },
    },
    '/api/v1/providers/{id}': {
      put: {
        tags: ['Providers'],
        summary: 'Update a provider',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { label: { type: 'string' }, baseURL: { type: 'string' }, defaultModel: { type: 'string' }, isDefault: { type: 'boolean' } } } } },
        },
        responses: { 200: { description: 'Provider updated' } },
      },
      delete: {
        tags: ['Providers'],
        summary: 'Delete a provider',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Provider deleted' } },
      },
    },
    '/api/v1/providers/{id}/test': {
      post: {
        tags: ['Providers'],
        summary: 'Test connection for a specific provider',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Connection test result' } },
      },
    },
    '/api/v1/providers/{id}/models': {
      get: {
        tags: ['Providers'],
        summary: 'List available models for a provider',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Model list' } },
      },
    },

    // ── Agents ──────────────────────────────────────────────
    '/api/v1/agents/search': {
      post: {
        tags: ['Agents'],
        summary: 'Search agents with filters',
        description: 'Works with optional auth. Authenticated users see their own private agents.',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  search: { type: 'string' },
                  category: { type: 'string', enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'] },
                  tags: { type: 'array', items: { type: 'string' } },
                  ownerId: { type: 'string' },
                  visibility: { type: 'string', enum: ['private', 'unlisted', 'public'] },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 10 },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Search results', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/agents/count': {
      post: {
        tags: ['Agents'],
        summary: 'Count agents matching filters',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { search: { type: 'string' }, category: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Count result' } },
      },
    },
    '/api/v1/agents': {
      post: {
        tags: ['Agents'],
        summary: 'Create a new agent',
        security: [{ clerkAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'systemPrompt', 'providerId'], properties: { name: { type: 'string' }, description: { type: 'string' }, systemPrompt: { type: 'string' }, providerId: { type: 'string' }, modelName: { type: 'string' }, webSearchEnabled: { type: 'boolean' }, visibility: { type: 'string', enum: ['private', 'unlisted', 'public'] }, category: { type: 'string', enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'] } } } } },
        },
        responses: { 201: { description: 'Agent created' } },
      },
    },
    '/api/v1/agents/slug/{slug}': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent by URL slug',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/agents/{id}': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent details' } },
      },
      patch: {
        tags: ['Agents'],
        summary: 'Update an agent',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, systemPrompt: { type: 'string' }, modelName: { type: 'string' }, webSearchEnabled: { type: 'boolean' }, visibility: { type: 'string', enum: ['private', 'unlisted', 'public'] } } } } } },
        responses: { 200: { description: 'Agent updated' } },
      },
      delete: {
        tags: ['Agents'],
        summary: 'Delete an agent',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent deleted' } },
      },
    },
    '/api/v1/agents/{id}/memory': {
      get: {
        tags: ['Agents'],
        summary: 'Get agent-specific memory',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agent memory data' } },
      },
    },
    '/api/v1/agents/{id}/memory/{key}': {
      delete: {
        tags: ['Agents'],
        summary: 'Delete a specific memory key',
        security: [{ clerkAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'key', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Memory key deleted' } },
      },
    },

    // ── Threads ─────────────────────────────────────────────
    '/api/v1/threads': {
      get: {
        tags: ['Threads'],
        summary: 'List user threads',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Threads list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Threads'],
        summary: 'Create a new thread',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string' }, title: { type: 'string' } } } } },
        },
        responses: { 201: { description: 'Thread created' } },
      },
      delete: {
        tags: ['Threads'],
        summary: 'Delete all user threads',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'All threads deleted' } },
      },
    },
    '/api/v1/threads/{id}': {
      get: {
        tags: ['Threads'],
        summary: 'Get a thread by ID',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Thread details' } },
      },
      delete: {
        tags: ['Threads'],
        summary: 'Delete a single thread',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Thread deleted' } },
      },
    },
    '/api/v1/threads/{id}/title': {
      patch: {
        tags: ['Threads'],
        summary: 'Update thread title',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } } } },
        responses: { 200: { description: 'Title updated' } },
      },
    },
    '/api/v1/threads/{id}/messages': {
      get: {
        tags: ['Threads'],
        summary: 'Get message history for a thread',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Message list' } },
      },
    },

    // ── Skills ──────────────────────────────────────────────
    '/api/v1/skills': {
      get: {
        tags: ['Skills'],
        summary: 'List own skills',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Skills list' } },
      },
      post: {
        tags: ['Skills'],
        summary: 'Create a skill',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'description', 'instructions'], properties: { name: { type: 'string' }, description: { type: 'string' }, instructions: { type: 'string' }, isPublic: { type: 'boolean' } } } } },
        },
        responses: { 201: { description: 'Skill created' } },
      },
    },
    '/api/v1/skills/search': {
      get: {
        tags: ['Skills'],
        summary: 'Search skills',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'Search results' } },
      },
    },
    '/api/v1/skills/public': {
      get: {
        tags: ['Skills'],
        summary: 'List public skills',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Public skills list' } },
      },
    },
    '/api/v1/skills/{id}': {
      get: {
        tags: ['Skills'],
        summary: 'Get skill by ID',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Skill details' } },
      },
      patch: {
        tags: ['Skills'],
        summary: 'Update a skill',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Skill updated' } },
      },
      delete: {
        tags: ['Skills'],
        summary: 'Delete a skill',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Skill deleted' } },
      },
    },
    '/api/v1/skills/{id}/agents': {
      get: {
        tags: ['Skills'],
        summary: 'List agents using a skill',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agents list' } },
      },
    },

    // ── MCP ─────────────────────────────────────────────────
    '/api/v1/mcps': {
      get: {
        tags: ['MCP'],
        summary: 'List MCP servers',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'MCP servers list' } },
      },
      post: {
        tags: ['MCP'],
        summary: 'Create an MCP server connector',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'transport', 'url'], properties: { name: { type: 'string' }, transport: { type: 'string', enum: ['http', 'sse'] }, url: { type: 'string' }, authType: { type: 'string', enum: ['none', 'oauth', 'apiKey'] }, authMode: { type: 'string', enum: ['owner', 'user'] } } } } },
        },
        responses: { 201: { description: 'MCP server created' } },
      },
    },
    '/api/v1/mcps/{id}': {
      get: {
        tags: ['MCP'],
        summary: 'Get MCP server details',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'MCP server details' } },
      },
      patch: {
        tags: ['MCP'],
        summary: 'Update MCP server',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'MCP server updated' } },
      },
      delete: {
        tags: ['MCP'],
        summary: 'Delete MCP server',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'MCP server deleted' } },
      },
    },
    '/api/v1/mcps/{id}/test': {
      post: {
        tags: ['MCP'],
        summary: 'Test MCP server connection',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Connection test result' } },
      },
    },
    '/api/v1/mcps/{id}/resource': {
      get: {
        tags: ['MCP'],
        summary: 'Read an MCP resource',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Resource content' } },
      },
    },
    '/api/v1/mcps/{id}/call-tool': {
      post: {
        tags: ['MCP'],
        summary: 'Call an MCP tool directly',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Tool call result' } },
      },
    },
    '/api/v1/mcps/{id}/agents': {
      get: {
        tags: ['MCP'],
        summary: 'List agents using this MCP server',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Agents list' } },
      },
    },
    '/api/v1/mcps/oauth/owner/callback': {
      get: {
        tags: ['MCP OAuth'],
        summary: 'OAuth callback for owner-mode authorization',
        description: 'Called by the external auth server after owner grants access. No auth required — identity recovered from signed state parameter.',
        responses: { 302: { description: 'Redirect with result' } },
      },
    },
    '/api/v1/mcps/oauth/user/callback': {
      get: {
        tags: ['MCP OAuth'],
        summary: 'OAuth callback for user-mode authorization',
        description: 'Called by the external auth server after end-user grants access. No auth required — identity recovered from signed state parameter.',
        responses: { 302: { description: 'Redirect with result' } },
      },
    },
    '/api/v1/mcps/{id}/oauth/owner/authorize': {
      get: {
        tags: ['MCP OAuth'],
        summary: 'Get owner OAuth authorization URL',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Authorization URL' } },
      },
    },
    '/api/v1/mcps/{id}/oauth/user/authorize': {
      get: {
        tags: ['MCP OAuth'],
        summary: 'Get user OAuth authorization URL',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Authorization URL' } },
      },
    },
    '/api/v1/mcps/{id}/oauth/user/status': {
      get: {
        tags: ['MCP OAuth'],
        summary: 'Check user OAuth connection status',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Connection status' } },
      },
    },
    '/api/v1/mcps/{id}/oauth/user/connection': {
      delete: {
        tags: ['MCP OAuth'],
        summary: 'Disconnect user OAuth connection',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Connection disconnected' } },
      },
    },
    '/api/v1/mcps/{id}/oauth/owner/connection': {
      delete: {
        tags: ['MCP OAuth'],
        summary: 'Disconnect owner OAuth connection',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Connection disconnected' } },
      },
    },

    // ── AG-UI ───────────────────────────────────────────────
    '/api/v1/agui': {
      get: {
        tags: ['AG-UI'],
        summary: 'AG-UI protocol info',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Protocol information' } },
      },
      post: {
        tags: ['AG-UI'],
        summary: 'Send message and stream agent response (SSE)',
        description: 'Returns a Server-Sent Events stream. The client reads events as they arrive (text chunks, tool calls, tool results, state snapshots). Supports resuming interrupted threads via the `resume` body field.',
        security: [{ clerkAuth: [] }],
        parameters: [
          { name: 'x-agent-id', in: 'header', required: true, schema: { type: 'string' }, description: 'Agent ID to chat with' },
          { name: 'x-thread-id', in: 'header', schema: { type: 'string' }, description: 'Thread ID to resume (omit for new conversation)' },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', enum: ['user', 'assistant'] }, content: { type: 'string' } } } },
                  resume: { type: 'object', description: 'Resume data for interrupted threads (decisions for HITL, answers for clarification)' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'SSE event stream' } },
      },
    },

    // ── Upload ──────────────────────────────────────────────
    '/api/v1/upload/avatar': {
      post: {
        tags: ['Upload'],
        summary: 'Upload avatar image',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary', description: 'Image file (jpg, png, gif, webp, max 5MB)' } } } } },
        },
        responses: { 200: { description: 'Upload result with URL' } },
      },
    },

    // ── Knowledge ───────────────────────────────────────────
    '/api/v1/knowledge': {
      get: {
        tags: ['Knowledge'],
        summary: 'List knowledge bases',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Knowledge base list' } },
      },
      post: {
        tags: ['Knowledge'],
        summary: 'Create a knowledge base',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, isPublic: { type: 'boolean' } } } } },
        },
        responses: { 201: { description: 'Knowledge base created' } },
      },
    },
    '/api/v1/knowledge/{id}': {
      get: {
        tags: ['Knowledge'],
        summary: 'Get knowledge base details',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Knowledge base details' } },
      },
      patch: {
        tags: ['Knowledge'],
        summary: 'Update knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Knowledge base updated' } },
      },
      delete: {
        tags: ['Knowledge'],
        summary: 'Delete knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Knowledge base deleted' } },
      },
    },
    '/api/v1/knowledge/{id}/upload': {
      post: {
        tags: ['Knowledge'],
        summary: 'Upload documents to a knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'Files to upload (PDF, TXT, MD, JSON, CSV, max 20MB each, max 10 files)' } } } } },
        },
        responses: { 200: { description: 'Upload result with chunk counts' } },
      },
    },
    '/api/v1/knowledge/{id}/documents': {
      get: {
        tags: ['Knowledge'],
        summary: 'List documents in a knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Document list' } },
      },
    },
    '/api/v1/knowledge/{id}/documents/{sourceName}': {
      delete: {
        tags: ['Knowledge'],
        summary: 'Delete a document from a knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'sourceName', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Document deleted' } },
      },
    },
    '/api/v1/knowledge/{id}/search': {
      post: {
        tags: ['Knowledge'],
        summary: 'Search a knowledge base',
        security: [{ clerkAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, topK: { type: 'integer', default: 5 } } } } },
        },
        responses: { 200: { description: 'Search results with source attribution' } },
      },
    },

    // ── Memory ──────────────────────────────────────────────
    '/api/v1/memory': {
      get: {
        tags: ['Memory'],
        summary: 'List memory files',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'Memory file list' } },
      },
    },
    '/api/v1/memory/file': {
      put: {
        tags: ['Memory'],
        summary: 'Write a memory file',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['key', 'content'], properties: { key: { type: 'string' }, content: { type: 'string' }, namespace: { type: 'string', enum: ['user', 'agent'] } } } } },
        },
        responses: { 200: { description: 'File written' } },
      },
      delete: {
        tags: ['Memory'],
        summary: 'Delete a memory file',
        security: [{ clerkAuth: [] }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', required: ['key'], properties: { key: { type: 'string' }, namespace: { type: 'string', enum: ['user', 'agent'] } } } } },
        },
        responses: { 200: { description: 'File deleted' } },
      },
    },
    '/api/v1/memory/all': {
      delete: {
        tags: ['Memory'],
        summary: 'Clear all memory',
        security: [{ clerkAuth: [] }],
        responses: { 200: { description: 'All memory cleared' } },
      },
    },

    // ── Webhooks ────────────────────────────────────────────
    '/api/v1/webhooks/clerk': {
      post: {
        tags: ['Webhooks'],
        summary: 'Clerk webhook handler',
        description: 'Receives Clerk user lifecycle events (user.created, user.updated, user.deleted). Verified with Svix signatures. Uses raw body parsing — no Clerk middleware or JSON parsing applied.',
        responses: { 200: { description: 'Webhook processed' } },
      },
    },
  },
};

export default openapiSpecification;
