import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { SessionManager } from '@rinardnick/client_mcp';
import {
  getMCPSessionManager,
  initializeNewMCPSession,
  getActiveSessionId,
  initializeSession,
  testSingleton,
} from './serverSessionManager';
import { loadConfig } from './configLoader';

// Mock the global object
const mockGlobal = global as any;

// Mock the SessionManager and its methods
vi.mock('@rinardnick/client_mcp', () => {
  const mockInitializeSession = vi.fn().mockResolvedValue('mock-session-id');
  const mockSendMessageStream = vi.fn().mockImplementation(function* () {
    yield { type: 'content', content: 'Mock response' };
    yield { type: 'done' };
  });
  const mockGetSession = vi.fn().mockImplementation(sessionId => {
    if (
      sessionId === 'mock-session-id' ||
      sessionId === 'existing-session-id'
    ) {
      return { id: sessionId };
    }
    if (sessionId === 'non-existent-session-id') {
      throw new Error('Session not found: non-existent-session-id');
    }
    return null;
  });

  return {
    SessionManager: vi.fn().mockImplementation(() => ({
      initializeSession: mockInitializeSession,
      sendMessageStream: mockSendMessageStream,
      getSession: mockGetSession,
    })),
  };
});

// Mock configLoader
vi.mock('./configLoader', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    llm: { type: 'claude', api_key: 'mock-api-key' },
    servers: {},
  }),
  getDefaultConfigPath: vi.fn().mockResolvedValue('/mock/path/config.json'),
}));

describe('Server Session Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new MCP session', async () => {
    const sessionId = await initializeNewMCPSession();
    expect(sessionId).toBe('mock-session-id');
  });

  it('should correctly handle active session ID', async () => {
    // Current implementation just returns null
    const activeSessionId = await getActiveSessionId();
    expect(activeSessionId).toBeNull();
  });

  it('should initialize an existing session if it exists', async () => {
    // This test will fail because we haven't implemented the function yet
    // Once implemented, it should initialize the session on the server side
    const existingSessionId = 'existing-session-id';
    const result = await initializeSession(existingSessionId);

    // The function should return true to indicate success
    expect(result).toBe(true);

    // The getSession method should have been called with the session ID
    const manager = await getMCPSessionManager();
    expect(manager.getSession).toHaveBeenCalledWith(existingSessionId);
  });

  it('should handle non-existent sessions gracefully', async () => {
    // This test will fail because we haven't implemented the function yet
    const nonExistentSessionId = 'non-existent-session-id';

    // The function should return false when the session doesn't exist
    const result = await initializeSession(nonExistentSessionId);
    expect(result).toBe(false);
  });
});

describe('ServerSessionManager Singleton Pattern', () => {
  beforeEach(() => {
    // Reset the global variables before each test
    mockGlobal.mcpSessionManager = undefined;
    mockGlobal.sessionManagerRequests = undefined;
  });

  it('should create a new SessionManager instance when first called', async () => {
    // First call should create a new instance
    const manager = await getMCPSessionManager();

    // Check that manager was created and stored in global
    expect(manager).toBeDefined();
    expect(mockGlobal.mcpSessionManager).toBe(manager);
    expect(mockGlobal.sessionManagerRequests).toBe(1);
  });

  it('should reuse the existing SessionManager instance on subsequent calls', async () => {
    // First call
    const manager1 = await getMCPSessionManager();

    // Second call should return the same instance
    const manager2 = await getMCPSessionManager();

    // Check that both references are the same object
    expect(manager1).toBe(manager2);
    expect(mockGlobal.mcpSessionManager).toBe(manager1);
    expect(mockGlobal.sessionManagerRequests).toBe(2);
  });

  it('should increment the request counter with each call', async () => {
    // Make several calls
    await getMCPSessionManager();
    await getMCPSessionManager();
    await getMCPSessionManager();

    // Counter should match the number of calls
    expect(mockGlobal.sessionManagerRequests).toBe(3);
  });

  it('should return true from testSingleton() when singleton behavior is working', async () => {
    // testSingleton makes multiple calls to getMCPSessionManager and verifies they return the same instance
    const result = await testSingleton();
    expect(result).toBe(true);
  });

  it('should maintain singleton behavior across multiple API requests', async () => {
    // This test simulates multiple API requests by getting the manager multiple times

    // First "API request"
    const manager1 = await getMCPSessionManager();

    // Simulate clearing request-specific variables but keeping global state
    // (as would happen between separate API requests)
    const storedManager = mockGlobal.mcpSessionManager;

    // Second "API request"
    const manager2 = await getMCPSessionManager();

    // Managers should be the same instance
    expect(manager1).toBe(storedManager);
    expect(manager2).toBe(storedManager);
    expect(manager1).toBe(manager2);
  });
});
