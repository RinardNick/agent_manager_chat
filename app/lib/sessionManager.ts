import {
  SessionManager as TSMCPSessionManager,
  ChatSession,
  LLMConfig,
} from '@rinardnick/client_mcp';
import { UIStateManager } from './uiState';

export class SessionManager {
  private uiStateManager: UIStateManager;
  private mcpManager: TSMCPSessionManager;

  constructor() {
    this.uiStateManager = new UIStateManager();
    this.mcpManager = new TSMCPSessionManager();
  }

  async initializeSession(config: LLMConfig): Promise<ChatSession> {
    try {
      // Initialize session through client_mcp
      const session = await this.mcpManager.initializeSession(config);

      // Initialize UI state
      this.uiStateManager.initializeState(session.id);

      return session;
    } catch (error) {
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
      return async function* (this: SessionManager) {
        try {
          for await (const chunk of stream) {
            switch (chunk.type) {
              case 'thinking':
                this.uiStateManager.updateState(sessionId, {
                  isThinking: true,
                });
                break;
              case 'tool_start':
                this.uiStateManager.updateState(sessionId, {
                  currentTool: chunk.content,
                });
                break;
              case 'tool_result':
                this.uiStateManager.updateState(sessionId, {
                  currentTool: undefined,
                });
                break;
              case 'error':
                this.uiStateManager.setError(
                  sessionId,
                  chunk.error || 'Unknown error'
                );
                break;
              case 'done':
                this.uiStateManager.updateState(sessionId, {
                  isLoading: false,
                  isThinking: false,
                  currentTool: undefined,
                });
                break;
            }
            yield chunk;
          }

          await this.mcpManager.updateSessionActivity(sessionId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown streaming error';
          this.uiStateManager.setError(sessionId, errorMessage);
          throw error;
        }
      }.call(this);
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
    // Clean up UI state
    this.uiStateManager.deleteState(sessionId);
  }
}
