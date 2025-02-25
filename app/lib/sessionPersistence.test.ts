import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/client_mcp';
import {
  SessionPersistenceManager,
  PersistedSession,
} from './sessionPersistence';
import { UIState } from './uiState';

// Mock the client_mcp module
const mockTSMCPSessionManager = {
  initializeSession: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(),
  getSession: vi.fn(),
  cleanupSession: vi.fn(),
  updateSessionActivity: vi.fn(),
};

vi.mock('@rinardnick/client_mcp', () => {
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

describe('Session Persistence Manager', () => {
  let persistenceManager: SessionPersistenceManager;
  let mockStorage: Storage;
  let testSession: PersistedSession;

  beforeEach(() => {
    // Create a mock storage implementation
    const store: Record<string, string> = {};
    mockStorage = {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      key: vi.fn((index: number) => Object.keys(store)[index] || null),
      length: 0,
    };
    Object.defineProperty(mockStorage, 'length', {
      get: () => Object.keys(store).length,
    });

    // Initialize the persistence manager with mock storage
    persistenceManager = new SessionPersistenceManager(mockStorage);

    // Create a test session
    const uiState: UIState = {
      isLoading: false,
      isThinking: false,
      error: null,
      currentTool: 'test-tool',
    };

    testSession = {
      id: 'test-session',
      lastActive: Date.now(),
      uiState,
    };
  });

  describe('Session Saving and Loading', () => {
    it('should save a session to storage', () => {
      persistenceManager.saveSession(testSession);

      // Verify session was saved
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'mcp_session_test-session',
        expect.any(String)
      );

      // Verify session IDs were updated
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'mcp_session_ids',
        expect.stringContaining('test-session')
      );
    });

    it('should load a session from storage', () => {
      // Save the session first
      persistenceManager.saveSession(testSession);

      // Load the session
      const loadedSession = persistenceManager.loadSession('test-session');

      // Verify the loaded session matches the original
      expect(loadedSession).toEqual(testSession);
    });

    it('should return null when loading non-existent session', () => {
      const loadedSession = persistenceManager.loadSession('non-existent');
      expect(loadedSession).toBeNull();
    });

    it('should handle JSON parse errors when loading', () => {
      // Mock a corrupted session in storage
      mockStorage.getItem = vi.fn().mockReturnValue('invalid-json');

      // Spy on console.error
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const loadedSession = persistenceManager.loadSession('test-session');

      // Verify error was logged and null was returned
      expect(consoleSpy).toHaveBeenCalled();
      expect(loadedSession).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should delete a session from storage', () => {
      // Save the session first
      persistenceManager.saveSession(testSession);

      // Delete the session
      persistenceManager.deleteSession('test-session');

      // Verify session was removed
      expect(mockStorage.removeItem).toHaveBeenCalledWith(
        'mcp_session_test-session'
      );

      // Verify session IDs were updated
      expect(mockStorage.setItem).toHaveBeenCalledWith('mcp_session_ids', '[]');
    });

    it('should get all session IDs', () => {
      // Save multiple sessions
      persistenceManager.saveSession(testSession);
      persistenceManager.saveSession({
        ...testSession,
        id: 'test-session-2',
      });

      // Get all session IDs
      const sessionIds = persistenceManager.getSessionIds();

      // Verify session IDs
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain('test-session');
      expect(sessionIds).toContain('test-session-2');
    });

    it('should get all sessions', () => {
      // Save multiple sessions
      persistenceManager.saveSession(testSession);
      const testSession2 = {
        ...testSession,
        id: 'test-session-2',
      };
      persistenceManager.saveSession(testSession2);

      // Get all sessions
      const sessions = persistenceManager.getAllSessions();

      // Verify sessions
      expect(sessions).toHaveLength(2);
      expect(sessions).toContainEqual(testSession);
      expect(sessions).toContainEqual(testSession2);
    });

    it('should handle errors when getting all sessions', () => {
      // Save a session
      persistenceManager.saveSession(testSession);

      // Mock an error when loading a session
      const loadSessionSpy = vi
        .spyOn(persistenceManager, 'loadSession')
        .mockImplementation(() => {
          throw new Error('Test error');
        });

      // Spy on console.error
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Get all sessions
      const sessions = persistenceManager.getAllSessions();

      // Verify error was logged and empty array was returned
      expect(consoleSpy).toHaveBeenCalled();
      expect(sessions).toEqual([]);

      // Restore the original implementation
      loadSessionSpy.mockRestore();
    });
  });

  describe('Session Activity and Cleanup', () => {
    it('should update session activity', () => {
      // Save the session first
      persistenceManager.saveSession(testSession);

      // Mock Date.now to return a specific timestamp
      const newTimestamp = Date.now() + 1000;
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(newTimestamp);

      // Update session activity
      persistenceManager.updateSessionActivity('test-session');

      // Load the updated session
      const updatedSession = persistenceManager.loadSession('test-session');

      // Verify the lastActive timestamp was updated
      expect(updatedSession?.lastActive).toBe(newTimestamp);

      // Restore Date.now
      dateNowSpy.mockRestore();
    });

    it('should clean up expired sessions', () => {
      // Create sessions with different timestamps
      const currentTime = Date.now();

      // Current session
      persistenceManager.saveSession(testSession);

      // Old session (8 days old)
      const oldSession = {
        ...testSession,
        id: 'old-session',
        lastActive: currentTime - 8 * 24 * 60 * 60 * 1000,
      };
      persistenceManager.saveSession(oldSession);

      // Clean up expired sessions (default 7 days)
      const expiredIds = persistenceManager.cleanupExpiredSessions();

      // Verify only the old session was removed
      expect(expiredIds).toHaveLength(1);
      expect(expiredIds).toContain('old-session');
      expect(persistenceManager.loadSession('old-session')).toBeNull();
      expect(persistenceManager.loadSession('test-session')).not.toBeNull();
    });

    it('should handle custom expiry period', () => {
      // Create sessions with different timestamps
      const currentTime = Date.now();

      // Current session
      persistenceManager.saveSession(testSession);

      // Somewhat old session (3 days old)
      const oldSession = {
        ...testSession,
        id: 'old-session',
        lastActive: currentTime - 3 * 24 * 60 * 60 * 1000,
      };
      persistenceManager.saveSession(oldSession);

      // Clean up sessions older than 2 days
      const expiredIds = persistenceManager.cleanupExpiredSessions(2);

      // Verify only the old session was removed
      expect(expiredIds).toHaveLength(1);
      expect(expiredIds).toContain('old-session');
    });
  });
});
