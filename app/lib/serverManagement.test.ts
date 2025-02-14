import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

vi.mock('@rinardnick/ts-mcp-client');

describe('Server Management through Session Manager', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    llmConfig = {
      type: 'test-type',
      model: 'test-model',
      api_key: 'test-key',
      system_prompt: 'You are a helpful assistant.',
    };
    mockServers = {
      testServer: {
        command: 'test-command',
        args: ['--test'],
        cwd: '/test/path',
      },
    };
  });

  it('should properly delegate server configuration to client', async () => {
    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        tools: ['tool1', 'tool2'],
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    vi.mocked(MockSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: vi.fn().mockResolvedValue(mockSession),
          sendMessage: vi.fn(),
          sendMessageStream: vi.fn(),
          getSession: vi.fn(),
          cleanupSession: vi.fn(),
          updateSessionActivity: vi.fn(),
        } as any)
    );

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(
      llmConfig,
      mockServers,
      10
    );

    expect(session.mcpClient).toBeDefined();
    expect(session.mcpClient?.configure).toHaveBeenCalledWith({
      servers: mockServers,
      max_tool_calls: 10,
    });
  });

  it('should handle client initialization failures', async () => {
    const mockSessionWithError = {
      mcpClient: {
        configure: vi
          .fn()
          .mockRejectedValue(new Error('Failed to initialize client')),
        tools: [],
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    vi.mocked(MockSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: vi.fn().mockResolvedValue(mockSessionWithError),
          sendMessage: vi.fn(),
          sendMessageStream: vi.fn(),
          getSession: vi.fn(),
          cleanupSession: vi.fn(),
          updateSessionActivity: vi.fn(),
        } as any)
    );

    sessionManager = new SessionManager();

    await expect(
      sessionManager.initializeSession(llmConfig, mockServers)
    ).rejects.toThrow('Failed to initialize client');
  });

  it('should expose client capabilities through session interface', async () => {
    const mockCapabilities = {
      tools: [
        {
          name: 'readFile',
          description: 'Reads a file from the filesystem',
        },
        {
          name: 'writeFile',
          description: 'Writes content to a file',
        },
      ],
    };

    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        tools: mockCapabilities.tools,
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    const mockInstance = new MockSessionManager();
    mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(
      llmConfig,
      mockServers
    );

    // Verify capabilities are exposed through session interface
    expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
  });

  describe('Tool Call Limits', () => {
    it('should enforce tool call limits from client configuration', async () => {
      const maxToolCalls = 2;
      const mockSession = {
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          tools: ['tool1', 'tool2'],
          invoke: vi
            .fn()
            .mockResolvedValueOnce({ result: 'first call' })
            .mockResolvedValueOnce({ result: 'second call' })
            .mockRejectedValueOnce(new Error('Tool call limit reached')),
        },
      };

      const { SessionManager: MockSessionManager } = await import(
        '@rinardnick/ts-mcp-client'
      );
      const mockInstance = new MockSessionManager();
      mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
      vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(
        llmConfig,
        mockServers,
        maxToolCalls
      );

      // Verify client was configured with tool call limit
      expect(session.mcpClient?.configure).toHaveBeenCalledWith({
        servers: mockServers,
        max_tool_calls: maxToolCalls,
      });

      // Verify tool call limit is enforced by client
      await expect(session.mcpClient?.invoke('tool1', {})).resolves.toEqual({
        result: 'first call',
      });
      await expect(session.mcpClient?.invoke('tool1', {})).resolves.toEqual({
        result: 'second call',
      });
      await expect(session.mcpClient?.invoke('tool1', {})).rejects.toThrow(
        'Tool call limit reached'
      );
    });

    it('should handle tool limit reached events gracefully', async () => {
      const maxToolCalls = 1;
      const mockSession = {
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          tools: ['tool1'],
          invoke: vi
            .fn()
            .mockResolvedValueOnce({ result: 'first call' })
            .mockRejectedValueOnce(new Error('Tool call limit reached')),
        },
      };

      const { SessionManager: MockSessionManager } = await import(
        '@rinardnick/ts-mcp-client'
      );
      const mockInstance = new MockSessionManager();
      mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
      vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(
        llmConfig,
        mockServers,
        maxToolCalls
      );

      // First tool call should succeed
      await expect(session.mcpClient?.invoke('tool1', {})).resolves.toEqual({
        result: 'first call',
      });

      // Second tool call should fail with a clear error message
      await expect(session.mcpClient?.invoke('tool1', {})).rejects.toThrow(
        'Tool call limit reached'
      );

      // Verify the session was configured with the correct limit
      expect(session.mcpClient?.configure).toHaveBeenCalledWith({
        servers: mockServers,
        max_tool_calls: maxToolCalls,
      });
    });
  });

  describe('Server Capability Discovery', () => {
    it('should delegate capability discovery to client and expose through session', async () => {
      const mockCapabilities = {
        tools: [
          {
            name: 'readFile',
            description: 'Reads a file from the filesystem',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
            },
          },
          {
            name: 'writeFile',
            description: 'Writes content to a file',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            },
          },
        ] as any[],
        resources: [
          {
            name: 'workspace',
            type: 'directory',
            description: 'Workspace root directory',
          },
        ] as any[],
      };

      // Mock the client's discovery method
      const mockDiscoverCapabilities = vi
        .fn()
        .mockResolvedValue(mockCapabilities);

      const mockSession = {
        mcpClient: {
          configure: vi.fn().mockImplementation(async () => {
            await mockDiscoverCapabilities();
            mockSession.mcpClient.tools = mockCapabilities.tools;
            mockSession.mcpClient.resources = mockCapabilities.resources;
          }),
          discoverCapabilities: mockDiscoverCapabilities,
          tools: [] as any[],
          resources: [] as any[],
        },
      };

      const { SessionManager: MockSessionManager } = await import(
        '@rinardnick/ts-mcp-client'
      );
      const mockInstance = new MockSessionManager();
      mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
      vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(
        llmConfig,
        mockServers
      );

      // Verify client handles discovery during configuration
      expect(mockDiscoverCapabilities).toHaveBeenCalled();

      // Verify capabilities are accessible through session interface
      expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
      expect(session.mcpClient?.resources).toEqual(mockCapabilities.resources);
    });

    it('should handle capability discovery errors through client', async () => {
      // Mock the client's discovery method to throw
      const mockDiscoverCapabilities = vi
        .fn()
        .mockRejectedValue(new Error('Failed to discover capabilities'));

      const mockSession = {
        mcpClient: {
          configure: vi.fn().mockImplementation(async () => {
            await mockDiscoverCapabilities();
          }),
          discoverCapabilities: mockDiscoverCapabilities,
          tools: [] as any[],
          resources: [] as any[],
        },
      };

      const { SessionManager: MockSessionManager } = await import(
        '@rinardnick/ts-mcp-client'
      );
      const mockInstance = new MockSessionManager();
      mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
      vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

      sessionManager = new SessionManager();

      // Verify error is propagated through client
      await expect(
        sessionManager.initializeSession(llmConfig, mockServers)
      ).rejects.toThrow('Failed to discover capabilities');
    });

    it('should use client caching for capabilities', async () => {
      const mockCapabilities = {
        tools: [{ name: 'testTool', description: 'Test tool' }] as any[],
        resources: [
          { name: 'testResource', type: 'test', description: 'Test resource' },
        ] as any[],
      };

      // Mock the client's discovery method with call tracking
      const mockDiscoverCapabilities = vi
        .fn()
        .mockResolvedValue(mockCapabilities);

      // Create a mock client that simulates caching by only discovering once
      let hasDiscovered = false;
      const mockSession = {
        mcpClient: {
          configure: vi.fn().mockImplementation(async () => {
            if (!hasDiscovered) {
              const capabilities = await mockDiscoverCapabilities();
              mockSession.mcpClient.tools = capabilities.tools;
              mockSession.mcpClient.resources = capabilities.resources;
              hasDiscovered = true;
            }
          }),
          discoverCapabilities: mockDiscoverCapabilities,
          tools: [] as any[],
          resources: [] as any[],
        },
      };

      const { SessionManager: MockSessionManager } = await import(
        '@rinardnick/ts-mcp-client'
      );
      const mockInstance = new MockSessionManager();
      mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
      vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

      sessionManager = new SessionManager();

      // First initialization
      const session1 = await sessionManager.initializeSession(
        llmConfig,
        mockServers
      );

      // Second initialization with same configuration
      const session2 = await sessionManager.initializeSession(
        llmConfig,
        mockServers
      );

      // Verify discovery is only called once
      expect(mockDiscoverCapabilities).toHaveBeenCalledTimes(1);

      // Verify both sessions have access to cached capabilities
      expect(session1.mcpClient?.tools).toEqual(mockCapabilities.tools);
      expect(session2.mcpClient?.tools).toEqual(mockCapabilities.tools);
      expect(session1.mcpClient?.resources).toEqual(mockCapabilities.resources);
      expect(session2.mcpClient?.resources).toEqual(mockCapabilities.resources);
    });
  });
});
