import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/ts-mcp-client';

// Mock the ts-mcp-client module
const mockTSMCPSessionManager = {
  initializeSession: vi.fn().mockResolvedValue({
    id: 'test-session-id',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'assistant', content: 'I am ready to help.' },
    ],
    mcpClient: {
      configure: vi.fn(),
      discoverCapabilities: vi.fn(),
    },
  }),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(),
  getSession: vi.fn(),
  cleanupSession: vi.fn(),
  updateSessionActivity: vi.fn(),
};

vi.mock('@rinardnick/ts-mcp-client', () => {
  return {
    SessionManager: vi.fn().mockImplementation(() => mockTSMCPSessionManager),
  };
});

describe('Memory Leak Detection', () => {
  let sessionManager: SessionManager;
  let llmConfig: LLMConfig;
  let mockServers: ServerConfig;
  let mockCapabilities: any;

  beforeEach(() => {
    vi.clearAllMocks();
    global.gc && global.gc(); // Force garbage collection if available

    llmConfig = {
      type: 'test-type',
      model: 'test-model',
      api_key: 'test-key',
      system_prompt: 'You are a helpful assistant.',
    };
    mockServers = {
      command: 'test-command',
      args: ['--test'],
      env: { TEST_ENV: 'test' },
    };
    mockCapabilities = {
      tools: [
        {
          name: 'readFile',
          description: 'Reads a file from the filesystem',
        },
        {
          name: 'writeFile',
          description: 'Writes content to a file',
        },
      ],
    };
  });

  it('should properly clean up session resources on explicit end', async () => {
    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    // Get initial memory usage
    const initialMemory = process.memoryUsage();

    // Simulate heavy session usage
    for (let i = 0; i < 100; i++) {
      await sessionManager.sendMessage(session.id, `test message ${i}`);
    }

    // Clean up session
    await sessionManager.cleanupSession(session.id);

    // Force garbage collection if available
    global.gc && global.gc();

    // Get final memory usage
    const finalMemory = process.memoryUsage();

    // Verify cleanup was called
    expect(mockTSMCPSessionManager.cleanupSession).toHaveBeenCalledWith(
      session.id
    );

    // Verify UI state is cleaned up
    expect(sessionManager.getUIState(session.id)).toBeUndefined();

    // Check memory usage (allowing for some overhead)
    const heapDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(heapDiff).toBeLessThan(1024 * 1024); // Less than 1MB difference
  });

  it('should not leak memory when handling multiple sessions', async () => {
    sessionManager = new SessionManager();
    const initialMemory = process.memoryUsage();

    // Create and use multiple sessions
    for (let i = 0; i < 10; i++) {
      const session = await sessionManager.initializeSession(llmConfig);
      await sessionManager.sendMessage(session.id, 'test message');
      await sessionManager.cleanupSession(session.id);
    }

    // Force garbage collection
    global.gc && global.gc();

    const finalMemory = process.memoryUsage();
    const heapDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(heapDiff).toBeLessThan(1024 * 1024); // Less than 1MB difference
  });

  it('should clean up resources when session errors occur', async () => {
    sessionManager = new SessionManager();
    const initialMemory = process.memoryUsage();

    // Mock an error in session initialization
    mockTSMCPSessionManager.initializeSession.mockRejectedValueOnce(
      new Error('Session initialization failed')
    );

    try {
      await sessionManager.initializeSession(llmConfig);
    } catch (error) {
      // Expected error
    }

    // Force garbage collection
    global.gc && global.gc();

    const finalMemory = process.memoryUsage();
    const heapDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(heapDiff).toBeLessThan(1024 * 1024); // Less than 1MB difference
  });

  it('should not leak memory during streaming operations', async () => {
    sessionManager = new SessionManager();
    const session = await sessionManager.initializeSession(llmConfig);

    const initialMemory = process.memoryUsage();

    // Simulate streaming operations
    mockTSMCPSessionManager.sendMessageStream.mockImplementation(
      async function* () {
        for (let i = 0; i < 100; i++) {
          yield { type: 'content', content: `chunk ${i}` };
        }
      }
    );

    // Process stream
    for await (const _ of sessionManager.sendMessageStream(
      session.id,
      'test'
    )) {
      // Consume stream
    }

    await sessionManager.cleanupSession(session.id);

    // Force garbage collection
    global.gc && global.gc();

    const finalMemory = process.memoryUsage();
    const heapDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    expect(heapDiff).toBeLessThan(1024 * 1024); // Less than 1MB difference
  });
});
