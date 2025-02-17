import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

// Mock the ts-mcp-client module
const mockTSMCPSessionManager = {
  initializeSession: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(),
  getSession: vi.fn(),
  cleanupSession: vi.fn(),
  updateSessionActivity: vi.fn(),
};

vi.mock('@rinardnick/ts-mcp-client', () => {
  return {
    SessionManager: vi.fn().mockImplementation(() => mockTSMCPSessionManager),
  };
});

describe('Session Persistence', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockCapabilities: any;
  let mockClientSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    const store: { [key: string]: string } = {};
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    });

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

    mockClientSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: mockCapabilities.tools,
      },
    };

    // Configure mock behavior
    mockTSMCPSessionManager.initializeSession.mockResolvedValue(
      mockClientSession
    );
    mockTSMCPSessionManager.getSession.mockResolvedValue(mockClientSession);
  });

  it('should delegate session persistence to client', async () => {
    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    // Verify session was initialized through client
    expect(mockTSMCPSessionManager.initializeSession).toHaveBeenCalledWith(
      llmConfig
    );
    expect(session.id).toBe(mockClientSession.id);

    // Verify UI state is maintained locally
    const uiState = sessionManager.getUIState(session.id);
    expect(uiState).toBeDefined();
    expect(uiState?.isLoading).toBe(false);
    expect(uiState?.error).toBeNull();
  });

  it('should recover session state from client', async () => {
    sessionManager = new SessionManager();
    const session = await sessionManager.recoverSession('test-session');

    // Verify session was retrieved from client
    expect(mockTSMCPSessionManager.getSession).toHaveBeenCalledWith(
      'test-session'
    );
    expect(session.id).toBe(mockClientSession.id);

    // Verify UI state is initialized
    const uiState = sessionManager.getUIState(session.id);
    expect(uiState).toBeDefined();
    expect(uiState?.isLoading).toBe(false);
    expect(uiState?.error).toBeNull();
  });

  it('should handle multiple active sessions with separate UI states', async () => {
    const mockSession2 = { ...mockClientSession, id: 'test-session-2' };
    mockTSMCPSessionManager.initializeSession
      .mockResolvedValueOnce(mockClientSession)
      .mockResolvedValueOnce(mockSession2);

    sessionManager = new SessionManager();
    const session1 = await sessionManager.initializeSession(llmConfig);
    const session2 = await sessionManager.initializeSession(llmConfig);

    // Verify both sessions were initialized through client
    expect(mockTSMCPSessionManager.initializeSession).toHaveBeenCalledTimes(2);
    expect(session1.id).toBe(mockClientSession.id);
    expect(session2.id).toBe(mockSession2.id);

    // Verify separate UI states
    const uiState1 = sessionManager.getUIState(session1.id);
    const uiState2 = sessionManager.getUIState(session2.id);
    expect(uiState1).toBeDefined();
    expect(uiState2).toBeDefined();
    expect(uiState1).not.toBe(uiState2);
  });

  it('should delegate session cleanup to client', async () => {
    mockTSMCPSessionManager.getSession.mockRejectedValueOnce(
      new Error('Session expired')
    );

    sessionManager = new SessionManager();
    await expect(
      sessionManager.recoverSession('expired-session')
    ).rejects.toThrow('Session expired');

    // Verify client was consulted about session existence
    expect(mockTSMCPSessionManager.getSession).toHaveBeenCalledWith(
      'expired-session'
    );
  });

  it('should handle client errors gracefully', async () => {
    mockTSMCPSessionManager.initializeSession.mockRejectedValueOnce(
      new Error('Client error')
    );

    sessionManager = new SessionManager();
    await expect(sessionManager.initializeSession(llmConfig)).rejects.toThrow(
      'Client error'
    );
  });

  it('should delegate activity tracking to client', async () => {
    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);
    await sessionManager.sendMessage(session.id, 'test message');

    // Verify activity tracking is delegated to client
    expect(mockTSMCPSessionManager.updateSessionActivity).toHaveBeenCalledWith(
      session.id
    );
  });
});
