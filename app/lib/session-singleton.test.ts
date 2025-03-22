/**
 * @jest-environment node
 */
import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  getMCPSessionManager,
  initializeNewMCPSession,
} from './serverSessionManager';

// Disable automatic mocks
vi.hoisted(() => {
  vi.stubGlobal('mcpSessionManager', undefined);
  vi.stubGlobal('isInitializingSessionManager', undefined);
  vi.stubGlobal('isInitializingSession', undefined);
  vi.stubGlobal('lastInitializedSessionId', undefined);
});

// Mock the SessionManager from client_mcp
vi.mock('@rinardnick/client_mcp', () => {
  const mockSession = {
    id: 'mock-session-id',
  };

  const mockSessionManager = {
    initializeSession: vi.fn().mockResolvedValue(mockSession),
    getSession: vi.fn(),
  };

  return {
    SessionManager: vi.fn().mockImplementation(() => mockSessionManager),
  };
});

// Mock the config loader
vi.mock('./configLoader', () => {
  return {
    getDefaultConfigPath: vi.fn().mockResolvedValue('/mock/path/config.json'),
    loadConfig: vi.fn().mockResolvedValue({
      llm: {
        type: 'anthropic',
        api_key: 'mock-api-key',
        model: 'mock-model',
        system_prompt: 'mock-system-prompt',
      },
      servers: {
        filesystem: {
          command: 'mock-command',
          args: ['mock-arg'],
        },
      },
    }),
  };
});

describe('Session Manager Singleton Tests', () => {
  beforeEach(() => {
    // Reset global objects before each test
    if (global.mcpSessionManager) {
      delete global.mcpSessionManager;
    }
    if (global.isInitializingSessionManager) {
      delete global.isInitializingSessionManager;
    }
    if (global.isInitializingSession) {
      delete global.isInitializingSession;
    }
    if (global.lastInitializedSessionId) {
      delete global.lastInitializedSessionId;
    }

    // Clear mocks
    vi.clearAllMocks();

    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  test('getMCPSessionManager returns the same instance on multiple calls', async () => {
    const manager1 = await getMCPSessionManager();
    const manager2 = await getMCPSessionManager();

    expect(manager1).toBe(manager2);
  });

  test('concurrent getMCPSessionManager calls create only one instance', async () => {
    // Create multiple promises at the same time before any resolve
    const managerPromises = [
      getMCPSessionManager(),
      getMCPSessionManager(),
      getMCPSessionManager(),
    ];

    const managers = await Promise.all(managerPromises);

    // All should be the same instance
    expect(managers[0]).toBe(managers[1]);
    expect(managers[1]).toBe(managers[2]);

    // SessionManager constructor should be called only once
    const { SessionManager } = await import('@rinardnick/client_mcp');
    expect(SessionManager).toHaveBeenCalledTimes(1);
  });

  test('concurrent initializeNewMCPSession calls use the same session ID', async () => {
    // Create multiple session promises
    const sessionPromises = [
      initializeNewMCPSession(),
      initializeNewMCPSession(),
      initializeNewMCPSession(),
    ];

    const sessionIds = await Promise.all(sessionPromises);

    // All session IDs should be identical
    expect(sessionIds[0]).toBe(sessionIds[1]);
    expect(sessionIds[1]).toBe(sessionIds[2]);

    // The test environment should return the same ID for all calls
    expect(sessionIds[0]).toBe('mock-session-id');
  });
});
