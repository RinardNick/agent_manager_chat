import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager';
import {
  LLMConfig,
  ServerConfig,
  SessionManager as TSMCPSessionManager,
} from '@rinardnick/client_mcp';

// Mock the client_mcp module
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

vi.mock('@rinardnick/client_mcp', () => {
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

  it('should properly clean up UI state on explicit end', async () => {
    const sessionManager = new SessionManager();

    // Initialize session and UI state
    const session = await sessionManager.initializeSession({
      type: 'test',
      api_key: 'test-key',
      system_prompt: 'You are a test assistant',
      model: 'test-model',
    });

    // Simulate some message sending
    await sessionManager.sendMessage(session.id, 'test message');

    // Get initial memory usage
    const initialMemoryUsage = process.memoryUsage().heapUsed;

    // Clean up UI state
    await sessionManager.cleanupSession(session.id);

    // Verify UI state is cleaned up
    expect(sessionManager.getUIState(session.id)).toBeNull();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Check memory usage after cleanup and GC
    const finalMemoryUsage = process.memoryUsage().heapUsed;
    // Allow for some memory overhead from test infrastructure
    expect(finalMemoryUsage).toBeLessThanOrEqual(
      initialMemoryUsage + 1024 * 1024
    ); // Allow 1MB overhead
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
    const stream = await sessionManager.sendMessageStream(session.id, 'test');

    for await (const _ of stream) {
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
