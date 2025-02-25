import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import { SessionPersistenceManager } from './sessionPersistence';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/client_mcp';

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

// Mock the sessionPersistence module
vi.mock('./sessionPersistence', () => {
  const mockPersistenceManager = {
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    getSessionIds: vi.fn(),
    getAllSessions: vi.fn(),
    cleanupExpiredSessions: vi.fn(),
    updateSessionActivity: vi.fn(),
  };

  return {
    SessionPersistenceManager: vi
      .fn()
      .mockImplementation(() => mockPersistenceManager),
  };
});

describe('Session Recovery', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockClientSession: any;
  let mockPersistenceManager: any;

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

    mockClientSession = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue({
          tools: [
            {
              name: 'readFile',
              description: 'Reads a file from the filesystem',
            },
          ],
        }),
      },
    };

    // Configure mock behavior
    mockTSMCPSessionManager.initializeSession.mockResolvedValue(
      mockClientSession
    );
    mockTSMCPSessionManager.getSession.mockResolvedValue(mockClientSession);

    // Get reference to the mock persistence manager
    sessionManager = new SessionManager();
    mockPersistenceManager = vi.mocked(SessionPersistenceManager).mock
      .results[0].value;
  });

  describe('Session Initialization with Persistence', () => {
    it('should persist session state on initialization', async () => {
      await sessionManager.initializeSession(llmConfig);

      // Verify session was persisted
      expect(mockPersistenceManager.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-session',
          lastActive: expect.any(Number),
          uiState: expect.objectContaining({
            isLoading: false,
            isThinking: false,
            error: null,
          }),
        })
      );
    });

    it('should clean up persisted data if initialization fails', async () => {
      // Mock the initializeSession to throw an error
      mockTSMCPSessionManager.initializeSession.mockImplementationOnce(() => {
        throw new Error('Initialization failed');
      });

      // Attempt to initialize a session
      await expect(sessionManager.initializeSession(llmConfig)).rejects.toThrow(
        'Failed to initialize session: Initialization failed'
      );

      // Since the error happens before we get a session ID, we need to test a different scenario
      // Let's reset the mock and test a scenario where we get a session ID but fail during configuration
      mockTSMCPSessionManager.initializeSession.mockReset();
      mockTSMCPSessionManager.initializeSession.mockResolvedValueOnce({
        id: 'test-session-fail',
        mcpClient: {
          configure: vi
            .fn()
            .mockRejectedValueOnce(new Error('Configuration failed')),
          discoverCapabilities: vi.fn(),
        },
      });

      // Attempt to initialize a session with servers
      await expect(
        sessionManager.initializeSession(llmConfig, mockServers)
      ).rejects.toThrow('Failed to configure client: Configuration failed');

      // Verify persisted data was cleaned up
      expect(mockPersistenceManager.deleteSession).toHaveBeenCalledWith(
        'test-session-fail'
      );
    });
  });

  describe('Session Recovery', () => {
    it('should recover session from persistence', async () => {
      // Mock a persisted session
      const mockPersistedSession = {
        id: 'test-session',
        lastActive: Date.now(),
        uiState: {
          isLoading: false,
          isThinking: true,
          error: null,
          currentTool: 'test-tool',
        },
      };
      mockPersistenceManager.loadSession.mockReturnValueOnce(
        mockPersistedSession
      );

      // Recover the session
      const session = await sessionManager.recoverSession('test-session');

      // Verify MCP session was recovered
      expect(mockTSMCPSessionManager.getSession).toHaveBeenCalledWith(
        'test-session'
      );

      // Verify UI state was restored from persistence
      const uiState = sessionManager.getUIState('test-session');
      expect(uiState).toEqual(mockPersistedSession.uiState);

      // Verify session activity was updated
      expect(mockPersistenceManager.updateSessionActivity).toHaveBeenCalledWith(
        'test-session'
      );
    });

    it('should initialize fresh UI state if no persisted state exists', async () => {
      // Mock no persisted session
      mockPersistenceManager.loadSession.mockReturnValueOnce(null);

      // Recover the session
      const session = await sessionManager.recoverSession('test-session');

      // Verify UI state was initialized with defaults
      const uiState = sessionManager.getUIState('test-session');
      expect(uiState).toEqual({
        isLoading: false,
        isThinking: false,
        error: null,
      });
    });

    it('should clean up persisted data if MCP session recovery fails', async () => {
      // Mock a persisted session that exists
      const mockPersistedSession = {
        id: 'test-session',
        lastActive: Date.now(),
        uiState: { isLoading: false, isThinking: false, error: null },
      };

      // First call to loadSession in recoverSession
      mockPersistenceManager.loadSession.mockReturnValueOnce(
        mockPersistedSession
      );

      // Second call to loadSession in the catch block
      mockPersistenceManager.loadSession.mockReturnValueOnce(
        mockPersistedSession
      );

      // Mock MCP session recovery failure
      mockTSMCPSessionManager.getSession.mockRejectedValueOnce(
        new Error('Session not found')
      );

      // Attempt to recover the session
      await expect(
        sessionManager.recoverSession('test-session')
      ).rejects.toThrow('Session not found');

      // Verify persisted data was cleaned up
      expect(mockPersistenceManager.deleteSession).toHaveBeenCalledWith(
        'test-session'
      );
    });
  });

  describe('Session Persistence During Operations', () => {
    it('should persist UI state changes during message sending', async () => {
      // Initialize a session
      await sessionManager.initializeSession(llmConfig);

      // Reset the mock to clear initialization calls
      mockPersistenceManager.saveSession.mockClear();

      // Send a message
      await sessionManager.sendMessage('test-session', 'Hello');

      // Verify UI state was persisted at least twice (before and after sending)
      expect(mockPersistenceManager.saveSession).toHaveBeenCalledTimes(2);
    });

    it('should persist UI state changes during streaming', async () => {
      // Initialize a session
      await sessionManager.initializeSession(llmConfig);

      // Reset the mock to clear initialization calls
      mockPersistenceManager.saveSession.mockClear();

      // Mock a stream with various events
      const mockStream = (async function* () {
        yield { type: 'thinking' };
        yield { type: 'content', content: 'Hello' };
        yield { type: 'error', error: 'Test error' };
        yield { type: 'done' };
      })();
      mockTSMCPSessionManager.sendMessageStream.mockReturnValueOnce(mockStream);

      // Start streaming
      const stream = await sessionManager.sendMessageStream(
        'test-session',
        'Hello'
      );

      // Consume the stream
      for await (const _ of stream) {
        // Just consume the stream
      }

      // Verify UI state was persisted multiple times
      // At least: initial state, thinking, error, done
      expect(mockPersistenceManager.saveSession).toHaveBeenCalledTimes(4);
    });

    it('should persist error states', async () => {
      // Initialize a session
      await sessionManager.initializeSession(llmConfig);

      // Reset the mock to clear initialization calls
      mockPersistenceManager.saveSession.mockClear();

      // Mock an error during message sending
      mockTSMCPSessionManager.sendMessage.mockRejectedValueOnce(
        new Error('Test error')
      );

      // Attempt to send a message
      await expect(
        sessionManager.sendMessage('test-session', 'Hello')
      ).rejects.toThrow('Test error');

      // Verify error state was persisted
      expect(mockPersistenceManager.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-session',
          uiState: expect.objectContaining({
            error: 'Test error',
          }),
        })
      );
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up persisted data when cleaning up a session', async () => {
      // Initialize a session
      await sessionManager.initializeSession(llmConfig);

      // Clean up the session
      await sessionManager.cleanupSession('test-session');

      // Verify persisted data was cleaned up
      expect(mockPersistenceManager.deleteSession).toHaveBeenCalledWith(
        'test-session'
      );
    });

    it('should clean up expired sessions on initialization', () => {
      // Verify expired sessions were cleaned up during initialization
      expect(mockPersistenceManager.cleanupExpiredSessions).toHaveBeenCalled();
    });

    it('should expose methods to manage persisted sessions', () => {
      // Mock session IDs
      const mockSessionIds = ['session1', 'session2'];
      mockPersistenceManager.getSessionIds.mockReturnValueOnce(mockSessionIds);

      // Get persisted session IDs
      const sessionIds = sessionManager.getPersistedSessionIds();

      // Verify session IDs were returned
      expect(sessionIds).toEqual(mockSessionIds);

      // Clean up expired sessions
      const customMaxAgeDays = 14;
      sessionManager.cleanupExpiredSessions(customMaxAgeDays);

      // Verify cleanup was called with custom age
      expect(
        mockPersistenceManager.cleanupExpiredSessions
      ).toHaveBeenCalledWith(customMaxAgeDays);
    });
  });
});
