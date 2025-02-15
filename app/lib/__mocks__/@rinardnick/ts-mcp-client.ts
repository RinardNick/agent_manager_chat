import { vi } from 'vitest';

export interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface LLMConfig {
  type: string;
  model: string;
  api_key: string;
  system_prompt: string;
}

const mockSession = {
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
    tools: [
      {
        name: 'readFile',
        description: 'Reads a file from the filesystem',
      },
    ],
  },
};

class MockSessionManager {
  private anthropic = {};
  public initializeSession = vi.fn().mockResolvedValue(mockSession);
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

// Export the mock session for test configuration
export const __mockSession = mockSession;
