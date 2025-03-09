import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getMCPSessionManager,
  initializeSession,
} from './serverSessionManager';
import { loadConfig, getDefaultConfigPath } from './configLoader';

// Mock modules and global object
const mockGlobal = global as any;

// Mock the MCP client module
vi.mock('@rinardnick/client_mcp', () => {
  // Create a mock session store to simulate session persistence
  const mockSessions = new Map<string, any>();

  // Create a mock SessionManager class
  const MockSessionManager = vi.fn().mockImplementation(() => ({
    initializeSession: vi.fn().mockImplementation(async () => {
      const sessionId = `session-${Date.now()}`;
      mockSessions.set(sessionId, { id: sessionId, createdAt: new Date() });
      return { id: sessionId };
    }),

    getSession: vi.fn().mockImplementation(sessionId => {
      if (!mockSessions.has(sessionId)) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      return mockSessions.get(sessionId);
    }),

    sendMessageStream: vi.fn().mockImplementation((sessionId, message) => {
      if (!mockSessions.has(sessionId)) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      // Return a mock async generator
      async function* mockStreamGenerator() {
        yield { type: 'thinking', content: 'Thinking...' };
        yield { type: 'content', content: `Response to: ${message}` };
        yield { type: 'done' };
      }
      return mockStreamGenerator();
    }),

    // Helper to check what sessions exist in our mock
    _getSessions: () => mockSessions,
  }));

  return {
    SessionManager: MockSessionManager,
  };
});

// Mock the config loader
vi.mock('./configLoader', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    llm: { model: 'test-model' },
  }),
  getDefaultConfigPath: vi.fn().mockResolvedValue('/mock/config/path'),
}));

describe('SessionManager Singleton Integration Tests', () => {
  beforeEach(() => {
    // Reset the global variables before each test
    mockGlobal.mcpSessionManager = undefined;
    mockGlobal.sessionManagerRequests = undefined;

    // Reset the mock implementations
    vi.clearAllMocks();
  });

  it('should maintain session data across different API endpoints', async () => {
    // Simulate first API endpoint creating a session
    const manager1 = await getMCPSessionManager();
    const session = await manager1.initializeSession({
      model: 'test-model',
    } as any);
    const sessionId = session.id;

    // Verify session was created
    expect(sessionId).toBeDefined();

    // Simulate second API endpoint using the session
    const manager2 = await getMCPSessionManager();

    // Both managers should be the same instance
    expect(manager2).toBe(manager1);

    // Try to get the session from the second manager
    let sessionExists = false;
    try {
      manager2.getSession(sessionId);
      sessionExists = true;
    } catch (error) {
      sessionExists = false;
    }

    // Session should exist in the second manager
    expect(sessionExists).toBe(true);
  });

  it('should allow sending messages to a session from different API endpoints', async () => {
    // Simulate first API endpoint creating a session
    const manager1 = await getMCPSessionManager();
    const session = await manager1.initializeSession({
      model: 'test-model',
    } as any);
    const sessionId = session.id;

    // Simulate second API endpoint sending a message
    const manager2 = await getMCPSessionManager();

    // Send a message using the second manager
    const stream = manager2.sendMessageStream(
      sessionId,
      'Hello from second endpoint'
    );

    // Process the stream
    const results: any[] = [];
    for await (const chunk of stream) {
      results.push(chunk);
    }

    // Verify we got a valid response
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(chunk => chunk.type === 'content')).toBe(true);
  });

  it('should correctly handle initializing an existing session', async () => {
    // Create a session
    const manager = await getMCPSessionManager();
    const session = await manager.initializeSession({
      model: 'test-model',
    } as any);
    const sessionId = session.id;

    // Now try to initialize this session
    const result = await initializeSession(sessionId);
    expect(result).toBe(true);

    // Try with a non-existent session ID
    const fakeResult = await initializeSession('non-existent-session-id');
    expect(fakeResult).toBe(false);
  });
});
