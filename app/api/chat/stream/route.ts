import { NextRequest } from 'next/server';
import { getMCPSessionManager } from '../../../lib/serverSessionManager';

// Define proper types for the stream chunks
interface BaseStreamChunk {
  type: string;
  content?: string;
  error?: string;
}

interface ToolCallChunk extends BaseStreamChunk {
  type: 'tool_call';
  name?: string;
  input?: Record<string, any>;
  id?: string;
}

interface ToolResultChunk extends BaseStreamChunk {
  type: 'tool_result' | 'tool_output';
  name?: string;
  output?: any;
  result?: any;
  id?: string;
}

type StreamChunk = BaseStreamChunk | ToolCallChunk | ToolResultChunk;

export async function GET(request: NextRequest) {
  // Get the message and session ID from the query parameters
  const searchParams = request.nextUrl.searchParams;
  const message = searchParams.get('message');
  const sessionId = searchParams.get('sessionId');

  if (!message || !sessionId) {
    return new Response(
      JSON.stringify({ error: 'Message and sessionId are required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Initialize streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get the session manager
        const sessionManager = await getMCPSessionManager();

        // Try to get the session, will throw if it doesn't exist
        try {
          sessionManager.getSession(sessionId);
        } catch (error) {
          // Session doesn't exist
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: 'Session not found',
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        // Send the message to the session and receive events
        const mcpStream = sessionManager.sendMessageStream(sessionId, message);

        // Process each chunk from the stream
        for await (const chunk of mcpStream as AsyncIterable<StreamChunk>) {
          try {
            if (chunk.type === 'thinking') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'thinking',
                    content: chunk.content,
                  })}\n\n`
                )
              );
            } else if (chunk.type === 'content') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'content',
                    content: chunk.content,
                  })}\n\n`
                )
              );
            } else if (chunk.type === 'tool_call') {
              const toolCallChunk = chunk as ToolCallChunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_call',
                    tool_call: {
                      toolName: toolCallChunk.name || '',
                      toolInput: toolCallChunk.input || {},
                      toolId: toolCallChunk.id,
                    },
                  })}\n\n`
                )
              );
            } else if (
              chunk.type === 'tool_result' ||
              chunk.type === 'tool_output'
            ) {
              const toolResultChunk = chunk as ToolResultChunk;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'tool_result',
                    tool_result: {
                      toolName: toolResultChunk.name || '',
                      result: toolResultChunk.output || toolResultChunk.result,
                      toolId: toolResultChunk.id,
                    },
                  })}\n\n`
                )
              );
            } else if (chunk.type === 'error') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    error: chunk.error,
                  })}\n\n`
                )
              );
            } else if (chunk.type === 'done') {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'done',
                  })}\n\n`
                )
              );
              controller.close();
            }
          } catch (error) {
            console.error('[STREAM] Error processing chunk:', error);
          }
        }
      } catch (error) {
        console.error('[STREAM] Error in stream handler:', error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: 'Server error',
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  // Return the streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
