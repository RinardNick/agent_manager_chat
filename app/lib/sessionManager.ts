import {
  SessionManager as TSMCPSessionManager,
  LLMConfig,
  ChatSession,
  ServerConfig,
} from '@rinardnick/ts-mcp-client';

export class SessionManager {
  private tsmpSessionManager: TSMCPSessionManager;

  constructor() {
    this.tsmpSessionManager = new TSMCPSessionManager();
  }

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

  async sendMessage(sessionId: string, message: string) {
    return this.tsmpSessionManager.sendMessage(sessionId, message);
  }

  async *sendMessageStream(sessionId: string, message: string) {
    return this.tsmpSessionManager.sendMessageStream(sessionId, message);
  }
}
