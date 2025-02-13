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
});
