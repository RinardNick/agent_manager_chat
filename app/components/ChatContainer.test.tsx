import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatContainer from './ChatContainer';
import * as clientSessionManager from '../lib/clientSessionManager';

// Mock the serverSessionManager module
vi.mock('@/app/lib/serverSessionManager', () => ({
  initializeNewMCPSession: vi.fn().mockResolvedValue('mock-session-id'),
}));

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

// Mock MessageList
vi.mock('./MessageList', () => ({
  default: () => <div data-testid="message-list">Message List</div>,
}));

// Mock MessageInput
vi.mock('./MessageInput', () => ({
  default: () => <div data-testid="message-input">Message Input</div>,
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

describe('ChatContainer', () => {
  beforeEach(() => {
    // Replace window.localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });

    // Mock window.confirm to always return true
    window.confirm = vi.fn().mockReturnValue(true);

    // Set up default mock implementations
    vi.mocked(clientSessionManager.getActiveSessionId).mockReturnValue(
      'test-session'
    );
    vi.mocked(clientSessionManager.createSession).mockReturnValue({
      id: 'test-session',
      name: 'Test Session',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders with session controls', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('session-controls')).toBeInTheDocument();
  });

  it('renders message list and input components', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('has a clear chat button', () => {
    render(<ChatContainer />);
    expect(
      screen.getByRole('button', { name: /clear chat/i })
    ).toBeInTheDocument();
  });

  it('handles session changes correctly', () => {
    render(<ChatContainer />);
    const sessionChangeButton = screen.getByTestId('session-change-button');
    fireEvent.click(sessionChangeButton);

    // Should have loaded messages from localStorage
    expect(localStorageMock.getItem).toHaveBeenCalled();
  });
});
