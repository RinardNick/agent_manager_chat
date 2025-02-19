import {
  LLMConfig,
  SessionManager as TSMCPSessionManager,
  ChatSession,
  ServerConfig,
} from '@rinardnick/ts-mcp-client';

interface UISession {
  id: string;
  uiState: {
    isLoading: boolean;
    error: string | null;
  };
}

/**
 * SessionManager is responsible for:
 * 1. UI Session Management: Maintaining UI-specific session state and handling error states
 * 2. Chat Session Delegation: Delegating chat operations to the MCP client
 */
export class SessionManager {
  private uiSessions: Map<string, UISession>;
  private tsmpSessionManager: TSMCPSessionManager;

  constructor() {
    this.uiSessions = new Map();
    this.tsmpSessionManager = new TSMCPSessionManager();
  }

  async initializeSession(
    config: LLMConfig,
    serverConfig?: ServerConfig,
    maxToolCalls?: number
  ): Promise<ChatSession> {
    try {
      const session = await this.tsmpSessionManager.initializeSession(config);

      if (serverConfig) {
        await session.mcpClient?.configure({
          servers: serverConfig,
          max_tool_calls: maxToolCalls,
        });
        try {
          await session.mcpClient?.discoverCapabilities();
        } catch (error) {
          console.error('Failed to discover capabilities:', error);
        }
      }

      // Create UI session state
      const uiSession: UISession = {
        id: session.id,
        uiState: {
          isLoading: false,
          error: null,
        },
      };

      this.uiSessions.set(session.id, uiSession);
      return session;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      throw error;
    }
  }

  async recoverSession(sessionId: string): Promise<ChatSession> {
    try {
      const session = await this.tsmpSessionManager.getSession(sessionId);

      // Create UI session state if it doesn't exist
      if (!this.uiSessions.has(sessionId)) {
        this.uiSessions.set(sessionId, {
          id: sessionId,
          uiState: {
            isLoading: false,
            error: null,
          },
        });
      }

      return session;
    } catch (error) {
      console.error('Failed to recover session:', error);
      throw error;
    }
  }

  private async getOrCreateUISession(sessionId: string): Promise<UISession> {
    let uiSession = this.uiSessions.get(sessionId);

    if (!uiSession) {
      // Get session from client to verify it exists
      await this.tsmpSessionManager.getSession(sessionId);

      // Create UI session
      uiSession = {
        id: sessionId,
        uiState: {
          isLoading: false,
          error: null,
        },
      };

      this.uiSessions.set(sessionId, uiSession);
    }

    return uiSession;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const uiSession = await this.getOrCreateUISession(sessionId);

    try {
      uiSession.uiState.isLoading = true;
      uiSession.uiState.error = null;

      await this.tsmpSessionManager.sendMessage(sessionId, message);
      await this.tsmpSessionManager.updateSessionActivity(sessionId);
    } catch (error) {
      console.error('Failed to send message:', error);
      uiSession.uiState.error = 'Failed to send message';
      throw new Error('Failed to send message');
    } finally {
      uiSession.uiState.isLoading = false;
    }
  }

  async *sendMessageStream(
    sessionId: string,
    message: string
  ): AsyncGenerator<any, void, unknown> {
    const uiSession = await this.getOrCreateUISession(sessionId);

    try {
      uiSession.uiState.isLoading = true;
      uiSession.uiState.error = null;

      yield* this.tsmpSessionManager.sendMessageStream(sessionId, message);
      await this.tsmpSessionManager.updateSessionActivity(sessionId);
    } catch (error) {
      console.error('Failed to stream message:', error);
      uiSession.uiState.error = 'Failed to stream message';
      throw new Error('Failed to stream message');
    } finally {
      uiSession.uiState.isLoading = false;
    }
  }

  // UI State Management
  setUIError(sessionId: string, error: string | null): void {
    const uiSession = this.uiSessions.get(sessionId);
    if (uiSession) {
      uiSession.uiState.error = error;
    }
  }

  setUILoading(sessionId: string, isLoading: boolean): void {
    const uiSession = this.uiSessions.get(sessionId);
    if (uiSession) {
      uiSession.uiState.isLoading = isLoading;
    }
  }

  getUIState(sessionId: string) {
    const uiSession = this.uiSessions.get(sessionId);
    return uiSession?.uiState;
  }

  async cleanupSession(sessionId: string): Promise<void> {
    try {
      // Clean up UI state only
      this.uiSessions.delete(sessionId);
    } catch (error) {
      console.error('Failed to cleanup UI session:', error);
      throw error;
    }
  }
}
