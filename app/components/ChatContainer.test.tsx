import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatContainer from './ChatContainer';
import * as clientSessionManager from '../lib/clientSessionManager';

// Mock clientSessionManager
vi.mock('../lib/clientSessionManager', () => ({
  getActiveSessionId: vi.fn(),
  getSessions: vi.fn(),
  setActiveSessionId: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
}));

// Mock SessionControls
vi.mock('./SessionControls', () => ({
  default: ({ onActiveSessionChange }: any) => (
    <div data-testid="session-controls">
      <button
        data-testid="session-change-button"
        onClick={onActiveSessionChange}
      >
        Change Session
      </button>
    </div>
  ),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    store,
  };
})();

// Save original localStorage
const originalLocalStorage = window.localStorage;

// Mock window.confirm
const originalConfirm = window.confirm;

// Mock the EventSource
class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
  CONNECTING = 0;
  OPEN = 1;
  CLOSED = 2;
  readyState = 0;
  url = '';
  withCredentials = false;
  onopen = null;
  onmessage = null;
  onerror = null;
}

// Save original EventSource
const originalEventSource = global.EventSource;

describe('ChatContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    // Mock window.confirm
    window.confirm = vi.fn(() => true);

    // Mock EventSource
    global.EventSource = MockEventSource as any;

    // Mock active session ID
    vi.mocked(clientSessionManager.getActiveSessionId).mockReturnValue(
      'session1'
    );

    // Clear localStorage mock
    localStorageMock.clear();
  });

  afterEach(() => {
    // Restore originals
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    window.confirm = originalConfirm;
    global.EventSource = originalEventSource;
  });

  it('renders the session controls and chat components', () => {
    render(<ChatContainer />);

    // Check if session controls are rendered
    expect(screen.getByTestId('session-controls')).toBeInTheDocument();

    // Check if clear chat button is rendered
    expect(
      screen.getByRole('button', { name: /clear chat/i })
    ).toBeInTheDocument();

    // Check if the input field and button are rendered
    expect(
      screen.getByPlaceholderText('Type your message...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('loads messages from localStorage for the active session', () => {
    // Setup localStorage with some messages
    const messages = [
      { id: '1', role: 'user', content: 'Hello', status: 'complete' },
      { id: '2', role: 'assistant', content: 'Hi there', status: 'complete' },
    ];

    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(messages));

    render(<ChatContainer />);

    // Should have loaded messages from localStorage
    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      'claude_chat_messages_session1'
    );
  });

  it('adds a user message when message is sent', async () => {
    vi.mocked(clientSessionManager.getActiveSessionId).mockReturnValue(
      'session1'
    );

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

    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('shows a loading state while waiting for response', async () => {
    render(<ChatContainer />);

    // Type and send a message
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });

    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    // Check if loading indicator appears
    expect(
      screen.getByTestId('assistant-message-streaming')
    ).toBeInTheDocument();

    // Button should be disabled while streaming
    expect(sendButton).toBeDisabled();
  });

  it('clears messages when clear chat button is clicked', async () => {
    // Setup localStorage with some messages
    const messages = [
      { id: '1', role: 'user', content: 'Hello', status: 'complete' },
      { id: '2', role: 'assistant', content: 'Hi there', status: 'complete' },
    ];

    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(messages));

    render(<ChatContainer />);

    // Click clear button
    fireEvent.click(screen.getByRole('button', { name: /clear chat/i }));

    // Confirm deletion
    expect(window.confirm).toHaveBeenCalled();

    // Should remove messages from localStorage
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      'claude_chat_messages_session1'
    );
  });
});
