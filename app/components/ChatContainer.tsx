'use client';

import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    toolName: string;
    toolInput: Record<string, any>;
  }>;
  toolResults?: Array<{
    toolName: string;
    result: any;
  }>;
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
      `/api/chat/stream?message=${encodeURIComponent(message)}&sessionId=default`
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
        toolCalls: [...(prev.toolCalls || []), {
          toolName: data.toolName,
          toolInput: data.toolInput
        }],
      }));
    });

    eventSource.addEventListener('tool_result', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        toolResults: [...(prev.toolResults || []), {
          toolName: data.toolName,
          result: data.result
        }],
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
      try {
        const data = JSON.parse(event.data);
        updateMessage(responseId, prev => ({
          ...prev,
          error: data.error,
          status: 'error',
        }));
      } catch (err) {
        // Handle connection errors
        updateMessage(responseId, prev => ({
          ...prev,
          error: 'Connection error occurred',
          status: 'error',
        }));
      }
      
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
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <MessageInput onSendMessage={sendMessage} disabled={isStreaming} />
    </div>
  );
}