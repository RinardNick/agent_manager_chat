import {
  SessionManager as TSMCPSessionManager,
  ChatSession as TSMCPChatSession,
  LLMConfig,
  ServerConfig,
} from '@rinardnick/client_mcp';
import { UIStateManager, UIState } from './uiState';
import {
  SessionPersistenceManager,
  PersistedSession,
} from './sessionPersistence';

interface MCPClient {
  configure: (config: {
    servers: ServerConfig;
    max_tool_calls: number;
  }) => Promise<void>;
  discoverCapabilities: () => Promise<any>;
  tools: any[];
}

interface ChatSession extends TSMCPChatSession {
  mcpClient?: MCPClient;
}

interface ExtendedTSMCPSessionManager extends TSMCPSessionManager {
  cleanupSession: (sessionId: string) => Promise<void>;
}

export class SessionManager {
  private uiStateManager: UIStateManager;
  private mcpManager: ExtendedTSMCPSessionManager;
  private persistenceManager: SessionPersistenceManager;

  constructor() {
    this.uiStateManager = new UIStateManager();
    this.mcpManager = new TSMCPSessionManager() as ExtendedTSMCPSessionManager;
    this.persistenceManager = new SessionPersistenceManager();

    // Clean up expired sessions on initialization
    this.cleanupExpiredSessions();
  }

