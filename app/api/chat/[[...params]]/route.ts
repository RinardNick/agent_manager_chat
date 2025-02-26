import { SessionManager, LLMConfig } from '@rinardnick/client_mcp';
import { NextRequest, NextResponse } from 'next/server';
import { getDefaultConfigPath } from '../../../lib/configLoader';
import { loadConfig } from '../../../lib/configLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Create an extended session type with our custom properties
interface ExtendedChatSession {
  id: string;
  messages: any[];
  config?: any;
  mcpEnabled?: boolean;
}

// Initialize session manager
let sessionManager: SessionManager;
let globalConfig: any;
let initializationPromise: Promise<void> | null = null;

async function initializeIfNeeded() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!sessionManager) {
        try {
          // Load configuration
          console.log('[API] Getting default config path');
          const configPath = await getDefaultConfigPath();
          console.log('[API] Loading config from:', configPath);
          globalConfig = await loadConfig(configPath);
          console.log('[API] Loaded config:', {
            ...globalConfig,
            llm: {
              ...globalConfig.llm,
              api_key: '[REDACTED]',
            },
          });

          // Create session manager
          console.log('[API] Creating session manager');
          sessionManager = new SessionManager();

          // Success - we don't need to initialize a test session here
          console.log('[INIT] Session manager initialized successfully');
        } catch (error) {
          console.error('[INIT] Failed to initialize:', error);
          initializationPromise = null;
          throw error;
        }
      }
    })();
  }
  await initializationPromise;
}

// We'll let the MCP client handle tool formatting now

