'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const initializingRef = useRef(false);

  useEffect(() => {
    // Initialize session on component mount
    const initSession = async () => {
      if (initializingRef.current || sessionId) return;
      initializingRef.current = true;

      try {
        const response = await fetch('/api/chat/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          // If there are any initial messages, add them
          if (data.messages) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
      } finally {
        initializingRef.current = false;
      }
    };
    initSession();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() && sessionId) {
      const userMessage = input.trim();
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
      setInput('');
      setIsTyping(true);

      try {
        const response = await fetch(`/api/chat/session/${sessionId}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
          }),
        });
        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.content },
        ]);
      } catch (error) {
        console.error('Chat error:', error);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, I encountered an error processing your request.',
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>AI Chat</CardTitle>
        </CardHeader>
        <CardContent className="h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {messages.map((m, index) => (
              <div
                key={index}
                className={`flex ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    m.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-black'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-2 rounded-lg bg-gray-200 text-black">
                  AI is typing...
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4">
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow"
            />
            <Button type="submit" disabled={isTyping || !sessionId}>
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
