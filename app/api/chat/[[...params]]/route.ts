import { SessionManager } from '@rinardnick/ts-mcp-client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Create a singleton instance of the session manager
const sessionManager = new SessionManager();

export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json();
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/chat', '');

    if (path === '/session') {
      const { config } = body;
      if (!config) {
        return NextResponse.json(
          { error: 'Configuration is required' },
          { status: 400 }
        );
      }

      try {
        const session = await sessionManager.initializeSession(config);
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
