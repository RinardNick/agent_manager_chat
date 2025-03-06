import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@rinardnick/client_mcp';
import { loadConfig, getDefaultConfigPath } from '@/app/lib/configLoader';

// Initialize sessionManager asynchronously
let sessionManager: SessionManager | undefined;

// This function ensures we only initialize the session manager once
async function getSessionManager(): Promise<SessionManager> {
  if (!sessionManager) {
    sessionManager = await (async () => {
      try {
        // Get the config path
        const configPath = await getDefaultConfigPath();

        // Load the configuration
        const fullConfig = await loadConfig(configPath);

        // Initialize the session manager with the loaded config
        const manager = new SessionManager({
          servers: fullConfig.servers,
        } as any);
        // Use the llm property from FullConfig which should match LLMConfig
        manager.initializeSession(fullConfig.llm);

        return manager;
      } catch (error) {
        console.error('Failed to initialize session manager:', error);
        throw error;
      }
    })();
  }

  return sessionManager;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const message = searchParams.get('message');

  if (!message) {
    return NextResponse.json({ error: 'No message provided' }, { status: 400 });
  }

  try {
    // Get the initialized session manager
    const sessionManager = await getSessionManager();

    // It seems that the sendMessage function expects just a single parameter with the message
    const response = await sessionManager.sendMessage('session1', message);

    return NextResponse.json({ response });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
