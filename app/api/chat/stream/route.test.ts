import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from './route';
import { SessionManager } from '@rinardnick/client_mcp';

// Mock client_mcp
vi.mock('@rinardnick/client_mcp', () => {
  const mockSendMessageStream = async function* () {
    yield { type: 'thinking', content: 'Thinking...' };
    yield { type: 'content', content: 'Hello, this is a test response!' };
    yield { 
      type: 'tool_start', 
      tool: { 
        name: 'testTool', 
        parameters: { param1: 'value1' } 
      } 
    };
    yield { 
      type: 'tool_result', 
      tool: { 
        name: 'testTool'
      },
      result: 'Test result'
    };
    yield { type: 'done' };
  };

  // Mock session manager
  const mockSessionManager = {
    // Return a mock session object with an ID when initializing, matching the actual behavior
    initializeSession: vi.fn().mockResolvedValue({
      id: 'mock-session-id',
      config: {},
      messages: [],
      // Other session properties as needed
    }),
    sendMessageStream: vi.fn().mockImplementation(() => mockSendMessageStream())
  };

  return {
    SessionManager: vi.fn().mockImplementation(() => mockSessionManager)
  };
});

// Mock the configLoader
vi.mock('../../../lib/configLoader', () => ({
  getDefaultConfigPath: vi.fn().mockResolvedValue('/path/to/config.json'),
  loadConfig: vi.fn().mockResolvedValue({
    llm: {
      type: 'claude',
      model: 'test-model',
      api_key: 'test-key',
      system_prompt: 'test-prompt'
    },
    servers: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/test']
      },
      terminal: {
        command: 'npx',
        args: ['@rinardnick/mcp-terminal', '--allowed-commands', '[ls,pwd]']
      }
    },
    max_tool_calls: 5
  })
}));

describe('POST /api/chat/stream', () => {
  let chunks: any[] = [];
  let res: Response;

  // Helper function to capture SSE events
  async function readAllChunks(response: Response) {
    chunks = [];
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      
      // Split by double newline (SSE message boundary)
      const events = chunk.split('\n\n').filter(Boolean);
      
      for (const event of events) {
        const lines = event.split('\n');
        const eventType = lines[0].replace('event: ', '');
        const data = lines[1].replace('data: ', '');
        
        chunks.push({ eventType, data: JSON.parse(data) });
      }
    }
  }

  beforeEach(async () => {
    chunks = [];
    
    // Create a mock request with a message
    const mockRequest = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Test message', sessionId: 'test-session' }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    res = await POST(mockRequest);
    expect(res.status).toBe(200);
    
    // Capture all events from the stream
    await readAllChunks(res);
  });

  it('returns a response with the correct headers for SSE', () => {
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams the correct event types in the expected order', async () => {
    expect(chunks.length).toBe(5);
    
    expect(chunks[0].eventType).toBe('thinking');
    expect(chunks[0].data.content).toBe('Thinking...');
    
    expect(chunks[1].eventType).toBe('content');
    expect(chunks[1].data.content).toBe('Hello, this is a test response!');
    
    expect(chunks[2].eventType).toBe('tool_start');
    expect(chunks[2].data.toolName).toBe('testTool');
    expect(chunks[2].data.toolInput).toEqual({ param1: 'value1' });
    
    expect(chunks[3].eventType).toBe('tool_result');
    expect(chunks[3].data.toolName).toBe('testTool');
    expect(chunks[3].data.result).toBe('Test result');
    
    expect(chunks[4].eventType).toBe('done');
  });

  it('handles missing message parameter', async () => {
    const mockRequest = new NextRequest('http://localhost/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    });
    
    const response = await POST(mockRequest);
    expect(response.status).toBe(200); // Still 200 because it's an SSE response
    
    await readAllChunks(response);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0].eventType).toBe('error');
    expect(chunks[0].data.error).toBe('No message provided');
  });
});