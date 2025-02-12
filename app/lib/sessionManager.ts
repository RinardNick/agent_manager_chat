import {
  SessionManager as TSMCPSessionManager,
  LLMConfig,
  ChatSession,
} from '@rinardnick/ts-mcp-client';

export class SessionManager {
  private tsmpSessionManager: TSMCPSessionManager;

  constructor() {
    this.tsmpSessionManager = new TSMCPSessionManager();
  }

  async initializeSession(config: LLMConfig): Promise<ChatSession> {
    return this.tsmpSessionManager.initializeSession(config);
  }
}
