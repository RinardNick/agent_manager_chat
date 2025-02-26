# Chat Application with MCP Integration

This project implements a chat application that uses the Model Context Protocol (MCP) to provide AI assistant capabilities with tool integration.

## Implementation Details

The application properly integrates with MCP servers for tool discovery and execution:

- **MCP Client Integration**: Uses the @rinardnick/client_mcp package to connect to MCP servers
- **Tool Discovery**: Automatically discovers available tools from configured MCP servers
- **Tool Execution**: Routes tool calls through MCP servers rather than using built-in tools

### Chat Interface

The application provides a modern chat interface with real-time streaming responses:

- **API Endpoint**: `/api/chat/session`
- **Components**:
  - `Chat.tsx` - A React component that provides the UI for the chat
  - Uses SSE (Server-Sent Events) to stream responses from the AI

### Navigation

A simple navigation component is included for the main interface:

- **Component**: `Nav.tsx` - A React component that provides navigation links
- **Layout**: The navigation component is included in `app/layout.tsx`

## Configuration

The application uses a configuration file located at `.mcp/config.json` that defines:

1. LLM settings (model, API key, system prompt)
2. MCP server configurations
3. Other application settings

Example configuration:
```json
{
  "llm": {
    "type": "claude",
    "model": "claude-3-5-sonnet-20241022",
    "api_key": "YOUR_API_KEY",
    "system_prompt": "You are a helpful assistant."
  },
  "max_tool_calls": 10,
  "servers": {
    "filesystem": { 
      "command": "npx", 
      "args": ["@modelcontextprotocol/server-filesystem"], 
      "env": {} 
    },
    "terminal": { 
      "command": "npx", 
      "args": ["@modelcontextprotocol/server-terminal"], 
      "env": {} 
    }
  }
}
```

## Getting Started

To run the application:

```bash
npm install
npm run dev
```

The application will be available at http://localhost:3000

## Testing

You can test the chat functionality using curl:

```bash
# Create a new session
curl -X POST http://localhost:3000/api/chat/session

# Send a message (replace SESSION_ID with the actual session ID)
curl -X POST -H "Content-Type: application/json" -d '{"message":"Hello, what can you help me with?"}' http://localhost:3000/api/chat/session/SESSION_ID/message
```
