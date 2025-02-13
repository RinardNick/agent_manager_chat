# MCP Host Application

This is a Next.js application that demonstrates how to use the TypeScript MCP Client (`@rinardnick/ts-mcp-client`) to create an AI assistant with tool capabilities.

## Features

- **Configuration Management**: Load and validate MCP client configuration from a JSON file
- **Server Management**: Automatically launch and manage MCP tool servers
- **Chat Interface**: Stream-based chat interface with the AI assistant
- **Tool Integration**: Seamless integration of tool capabilities from MCP servers

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `config.json` file in the root directory with the following structure:

```json
{
  "llm": {
    "type": "claude",
    "model": "claude-3-sonnet-20240229",
    "apiKey": "YOUR_API_KEY_HERE",
    "systemPrompt": "You are a helpful assistant."
  },
  "max_tool_calls": 10,
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "YOUR_FILESYSTEM_WORK_DIR_HERE"
      ],
      "env": {}
    },
    "terminal": {
      "command": "npx",
      "args": [
        "@rinardnick/mcp-terminal",
        "--allowed-commands",
        "[go,python3,uv,npm,npx,git,ls,cd,touch,mv,pwd,mkdir]"
      ],
      "env": {}
    }
  }
}
```

### Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### Chat Session Management

- `POST /api/chat/session`

  - Create a new chat session
  - Body: `{ "config": LLMConfig }`
  - Returns: `{ "sessionId": string, "messages": Message[] }`

- `POST /api/chat/session/{sessionId}/message`

  - Send a message in an existing session
  - Body: `{ "message": string }`
  - Returns: Message response

- `GET /api/chat/session/{sessionId}/stream`
  - Stream messages in real-time
  - Query params: `message=string`
  - Returns: Server-sent events stream

## Error Handling

The application includes comprehensive error handling for:

- Configuration validation
- Server initialization
- Session management
- Message processing
- Tool invocation

All errors are logged and streamed back to the client with appropriate context.

## Architecture

The host application is built with:

- Next.js for the web framework
- `@rinardnick/ts-mcp-client` for MCP client functionality
- Server-sent events (SSE) for real-time message streaming
- Child process management for MCP tool servers

Key components:

- `SessionManager`: Manages chat sessions and tool invocations
- `ServerManager`: Handles MCP server lifecycle
- `ConfigLoader`: Loads and validates configuration

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
