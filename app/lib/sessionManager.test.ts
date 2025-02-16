import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

vi.mock('@rinardnick/ts-mcp-client');

describe('Session Manager Responsibilities', () => {
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

  describe('UI Session Management', () => {
    it('should maintain UI state separate from chat session', async () => {
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

      expect(session.mcpClient).toBeDefined();
      expect(session.mcpClient?.tools).toEqual(mockCapabilities.tools);
    });

    it('should handle UI-specific error states', async () => {
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
            sendMessage: vi.fn().mockRejectedValue(new Error('UI error')),
            sendMessageStream: vi.fn(),
            getSession: vi.fn(),
            cleanupSession: vi.fn(),
            updateSessionActivity: vi.fn(),
          } as any)
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
            sendMessage: vi
              .fn()
              .mockResolvedValue({ role: 'assistant', content: 'test' }),
            sendMessageStream: vi.fn(),
            getSession: vi.fn(),
            cleanupSession: vi.fn(),
            updateSessionActivity: vi.fn(),
          } as any)
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      await sessionManager.sendMessage(session.id, 'test message');
      expect(session.mcpClient).toBeDefined();
    });

    it('should delegate streaming to client', async () => {
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
            sendMessageStream: vi.fn().mockImplementation(async function* () {
              yield { type: 'content', content: 'test' };
            }),
            getSession: vi.fn(),
            cleanupSession: vi.fn(),
            updateSessionActivity: vi.fn(),
          } as any)
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      const stream = sessionManager.sendMessageStream(session.id, 'test message');
      expect(stream).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle client initialization errors', async () => {
      const mockSession = {
        id: 'test-session',
        mcpClient: {
          configure: vi
            .fn()
            .mockRejectedValue(new Error('Failed to initialize client')),
          discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
          tools: [],
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

      await expect(
        sessionManager.initializeSession(llmConfig, mockServers)
      ).rejects.toThrow('Failed to initialize client');
    });

    it('should handle message sending errors', async () => {
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
            sendMessage: vi
              .fn()
              .mockRejectedValue(new Error('Failed to send message')),
            sendMessageStream: vi.fn(),
            getSession: vi.fn(),
            cleanupSession: vi.fn(),
            updateSessionActivity: vi.fn(),
          } as any)
      );

      sessionManager = new SessionManager();
      const session = await sessionManager.initializeSession(llmConfig);

      await expect(
        sessionManager.sendMessage(session.id, 'test message')
      ).rejects.toThrow('Failed to send message');
    });
  });
});
