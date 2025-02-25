import { SessionManager, LLMConfig } from '@rinardnick/client_mcp';
import { NextRequest, NextResponse } from 'next/server';
import { getDefaultConfigPath } from '../../../lib/configLoader';
import { loadConfig } from '../../../lib/configLoader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Define basic tools that will be available
const BUILT_IN_TOOLS = [
  {
    name: 'list_files',
    description: 'List files in a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
        content: {
          type: 'string',
          description: 'Content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
];

// Define MCPClient interface with optional methods to match actual implementation
interface MCPClient {
  configure: (config: {
    servers: Record<string, any>;
    max_tool_calls: number;
  }) => Promise<void>;
  discoverCapabilities?: () => Promise<any>;
  listTools?: () => Promise<any>;
  listResources?: () => Promise<any>;
  tools?: any[];
}

// Create an extended session type that includes mcpClient
interface ExtendedChatSession {
  id: string;
  messages: any[];
  mcpClient?: MCPClient; // Optional since we might run without it
  tools?: any[]; // Directly add tools at the session level
  config?: any; // Added for the new formatToolsForLLM function
  formatToolsForLLM?: () => any; // Function to format tools for the LLM
}

// Initialize session manager
let sessionManager: SessionManager;
let globalConfig: any;
let initializationPromise: Promise<void> | null = null;

// Helper function to attach tools to session object
function attachTools(session: any, tools: any[]) {
  if (!session) return;

  // Attach tools directly to session object
  session.tools = tools;

  // If mcpClient exists, also attach tools there
  if (session.mcpClient) {
    session.mcpClient.tools = tools;
  }

  // Add a special function to format tools for Anthropic or other LLMs
  session.formatToolsForLLM = function () {
    if (!this.tools || this.tools.length === 0) {
      return null;
    }

    // Format depends on the LLM type
    const llmType = this.config?.type || 'claude';

    if (llmType === 'claude') {
      // Format for Anthropic Claude - using the required schema
      return {
        type: 'tools',
        tools: this.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
      };
    }

    // Default format
    return { tools: this.tools };
  };

  console.log(`[TOOLS] Attached ${tools.length} tools to session`);
  return session;
}

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

// Helper function to format tools for the Claude API
function formatClaudeTools(tools: any[]) {
  if (!tools || tools.length === 0) {
    return null;
  }

  return {
    type: 'tools',
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  };
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
        // Get request body
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

        // Create a new session using the global configuration and cast to our extended type
        const session = (await sessionManager.initializeSession({
          type: globalConfig.llm.type,
          api_key: globalConfig.llm.api_key,
          system_prompt: globalConfig.llm.system_prompt,
          model: globalConfig.llm.model,
        })) as unknown as ExtendedChatSession;

        // Attach tools directly to session if needed
        if (useTools) {
          console.log('[SESSION] Attaching built-in tools to session');
          attachTools(session, BUILT_IN_TOOLS);
        } else {
          console.log('[SESSION] Tools disabled for this session');
        }

        return NextResponse.json(
          {
            sessionId: session.id,
            messages: session.messages,
            hasTools: useTools && session.tools && session.tools.length > 0,
          },
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

        // Prepare tools if available
        let toolsForLLM = null;
        if (session.tools && session.tools.length > 0) {
          console.log(
            `[MESSAGE] Session ${sessionId} has ${session.tools.length} tools available`
          );
          toolsForLLM = formatClaudeTools(session.tools);
          console.log(
            '[MESSAGE] Formatted tools for Claude:',
            JSON.stringify(toolsForLLM)
          );
        } else {
          console.log('[MESSAGE] No tools available for this session');
        }

        // Instead of relying on internal formatting, manually send the tools to Anthropic
        // This is a patch based on the assumption that we need to manually attach tools
        const anthropicOptions = {
          temperature: 0.7,
          max_tokens: 1000,
          tools: toolsForLLM,
        };

        console.log(
          '[MESSAGE] Sending message with Anthropic options:',
          JSON.stringify({
            ...anthropicOptions,
            tools: anthropicOptions.tools ? 'Included' : 'None',
          })
        );

        // Attempt to pass anthropicOptions to the sendMessage function
        // Use as any to bypass the type checking since we're patching the function call
        try {
          const response = await (sessionManager.sendMessage as any)(
            sessionId,
            message,
            anthropicOptions
          );
          return NextResponse.json(response);
        } catch (err) {
          console.log('[MESSAGE] Error with options, trying without options');
          // Fallback to standard sendMessage without options
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
