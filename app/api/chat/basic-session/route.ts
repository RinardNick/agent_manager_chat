import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Store sessions in memory for this simplified API
const sessions = new Map<
  string,
  {
    id: string;
    messages: Array<{ role: string; content: string }>;
    createdAt: Date;
  }
>();

// Generate a random ID
const generateId = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

export async function POST(request: NextRequest) {
  try {
    // Create a basic session without MCP
    const sessionId = generateId();

    const session = {
      id: sessionId,
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      createdAt: new Date(),
    };

    // Store the session
    sessions.set(sessionId, session);

    console.log('[BASIC-API] Created new session:', sessionId);

    return NextResponse.json(
      {
        sessionId,
        messages: session.messages,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[BASIC-API] Error creating session:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Handle message endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return NextResponse.json(
        {
          error: 'Session ID and message are required',
        },
        { status: 400 }
      );
    }

    // Get the session
    const session = sessions.get(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          error: 'Session not found',
        },
        { status: 404 }
      );
    }

    // Add the message to history
    session.messages.push({ role: 'user', content: message });

    // Generate a simple response (in a real app, this would call the LLM)
    const responseContent = `I received your message: "${message}". This is coming from a simplified API that doesn't use MCP.`;
    session.messages.push({ role: 'assistant', content: responseContent });

    console.log('[BASIC-API] Added message to session:', sessionId);

    return NextResponse.json({
      role: 'assistant',
      content: responseContent,
      hasToolCall: false,
    });
  } catch (error) {
    console.error('[BASIC-API] Error handling message:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
