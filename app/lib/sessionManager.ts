import {
  SessionManager as TSMCPSessionManager,
  LLMConfig,
  ChatSession,
  ServerConfig,
} from '@rinardnick/ts-mcp-client';

/**
 * SessionManager is responsible for managing the host-side UI session state and delegating
 * chat functionality to the MCP client. It provides a clean interface between the UI layer
 * and the underlying MCP client implementation.
 *
 * Key Responsibilities:
 * 1. UI Session Management:
 *    - Maintains UI-specific session state
 *    - Handles UI error states and recovery
 *    - Manages session lifecycle from UI perspective
 *
 * 2. Chat Session Delegation:
 *    - Delegates all chat operations to MCP client
 *    - Provides streaming interface for real-time updates
 *    - Maintains clean separation between UI and chat logic
 *
 * 3. Configuration Management:
 *    - Handles server configuration during initialization
 *    - Manages tool call limits
 *    - Configures MCP client with server details
 */
export class SessionManager {
  private tsmpSessionManager: TSMCPSessionManager;

  constructor() {
    this.tsmpSessionManager = new TSMCPSessionManager();
  }

  /**
   * Initializes a new chat session with the given configuration.
   *
   * @param config - LLM configuration for the session
   * @param servers - Optional server configurations for tool support
   * @param maxToolCalls - Optional maximum number of tool calls allowed
   * @returns A promise that resolves to the created ChatSession
   */
  async initializeSession(
    config: LLMConfig,
    servers?: Record<string, ServerConfig>,
    maxToolCalls?: number
  ): Promise<ChatSession> {
    const session = await this.tsmpSessionManager.initializeSession(config);

    if (session.mcpClient && servers) {
      await session.mcpClient.configure({
        servers,
        max_tool_calls: maxToolCalls,
      });
    }

    return session;
  }

  /**
   * Sends a message in the specified session.
   *
   * @param sessionId - The ID of the session to send the message in
   * @param message - The message content to send
   * @returns A promise that resolves to the response
   */
  async sendMessage(sessionId: string, message: string) {
    return this.tsmpSessionManager.sendMessage(sessionId, message);
  }

  /**
   * Streams a message in the specified session, providing real-time updates.
   *
   * @param sessionId - The ID of the session to stream the message in
   * @param message - The message content to send
   * @returns An async generator that yields message chunks
   */
  async *sendMessageStream(sessionId: string, message: string) {
    return this.tsmpSessionManager.sendMessageStream(sessionId, message);
  }
}
