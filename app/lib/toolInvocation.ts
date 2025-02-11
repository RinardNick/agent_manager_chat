interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  role: string;
  content: string;
}

export class ToolInvocationManager {
  private toolCallCount: number = 0;
  private readonly maxToolCalls: number;

  constructor(maxToolCalls: number = 10) {
    this.maxToolCalls = maxToolCalls;
  }

  public detectToolCall(llmResponse: string): ToolCall | null {
    const match = llmResponse.match(/<tool_call>\s*([\s\S]+?)\s*<\/tool_call>/);
    if (!match) return null;

    try {
      const jsonStr = match[1].trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse tool call:', error);
      return null;
    }
  }

  public prepareRequest(toolCall: ToolCall): RequestInit {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolCall.name,
        arguments: toolCall.args,
      }),
    };
  }

  public async invokeToolOnServer(
    serverUrl: string,
    toolCall: ToolCall
  ): Promise<any> {
    try {
      // Check if we've reached the tool call limit
      if (this.toolCallCount >= this.maxToolCalls) {
        console.log('Tool call limit reached');
        throw new Error('Tool call limit reached');
      }

      console.log('Tool invocation:', {
        tool: toolCall.name,
        arguments: toolCall.args,
      });

      const response = await fetch(
        `${serverUrl}/tools/invoke`,
        this.prepareRequest(toolCall)
      );

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      this.toolCallCount++;

      return await response.json();
    } catch (error) {
      throw new Error(
        `Tool invocation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public integrateToolOutput(
    conversation: Message[],
    toolOutput: { content: string }
  ): Message[] {
    return [
      ...conversation,
      {
        role: 'tool',
        content: toolOutput.content,
      },
    ];
  }

  public getToolCallCount(): number {
    return this.toolCallCount;
  }

  public getFinalMessage(): Message {
    return {
      role: 'assistant',
      content:
        'I have reached the tool call limit. I can only use tools a limited number of times per session.',
    };
  }
}
