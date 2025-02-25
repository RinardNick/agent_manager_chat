# MCP Tool Integration Debugging Guide

## Current Status

We've identified that the Model Context Protocol (MCP) tool discovery has issues with the existing implementation. The specific error encountered is:

```
MCP error -32601: Method not found
```

This error indicates that the client is trying to call methods like `listTools` and `listResources` on the MCP server, but those methods are not implemented or not exposed correctly by the server.

## Attempted Solutions

1. **Direct Tool Attachment**: We've implemented a solution that directly attaches tools to the session object, bypassing the need for MCP server discovery.

2. **Tool Formatting**: We've added proper tool formatting for the Anthropic Claude model.

3. **Flexible API Options**: We've modified the API to support passing options directly to the Anthropic API call.

## Current Behavior

Despite these improvements, the model still does not actually execute tool calls. It recognizes the tool existence (mentioning tools like `list_files` in responses) but doesn't invoke them. This suggests that:

1. The tool definitions might not be properly formatted for the Claude API
2. The tool execution flow may require additional server-side handling
3. There might be a mismatch between the model's expectations and the provided tool schema

## Next Steps

To completely resolve this issue, we recommend:

1. **Review MCP Server Implementation**:

   - Check the implementation of the MCP servers in the `@rinardnick/client_mcp` package
   - Verify that methods like `listTools` and `listResources` are correctly exposed

2. **Check MCP Protocol Compatibility**:

   - Ensure the MCP client and server versions are compatible
   - Review if any API changes have occurred in recent updates

3. **Try Simplified Direct Implementation**:

   - Consider bypassing the MCP integration completely
   - Implement direct Anthropic API calls with tool definitions
   - Handle tool execution manually

4. **Debug Tool Execution Flow**:
   - Add detailed logging of each step in the tool execution process
   - Verify how tools are registered, discovered, and executed

## Additional Insights

The LLM seems to be aware of the tools but may not have permission or capability to execute them. This could be due to:

1. **Security Restrictions**: The model might be prevented from executing these tools
2. **Missing Execution Handler**: There might be a missing component that handles the execution of tools when the model calls them
3. **Incorrect Tool Schema**: The tool schema might not match what the Anthropic API expects

## Recommended Configuration

For a simplified approach, consider this pattern:

```javascript
// Direct tool configuration
const tools = [
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory',
        },
      },
      required: ['path'],
    },
  },
];

// Format for Anthropic API
const anthropicTools = {
  type: 'tools',
  tools: tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  })),
};

// API call
const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000,
  messages: [
    { role: 'user', content: 'List the files in the current directory' },
  ],
  tools: anthropicTools,
});
```

## References

- [MCP Protocol Specification](https://github.com/model-context-protocol/protocol)
- [Anthropic Claude Tool Usage](https://docs.anthropic.com/claude/docs/tools-api)
- [Error Code Reference](https://github.com/model-context-protocol/protocol/blob/main/spec/errors.md)
