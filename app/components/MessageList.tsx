'use client';

import { useEffect, useRef } from 'react';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';
import { Message } from './ChatContainer';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
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