'use client';

import { useState, useEffect } from 'react';

interface Message {
  role: string;
  content: string;
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content: 'You are a helpful assistant with access to tools.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input) return;

    const updatedMessages = [...messages, { role: 'user', content: input }];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Call the API endpoint
      const response = await fetch(
        `/api/chat?message=${encodeURIComponent(input)}`
      );
      const data = await response.json();

      if (response.ok) {
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: data.response },
        ]);
      } else {
        console.error('API error:', data.error);
        // Optionally show error message to user
      }
    } catch (error) {
      console.error('Error calling API:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ul>
        {messages.map((message, index) => (
          <li key={index}>
            <strong>{message.role}:</strong> {message.content}
          </li>
        ))}
      </ul>
      <input
        type="text"
        value={input}
        onInput={(e: React.ChangeEvent<HTMLInputElement>) =>
          setInput(e.target.value)
        }
      />
      <button onClick={handleSendMessage} disabled={loading}>
        Send
      </button>
      {loading && <p>Loading response...</p>}
    </div>
  );
}

export default Chat;
