'use client';

import { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import SessionControls from './SessionControls';
import { getActiveSessionId } from '../lib/sessionManager';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    toolName: string;
    toolInput: Record<string, any>;
    toolId?: string;
  }>;
  toolResults?: Array<{
    toolName: string;
    result: any;
    toolId?: string;
  }>;
  error?: string;
  status: 'complete' | 'streaming' | 'error';
}

// Key for storing messages in localStorage
const MESSAGES_STORAGE_PREFIX = 'claude_chat_messages_';

export default function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load messages for the active session
  useEffect(() => {
    const loadMessages = () => {
      const currentSessionId = getActiveSessionId();
      setActiveSessionId(currentSessionId);
      
      if (currentSessionId) {
        const storedMessages = localStorage.getItem(
          `${MESSAGES_STORAGE_PREFIX}${currentSessionId}`
        );
        
        if (storedMessages) {
          try {
            const parsedMessages = JSON.parse(storedMessages) as Message[];
            setMessages(parsedMessages);
          } catch (error) {
            console.error('Failed to parse stored messages:', error);
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    };

    loadMessages();

    // Listen for storage events (changes from other tabs)
    const handleStorageChange = (event: StorageEvent) => {
      const currentSessionId = getActiveSessionId();
      
      if (
        currentSessionId && 
        event.key === `${MESSAGES_STORAGE_PREFIX}${currentSessionId}`
      ) {
        loadMessages();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      localStorage.setItem(
        `${MESSAGES_STORAGE_PREFIX}${activeSessionId}`,
        JSON.stringify(messages)
      );
    }
  }, [messages, activeSessionId]);

  const handleSessionChange = () => {
    // Get the new active session ID
    const newSessionId = getActiveSessionId();
    setActiveSessionId(newSessionId);
    
    // Load messages for the new session
    if (newSessionId) {
      const storedMessages = localStorage.getItem(
        `${MESSAGES_STORAGE_PREFIX}${newSessionId}`
      );
      
      if (storedMessages) {
        try {
          const parsedMessages = JSON.parse(storedMessages) as Message[];
          setMessages(parsedMessages);
        } catch (error) {
          console.error('Failed to parse stored messages:', error);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming || !activeSessionId) return;

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
    startStreaming(content, assistantMessage.id, activeSessionId);
  };

  const startStreaming = (message: string, responseId: string, sessionId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new connection with session ID
    const eventSource = new EventSource(
      `/api/chat/stream?message=${encodeURIComponent(message)}&sessionId=${sessionId}`
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
          toolInput: data.toolInput,
          toolId: data.toolId,
        }],
      }));
    });

    eventSource.addEventListener('tool_result', event => {
      const data = JSON.parse(event.data);
      updateMessage(responseId, prev => ({
        ...prev,
        toolResults: [...(prev.toolResults || []), {
          toolName: data.toolName,
          result: data.result,
          toolId: data.toolId,
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

    // Handle errors from the server side
    eventSource.addEventListener('error', event => {
      try {
        // Try to parse the error data from the event
        if (event.data) {
          const data = JSON.parse(event.data);
          updateMessage(responseId, prev => ({
            ...prev,
            error: data.error,
            status: 'error',
          }));
        } else {
          // Handle connection errors
          updateMessage(responseId, prev => ({
            ...prev,
            error: 'Connection error occurred',
            status: 'error',
          }));
        }
      } catch (err) {
        // Handle connection errors or parsing errors
        updateMessage(responseId, prev => ({
          ...prev,
          error: 'Connection error occurred',
          status: 'error',
        }));
      }
      
      eventSource.close();
      setIsStreaming(false);
    });
    
    // Handle general EventSource errors (connection issues)
    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      updateMessage(responseId, prev => ({
        ...prev,
        error: 'Connection to server lost. Please try again.',
        status: 'error',
      }));
      
      eventSource.close();
      setIsStreaming(false);
    };

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

  // Clear messages for the current session
  const clearMessages = () => {
    if (!activeSessionId) return;
    
    if (window.confirm('Are you sure you want to clear all messages in this session?')) {
      setMessages([]);
      localStorage.removeItem(`${MESSAGES_STORAGE_PREFIX}${activeSessionId}`);
    }
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
      <div className="flex items-center justify-between p-2 border-b dark:border-gray-700">
        <SessionControls onActiveSessionChange={handleSessionChange} />
        
        <button
          className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-sm px-3 py-1 rounded-md ml-2"
          onClick={clearMessages}
          disabled={!activeSessionId || messages.length === 0}
        >
          Clear Chat
        </button>
      </div>
      
      <MessageList messages={messages} />
      
      <MessageInput 
        onSendMessage={sendMessage} 
        disabled={isStreaming || !activeSessionId} 
      />
    </div>
  );
}