import { NextRequest } from 'next/server';
import { SessionManager } from '@rinardnick/client_mcp';

// Define proper types for the stream chunks based on actual structure
interface StreamChunk {
  type: 'thinking' | 'content' | 'tool_start' | 'tool_result' | 'error' | 'done';
  content?: string;
  error?: string;
  tool?: {
    name: string;
    parameters: Record<string, any>;
  };
  result?: any;
}
import { loadConfig, getDefaultConfigPath } from '../../../lib/configLoader';

// Initialize sessionManager asynchronously
let sessionManager: SessionManager | undefined;
// Keep track of the session ID
let sessionId: string | undefined;

// This function ensures we only initialize the session manager once
async function getSessionManager(): Promise<{ manager: SessionManager, sessionId: string }> {
  if (!sessionManager) {
    sessionManager = await (async () => {
      try {
        // Get the config path
        const configPath = await getDefaultConfigPath();

        // Load the configuration
        const fullConfig = await loadConfig(configPath);

        console.log("[API] Creating session manager");
        
        // Initialize the session manager with the loaded config
        // According to the type definition, SessionManager only accepts useSharedServers
        const manager = new SessionManager({
          useSharedServers: true
        });
        
        // Log the available servers and tools in the config
        if (fullConfig.servers) {
          console.log("[API] Config has servers:", Object.keys(fullConfig.servers));
        } else {
          console.warn("[API] No servers configured in the config file");
        }
        
        // The LLMConfig passed to initializeSession is where we need to pass the servers
        // Create a new LLMConfig that includes everything needed
        const llmConfig = {
          ...fullConfig.llm,
          // Add tools configuration - this is passed directly to the LLM
          tools: [
            // Define filesystem tools if available
            ...(fullConfig.servers?.filesystem ? [{
              type: "filesystem",
              description: "Access and manipulate files in the filesystem"
            }] : []),
            // Define terminal tools if available
            ...(fullConfig.servers?.terminal ? [{
              type: "terminal",
              description: "Execute commands in a terminal"
            }] : [])
          ],
          // Add servers configuration
          servers: fullConfig.servers,
          // Enable thinking
          thinking: {
            enabled: true,
            budget_tokens: 6000
          },
          // Add max_tool_calls if specified
          max_tool_calls: fullConfig.max_tool_calls || 10
        };
        
        // Initialize a session and get the ID that client_mcp generates
        console.log("[API] Initializing new session with client_mcp");
        
        // Use our enhanced llmConfig with tools and servers
        console.log("[API] Using LLM config with tools:", llmConfig.tools?.length || 0);
        const session = await manager.initializeSession(llmConfig);
        
        // Extract the actual session ID string from the returned object
        if (typeof session === 'object' && session !== null && 'id' in session) {
          sessionId = session.id;
        } else if (typeof session === 'string') {
          sessionId = session;
        } else {
          console.log(`[API] Unexpected session format:`, session);
          throw new Error('Invalid session format returned');
        }
        
        console.log(`[API] Session initialized with ID: ${sessionId}`);

        return manager;
      } catch (error) {
        console.error('Failed to initialize session manager:', error);
        throw error;
      }
    })();
  }

  if (!sessionId) {
    throw new Error('Session ID is not initialized');
  }

  return { 
    manager: sessionManager,
    sessionId: sessionId
  };
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

      // Get the session manager and session ID
      const { manager, sessionId: actualSessionId } = await getSessionManager();
      
      console.log(`[API] Sending message to session: ${actualSessionId}`);
      
      // Get stream from client_mcp
      const mcpStream = manager.sendMessageStream(actualSessionId, message);

      // Process the stream chunks
      for await (const chunk of mcpStream as AsyncGenerator<StreamChunk>) {
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