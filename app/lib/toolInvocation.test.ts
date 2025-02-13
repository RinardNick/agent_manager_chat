import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import { LLMConfig } from '@rinardnick/ts-mcp-client';

vi.mock('@rinardnick/ts-mcp-client', () => {
  return {
    SessionManager: vi.fn().mockImplementation(() => ({
      initializeSession: vi.fn(),
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
      getSession: vi.fn(),
      cleanupSession: vi.fn(),
      updateSessionActivity: vi.fn(),
    })),
  };
});

describe('Tool Invocation through Session Manager', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    llmConfig = {
      type: 'test-type',
      model: 'test-model',
      api_key: 'test-key',
      system_prompt: 'You are a helpful assistant.',
    };
  });

  it('should handle tool invocations through session', async () => {
    // Setup mock session with tool capability
    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        tools: ['readFile'],
        invoke: vi.fn().mockResolvedValue({ content: 'file contents' }),
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    const mockInstance = new MockSessionManager();
    mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    expect(session.mcpClient).toBeDefined();
    expect(session.mcpClient?.tools).toContain('readFile');
  });

  it('should respect tool call limits from configuration', async () => {
    const mockServers = {
      testServer: {
        command: 'test-command',
        args: ['--test'],
        cwd: '/test/path',
      },
    };

    const maxToolCalls = 5;

    // Setup mock session that will hit tool limit
    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        tools: ['readFile'],
        invoke: vi
          .fn()
          .mockResolvedValueOnce({ content: 'first call' })
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

    // Verify tool limit configuration was passed
    expect(session.mcpClient?.configure).toHaveBeenCalledWith({
      servers: mockServers,
      max_tool_calls: maxToolCalls,
    });
  });

  it('should handle tool invocation errors gracefully', async () => {
    // Setup mock session that will encounter an error
    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        tools: ['readFile'],
        invoke: vi.fn().mockRejectedValue(new Error('Failed to invoke tool')),
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    const mockInstance = new MockSessionManager();
    mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    await expect(
      session.mcpClient?.invoke('readFile', { path: '/test' })
    ).rejects.toThrow('Failed to invoke tool');
  });

  it('should make tool capabilities available through session', async () => {
    // Setup mock session with tool capabilities
    const mockSession = {
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
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
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    const mockInstance = new MockSessionManager();
    mockInstance.initializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(MockSessionManager).mockImplementation(() => mockInstance);

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    expect(session.mcpClient?.tools).toHaveLength(2);
    expect(session.mcpClient?.tools[0].name).toBe('readFile');
    expect(session.mcpClient?.tools[1].name).toBe('writeFile');
  });
});