  async initializeSession(
    config: LLMConfig,
    servers?: ServerConfig,
    maxToolCalls?: number
  ): Promise<ChatSession> {
    let session: ChatSession | undefined;
    let sessionId: string | undefined;

    try {
      // Initialize session through client_mcp
      session = await this.mcpManager.initializeSession(config);
      sessionId = session.id;

      // Initialize UI state
      const uiState = this.uiStateManager.initializeState(session.id);

      // Persist the session
      this.persistSession(session.id, uiState);

      // Configure client if servers are provided
      if (servers) {
        try {
          await session.mcpClient?.configure({
            servers,
            max_tool_calls: maxToolCalls || 10,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Unknown error configuring client';
          throw new Error(`Failed to configure client: ${errorMessage}`);
        }
      }

      // Discover capabilities
      try {
        await session.mcpClient?.discoverCapabilities();
      } catch (error) {
        // Log the error but don't fail initialization
        console.warn('Failed to discover capabilities:', error);
      }

      return session;
    } catch (error) {
      // Clean up UI state and persisted data if initialization fails
      if (sessionId) {
        this.uiStateManager.deleteState(sessionId);
        this.persistenceManager.deleteSession(sessionId);
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error initializing session';
      throw new Error(`Failed to initialize session: ${errorMessage}`);
    }
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const uiState = this.uiStateManager.getState(sessionId);
    if (!uiState) {
      throw new Error(`No UI state found for session ${sessionId}`);
    }

    try {
      this.uiStateManager.updateState(sessionId, {
        isLoading: true,
        error: null,
      });

      // Update persistence with new UI state
      this.persistSession(sessionId, this.uiStateManager.getState(sessionId)!);

      await this.mcpManager.sendMessage(sessionId, message);
      await this.mcpManager.updateSessionActivity(sessionId);

      const updatedState = this.uiStateManager.updateState(sessionId, {
        isLoading: false,
      });

      // Update persistence after message is sent
      this.persistSession(sessionId, updatedState);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error sending message';
      this.uiStateManager.setError(sessionId, errorMessage);

      // Update persistence with error state
      this.persistSession(sessionId, this.uiStateManager.getState(sessionId)!);

      throw error;
    }
  }

  async sendMessageStream(
    sessionId: string,
    message: string
  ): Promise<
    AsyncGenerator<{
      type: string;
      content?: string;
      error?: string;
    }>
  > {
    const uiState = this.uiStateManager.getState(sessionId);
    if (!uiState) {
      throw new Error(`No UI state found for session ${sessionId}`);
    }

    try {
      this.uiStateManager.updateState(sessionId, {
        isLoading: true,
        error: null,
      });

      // Update persistence with new UI state
      this.persistSession(sessionId, this.uiStateManager.getState(sessionId)!);

      const stream = this.mcpManager.sendMessageStream(sessionId, message);

      // Create a new generator that updates UI state based on stream events
      const self = this; // Capture this context
      return (async function* () {
        try {
          for await (const chunk of stream) {
            let updatedState;

            switch (chunk.type) {
              case 'thinking':
                updatedState = self.uiStateManager.updateState(sessionId, {
                  isThinking: true,
                });
                break;
              case 'tool_start':
                updatedState = self.uiStateManager.updateState(sessionId, {
                  currentTool: chunk.content,
                });
                break;
              case 'tool_result':
                updatedState = self.uiStateManager.updateState(sessionId, {
                  currentTool: undefined,
                });
                break;
              case 'error':
                self.uiStateManager.setError(
                  sessionId,
                  chunk.error || 'Unknown error'
                );
                updatedState = self.uiStateManager.getState(sessionId)!;
                break;
              case 'done':
                updatedState = self.uiStateManager.updateState(sessionId, {
                  isLoading: false,
                  isThinking: false,
                  currentTool: undefined,
                });
                break;
            }

            // Persist UI state updates for significant state changes
            if (
              updatedState &&
              ['thinking', 'error', 'done'].includes(chunk.type)
            ) {
              self.persistSession(sessionId, updatedState);
            }

            yield chunk;
          }

          await self.mcpManager.updateSessionActivity(sessionId);

          // Update session activity in persistence
          self.persistenceManager.updateSessionActivity(sessionId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown streaming error';
          self.uiStateManager.setError(sessionId, errorMessage);

          // Persist error state
          const errorState = self.uiStateManager.getState(sessionId);
          if (errorState) {
            self.persistSession(sessionId, errorState);
          }

          throw error;
        }
      })();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error initializing stream';
      this.uiStateManager.setError(sessionId, errorMessage);

      // Persist error state
      this.persistSession(sessionId, this.uiStateManager.getState(sessionId)!);

      throw error;
    }
  }

  async recoverSession(sessionId: string): Promise<ChatSession> {
    try {
      // First try to recover from persistence
      const persistedSession = this.persistenceManager.loadSession(sessionId);

      // Then try to recover the MCP session
      const session = await this.mcpManager.getSession(sessionId);

      // If we have persisted UI state, use it
      if (persistedSession) {
        // Initialize UI state from persisted data
        if (this.uiStateManager.getState(sessionId)) {
          this.uiStateManager.deleteState(sessionId);
        }
        this.uiStateManager.initializeState(sessionId);
        this.uiStateManager.updateState(sessionId, {
          ...persistedSession.uiState,
          error: null, // Ensure error is null when recovering a session
        });
      } else {
        // Initialize fresh UI state if no persisted state exists
        if (!this.uiStateManager.getState(sessionId)) {
          this.uiStateManager.initializeState(sessionId);
        } else {
          // Make sure error is cleared in existing state
          this.uiStateManager.clearError(sessionId);
        }
      }

      // Update session activity
      this.persistenceManager.updateSessionActivity(sessionId);

      return session;
    } catch (error) {
      // If MCP session recovery fails but we have persisted data,
      // clean up the persisted data
      const persistedSession = this.persistenceManager.loadSession(sessionId);
      if (persistedSession) {
        this.persistenceManager.deleteSession(sessionId);
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error recovering session';
      throw new Error(`Failed to recover session: ${errorMessage}`);
    }
  }

  getUIState(sessionId: string) {
    return this.uiStateManager.getState(sessionId);
  }

  async cleanupSession(sessionId: string): Promise<void> {
    try {
      // Clean up MCP session first
      await this.mcpManager.cleanupSession(sessionId);
      // Then clean up UI state
      this.uiStateManager.deleteState(sessionId);
      // Finally clean up persisted data
      this.persistenceManager.deleteSession(sessionId);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error cleaning up session';
      throw new Error(`Failed to cleanup session: ${errorMessage}`);
    }
  }

  /**
   * Get all persisted session IDs
   */
  getPersistedSessionIds(): string[] {
    return this.persistenceManager.getSessionIds();
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAgeDays?: number): string[] {
    return this.persistenceManager.cleanupExpiredSessions(maxAgeDays);
  }

  /**
   * Helper method to persist session UI state
   */
  private persistSession(sessionId: string, uiState: UIState): void {
    const persistedSession: PersistedSession = {
      id: sessionId,
      lastActive: Date.now(),
      uiState,
    };

    this.persistenceManager.saveSession(persistedSession);
  }
}
