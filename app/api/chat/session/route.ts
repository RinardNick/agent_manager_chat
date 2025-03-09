import { NextRequest, NextResponse } from 'next/server';
import { initializeNewMCPSession } from '../../../lib/serverSessionManager';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await initializeNewMCPSession();
    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
