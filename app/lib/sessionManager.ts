import {
  LLMConfig,
  SessionManager as TSMCPSessionManager,
  ChatSession,
  ServerConfig,
} from '@rinardnick/ts-mcp-client';

interface Session {
  id: string;
  client: any; // TODO: Replace with proper MCPClient type when available
  lastActivity: number;
  config: LLMConfig;
  serverConfig?: ServerConfig;
  capabilities?: any;
}

interface StoredSession {
  id: string;
  config: LLMConfig;
  lastActivity: number;
  serverConfig?: ServerConfig;
}

/**
 * SessionManager is responsible for:
 * 1. UI Session Management: Maintaining UI-specific session state, handling error states, and managing session lifecycle
 * 2. Chat Session Delegation: Delegating chat operations to the MCP client and providing a streaming interface for real-time updates
 * 3. Configuration Management: Handling server configuration, managing tool call limits, and configuring the MCP client
 * 4. Session Persistence: Managing session storage and recovery across page reloads
 */
export class SessionManager {
  private sessions: Map<string, Session>;
  private readonly STORAGE_KEY = 'mcp_sessions';
  private readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private tsmpSessionManager: TSMCPSessionManager;

  constructor() {
    this.sessions = new Map();
    this.tsmpSessionManager = new TSMCPSessionManager();
    this.loadSessions();
  }

  private handleStorageError(operation: string, error: unknown): null {
    console.error(`Failed to ${operation}:`, error);
    // Continue operation without storage
    return null;
  }

  private loadSessions() {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (storedData) {
        const storedSessions: StoredSession[] = JSON.parse(storedData);
        // Filter out expired sessions before loading
        const validSessions = storedSessions.filter(
          stored => Date.now() - stored.lastActivity <= this.SESSION_EXPIRY
        );

        // Load each valid session
        validSessions.forEach(async stored => {
          try {
            await this.recoverSession(stored.id);
          } catch (error) {
            console.error(`Failed to recover session ${stored.id}:`, error);
            // Remove failed session from storage
            this.sessions.delete(stored.id);
            this.persistSessions();
          }
        });
      }
    } catch (error) {
      this.handleStorageError('load sessions', error);
    }
  }

  private persistSessions() {
    try {
      const sessionsToStore: StoredSession[] = Array.from(
        this.sessions.values()
      ).map(session => ({
        id: session.id,
        config: session.config,
        lastActivity: session.lastActivity,
        serverConfig: session.serverConfig,
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionsToStore));
    } catch (error) {
      this.handleStorageError('persist sessions', error);
    }
  }

  async initializeSession(
    config: LLMConfig,
    serverConfig?: ServerConfig,
    maxToolCalls?: number
  ): Promise<ChatSession> {
    try {
      const session = await this.tsmpSessionManager.initializeSession(config);

      // Ensure mcpClient exists
      if (!session.mcpClient) {
        session.mcpClient = {
          configure: async () => {},
          discoverCapabilities: async () => {},
          tools: [],
        };
      }

      if (serverConfig) {
        await session.mcpClient.configure({
          servers: serverConfig,
          max_tool_calls: maxToolCalls,
        });
        try {
          await session.mcpClient.discoverCapabilities();
        } catch (error) {
          console.error('Failed to discover capabilities:', error);
          // Continue with empty tools array
        }
      }

      const newSession: Session = {
        id: session.id,
        client: session.mcpClient,
        lastActivity: Date.now(),
        config,
        serverConfig,
      };

      this.sessions.set(session.id, newSession);
      this.persistSessions();
      return session;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      throw error;
    }
  }

  async recoverSession(sessionId: string): Promise<ChatSession> {
    try {
      const storedData = localStorage.getItem(this.STORAGE_KEY);
      if (!storedData) {
        throw new Error('No stored sessions found');
      }

      const storedSessions: StoredSession[] = JSON.parse(storedData);
      const storedSession = storedSessions.find(s => s.id === sessionId);

      if (!storedSession) {
        throw new Error('Session not found');
      }

      if (Date.now() - storedSession.lastActivity > this.SESSION_EXPIRY) {
        // Remove expired session from storage
        const updatedSessions = storedSessions.filter(s => s.id !== sessionId);
        try {
          localStorage.setItem(
            this.STORAGE_KEY,
            JSON.stringify(updatedSessions)
          );
        } catch (error) {
          this.handleStorageError('update sessions after expiry', error);
        }
        throw new Error('Session expired');
      }

      try {
        return this.initializeSession(
          storedSession.config,
          storedSession.serverConfig
        );
      } catch (error) {
        console.error(`Failed to recover session ${sessionId}:`, error);
        // Remove failed session from storage
        this.sessions.delete(sessionId);
        this.persistSessions();
        throw new Error(
          `Failed to recover session ${sessionId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    } catch (error) {
      console.error('Failed to recover session:', error);
      throw error;
    }
  }

  getStoredSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Update activity before sending message
      session.lastActivity = Date.now();
      this.persistSessions();

      await this.tsmpSessionManager.sendMessage(sessionId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw new Error('Failed to send message');
    }
  }

  async *sendMessageStream(
    sessionId: string,
    message: string
  ): AsyncGenerator<any, void, unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Update activity before streaming
      session.lastActivity = Date.now();
      this.persistSessions();

      yield* this.tsmpSessionManager.sendMessageStream(sessionId, message);
    } catch (error) {
      console.error('Failed to stream message:', error);
      throw new Error('Failed to stream message');
    }
  }

  cleanupExpiredSessions(): void {
    try {
      const now = Date.now();
      const entries = Array.from(this.sessions.entries());
      let hasExpired = false;

      for (const [sessionId, session] of entries) {
        if (now - session.lastActivity > this.SESSION_EXPIRY) {
          this.sessions.delete(sessionId);
          hasExpired = true;
        }
      }

      // Only persist if we actually removed sessions
      if (hasExpired) {
        this.persistSessions();
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }
}