export async function GET(request: NextRequest) {
  try {
    await initializeIfNeeded();

    const url = new URL(request.url);
    const path = url.pathname.replace('/api/chat', '');
    const match = path.match(/^\/session\/([^/]+)\/stream$/);

    if (!match) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
    }

    const sessionId = match[1];
    const message = url.searchParams.get('message');

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    console.log(`[STREAM] Starting stream handler for session ${sessionId}`);

    // Create a ReadableStream that will yield our chunks
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('[STREAM] Getting message stream from SessionManager');
          const messageStream = sessionManager.sendMessageStream(
            sessionId,
            message
          );

          console.log('[STREAM] Starting to process chunks');
          for await (const chunk of messageStream) {
            console.log('[STREAM] Processing chunk:', chunk);

            // Enhanced logging for tool-related chunks
            if (chunk.type === 'tool_start') {
              console.log('[STREAM] Tool execution starting:', chunk.content);
            } else if (chunk.type === 'tool_result') {
              console.log('[STREAM] Tool execution result:', chunk.content);
            }

            const encodedChunk = new TextEncoder().encode(
              `data: ${JSON.stringify(chunk)}\n\n`
            );
            controller.enqueue(encodedChunk);
          }
          console.log('[STREAM] Stream complete, closing');
          controller.close();
        } catch (error) {
          console.error('[STREAM] Error in stream:', error);
          const errorChunk = new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            })}\n\n`
          );
          controller.enqueue(errorChunk);
          controller.close();
        }
      },
    });

    // Return the response with appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[STREAM] Error in GET handler:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeIfNeeded();

    const url = new URL(request.url);
    const path = url.pathname.replace('/api/chat', '');

    if (path === '/session') {
      try {
        let useTools = true; // Default to using tools
        try {
          const body = await request.json();
          if (body.disable_tools === true) {
            useTools = false;
          }
        } catch (e) {
          // No body or invalid JSON, proceed with default settings
        }

        console.log('[SESSION] Initializing new session with config:', {
          type: globalConfig.llm.type,
          model: globalConfig.llm.model,
          system_prompt: globalConfig.llm.system_prompt,
          api_key_length: globalConfig.llm.api_key?.length,
          use_tools: useTools,
        });

        // Prepare session config based on whether tools are enabled
        const sessionConfig: LLMConfig = {
          type: globalConfig.llm.type,
          api_key: globalConfig.llm.api_key,
          system_prompt: useTools 
            ? "You are a helpful assistant with access to tools. When a user asks you something that requires using a tool, ALWAYS use the tool instead of making up an answer. For example, if a user asks about files, use the appropriate file tool."
            : globalConfig.llm.system_prompt,
          model: globalConfig.llm.model,
          // Only include servers if tools are enabled
          servers: useTools ? globalConfig.servers : undefined,
          // Pass along max_tool_calls if it exists
          max_tool_calls: globalConfig.max_tool_calls
        };
        
        try {
          // Create a new session with proper configuration
          console.log('[SESSION] Creating session with full config including servers');
          const session = (await sessionManager.initializeSession(sessionConfig)) as unknown as ExtendedChatSession;
          
          // Mark this session as having MCP enabled if we included servers
          if (useTools) {
            console.log('[SESSION] MCP enabled for this session (servers were configured)');
            session.mcpEnabled = true;
          } else {
            console.log('[SESSION] Tools disabled for this session');
          }
          
          // Return the session information
          return NextResponse.json(
            {
              sessionId: session.id,
              messages: session.messages,
              hasTools: useTools && session.mcpEnabled === true,
            },
            { status: 201 }
          );
        } catch (initError) {
          console.error('[SESSION] Failed to initialize session with servers:', initError);
          console.log('[SESSION] Falling back to session without MCP');
          
          // If session with servers failed, try again without servers
          const fallbackSession = await sessionManager.initializeSession({
            type: globalConfig.llm.type,
            api_key: globalConfig.llm.api_key,
            system_prompt: globalConfig.llm.system_prompt,
            model: globalConfig.llm.model,
          });
          
          return NextResponse.json({
            sessionId: fallbackSession.id,
            messages: fallbackSession.messages,
            hasTools: false,
          }, { status: 201 });
        }
      } catch (error) {
        console.error('Error creating session:', error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Failed to create session',
          },
          { status: 500 }
        );
      }
    }

    const match = path.match(/^\/session\/([^/]+)\/message$/);
    if (match) {
      const sessionId = match[1];
      const body = await request.json();
      const { message } = body;

      if (!message) {
        return NextResponse.json(
          { error: 'Message is required' },
          { status: 400 }
        );
      }

      try {
        // Get the session
        const session = (await sessionManager.getSession(
          sessionId
        )) as unknown as ExtendedChatSession;

        if (!session) {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }

        // Check if MCP is enabled for this session
        const mcpEnabled = !!(session as ExtendedChatSession).mcpEnabled;

        console.log(
          `[MESSAGE] Session ${sessionId} has MCP enabled: ${mcpEnabled}`
        );

        // Let the SessionManager handle tool discovery and execution
        const clientOptions = {
          temperature: 0.7,
          max_tokens: 1000,
          tools: mcpEnabled ? 'auto' : 'none', // Enable tools only if MCP is enabled
        };

        console.log(
          '[MESSAGE] Client options prepared:',
          JSON.stringify(clientOptions)
        );

        try {
          console.log('[MESSAGE] Sending message with sessionManager');

          // SessionManager should now handle the MCP tools automatically
          if (mcpEnabled) {
            console.log(
              '[MESSAGE] MCP tools are enabled, SessionManager will handle tool execution'
            );
          }

          // Send the message through the session manager
          // The session manager will use the MCP client if it's available
          const response = await sessionManager.sendMessage(sessionId, message);

          console.log('[MESSAGE] Successfully sent message with client');
          return NextResponse.json(response);
        } catch (err) {
          console.error('[MESSAGE] Error sending message with options:', err);

          // Fallback to standard sendMessage without options
          console.log(
            '[MESSAGE] Falling back to standard method without options'
          );
          const response = await sessionManager.sendMessage(sessionId, message);
          return NextResponse.json(response);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
          {
            error:
              error instanceof Error ? error.message : 'Failed to send message',
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) {
    console.error('Error in POST handler:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
