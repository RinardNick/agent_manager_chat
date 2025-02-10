'use client';

import { useState, useEffect, useRef } from 'react';
import { LLMConfig } from '@rinardnick/ts-mcp-client';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function Chat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat session
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError(
        'API key not found. Please set NEXT_PUBLIC_ANTHROPIC_API_KEY in your environment.'
      );
      return;
    }

    // Prevent duplicate initialization
    if (sessionId || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const config: LLMConfig = {
      type: process.env.NEXT_PUBLIC_LLM_TYPE || 'claude',
      api_key: apiKey,
      system_prompt:
        process.env.NEXT_PUBLIC_SYSTEM_PROMPT || 'You are a helpful assistant.',
      model: process.env.NEXT_PUBLIC_LLM_MODEL || 'claude-3-5-sonnet-20240620',
    };

    const initSession = async () => {
      try {
        const response = await fetch('/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to initialize chat session'
          );
        }

        const data = await response.json();
        console.log('Session initialized:', data);
        setSessionId(data.sessionId);
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to initialize chat session. Please try again.'
        );
      }
    };

    initSession();
  }, [sessionId]); // Add sessionId as dependency

  const sendMessage = async (message: string) => {
    if (!sessionId || !message.trim() || isLoading) return;

    setIsLoading(true);
    setInput('');
    setError(null);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    try {
      console.log('[CLIENT] Setting up EventSource connection');
      const eventSource = new EventSource(
        `/api/chat/session/${sessionId}/stream?message=${encodeURIComponent(
          message
        )}`
      );

      console.log('[CLIENT] EventSource readyState:', eventSource.readyState);
      console.log('[CLIENT] EventSource url:', eventSource.url);

      let assistantMessage = '';
      let hasReceivedMessage = false;
      let isConnectionEstablished = false;

      // Set up all event handlers before starting the connection timeout
      eventSource.addEventListener('open', () => {
        console.log('[CLIENT] EventSource connection opened');
        console.log(
          '[CLIENT] EventSource readyState at open:',
          eventSource.readyState
        );
        isConnectionEstablished = true;
        clearTimeout(connectionTimeout); // Clear initial connection timeout
      });

      eventSource.addEventListener('message', event => {
        console.log('[CLIENT] Message event received:', event);
        hasReceivedMessage = true;

        try {
          const data = JSON.parse(event.data);
          console.log('[CLIENT] Parsed message data:', data);

          if (data.type === 'content') {
            console.log('[CLIENT] Received content:', data.content);
            assistantMessage += data.content;
            setMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];

              if (lastMessage?.role === 'assistant') {
                lastMessage.content = assistantMessage;
                return [...newMessages];
              } else {
                return [
                  ...newMessages,
                  { role: 'assistant', content: assistantMessage },
                ];
              }
            });
          } else if (data.type === 'done') {
            console.log('[CLIENT] Stream complete, closing connection');
            eventSource.close();
            setIsLoading(false); // Ensure loading state is cleared
          } else if (data.type === 'error') {
            console.error('[CLIENT] Server reported error:', data.error);
            setError(data.error);
            eventSource.close();
            setIsLoading(false); // Ensure loading state is cleared
          }
        } catch (error) {
          console.error('[CLIENT] Error processing message:', error);
          console.error('[CLIENT] Raw event data:', event.data);
          setError('Error processing response. Please try again.');
          eventSource.close();
          setIsLoading(false); // Ensure loading state is cleared
        }
      });

      eventSource.addEventListener('error', error => {
        console.error('[CLIENT] EventSource error:', error);
        console.error('[CLIENT] Error type:', error.type);
        console.error(
          '[CLIENT] EventSource readyState at error:',
          eventSource.readyState
        );

        if (!isConnectionEstablished) {
          // Only handle connection errors before any successful connection
          console.error('[CLIENT] Connection failed to establish');
          clearTimeout(connectionTimeout);
          setError('Failed to establish connection. Please try again.');
          setIsLoading(false); // Ensure loading state is cleared
          eventSource.close();
        } else if (!hasReceivedMessage) {
          // Handle errors after connection but before any messages
          console.error('[CLIENT] Connected but no messages received');
          setError(
            'Connected but failed to receive response. Please try again.'
          );
          setIsLoading(false); // Ensure loading state is cleared
          eventSource.close();
        }
        // If we've received messages, don't close on error - wait for server done/error
      });

      // Set up connection timeout - only for initial connection
      const connectionTimeout = setTimeout(() => {
        console.error('[CLIENT] Initial connection timeout');
        if (!isConnectionEstablished) {
          setError('Connection timeout. Please try again.');
          setIsLoading(false);
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
        }
      }, 20000); // 20 second timeout for initial connection

      // Add cleanup on component unmount
      return () => {
        console.log('[CLIENT] Cleaning up EventSource connection');
        clearTimeout(connectionTimeout);
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
        setIsLoading(false); // Ensure loading state is cleared on unmount
      };
    } catch (error) {
      console.error('[CLIENT] Error in message handler:', error);
      setError('Failed to send message. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      {error && (
        <div
          role="alert"
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
        >
          {error}
        </div>
      )}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-4 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="text-sm font-semibold mb-1">
              {msg.role === 'user'
                ? 'You'
                : msg.role === 'system'
                ? 'System'
                : 'Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e =>
            e.key === 'Enter' && !isLoading && sendMessage(input)
          }
          placeholder="Type your message..."
          disabled={isLoading || !sessionId}
          className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !sessionId || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
