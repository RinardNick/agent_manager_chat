import { vi } from 'vitest';

export interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface Tool {
  name: string;
  description: string;
}

export interface LLMConfig {
  type: string;
  model: string;
  api_key: string;
  system_prompt: string;
}

const mockCapabilities = {
  tools: [
    {
      name: 'readFile',
      description: 'Reads a file from the filesystem',
    },
    {
      name: 'writeFile',
      description: 'Writes content to a file',
    },
  ] as Tool[],
};

const mockSession = {
  id: 'test-session',
  mcpClient: {
    configure: vi.fn().mockResolvedValue(undefined),
    discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
    tools: mockCapabilities.tools,
    sendMessageStream: vi.fn().mockImplementation(async function* () {
      yield { type: 'content', content: 'test' };
    }),
  },
};

class MockSessionManager {
  private sessions = new Map();
  private cachedCapabilities: typeof mockCapabilities | null = null;

  public initializeSession = vi.fn().mockImplementation(async () => {
    const session = {
      id: 'test-session',
      mcpClient: {
        configure: vi.fn().mockResolvedValue(undefined),
        discoverCapabilities: vi.fn().mockResolvedValue(mockCapabilities),
        tools: [] as Tool[],
        sendMessageStream: vi.fn().mockImplementation(async function* () {
          yield { type: 'content', content: 'test' };
        }),
      },
      messages: [],
    };

    if (!this.cachedCapabilities) {
      this.cachedCapabilities = await session.mcpClient.discoverCapabilities();
    }
    session.mcpClient.tools = this.cachedCapabilities?.tools || [];
    return session;
  });

  public sendMessage = vi
    .fn()
    .mockResolvedValue({ role: 'assistant', content: 'test' });

  public sendMessageStream = vi.fn().mockImplementation(async function* () {
    yield { type: 'content', content: 'test' };
  });

  public getSession = vi.fn().mockReturnValue(mockSession);
  public cleanupSession = vi.fn();
  public updateSessionActivity = vi.fn();
  public processToolCall = vi.fn();
  public handleToolCallLimit = vi.fn();
}

export const SessionManager = vi
  .fn()
  .mockImplementation(() => new MockSessionManager());

// Export the mock session and capabilities for test configuration
export const __mockSession = mockSession;
export const __mockCapabilities = mockCapabilities;
