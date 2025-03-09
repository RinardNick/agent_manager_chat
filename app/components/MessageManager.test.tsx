import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageManager } from './MessageManager';
import * as clientSessionManager from '../lib/clientSessionManager';

// Mock clientSessionManager
vi.mock('../lib/clientSessionManager', () => ({
  getActiveSessionId: vi.fn(),
  setActiveSessionId: vi.fn(),
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

describe('useMessageManager', () => {
  const MESSAGES_STORAGE_PREFIX = 'claude_chat_messages_';

  beforeEach(() => {
    // Replace window.localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });

    // Set up default mock implementations
    vi.mocked(clientSessionManager.getActiveSessionId).mockReturnValue(
      'test-session'
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('should initialize with empty messages array', () => {
    const { result } = renderHook(() => useMessageManager());
    expect(result.current.messages).toEqual([]);
  });

  it('should load messages from localStorage for active session', () => {
    // Set up mock data in localStorage
    const mockMessages = [
      { id: '1', role: 'user', content: 'Hello', status: 'complete' },
      { id: '2', role: 'assistant', content: 'Hi there', status: 'complete' },
    ];
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}test-session`] =
      JSON.stringify(mockMessages);

    const { result } = renderHook(() => useMessageManager());
    expect(result.current.messages).toEqual(mockMessages);
    expect(localStorageMock.getItem).toHaveBeenCalledWith(
      `${MESSAGES_STORAGE_PREFIX}test-session`
    );
  });

  it('should handle localStorage errors gracefully', () => {
    // Set up invalid JSON in localStorage
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}test-session`] =
      'invalid-json';

    const { result } = renderHook(() => useMessageManager());
    expect(result.current.messages).toEqual([]);
  });

  it('should save messages to localStorage when they change', () => {
    const { result } = renderHook(() => useMessageManager());

    const newMessage = {
      id: '1',
      role: 'user' as const,
      content: 'Hello',
      status: 'complete' as const,
    };

    act(() => {
      result.current.addMessage(newMessage);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${MESSAGES_STORAGE_PREFIX}test-session`,
      JSON.stringify([newMessage])
    );
  });

  it('should update an existing message correctly', () => {
    // Setup initial messages
    const initialMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        status: 'complete' as const,
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: '',
        status: 'streaming' as const,
      },
    ];
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}test-session`] =
      JSON.stringify(initialMessages);

    const { result } = renderHook(() => useMessageManager());

    act(() => {
      result.current.updateMessage('2', prev => ({
        ...prev,
        content: 'Updated content',
        status: 'complete' as const,
      }));
    });

    expect(result.current.messages[1].content).toBe('Updated content');
    expect(result.current.messages[1].status).toBe('complete');
  });

  it('should clear all messages', () => {
    // Setup initial messages
    const initialMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        status: 'complete' as const,
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Hi',
        status: 'complete' as const,
      },
    ];
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}test-session`] =
      JSON.stringify(initialMessages);

    const { result } = renderHook(() => useMessageManager());

    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${MESSAGES_STORAGE_PREFIX}test-session`,
      '[]'
    );
  });

  it('should reload messages when active session changes', () => {
    // Setup initial messages for first session
    const firstSessionMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        status: 'complete' as const,
      },
    ];
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}test-session`] =
      JSON.stringify(firstSessionMessages);

    const { result } = renderHook(() => useMessageManager());

    // Change active session
    vi.mocked(clientSessionManager.getActiveSessionId).mockReturnValue(
      'second-session'
    );

    // Setup messages for second session
    const secondSessionMessages = [
      {
        id: '2',
        role: 'user' as const,
        content: 'Hi again',
        status: 'complete' as const,
      },
    ];
    localStorageMock.store[`${MESSAGES_STORAGE_PREFIX}second-session`] =
      JSON.stringify(secondSessionMessages);

    // Trigger session change callback
    act(() => {
      result.current.handleSessionChange();
    });

    expect(result.current.messages).toEqual(secondSessionMessages);
  });
});
