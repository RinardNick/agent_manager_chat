'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from './ui/card';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function BasicChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Create session when component mounts
  useEffect(() => {
    const createSession = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/chat/basic-session', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.status}`);
        }

        const data = await response.json();
        setSessionId(data.sessionId);
        setMessages(data.messages || []);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to create session'
        );
        console.error('Error creating session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    createSession();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      setIsLoading(true);

      const response = await fetch('/api/chat/basic-session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }

      const data = await response.json();

      // Add assistant response
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.content,
        },
      ]);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Basic Chat Demo (Without MCP)</CardTitle>
        {sessionId && (
          <div className="text-sm text-gray-500">Session ID: {sessionId}</div>
        )}
      </CardHeader>

      <CardContent className="h-[60vh] overflow-y-auto flex flex-col space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            {isLoading ? 'Creating session...' : 'No messages yet'}
          </div>
        ) : (
          messages
            .filter(msg => msg.role !== 'system')
            .map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg max-w-[80%] ${
                  msg.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
                }`}
              >
                <div className="text-sm font-semibold mb-1">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {error && (
        <div className="mx-4 p-3 bg-red-100 text-red-800 rounded-md mb-2">
          {error}
        </div>
      )}

      <CardFooter className="border-t p-4">
        <div className="flex w-full space-x-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!sessionId || isLoading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!sessionId || !input.trim() || isLoading}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
