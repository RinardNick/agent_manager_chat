// Mock types
export interface LLMConfig {
  type: string;
  api_key: string;
  model: string;
  system_prompt: string;
  servers?: Record<string, ServerConfig>;
}

export interface ServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  isToolResult?: boolean;
}

export interface MCPClient {
  configure: () => Promise<void>;
  discoverCapabilities: () => Promise<{
    tools: Array<{
      name: string;
      description: string;
    }>;
  }>;
}

export interface ChatSession {
  id: string;
  config: LLMConfig;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivityAt: Date;
  serverClients: Map<string, any>;
  toolCallCount: number;
  maxToolCalls: number;
  tools: any[];
  resources: any[];
  mcpClient: MCPClient;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Mock implementation
export class SessionManager {
  private sessions: Map<string, ChatSession>;

  constructor() {
    this.sessions = new Map();
  }

  async initializeSession(config: LLMConfig): Promise<ChatSession> {
    const session: ChatSession = {
      id: 'test-session-id',
      config,
      messages: [
        {
          role: 'system',
          content: config.system_prompt || 'You are a helpful assistant.',
        },
        { role: 'assistant', content: 'I am ready to help.' },
      ],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      serverClients: new Map(),
      toolCallCount: 0,
      maxToolCalls: 10,
      tools: [],
      resources: [],
      mcpClient: {
        configure: () => Promise.resolve(),
        discoverCapabilities: () =>
          Promise.resolve({
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
          }),
      },
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'assistant', content: 'Mock response' });
  }

  async *sendMessageStream(sessionId: string, message: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.messages.push({ role: 'user', content: message });

    yield { type: 'thinking' };
    yield { type: 'content', content: 'Mock' };
    yield { type: 'content', content: ' response' };
    yield { type: 'done' };

    session.messages.push({ role: 'assistant', content: 'Mock response' });
  }

  async getSession(sessionId: string): Promise<ChatSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
  }

  async cleanupSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export function loadConfig(configPath: string): Promise<any> {
  return Promise.resolve({
    llm: {
      type: 'claude',
      api_key: 'test-key',
      model: 'test-model',
      system_prompt: 'test prompt',
    },
    servers: {
      filesystem: {
        command: 'npx',
        args: ['test'],
        env: {},
      },
    },
  });
}
