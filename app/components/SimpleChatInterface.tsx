'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
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
  status: 'complete' | 'streaming' | 'error';
  error?: string;
}

export default function SimpleChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session on first load
  useEffect(() => {
    async function initSession() {
      try {
        const response = await fetch('/api/chat/session', {
          method: 'POST',
        });

        if (!response.ok) throw new Error('Failed to create session');

        const data = await response.json();
        setSessionId(data.sessionId);
        console.log('Created new session:', data.sessionId);
      } catch (error) {
        console.error('Error initializing session:', error);
      }
    }

    if (!sessionId) {
      initSession();
    }
  }, [sessionId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input,
      status: 'complete',
    };

    // Add user message to UI
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Create placeholder for assistant response
    const assistantMessageId = uuidv4();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(true);

    // Start streaming the response
    startStreaming(input, assistantMessageId, sessionId);
  };

  const startStreaming = (
    message: string,
    responseId: string,
    sessionId: string
  ) => {
    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const encodedSessionId = encodeURIComponent(sessionId);
    const eventSource = new EventSource(
      `/api/chat/stream?message=${encodeURIComponent(
        message
      )}&sessionId=${encodedSessionId}`
    );

    eventSourceRef.current = eventSource;

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'thinking' && data.content) {
          updateMessage(responseId, prev => ({
            ...prev,
            thinking: data.content,
          }));
        } else if (data.type === 'content' && data.content) {
          updateMessage(responseId, prev => ({
            ...prev,
            content: (prev.content || '') + data.content,
          }));
        } else if (data.type === 'tool_call' && data.tool_call) {
          updateMessage(responseId, prev => {
            const toolCalls = [...(prev.toolCalls || [])];
            toolCalls.push(data.tool_call);
            return {
              ...prev,
              toolCalls,
            };
          });
        } else if (data.type === 'tool_result' && data.tool_result) {
          updateMessage(responseId, prev => {
            const toolResults = [...(prev.toolResults || [])];
            toolResults.push(data.tool_result);
            return {
              ...prev,
              toolResults,
            };
          });
        } else if (data.type === 'error') {
          updateMessage(responseId, prev => ({
            ...prev,
            error: data.error || 'An error occurred',
            status: 'error',
          }));
          eventSource.close();
          setIsLoading(false);
        } else if (data.type === 'done') {
          updateMessage(responseId, prev => ({
            ...prev,
            status: 'complete',
          }));
          eventSource.close();
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('EventSource error:', error);
      updateMessage(responseId, prev => ({
        ...prev,
        error: 'Connection error',
        status: 'error',
      }));
      eventSource.close();
      setIsLoading(false);
    };
  };

  const updateMessage = (id: string, updateFn: (prev: Message) => Message) => {
    setMessages(prevMessages =>
      prevMessages.map(msg => (msg.id === id ? updateFn(msg) : msg))
    );
  };

  const resetChat = async () => {
    // Create a new session
    try {
      setMessages([]);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const response = await fetch('/api/chat/session', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to create session');

      const data = await response.json();
      setSessionId(data.sessionId);
      console.log('Created new session:', data.sessionId);
    } catch (error) {
      console.error('Error resetting chat:', error);
    }
  };

  return (
    <div className="w-full max-w-4xl h-[80vh] flex flex-col border rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h2 className="font-semibold">Chat Session</h2>
          {sessionId && (
            <p className="text-xs text-gray-500">ID: {sessionId}</p>
          )}
        </div>
        <button
          onClick={resetChat}
          className="px-3 py-1 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
        >
          New Chat
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            Start a conversation by sending a message
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`max-w-[85%] ${
                message.role === 'user' ? 'ml-auto bg-blue-100' : 'bg-gray-100'
              } rounded-lg p-3`}
            >
              <div className="font-medium text-xs mb-1">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap">
                {message.content ||
                  (message.status === 'streaming' ? '...' : '')}
              </div>

              {/* Thinking section */}
              {message.thinking && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-500 font-mono">
                  <div className="font-medium mb-1">Thinking:</div>
                  <div className="whitespace-pre-wrap">{message.thinking}</div>
                </div>
              )}

              {/* Tool calls section */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  <div className="font-medium mb-1">Tool Calls:</div>
                  {message.toolCalls.map((tool, idx) => (
                    <div key={idx} className="mb-2 last:mb-0">
                      <div className="font-medium">{tool.toolName}</div>
                      <pre className="bg-gray-100 p-1 rounded text-xs overflow-auto">
                        {JSON.stringify(tool.toolInput, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Tool results section */}
              {message.toolResults && message.toolResults.length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  <div className="font-medium mb-1">Tool Results:</div>
                  {message.toolResults.map((result, idx) => (
                    <div key={idx} className="mb-2 last:mb-0">
                      <div className="font-medium">{result.toolName}</div>
                      <pre className="bg-gray-100 p-1 rounded text-xs overflow-auto">
                        {typeof result.result === 'object'
                          ? JSON.stringify(result.result, null, 2)
                          : String(result.result)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Error display */}
              {message.error && (
                <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600">
                  <div className="font-medium">Error:</div>
                  <div>{message.error}</div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || !sessionId}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !sessionId}
            className={`px-4 py-2 rounded-md ${
              isLoading || !input.trim() || !sessionId
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
