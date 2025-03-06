import { vi } from 'vitest';

export interface LLMConfig {
  type: string;
  model?: string;
  api_key?: string;
  system_prompt?: string;
  thinking?: boolean;
}

export interface SessionOptions {
  useSharedServers?: boolean;
  servers?: Record<string, any>;
}

export interface StreamChunk {
  type: 'thinking' | 'content' | 'tool_start' | 'tool_result' | 'error' | 'done';
  content?: string;
  tool?: {
    name: string;
    parameters: Record<string, any>;
  };
  result?: any;
  error?: string;
}

export class SessionManager {
  constructor(options?: SessionOptions) {}

  async initializeSession(config: LLMConfig, sessionId: string = 'default'): Promise<void> {
    return Promise.resolve();
  }

  async sendMessage(sessionId: string, message: string): Promise<string> {
    return Promise.resolve('Response from the mock');
  }

  sendMessageStream(sessionId: string, message: string): AsyncGenerator<StreamChunk> {
    // This is a mock implementation of an async generator
    // We'll need to mock this differently in tests
    return (async function* () {
      yield { type: 'thinking', content: 'I am thinking...' };
      yield { type: 'content', content: 'Hello, I am a mock response.' };
      yield { type: 'done' };
    })();
  }

  // Mock implementations of other methods
  async resetSession(sessionId: string): Promise<void> {
    return Promise.resolve();
  }
}

// Export functions to load config
export function loadConfig(path: string): Promise<any> {
  return Promise.resolve({
    type: 'claude',
    model: 'claude-3-sonnet-20240229',
    api_key: 'mock-api-key',
    system_prompt: 'You are a helpful assistant.'
  });
}