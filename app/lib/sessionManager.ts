import {
  SessionManager as TSMCPSessionManager,
  ChatSession as TSMCPChatSession,
  LLMConfig,
  ServerConfig,
} from '@rinardnick/client_mcp';
import { UIStateManager } from './uiState';

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

  constructor() {
    this.uiStateManager = new UIStateManager();
    this.mcpManager = new TSMCPSessionManager() as ExtendedTSMCPSessionManager;
  }

  async initializeSession(
    config: LLMConfig,
    servers?: ServerConfig,
    maxToolCalls?: number
  ): Promise<ChatSession> {
    let session: ChatSession | undefined;

    try {
      // Initialize session through client_mcp
      session = await this.mcpManager.initializeSession(config);

      // Initialize UI state
      this.uiStateManager.initializeState(session.id);

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
      // Clean up UI state if initialization fails
      if (session?.id) {
        this.uiStateManager.deleteState(session.id);
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

      await this.mcpManager.sendMessage(sessionId, message);
      await this.mcpManager.updateSessionActivity(sessionId);

      this.uiStateManager.updateState(sessionId, {
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error sending message';
      this.uiStateManager.setError(sessionId, errorMessage);
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

      const stream = this.mcpManager.sendMessageStream(sessionId, message);

      // Create a new generator that updates UI state based on stream events
      const self = this; // Capture this context
      return (async function* () {
        try {
          for await (const chunk of stream) {
            switch (chunk.type) {
              case 'thinking':
                self.uiStateManager.updateState(sessionId, {
                  isThinking: true,
                });
                break;
              case 'tool_start':
                self.uiStateManager.updateState(sessionId, {
                  currentTool: chunk.content,
                });
                break;
              case 'tool_result':
                self.uiStateManager.updateState(sessionId, {
                  currentTool: undefined,
                });
                break;
              case 'error':
                self.uiStateManager.setError(
                  sessionId,
                  chunk.error || 'Unknown error'
                );
                break;
              case 'done':
                self.uiStateManager.updateState(sessionId, {
                  isLoading: false,
                  isThinking: false,
                  currentTool: undefined,
                });
                break;
            }
            yield chunk;
          }

          await self.mcpManager.updateSessionActivity(sessionId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown streaming error';
          self.uiStateManager.setError(sessionId, errorMessage);
          throw error;
        }
      })();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error initializing stream';
      this.uiStateManager.setError(sessionId, errorMessage);
      throw error;
    }
  }

  async recoverSession(sessionId: string): Promise<ChatSession> {
    try {
      const session = await this.mcpManager.getSession(sessionId);

      // Initialize UI state if it doesn't exist
      if (!this.uiStateManager.getState(sessionId)) {
        this.uiStateManager.initializeState(sessionId);
      }

      return session;
    } catch (error) {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error cleaning up session';
      throw new Error(`Failed to cleanup session: ${errorMessage}`);
    }
  }
}
