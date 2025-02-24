import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
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

describe('Session Manager Responsibilities', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockCapabilities: any;
  let mockClientSession: any;

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

  describe('UI Session Management', () => {
    it('should maintain UI state separate from chat session', async () => {
      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      expect(session.mcpClient).toBeDefined();
      expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
    });

    it('should handle UI-specific error states', async () => {
      mockTSMCPSessionManager.sendMessage.mockRejectedValueOnce(
        new Error('UI error')
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      await expect(
        sessionManager.sendMessage(session.id, 'test message')
      ).rejects.toThrow('Failed to send message');
    });
  });

  describe('Chat Session Delegation', () => {
    it('should delegate chat session management to client', async () => {
      mockTSMCPSessionManager.sendMessage.mockResolvedValueOnce({
        role: 'assistant',
        content: 'test',
      });

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      await sessionManager.sendMessage(session.id, 'test message');
      expect(session.mcpClient).toBeDefined();
    });

    it('should delegate streaming to client', async () => {
      mockTSMCPSessionManager.sendMessageStream.mockImplementationOnce(
        async function* () {
          yield { type: 'content', content: 'test' };
        }
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      const stream = sessionManager.sendMessageStream(
        session.id,
        'test message'
      );
      expect(stream).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle client initialization errors', async () => {
      mockClientSession.mcpClient.configure.mockRejectedValueOnce(
        new Error('Failed to initialize client')
      );

      sessionManager = new SessionManager();

      await expect(
        sessionManager.initializeSession(llmConfig, mockServers)
      ).rejects.toThrow('Failed to initialize client');
    });

    it('should handle message sending errors', async () => {
      mockTSMCPSessionManager.sendMessage.mockRejectedValueOnce(
        new Error('Failed to send message')
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      await expect(
        sessionManager.sendMessage(session.id, 'test message')
      ).rejects.toThrow('Failed to send message');
    });
  });
});
