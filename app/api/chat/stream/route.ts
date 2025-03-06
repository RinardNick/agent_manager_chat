import { NextRequest } from 'next/server';
import { SessionManager } from '@rinardnick/client_mcp';
import { loadConfig, getDefaultConfigPath } from '../../../lib/configLoader';

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
          useSharedServers: true,
          servers: fullConfig.servers,
        });
        // Initialize the default session
        await manager.initializeSession(fullConfig.llm);

        return manager;
      } catch (error) {
        console.error('Failed to initialize session manager:', error);
        throw error;
      }
    })();
  }

  return sessionManager;
}

async function handleRequest(request: NextRequest) {
  // Set headers for Server-Sent Events
  const encoder = new TextEncoder();
  const customHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: string) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
  };

  // Process the request in the background
  (async () => {
    let writerClosed = false;
    
    try {
      // Support both GET and POST methods
      let message: string;
      let sessionId = 'default';
      
      if (request.method === 'GET') {
        const { searchParams } = new URL(request.url);
        message = searchParams.get('message') || '';
        sessionId = searchParams.get('sessionId') || 'default';
      } else {
        // POST method
        const body = await request.json();
        message = body.message || '';
        sessionId = body.sessionId || 'default';
      }

      if (!message) {
        await sendEvent(
          'error',
          JSON.stringify({ error: 'No message provided' })
        );
        writerClosed = true;
        await writer.close();
        return;
      }

      const sessionManager = await getSessionManager();

      // Get stream from client_mcp
      const mcpStream = sessionManager.sendMessageStream(sessionId, message);

      // Process the stream chunks
      for await (const chunk of mcpStream) {
        switch (chunk.type) {
          case 'thinking':
            await sendEvent(
              'thinking',
              JSON.stringify({ content: chunk.content })
            );
            break;
          case 'tool_start':
            await sendEvent(
              'tool_start',
              JSON.stringify({
                toolName: chunk.tool.name,
                toolInput: chunk.tool.parameters,
              })
            );
            break;
          case 'tool_result':
            await sendEvent(
              'tool_result',
              JSON.stringify({
                toolName: chunk.tool.name,
                result: chunk.result,
              })
            );
            break;
          case 'content':
            await sendEvent(
              'content',
              JSON.stringify({ content: chunk.content })
            );
            break;
          case 'error':
            await sendEvent('error', JSON.stringify({ error: chunk.error }));
            break;
          case 'done':
            await sendEvent('done', JSON.stringify({}));
            break;
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await sendEvent('error', JSON.stringify({ error: errorMessage }));
    } finally {
      if (!writerClosed) {
        await writer.close();
      }
    }
  })();

  return new Response(stream.readable, { headers: customHeaders });
}

export const GET = handleRequest;
export const POST = handleRequest;