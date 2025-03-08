import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { SessionManager } from '@rinardnick/client_mcp';
import {
  getMCPSessionManager,
  initializeNewMCPSession,
  getActiveSessionId,
  initializeSession,
} from './serverSessionManager';
import { loadConfig } from './configLoader';

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
