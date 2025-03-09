import { NextRequest, NextResponse } from 'next/server';
import {
  getMCPSessionManager,
  testSingleton,
  initializeSession,
} from '@/app/lib/serverSessionManager';
import { loadConfig, getDefaultConfigPath } from '@/app/lib/configLoader';

/**
 * API route to test the singleton pattern implementation
 * This route verifies that multiple calls to getMCPSessionManager return the same instance
 * and that sessions created can be accessed across different parts of the application
 */
export async function GET(req: NextRequest) {
  try {
    // Test the singleton implementation
    const isSingleton = await testSingleton();

    // Get the manager and retrieve its request count
    const manager = await getMCPSessionManager();
    const requestCount = global.sessionManagerRequests || 0;

    // Test session creation and access
    let sessionTestResults = { success: false, sessionId: '', error: '' };

    try {
      // Create a new session
      const configPath = await getDefaultConfigPath();
      const fullConfig = await loadConfig(configPath);

      const newSession = await manager.initializeSession(fullConfig.llm);
      const sessionId =
        typeof newSession === 'object' ? newSession.id : newSession;

      // Verify we can access this session again
      const sessionExists = await initializeSession(sessionId);

      sessionTestResults = {
        success: sessionExists,
        sessionId,
        error: '',
      };
    } catch (error) {
      sessionTestResults.error =
        error instanceof Error ? error.message : 'Unknown session error';
    }

    // Test that we can get a list of properties from the manager
    const managerProperties = Object.getOwnPropertyNames(manager)
      .filter(
        prop => typeof manager[prop as keyof typeof manager] !== 'function'
      )
      .slice(0, 5); // Limit to first 5 properties to avoid too much output

    return NextResponse.json({
      success: true,
      isSingleton,
      requestCount,
      sessionTest: sessionTestResults,
      managerProperties,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in test-singleton API route:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
