import { vi } from 'vitest';

// Types
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

export interface ChatSession {
  id: string;
  mcpClient: any;
  messages: any[];
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface LLMError extends Error {
  code: string;
  details?: any;
}

// Mock data
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

// Mock SessionManager class
export class SessionManager {
  private sessions = new Map();
  private cachedCapabilities: typeof mockCapabilities | null = null;
  public anthropic = {};
  public processToolCall = vi.fn();
  public handleToolCallLimit = vi.fn();

  constructor() {}

  public initializeSession = vi
    .fn()
    .mockImplementation(async (config: LLMConfig) => {
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
        this.cachedCapabilities =
          await session.mcpClient.discoverCapabilities();
      }
      session.mcpClient.tools = this.cachedCapabilities?.tools || [];
      this.sessions.set(session.id, session);
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
}

// Export mock data for test configuration
export const __mockSession = mockSession;
export const __mockCapabilities = mockCapabilities;

// Export config loader
export const loadConfig = vi.fn().mockImplementation(() => ({
  type: 'test',
  model: 'test-model',
  api_key: 'test-key',
  system_prompt: 'test-prompt',
}));
