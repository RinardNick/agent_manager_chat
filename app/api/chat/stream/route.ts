import { NextRequest } from 'next/server';
import { getMCPSessionManager } from '../../../lib/serverSessionManager';

// Define types for the stream chunks
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

// Define types for tool information extraction
interface ToolCall {
  toolName: string;
  toolInput: Record<string, any>;
  toolId: string;
}

interface ToolResult {
  toolName: string;
  toolOutput: any;
  toolId: string;
}

interface ExtractedToolInfo {
  textContent: string;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
}

type StreamChunk = BaseStreamChunk | ToolCallChunk | ToolResultChunk;

// Helper function to parse tool calls from response content
function extractToolInfo(content: string): ExtractedToolInfo {
  // Check if it looks like JSON
  if (content.includes('{"content":[') || content.includes('{"type":"text"')) {
    try {
      // First, try to see if the entire content is a JSON object
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          textContent: parsed.text || parsed.content || content,
          toolCalls: null,
          toolResults: null,
        };
      }
    } catch (e) {
      // Not valid JSON, continue with normal processing
    }
  }

  // Extract text content and remove any JSON-looking sections
  let textContent = content;
  const toolCalls: ToolCall[] = [];
  const toolResults: ToolResult[] = [];

  // Look for JSON tool call/result patterns
  const jsonPattern =
    /\{\"content\":\[\{.*?\}\]\}|\{\"type\":\"text\",\"text\":\".*?\"\}/g;
  const jsonMatches = content.match(jsonPattern);

  if (jsonMatches) {
    // Remove the JSON sections from the text content
    textContent = content.replace(jsonPattern, '').trim();

    // Process each JSON section
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);

        // Handle nested "content" array structure
        if (parsed.content && Array.isArray(parsed.content)) {
          for (const item of parsed.content) {
            if (item.type === 'tool_use') {
              toolCalls.push({
                toolName: item.name,
                toolInput: item.input || {},
                toolId: item.id,
              });
            } else if (item.type === 'text') {
              // Add text content back
              textContent += ' ' + item.text;
            }
          }
        }
        // Handle direct "type":"text" objects
        else if (parsed.type === 'text') {
          textContent += ' ' + parsed.text;
        }
      } catch (e) {
        console.error('Error parsing JSON in response:', e);
      }
    }
  }

  return {
    textContent: textContent.trim(),
    toolCalls: toolCalls.length > 0 ? toolCalls : null,
    toolResults: toolResults.length > 0 ? toolResults : null,
  };
}

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
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get the session manager
        const sessionManager = await getMCPSessionManager();

        try {
          // Validate the session exists
          sessionManager.getSession(sessionId);
        } catch (error) {
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

        // Add initial streaming state
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'content',
              content: '',
            })}\n\n`
          )
        );

        try {
          // Instead of streaming, use sendMessage like in the integration test
          console.log(
            '[API] Sending message using sendMessage to match integration test'
          );
          const response = await sessionManager.sendMessage(sessionId, message);

          // Send the complete response content
          if (response && response.content) {
            // Extract tool call information if present in the response
            const { textContent, toolCalls, toolResults } = extractToolInfo(
              response.content
            );

            // Send the pure text content
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'content',
                  content: textContent,
                })}\n\n`
              )
            );

            // Send any tool calls separately
            if (toolCalls && toolCalls.length > 0) {
              for (const toolCall of toolCalls) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_call',
                      tool_call: toolCall,
                    })}\n\n`
                  )
                );
              }
            }

            // Send any tool results separately
            if (toolResults && toolResults.length > 0) {
              for (const toolResult of toolResults) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_result',
                      tool_result: toolResult,
                    })}\n\n`
                  )
                );
              }
            }
          }

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          console.error('[API] Error sending message:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              })}\n\n`
            )
          );
          controller.close();
        }
      } catch (error) {
        console.error('[API] Error in stream handler:', error);
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
