import {
  SessionManager,
  LLMConfig,
  ChatSession as BaseChatSession,
} from '@rinardnick/client_mcp';
import { NextRequest, NextResponse } from 'next/server';
import { getDefaultConfigPath } from '../../../lib/configLoader';
import { loadConfig } from '../../../lib/configLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Define extended ChatSession type that includes mcpClient
interface ChatSession extends BaseChatSession {
  mcpClient?: {
    configure: (config: any) => Promise<void>;
    discoverCapabilities: () => Promise<any>;
    tools?: any[];
  };
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
            api_key: '[REDACTED]',
          });

          // Create session manager
          console.log('[API] Creating session manager');
          sessionManager = new SessionManager();

          // Initialize session with LLM config
          // Check if we have globalConfig.llm (file format) or if the config is flat (env vars format)
          const llmConfig: LLMConfig = globalConfig.llm
            ? {
                type: globalConfig.llm.type,
                api_key: globalConfig.llm.api_key,
                system_prompt: globalConfig.llm.system_prompt,
                model: globalConfig.llm.model,
                servers: globalConfig.servers,
              }
            : {
                // If globalConfig is already in the right format (from env vars), use it directly
                type: globalConfig.type,
                api_key: globalConfig.api_key,
                system_prompt: globalConfig.system_prompt,
                model: globalConfig.model,
                servers: globalConfig.servers,
              };

          console.log('[API] Using LLM config:', {
            type: llmConfig.type,
            model: llmConfig.model,
            system_prompt: llmConfig.system_prompt,
            api_key: '[REDACTED]',
          });

          // Initialize session
          console.log('[API] Initializing session');
          try {
            const session = await sessionManager.initializeSession(llmConfig);
            console.log('[API] Session initialized successfully:', {
              id: session.id,
              hasClient: !!session.mcpClient,
              messageCount: session.messages?.length || 0,
            });

            // Configure MCP client if available
            if (session.mcpClient) {
              console.log('[API] Configuring MCP client');
              await session.mcpClient.configure({
                servers: globalConfig.servers,
                max_tool_calls: globalConfig.max_tool_calls,
              });
              console.log('[API] MCP client configured successfully');
            }

            console.log('[INIT] Session manager initialized successfully');
            if (session.mcpClient) {
              console.log('[INIT] Available tools:', session.mcpClient.tools);
            }
          } catch (error) {
            console.error('[API] Session initialization error details:', {
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                    }
                  : error,
              config: {
                type: llmConfig.type,
                model: llmConfig.model,
                system_prompt: llmConfig.system_prompt,
                api_key_length: llmConfig.api_key.length,
              },
            });
            throw error;
          }
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
        // Create a new session using the global configuration
        const session = await sessionManager.initializeSession({
          type: globalConfig.llm.type,
          api_key: globalConfig.llm.api_key,
          system_prompt: globalConfig.llm.system_prompt,
          model: globalConfig.llm.model,
        });

        // Configure MCP client if available
        if (session.mcpClient) {
          await session.mcpClient.configure({
            servers: globalConfig.servers,
            max_tool_calls: globalConfig.max_tool_calls,
          });
        }

        return NextResponse.json(
          { sessionId: session.id, messages: session.messages },
          { status: 201 }
        );
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
        const response = await sessionManager.sendMessage(sessionId, message);
        return NextResponse.json(response);
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
