# Claude Chat Interface Implementation Plan

This document outlines the step-by-step process to implement a Claude-like chat interface with tool use and streaming capabilities using the `@rinardnick/client_mcp` package.

## Overview

We'll create a modern, responsive chat interface that mimics Claude's UI, with support for:

- Streaming responses
- Tool execution visualization
- "Thinking" display (for Claude 3.7)
- Message history
- Error handling

The implementation will use Next.js with:

- React for the frontend
- Tailwind CSS for styling
- Server components for backend functionality
- client_mcp for LLM connection and tool management

## System Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│                 │       │                 │       │                 │
│  React Frontend │◄─────►│  Next.js API    │◄─────►│  client_mcp     │
│  (Chat UI)      │       │  (Routes)       │       │  (Session Mgr)  │
│                 │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │                 │
                                                  │  MCP Servers    │
                                                  │  (Tools)        │
                                                  │                 │
                                                  └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │                 │
                                                  │  Claude API     │
                                                  │  (LLM)          │
                                                  │                 │
                                                  └─────────────────┘
```

## Implementation Steps

### Phase 1: Setup and Configuration

1. **Configure client_mcp**

   - [x] Create/update config.json with appropriate settings
   - [x] Set up server configurations for tools
   - [x] Configure LLM settings with thinking enabled

2. **Prepare API Routes**
   - [x] Create basic route structure for chat API
   - [ ] Implement session management with persistent sessions
   - [ ] Add proper error handling and logging

### Phase 2: Streaming Implementation

3. **Implement Streaming API**

   - [ ] Create a streaming endpoint at `/api/chat/stream`
   - [ ] Implement correct headers for Server-Sent Events
   - [ ] Configure streaming with client_mcp's sendMessageStream
   - [ ] Handle different chunk types (content, thinking, tool_start, tool_result)
   - [ ] Add error handling and reconnection logic

4. **Test Streaming Endpoint**
   - [ ] Verify streaming works with curl or Postman
   - [ ] Ensure all chunk types are properly emitted
   - [ ] Test error handling and recovery

### Phase 3: Frontend Development

5. **Basic Chat UI Components**

   - [ ] Create a ChatContainer component
   - [ ] Implement MessageList component
   - [ ] Create MessageInput component with send button
   - [ ] Add basic styling with Tailwind CSS

6. **Enhanced Message Display**

   - [ ] Implement user message display
   - [ ] Create assistant message component with markdown support
   - [ ] Add thinking display with subtle animation
   - [ ] Implement tool call visualization
   - [ ] Add tool result display

7. **Frontend-Backend Integration**
   - [ ] Connect MessageInput to streaming API
   - [ ] Implement EventSource for streaming
   - [ ] Handle chunk parsing and message assembly
   - [ ] Add loading states and indicators

### Phase 4: Advanced Features

8. **Enhanced Tool Use Visualization**

   - [ ] Add expandable/collapsible tool calls
   - [ ] Implement syntax highlighting for code in tool results
   - [ ] Create visual indicators for tool execution status

9. **Session Management**

   - [ ] Implement local storage for conversation persistence
   - [ ] Add session creation and selection UI
   - [ ] Create session reset functionality

10. **Error Handling and Retry Logic**
    - [ ] Implement error display in UI
    - [ ] Add retry mechanism for failed messages
    - [ ] Create reconnection logic for dropped streams

### Phase 5: Polishing and Optimization

11. **UI/UX Improvements**

    - [ ] Add responsive design for mobile devices
    - [ ] Implement dark/light mode toggle
    - [ ] Add keyboard shortcuts (Cmd/Ctrl + Enter to send)
    - [ ] Implement auto-scroll with ability to pause

12. **Performance Optimization**
    - [ ] Implement message virtualization for long conversations
    - [ ] Add lazy loading for message history
    - [ ] Optimize markdown rendering
    - [ ] Implement debouncing for user input

## Detailed Technical Implementation

### 1. Streaming API Implementation

```typescript
// app/api/chat/stream/route.ts
import { NextRequest } from 'next/server';
import { SessionManager } from '@rinardnick/client_mcp';
import { getSessionManager } from '@/app/lib/sessionManager';

