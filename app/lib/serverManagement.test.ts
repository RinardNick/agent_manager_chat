import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

vi.mock('@rinardnick/ts-mcp-client');

describe('Server Management through Session Manager', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockCapabilities: any;

  beforeEach(() => {
    vi.clearAllMocks();
    llmConfig = {
      type: 'test-type',
      model: 'test-model',
      api_key: 'test-key',
      system_prompt: 'You are a helpful assistant.',
    };
    mockServers = {
      command: 'test-command',
      args: ['--test'],
      env: { TEST_ENV: 'test' },
    };
    mockCapabilities = {
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
  });

  it('should properly delegate server configuration to client', async () => {
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
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
    expect(session.mcpClient?.discoverCapabilities).toHaveBeenCalled();
  });

  it('should handle client initialization failures', async () => {
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi
          .fn()
          .mockRejectedValue(new Error('Failed to initialize client')),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: [],
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

    await expect(
      sessionManager.initializeSession(llmConfig, mockServers)
    ).rejects.toThrow('Failed to initialize client');
  });

  it('should expose client capabilities through session interface', async () => {
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
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
      mockServers
    );

    expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
  });

  describe('Tool Call Limits', () => {
    it('should enforce tool call limits from client configuration', async () => {
      const maxToolCalls = 2;
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
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
        maxToolCalls
      );

      expect(session.mcpClient?.configure).toHaveBeenCalledWith({
        servers: mockServers,
        max_tool_calls: maxToolCalls,
      });
    });

    it('should handle tool limit reached events gracefully', async () => {
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
          tools: ['tool1', 'tool2'],
          invoke: vi
            .fn()
            .mockRejectedValue(new Error('Tool call limit reached')),
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
        mockServers
      );

      await expect(session.mcpClient?.invoke('test-tool', {})).rejects.toThrow(
        'Tool call limit reached'
      );
    });
  });

  describe('Server Capability Discovery', () => {
    it('should delegate capability discovery to client and expose through session', async () => {
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
          tools: mockCapabilities.tools,
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
        mockServers
      );

      expect(session.mcpClient?.discoverCapabilities).toHaveBeenCalled();
      expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
    });

    it('should handle capability discovery errors through client', async () => {
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          discoverCapabilities: vi
            .fn()
            .mockRejectedValue(new Error('Failed to discover capabilities')),
          tools: [],
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
        mockServers
      );

      // Should still initialize with empty capabilities
      expect(session).toBeDefined();
      expect(session.mcpClient?.tools).toEqual([]);
    });

    it('should use client caching for capabilities', async () => {
      const mockDiscoverCapabilities = vi
        .fn()
        .mockResolvedValue(mockCapabilities);
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi.fn().mockResolvedValue(undefined),
          discoverCapabilities: mockDiscoverCapabilities,
          tools: mockCapabilities.tools,
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

      // Initialize first session
      const session1 = await sessionManager.initializeSession(
        llmConfig,
        mockServers
      );
      expect(session1.mcpClient?.discoverCapabilities).toHaveBeenCalled();

      // Initialize second session
      const session2 = await sessionManager.initializeSession(
        llmConfig,
        mockServers
      );

      // Verify discovery is only called once
      expect(mockDiscoverCapabilities).toHaveBeenCalledTimes(1);

      // Verify both sessions have access to cached capabilities
      expect(session1.mcpClient?.tools).toEqual(mockCapabilities.tools);
      expect(session2.mcpClient?.tools).toEqual(mockCapabilities.tools);
    });
  });
});
