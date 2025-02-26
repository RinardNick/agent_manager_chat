import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';

// Store agent relationships
const agentRelationships = new Map<string, string[]>();

// POST - Connect agents (parent/child relationship)
export async function POST(request: NextRequest) {
  try {
    const { parentSessionId, childSessionId } = await request.json();

    if (!parentSessionId || !childSessionId) {
      return NextResponse.json(
        { error: 'Both parentSessionId and childSessionId are required' },
        { status: 400 }
      );
    }

    // Create or update the relationship
    if (!agentRelationships.has(parentSessionId)) {
      agentRelationships.set(parentSessionId, []);
    }
    
    const children = agentRelationships.get(parentSessionId) || [];
    if (!children.includes(childSessionId)) {
      children.push(childSessionId);
      agentRelationships.set(parentSessionId, children);
    }

    return NextResponse.json(
      { 
        success: true,
        parentSessionId,
        childSessionId,
        relationships: {
          [parentSessionId]: children
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error connecting agents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Send message from agent to agent
export async function PUT(request: NextRequest) {
  try {
    const { fromSessionId, toSessionId, message } = await request.json();

    if (!fromSessionId || !toSessionId || !message) {
      return NextResponse.json(
        { error: 'fromSessionId, toSessionId, and message are required' },
        { status: 400 }
      );
    }

    // Check if relationship exists
    const children = agentRelationships.get(fromSessionId) || [];
    const isParent = children.includes(toSessionId);
    
    const parents = Array.from(agentRelationships.entries())
      .filter(([_, childIds]) => childIds.includes(fromSessionId))
      .map(([parentId]) => parentId);
    const isChild = parents.includes(toSessionId);

    if (!isParent && !isChild) {
      return NextResponse.json(
        { error: 'No relationship exists between these agents' },
        { status: 403 }
      );
    }

    // Here you would actually send the message to the other session
    // This could involve saving to a message queue, database, etc.
    // For now, we'll just simulate a successful message passing

    return NextResponse.json(
      {
        success: true,
        fromSessionId,
        toSessionId,
        message,
        relationship: isParent ? 'parent-to-child' : 'child-to-parent'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending message between agents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Retrieve agent relationships
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId parameter is required' },
        { status: 400 }
      );
    }

    // Get immediate children
    const children = agentRelationships.get(sessionId) || [];
    
    // Get parent(s)
    const parents = Array.from(agentRelationships.entries())
      .filter(([_, childIds]) => childIds.includes(sessionId))
      .map(([parentId]) => parentId);

    return NextResponse.json(
      {
        sessionId,
        children,
        parents,
        relationships: Object.fromEntries(agentRelationships)
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrieving agent relationships:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}