export async function POST(request: NextRequest) {
  // Set headers for Server-Sent Events
  const encoder = new TextEncoder();
  const customHeaders = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: string) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
  };

  // Process the request in the background
  (async () => {
    try {
      const { message, sessionId = 'default' } = await request.json();

      if (!message) {
        await sendEvent(
          'error',
          JSON.stringify({ error: 'No message provided' })
        );
        await writer.close();
        return;
      }

      const sessionManager = await getSessionManager();

      // Get stream from client_mcp
      const mcpStream = sessionManager.sendMessageStream(sessionId, message);

      // Process the stream chunks
      for await (const chunk of mcpStream) {
        switch (chunk.type) {
          case 'thinking':
            await sendEvent(
              'thinking',
              JSON.stringify({ content: chunk.content })
            );
            break;
          case 'tool_start':
            await sendEvent(
              'tool_start',
              JSON.stringify({
                toolName: chunk.tool.name,
                toolInput: chunk.tool.parameters,
              })
            );
            break;
          case 'tool_result':
            await sendEvent(
              'tool_result',
              JSON.stringify({
                toolName: chunk.tool.name,
                result: chunk.result,
              })
            );
            break;
          case 'content':
            await sendEvent(
              'content',
              JSON.stringify({ content: chunk.content })
            );
            break;
          case 'error':
            await sendEvent('error', JSON.stringify({ error: chunk.error }));
            break;
          case 'done':
            await sendEvent('done', JSON.stringify({}));
            break;
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await sendEvent('error', JSON.stringify({ error: errorMessage }));
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, { headers: customHeaders });
}
```

### 2. React Components

#### Session Manager Singleton

```typescript
// app/lib/sessionManager.ts
import { SessionManager } from '@rinardnick/client_mcp';
import { loadConfig, getDefaultConfigPath } from './configLoader';

let sessionManager: SessionManager | undefined;

export async function getSessionManager(): Promise<SessionManager> {
  if (!sessionManager) {
    sessionManager = await (async () => {
      try {
        const configPath = await getDefaultConfigPath();
        const fullConfig = await loadConfig(configPath);

        const manager = new SessionManager({
          useSharedServers: true,
        });

        // Initialize a default session
        await manager.initializeSession(fullConfig.llm);

        return manager;
      } catch (error) {
        console.error('Failed to initialize session manager:', error);
        throw error;
      }
    })();
  }

  return sessionManager;
}
```

#### Chat Container Component

```typescript
// app/components/ChatContainer.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: any[];
  toolResults?: any[];
  error?: string;
  status: 'complete' | 'streaming' | 'error';
}

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    // Add user message
    const messageId = Date.now().toString();
    const userMessage: Message = {
      id: messageId,
      role: 'user',
      content,
      status: 'complete',
    };

    setMessages(prevMessages => [...prevMessages, userMessage]);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: `${messageId}-response`,
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    setMessages(prevMessages => [...prevMessages, assistantMessage]);
    setIsStreaming(true);

    // Start streaming
    startStreaming(content, assistantMessage.id);
  };

  const startStreaming = (message: string, responseId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new connection
    const eventSource = new EventSource(
      `/api/chat/stream?message=${encodeURIComponent(message)}`
    );
    eventSourceRef.current = eventSource;

    // Define event handlers
    eventSource.addEventListener('thinking', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        thinking: (prev.thinking || '') + data.content,
      }));
    });

    eventSource.addEventListener('tool_start', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        toolCalls: [...(prev.toolCalls || []), data],
      }));
    });

    eventSource.addEventListener('tool_result', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        toolResults: [...(prev.toolResults || []), data],
      }));
    });

    eventSource.addEventListener('content', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        content: (prev.content || '') + data.content,
      }));
    });

    eventSource.addEventListener('error', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        error: data.error,
        status: 'error',
      }));
      eventSource.close();
      setIsStreaming(false);
    });

    eventSource.addEventListener('done', () => {
      updateMessage(responseId, prev => ({
        ...prev,
        status: 'complete',
      }));
      eventSource.close();
      setIsStreaming(false);
    });
  };

  const updateMessage = (id: string, updateFn: (prev: Message) => Message) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => (msg.id === id ? updateFn(msg) : msg))
    );
  };

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={messages} />
      <MessageInput onSendMessage={sendMessage} disabled={isStreaming} />
    </div>
  );
}
```

#### Message Components

```typescript
// app/components/MessageList.tsx
import { useEffect, useRef } from 'react';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';

export default function MessageList({ messages }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(message => (
        <div key={message.id}>
          {message.role === 'user' ? (
            <UserMessage content={message.content} />
          ) : (
            <AssistantMessage
              content={message.content}
              thinking={message.thinking}
              toolCalls={message.toolCalls}
              toolResults={message.toolResults}
              error={message.error}
              status={message.status}
            />
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

### 3. Testing and Validation

For each phase, implement simple tests to validate:

1. **API Tests**

   - Use Postman or curl to test all endpoints
   - Verify proper error handling
   - Check streaming functionality

2. **UI Tests**

   - Validate rendering of different message types
   - Test tool visualization
   - Ensure proper streaming display

3. **Integration Tests**
   - End-to-end testing of sending messages and receiving responses
   - Validate tool execution flow
   - Test error handling and recovery

## Conclusion

This implementation plan provides a comprehensive roadmap for building a Claude-like chat interface with the client_mcp package, focusing on small, testable steps. The end result will be a modern, responsive UI that seamlessly handles streaming responses, tool usage, and error conditions while leveraging the capabilities of the client_mcp library for session management and LLM interaction.
