import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SessionManager as TSMCPSessionManager,
  LLMConfig,
  ChatSession,
  ServerConfig,
} from '@rinardnick/ts-mcp-client';
import { loadConfig } from './configLoader';
import { SessionManager } from './sessionManager';

vi.mock('@rinardnick/ts-mcp-client');
vi.mock('./configLoader');

describe('Session Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize a session with server capabilities from config', async () => {
    // Mock config
    const mockConfig = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: 10,
      servers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/test/path'],
          env: {},
        },
      },
    };

    vi.mocked(loadConfig).mockResolvedValue(mockConfig);

    // Mock session response
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        tools: ['readFile', 'writeFile'],
        configure: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as ChatSession;

    const mockInitializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(TSMCPSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: mockInitializeSession,
          anthropic: {},
          processToolCall: vi.fn(),
          handleToolCallLimit: vi.fn(),
          sendMessage: vi.fn(),
          getSession: vi.fn(),
          getSessions: vi.fn(),
          deleteSession: vi.fn(),
        } as unknown as TSMCPSessionManager)
    );

    // Create session manager
    const sessionManager = new SessionManager();

    // Convert config to LLMConfig format
    const llmConfig: LLMConfig = {
      type: mockConfig.llm.type,
      api_key: mockConfig.llm.api_key,
      system_prompt: mockConfig.llm.system_prompt,
      model: mockConfig.llm.model,
    };

    const session = await sessionManager.initializeSession(llmConfig);

    // Verify session was initialized with server capabilities
    expect(session).toBeDefined();
    expect(session.mcpClient).toBeDefined();
    expect(mockInitializeSession).toHaveBeenCalledWith(llmConfig);
  });

  it('should handle server initialization failures gracefully', async () => {
    // Mock config
    const mockConfig = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: 10,
      servers: {
        filesystem: {
          command: 'invalid-command',
          args: [],
          env: {},
        },
      },
    };

    vi.mocked(loadConfig).mockResolvedValue(mockConfig);

    // Convert config to LLMConfig format
    const llmConfig: LLMConfig = {
      type: mockConfig.llm.type,
      api_key: mockConfig.llm.api_key,
      system_prompt: mockConfig.llm.system_prompt,
      model: mockConfig.llm.model,
    };

    // Mock initialization failure
    const mockError = new Error(
      'Failed to initialize server: invalid-command not found'
    );
    const mockInitializeSession = vi.fn().mockRejectedValue(mockError);
    vi.mocked(TSMCPSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: mockInitializeSession,
          anthropic: {},
          processToolCall: vi.fn(),
          handleToolCallLimit: vi.fn(),
          sendMessage: vi.fn(),
          getSession: vi.fn(),
          getSessions: vi.fn(),
          deleteSession: vi.fn(),
        } as unknown as TSMCPSessionManager)
    );

    // Create session manager
    const sessionManager = new SessionManager();

    // Attempt to initialize session
    await expect(sessionManager.initializeSession(llmConfig)).rejects.toThrow(
      'Failed to initialize server'
    );
  });

  it('should configure MCP client with servers and tool call limits', async () => {
    // Mock config
    const mockConfig = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: 5,
      servers: {
        filesystem: {
          command: 'npx',
          args: [],
          env: {},
        },
      },
    };

    // Mock session response
    const mockSession = {
      id: 'test-session',
      mcpClient: {
        tools: ['readFile', 'writeFile'],
        configure: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as ChatSession;

    const mockInitializeSession = vi.fn().mockResolvedValue(mockSession);
    vi.mocked(TSMCPSessionManager).mockImplementation(
      () =>
        ({
          initializeSession: mockInitializeSession,
          anthropic: {},
          processToolCall: vi.fn(),
          handleToolCallLimit: vi.fn(),
          sendMessage: vi.fn(),
          getSession: vi.fn(),
          getSessions: vi.fn(),
          deleteSession: vi.fn(),
        } as unknown as TSMCPSessionManager)
    );

    // Create session manager
    const sessionManager = new SessionManager();

    // Convert config to LLMConfig format
    const llmConfig: LLMConfig = {
      type: mockConfig.llm.type,
      api_key: mockConfig.llm.api_key,
      system_prompt: mockConfig.llm.system_prompt,
      model: mockConfig.llm.model,
    };

    const session = await sessionManager.initializeSession(
      llmConfig,
      mockConfig.servers,
      mockConfig.max_tool_calls
    );

    // Verify MCP client was configured with servers and tool call limits
    expect(session.mcpClient?.configure).toHaveBeenCalledWith({
      servers: mockConfig.servers,
      max_tool_calls: mockConfig.max_tool_calls,
    });
  });
});
