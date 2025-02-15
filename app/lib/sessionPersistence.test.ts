import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

vi.mock('@rinardnick/ts-mcp-client');

describe('Session Persistence', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockCapabilities: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('should persist session state to storage', async () => {
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
    const session = await sessionManager.initializeSession(llmConfig);

    const storedData = localStorage.getItem('mcp_sessions');
    expect(storedData).toBeDefined();

    const storedSessions = JSON.parse(storedData!);
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0].id).toBe(session.id);
    expect(storedSessions[0].config).toEqual(llmConfig);
  });

  it('should recover session state after reload', async () => {
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

    // Create and store a session
    sessionManager = new SessionManager();
    const originalSession = await sessionManager.initializeSession(llmConfig);

    // Create a new session manager instance to simulate page reload
    sessionManager = new SessionManager();
    const recoveredSession = await sessionManager.recoverSession(
      originalSession.id
    );

    expect(recoveredSession.id).toBe(originalSession.id);
    expect(recoveredSession.mcpClient?.tools).toEqual(mockCapabilities.tools);
  });

  it('should handle multiple active sessions', async () => {
    const mockSession1 = {
      id: 'test-session-1',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
      },
    };

    const mockSession2 = {
      id: 'test-session-2',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
      },
    };

    const { SessionManager: MockSessionManager } = await import(
      '@rinardnick/ts-mcp-client'
    );
    const mockInitializeSession = vi
      .fn()
      .mockResolvedValueOnce(mockSession1)
      .mockResolvedValueOnce(mockSession2);

    vi.mocked(MockSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: mockInitializeSession,
          sendMessage: vi.fn(),
          sendMessageStream: vi.fn(),
          getSession: vi.fn(),
          cleanupSession: vi.fn(),
          updateSessionActivity: vi.fn(),
        } as any)
    );

    sessionManager = new SessionManager();
    const session1 = await sessionManager.initializeSession(llmConfig);
    const session2 = await sessionManager.initializeSession(llmConfig);

    const storedData = localStorage.getItem('mcp_sessions');
    const storedSessions = JSON.parse(storedData!);

    expect(storedSessions).toHaveLength(2);
    expect(storedSessions.map((s: any) => s.id)).toContain(session1.id);
    expect(storedSessions.map((s: any) => s.id)).toContain(session2.id);
  });

  it('should cleanup expired sessions', async () => {
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

    // Create a session and manually set its last activity to 25 hours ago
    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);
    const storedData = localStorage.getItem('mcp_sessions');
    const storedSessions = JSON.parse(storedData!);
    storedSessions[0].lastActivity = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('mcp_sessions', JSON.stringify(storedSessions));

    // Create a new session manager instance to trigger cleanup
    sessionManager = new SessionManager();
    await expect(sessionManager.recoverSession(session.id)).rejects.toThrow(
      'Session expired'
    );
  });

  it('should handle storage errors gracefully', async () => {
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

    // Mock localStorage.setItem to throw an error
    const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
    mockSetItem.mockImplementation(() => {
      throw new Error('Storage full');
    });

    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    // Session should still be initialized even if storage fails
    expect(session).toBeDefined();
    expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
  });

  it('should update session activity on message send', async () => {
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
    const session = await sessionManager.initializeSession(llmConfig);

    const initialStoredData = localStorage.getItem('mcp_sessions');
    const initialLastActivity = JSON.parse(initialStoredData!)[0].lastActivity;

    // Wait a bit to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));

    await sessionManager.sendMessage(session.id, 'test message');

    const updatedStoredData = localStorage.getItem('mcp_sessions');
    const updatedLastActivity = JSON.parse(updatedStoredData!)[0].lastActivity;

    expect(updatedLastActivity).toBeGreaterThan(initialLastActivity);
  });
});
