# Chat Application with MCP Bypass

This project implements a chat application with two interfaces:

1. **Original Chat Interface** - Uses the @rinardnick/client_mcp package for tool discovery and chat functionality
2. **Basic Chat Interface** - A simplified version that bypasses MCP tool discovery and provides core chat functionality

## Current Issues

The application currently faces an issue with MCP tool discovery:

- When attempting to discover tools using the MCP client, the application encounters a "Method not found" error:
  ```
  McpError: MCP error -32601: Method not found
  ```
- This error occurs when calling methods such as `client.listTools({})` and `client.listResources({})`

## Implementation Details

### Basic Chat Interface

We've implemented a simplified chat interface that doesn't rely on MCP for tool discovery:

- **API Endpoint**: `/api/chat/basic-session`
- **Components**:
  - `BasicChatDemo.tsx` - A React component that provides the UI for the basic chat
  - `app/basic-chat/page.tsx` - A page that hosts the basic chat demo

### Original Chat Interface

The original chat interface has been modified to default to skipping MCP initialization:

- The `skipMcp` variable in `app/api/chat/[[...params]]/route.ts` defaults to `true`
- Users can still opt to use MCP by explicitly setting `use_mcp: true` in the request body

### Navigation

A navigation component has been added to allow users to switch between the different chat interfaces:

- **Component**: `Nav.tsx` - A React component that provides navigation links
- **Layout**: The navigation component is included in `app/layout.tsx`

## Getting Started

To run the application:

```bash
npm install
npm run dev
```

The application will be available at http://localhost:3000

## Possible Solutions for MCP Issues

To resolve the MCP tool discovery issue, consider:

1. Updating the @rinardnick/client_mcp package to the latest version
2. Checking if the server implementation is compatible with the MCP protocol
3. Ensuring the correct servers are configured in the config.json file
4. Verifying that server commands are accessible and executable in the current environment
5. Implementing a custom tool discovery mechanism if needed

## Testing

You can test the basic chat functionality using curl:

```bash
# Create a new session
curl -X POST http://localhost:3000/api/chat/basic-session

# Send a message (replace SESSION_ID with the actual session ID)
curl -X PUT -H "Content-Type: application/json" -d '{"sessionId":"SESSION_ID","message":"Hello, what can you help me with?"}' http://localhost:3000/api/chat/basic-session
```
