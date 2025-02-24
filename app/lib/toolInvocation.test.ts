import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/client_mcp';

vi.mock('@rinardnick/client_mcp');

describe('Tool Invocation through Session Manager', () => {
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

  it('should properly delegate tool invocations to client', async () => {
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
        invoke: vi.fn().mockResolvedValue({ result: 'test result' }),
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/client_mcp'
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
    const session = await sessionManager.initializeSession(llmConfig);

    const result = await session.mcpClient?.invoke('readFile', {
      path: 'test.txt',
    });
    expect(result).toEqual({ result: 'test result' });
    expect(session.mcpClient?.invoke).toHaveBeenCalledWith('readFile', {
      path: 'test.txt',
    });
  });

  it('should handle tool invocation errors from client', async () => {
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
        invoke: vi.fn().mockRejectedValue(new Error('Tool invocation failed')),
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/client_mcp'
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
    const session = await sessionManager.initializeSession(llmConfig);

    await expect(
      session.mcpClient?.invoke('readFile', { path: 'test.txt' })
    ).rejects.toThrow('Tool invocation failed');
  });
});
