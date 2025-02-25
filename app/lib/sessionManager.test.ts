import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/client_mcp';

// Mock the client_mcp module
const mockTSMCPSessionManager = {
  initializeSession: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(),
  getSession: vi.fn(),
  updateSessionActivity: vi.fn(),
};

vi.mock('@rinardnick/client_mcp', () => ({
  SessionManager: vi.fn().mockImplementation(() => mockTSMCPSessionManager),
}));

describe('Session Manager', () => {
  let sessionManager: SessionManager;
  let config: LLMConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();

    config = {
      type: 'claude',
      api_key: 'test-key',
      model: 'test-model',
      system_prompt: 'test prompt',
    };
  });

  describe('Session Initialization', () => {
    it('should initialize session with UI state', async () => {
      const mockSession = {
        id: 'test-session',
        config,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        messages: [],
      };

      mockTSMCPSessionManager.initializeSession.mockResolvedValue(mockSession);

      const session = await sessionManager.initializeSession(config);
      expect(session).toBe(mockSession);

      const uiState = sessionManager.getUIState(session.id);
      expect(uiState).toEqual({
        isLoading: false,
        isThinking: false,
        error: null,
      });
    });

    it('should handle initialization errors', async () => {
      mockTSMCPSessionManager.initializeSession.mockRejectedValue(
        new Error('Test error')
      );

      await expect(sessionManager.initializeSession(config)).rejects.toThrow(
        'Failed to initialize session: Test error'
      );
    });
  });

  describe('Message Handling', () => {
    const sessionId = 'test-session';

    beforeEach(async () => {
      const mockSession = { id: sessionId };
      mockTSMCPSessionManager.initializeSession.mockResolvedValue(mockSession);
      await sessionManager.initializeSession(config);
    });

    it('should send message and update UI state', async () => {
      mockTSMCPSessionManager.sendMessage.mockResolvedValue(undefined);

      await sessionManager.sendMessage(sessionId, 'test message');

      const uiState = sessionManager.getUIState(sessionId);
      expect(uiState?.isLoading).toBe(false);
      expect(uiState?.error).toBeNull();

      expect(mockTSMCPSessionManager.sendMessage).toHaveBeenCalledWith(
        sessionId,
        'test message'
      );
      expect(
        mockTSMCPSessionManager.updateSessionActivity
      ).toHaveBeenCalledWith(sessionId);
    });

    it('should handle message errors', async () => {
      mockTSMCPSessionManager.sendMessage.mockRejectedValue(
        new Error('Test error')
      );

      await expect(
        sessionManager.sendMessage(sessionId, 'test message')
      ).rejects.toThrow('Test error');

      const uiState = sessionManager.getUIState(sessionId);
      expect(uiState?.error).toBe('Test error');
      expect(uiState?.isLoading).toBe(false);
    });

    it('should stream messages with UI state updates', async () => {
      const mockStream = (async function* () {
        yield { type: 'thinking' };
        yield { type: 'tool_start', content: 'test-tool' };
        yield { type: 'tool_result' };
        yield { type: 'content', content: 'test response' };
        yield { type: 'done' };
      })();

      mockTSMCPSessionManager.sendMessageStream.mockReturnValue(mockStream);

      const stream = await sessionManager.sendMessageStream(
        sessionId,
        'test message'
      );

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);

        // Check UI state after each chunk
        const uiState = sessionManager.getUIState(sessionId);
        switch (chunk.type) {
          case 'thinking':
            expect(uiState?.isThinking).toBe(true);
            break;
          case 'tool_start':
            expect(uiState?.currentTool).toBe('test-tool');
            break;
          case 'tool_result':
            expect(uiState?.currentTool).toBeUndefined();
            break;
          case 'done':
            expect(uiState?.isLoading).toBe(false);
            expect(uiState?.isThinking).toBe(false);
            expect(uiState?.currentTool).toBeUndefined();
            break;
        }
      }

      expect(chunks).toHaveLength(5);
      expect(
        mockTSMCPSessionManager.updateSessionActivity
      ).toHaveBeenCalledWith(sessionId);
    });

    it('should handle streaming errors', async () => {
      const mockStream = (async function* () {
        yield { type: 'thinking' };
        throw new Error('Test error');
      })();

      mockTSMCPSessionManager.sendMessageStream.mockReturnValue(mockStream);

      const stream = await sessionManager.sendMessageStream(
        sessionId,
        'test message'
      );

      await expect(async () => {
        for await (const _ of stream) {
          // consume stream
        }
      }).rejects.toThrow('Test error');

      const uiState = sessionManager.getUIState(sessionId);
      expect(uiState?.error).toBe('Test error');
    });
  });

  describe('Session Recovery', () => {
    it('should recover session and initialize UI state', async () => {
      const mockSession = {
        id: 'test-session',
        config,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        messages: [],
      };

      mockTSMCPSessionManager.getSession.mockResolvedValue(mockSession);

      const session = await sessionManager.recoverSession('test-session');
      expect(session).toBe(mockSession);

      const uiState = sessionManager.getUIState(session.id);
      expect(uiState).toEqual({
        isLoading: false,
        isThinking: false,
        error: null,
      });
    });

    it('should handle recovery errors', async () => {
      mockTSMCPSessionManager.getSession.mockRejectedValue(
        new Error('Test error')
      );

      await expect(
        sessionManager.recoverSession('test-session')
      ).rejects.toThrow('Failed to recover session: Test error');
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up UI state', async () => {
      const mockSession = { id: 'test-session' };
      mockTSMCPSessionManager.initializeSession.mockResolvedValue(mockSession);

      const session = await sessionManager.initializeSession(config);
      expect(sessionManager.getUIState(session.id)).toBeDefined();

      await sessionManager.cleanupSession(session.id);
      expect(sessionManager.getUIState(session.id)).toBeNull();
    });
  });
});
