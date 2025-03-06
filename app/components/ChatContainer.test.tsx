import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatContainer from './ChatContainer';

// Mock the EventSource
global.EventSource = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
  readyState: 0,
  url: '',
  withCredentials: false,
  onopen: null,
  onmessage: null,
  onerror: null,
}));

describe('ChatContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the chat container with input and submit button', () => {
    render(<ChatContainer />);
    
    // Check if the input field and button are rendered
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('adds a user message when message is sent', async () => {
    render(<ChatContainer />);
    
    // Type a message
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello, AI!' } });
    
    // Click send button
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    
    // Check if the message is displayed
    await waitFor(() => {
      expect(screen.getByText('Hello, AI!')).toBeInTheDocument();
    });
    
    // Input should be cleared after sending
    expect(input).toHaveValue('');
  });

  it('shows a loading state while waiting for response', async () => {
    render(<ChatContainer />);
    
    // Type and send a message
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    
    // Check if loading indicator appears
    expect(screen.getByTestId('assistant-message-streaming')).toBeInTheDocument();
    
    // Button should be disabled while streaming
    expect(sendButton).toBeDisabled();
  });
});