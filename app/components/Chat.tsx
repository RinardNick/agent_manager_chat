'use client';

import { useState, useEffect, useRef } from 'react';
import { LLMConfig } from '@rinardnick/client_mcp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
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
    // Prevent duplicate initialization
    if (sessionId || initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    const initSession = async () => {
      try {
        const response = await fetch('/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const message = input.trim();
    await sendMessage(message);
  };

  const sendMessage = async (message: string) => {
    if (!sessionId || !message.trim() || isLoading) return;

    setIsLoading(true);
    setInput('');
    setError(null);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    // Add helpful debugging log to track message requests
    console.log(`[CLIENT] Sending message: ${message}`);

    try {
      console.log('[CLIENT] Setting up EventSource connection');
      const eventSource = new EventSource(
        `/api/chat/session/${sessionId}/stream?message=${encodeURIComponent(
          message
        )}`
      );

      console.log('[CLIENT] EventSource readyState:', eventSource.readyState);
      console.log('[CLIENT] EventSource url:', eventSource.url);

      // Create streaming message placeholder
      const streamingMessageId = Date.now();
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: '', 
          isStreaming: true 
        }
      ]);

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
        clearTimeout(connectionTimeout);
      });

      eventSource.addEventListener('message', event => {
        console.log('[CLIENT] Message event received:', event);
        hasReceivedMessage = true;

        try {
          const data = JSON.parse(event.data);
          console.log('[CLIENT] Parsed message data:', data);

          if (data.type === 'content') {
            console.log('[CLIENT] Received content:', data.content);
            
            // Update streaming message content
            setMessages(prev => {
              const newMessages = [...prev];
              // Find the last assistant message (which is the streaming one)
              const streamingIndex = newMessages.findIndex(
                msg => msg.role === 'assistant' && msg.isStreaming === true
              );

              if (streamingIndex !== -1) {
                // Update content of the streaming message
                newMessages[streamingIndex].content += data.content;
                return [...newMessages];
              } else {
                // Create new message if no streaming message found (shouldn't happen)
                return [
                  ...newMessages,
                  { role: 'assistant', content: data.content, isStreaming: true },
                ];
              }
            });
          } else if (data.type === 'tool_start') {
            console.log('[CLIENT] Tool execution started:', data.content);
            // Show tool execution in UI
            setMessages(prev => [
              ...prev,
              { role: 'system', content: `Using tool: ${data.content}` }
            ]);
          } else if (data.type === 'tool_result') {
            console.log('[CLIENT] Tool execution result:', data.content);
            // Show tool result in UI
            setMessages(prev => [
              ...prev,
              { role: 'system', content: `Tool result: ${data.content}` }
            ]);
          } else if (data.type === 'done') {
            console.log('[CLIENT] Stream complete, closing connection');
            
            // Mark streaming as complete
            setMessages(prev => 
              prev.map(msg => 
                msg.isStreaming ? { ...msg, isStreaming: false } : msg
              )
            );
            
            eventSource.close();
            setIsLoading(false);
          } else if (data.type === 'error') {
            console.error('[CLIENT] Server reported error:', data.error);
            setError(data.error);
            eventSource.close();
            setIsLoading(false);
          }
        } catch (error) {
          console.error('[CLIENT] Error processing message:', error);
          console.error('[CLIENT] Raw event data:', event.data);
          setError('Error processing response. Please try again.');
          eventSource.close();
          setIsLoading(false);
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
          console.error('[CLIENT] Connection failed to establish');
          clearTimeout(connectionTimeout);
          setError('Failed to establish connection. Please try again.');
          setIsLoading(false);
          eventSource.close();
        } else if (!hasReceivedMessage) {
          console.error('[CLIENT] Connected but no messages received');
          setError(
            'Connected but failed to receive response. Please try again.'
          );
          setIsLoading(false);
          eventSource.close();
        }
      });

      const connectionTimeout = setTimeout(() => {
        console.error('[CLIENT] Initial connection timeout');
        if (!isConnectionEstablished) {
          setError('Connection timeout. Please try again.');
          setIsLoading(false);
          if (eventSource.readyState !== EventSource.CLOSED) {
            eventSource.close();
          }
        }
      }, 20000);

      return () => {
        console.log('[CLIENT] Cleaning up EventSource connection');
        clearTimeout(connectionTimeout);
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
        setIsLoading(false);
      };
    } catch (error) {
      console.error('[CLIENT] Error in message handler:', error);
      setError('Failed to send message. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)]">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>AI Chat</CardTitle>
          {error && (
            <div className="text-sm text-destructive mt-2" role="alert">
              {error}
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map((m, index) => (
            <div
              key={index}
              className={`${m.role === 'user' ? 'text-right' : 'text-left'} ${
                m.role === 'system' ? 'text-center' : ''
              }`}
            >
              <span
                className={`inline-block p-2 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : m.role === 'system'
                    ? 'bg-muted text-muted-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {m.content}
                {m.isStreaming && <span className="ml-1 animate-pulse">▍</span>}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="text-left">
              <span className="inline-block p-2 rounded-lg bg-muted text-muted-foreground">
                AI is typing...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        <CardFooter className="border-t bg-card">
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow"
              disabled={!sessionId || isLoading}
            />
            <Button
              type="submit"
              disabled={!sessionId || isLoading || !input.trim()}
            >
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
