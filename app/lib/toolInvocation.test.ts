import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ToolInvocationManager } from './toolInvocation';

describe('Tool Invocation', () => {
  let toolManager: ToolInvocationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    toolManager = new ToolInvocationManager(2); // Set max_tool_calls to 2
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

  // New tests for tool invocation limiting
  it('should track and limit tool invocations', async () => {
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'file contents' }),
    });

    // First invocation should succeed
    await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);
    expect(toolManager.getToolCallCount()).toBe(1);

    // Second invocation should succeed
    await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);
    expect(toolManager.getToolCallCount()).toBe(2);

    // Third invocation should fail
    await expect(
      toolManager.invokeToolOnServer('http://localhost:3001', toolCall)
    ).rejects.toThrow('Tool call limit reached');
  });

  it('should provide a final message when tool limit is reached', () => {
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    const conversation = [
      { role: 'user', content: 'Please read the file' },
      { role: 'assistant', content: 'I will read the file for you.' },
    ];

    // Simulate reaching the tool call limit
    toolManager.invokeToolOnServer('http://localhost:3001', toolCall);
    toolManager.invokeToolOnServer('http://localhost:3001', toolCall);

    const finalMessage = toolManager.getFinalMessage();
    expect(finalMessage).toBeDefined();
    expect(finalMessage.role).toBe('assistant');
    expect(finalMessage.content).toContain('tool call limit');
  });

  it('should log when tool limit is reached', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const toolCall = {
      name: 'readFile',
      args: { path: '/path/to/file' },
    };

    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'file contents' }),
    });

    // First two invocations
    await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);
    await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);

    // Third invocation should fail
    try {
      await toolManager.invokeToolOnServer('http://localhost:3001', toolCall);
    } catch (error) {
      // Expected error
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tool call limit reached')
    );
  });
});
