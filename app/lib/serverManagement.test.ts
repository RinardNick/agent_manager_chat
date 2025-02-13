import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';
import { __mockSession } from './__mocks__/@rinardnick/ts-mcp-client';

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

  it('should launch servers with correct configuration', async () => {
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

  it('should handle server initialization failures', async () => {
    const mockSessionWithError = {
      mcpClient: {
        configure: vi
          .fn()
          .mockRejectedValue(new Error('Failed to launch server')),
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
    ).rejects.toThrow('Failed to launch server');
  });

  it('should make server capabilities available through session', async () => {
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
      mockServers
    );

    expect(session.mcpClient?.tools).toEqual(['tool1', 'tool2']);
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
});
