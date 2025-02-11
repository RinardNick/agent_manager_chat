import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ToolInvocationManager } from './toolInvocation';

describe('Tool Invocation', () => {
  let toolManager: ToolInvocationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    toolManager = new ToolInvocationManager();
    global.fetch = vi.fn();
  });

  it('should detect tool invocation in LLM response', () => {
    const llmResponse = `Let me help you with that. I'll need to read the file.
    <tool_call>
      {"name": "readFile", "args": {"path": "/path/to/file"}}
    </tool_call>`;

    const result = toolManager.detectToolCall(llmResponse);
    expect(result).toBeDefined();
    expect(result?.name).toBe('readFile');
    expect(result?.args).toEqual({ path: '/path/to/file' });
  });

  it('should prepare tool invocation request according to MCP protocol', () => {
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    const request = toolManager.prepareRequest(toolCall);
    expect(request).toEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'readFile',
        arguments: { path: '/path/to/file' },
      }),
    });
  });

  it('should send tool request to appropriate server and receive response', async () => {
    const mockResponse = { content: 'file contents' };
    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    const response = await toolManager.invokeToolOnServer(
      'http://localhost:3001',
      toolCall
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/tools/invoke',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      })
    );
    expect(response).toEqual(mockResponse);
  });

  it('should log tool invocations', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    (global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ content: 'file contents' }),
    });

    await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tool invocation:'),
      expect.objectContaining({
        tool: 'readFile',
        arguments: { path: '/path/to/file' },
      })
    );
  });

  it('should integrate tool output into conversation', () => {
    const toolOutput = { content: 'file contents' };
    const conversation = [
      { role: 'user', content: 'Please read the file' },
      { role: 'assistant', content: 'I will read the file for you.' },
    ];

    const updatedConversation = toolManager.integrateToolOutput(
      conversation,
      toolOutput
    );

    expect(updatedConversation).toHaveLength(3);
    expect(updatedConversation[2]).toEqual({
      role: 'tool',
      content: 'file contents',
    });
  });

  it('should handle tool invocation errors gracefully', async () => {
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    (global.fetch as Mock).mockRejectedValueOnce(
      new Error('Failed to invoke tool')
    );

    await expect(
      toolManager.invokeToolOnServer('http://localhost:3001', toolCall)
    ).rejects.toThrow('Tool invocation failed: Failed to invoke tool');
  });
});
