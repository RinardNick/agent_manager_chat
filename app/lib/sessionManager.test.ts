import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSessionState,
  saveSessionState,
  createSession,
  getAllSessions,
  getActiveSessionId,
  getActiveSession,
  setActiveSession,
  deleteSession,
  renameSession,
  clearAllSessions,
  SessionState,
} from './sessionManager';

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

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window
Object.defineProperty(global, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
});

describe('Session Manager', () => {
  // Reset localStorage and mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Mock Date.now() for consistent timestamps across all tests
    const mockNow = vi.spyOn(Date, 'now');
    mockNow.mockImplementation(() => 1616161616161);
  });

  // Clean up after tests
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSessionState', () => {
    it('returns empty state when no data in localStorage', () => {
      const state = getSessionState();
      expect(state).toEqual({ sessions: [], activeSessionId: null });
    });

    it('returns parsed state from localStorage', () => {
      const mockState: SessionState = {
        sessions: [
          {
            id: 'test-id',
            name: 'Test Session',
            createdAt: 123,
            lastUsedAt: 456,
          },
        ],
        activeSessionId: 'test-id',
      };
      localStorageMock.setItem(
        'claude_chat_sessions',
        JSON.stringify(mockState)
      );

      const state = getSessionState();
      expect(state).toEqual(mockState);
    });

    it('returns empty state when localStorage has invalid JSON', () => {
      localStorageMock.setItem('claude_chat_sessions', 'invalid-json');

      const state = getSessionState();
      expect(state).toEqual({ sessions: [], activeSessionId: null });
    });
  });

  describe('saveSessionState', () => {
    it('saves state to localStorage', () => {
      const mockState: SessionState = {
        sessions: [
          {
            id: 'test-id',
            name: 'Test Session',
            createdAt: 123,
            lastUsedAt: 456,
          },
        ],
        activeSessionId: 'test-id',
      };

      saveSessionState(mockState);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claude_chat_sessions',
        JSON.stringify(mockState)
      );
    });
  });

  describe('createSession', () => {
    it('creates a new session and sets it as active', () => {
      const session = createSession('new-id', 'New Session');

      // Check returned session
      expect(session).toEqual({
        id: 'new-id',
        name: 'New Session',
        createdAt: 1616161616161,
        lastUsedAt: 1616161616161,
      });

      // Check localStorage was updated
      expect(localStorageMock.setItem).toHaveBeenCalled();

      // Check state was updated
      const state = getSessionState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0]).toEqual(session);
      expect(state.activeSessionId).toBe('new-id');
    });

    it('adds a new session to existing sessions', () => {
      // Create initial session
      createSession('first-id', 'First Session');

      // Create second session
      const session = createSession('second-id', 'Second Session');

      // Check state has both sessions and active is the new one
      const state = getSessionState();
      expect(state.sessions).toHaveLength(2);
      expect(state.activeSessionId).toBe('second-id');
    });
  });

  describe('getAllSessions', () => {
    it('returns empty array when no sessions exist', () => {
      const sessions = getAllSessions();
      expect(sessions).toEqual([]);
    });

    it('returns all sessions', () => {
      // Create sessions
      createSession('id1', 'Session 1');
      createSession('id2', 'Session 2');

      const sessions = getAllSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('id1');
      expect(sessions[1].id).toBe('id2');
    });
  });

  describe('getActiveSessionId', () => {
    it('returns null when no active session', () => {
      const activeId = getActiveSessionId();
      expect(activeId).toBeNull();
    });

    it('returns the active session ID', () => {
      createSession('test-id', 'Test Session');

      const activeId = getActiveSessionId();
      expect(activeId).toBe('test-id');
    });
  });

  describe('getActiveSession', () => {
    it('returns null when no active session', () => {
      const session = getActiveSession();
      expect(session).toBeNull();
    });

    it('returns the active session', () => {
      createSession('test-id', 'Test Session');

      const session = getActiveSession();
      expect(session).not.toBeNull();
      expect(session?.id).toBe('test-id');
      expect(session?.name).toBe('Test Session');
    });
  });

  describe('setActiveSession', () => {
    it('returns false if session does not exist', () => {
      const result = setActiveSession('non-existent-id');
      expect(result).toBe(false);
    });

    it('sets the active session and updates lastUsedAt', () => {
      // Create two sessions
      createSession('id1', 'Session 1');
      createSession('id2', 'Session 2');

      // Active session should be id2
      expect(getActiveSessionId()).toBe('id2');

      // Update timestamp to simulate time passing
      const mockNow = vi.spyOn(Date, 'now');
      mockNow.mockImplementation(() => 1616161617161); // 1 second later

      // Set id1 as active
      const result = setActiveSession('id1');

      // Check result
      expect(result).toBe(true);

      // Check active session
      expect(getActiveSessionId()).toBe('id1');

      // Check lastUsedAt was updated
      const session = getActiveSession();
      expect(session?.lastUsedAt).toBe(1616161617161);
    });
  });

  describe('deleteSession', () => {
    it('deletes a session', () => {
      // Create two sessions
      createSession('id1', 'Session 1');
      createSession('id2', 'Session 2');

      // Delete second session
      const result = deleteSession('id2');

      // Check result
      expect(result).toBe(true);

      // Check session was deleted
      const sessions = getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('id1');

      // Active session should fall back to remaining session
      expect(getActiveSessionId()).toBe('id1');
    });

    it('handles deleting the active session by selecting most recently used', () => {
      // Set specific timestamps for each session creation
      const mockNow = vi.spyOn(Date, 'now');

      // Create first session (oldest)
      mockNow.mockImplementation(() => 1616161616161);
      createSession('id1', 'Session 1');

      // Create second session (middle)
      mockNow.mockImplementation(() => 1616161617161); // 1 second later
      createSession('id2', 'Session 2');

      // Create third session (newest)
      mockNow.mockImplementation(() => 1616161618161); // 2 seconds later
      createSession('id3', 'Session 3');

      // Verify session creation timestamps
      const sessions = getAllSessions();
      expect(sessions[0].lastUsedAt).toBe(1616161616161);
      expect(sessions[1].lastUsedAt).toBe(1616161617161);
      expect(sessions[2].lastUsedAt).toBe(1616161618161);

      // Delete active session (id3)
      deleteSession('id3');

      // Active session should fall back to id2 (most recently used)
      expect(getActiveSessionId()).toBe('id2');
    });

    it('sets activeSessionId to null when deleting the last session', () => {
      // Create a session
      createSession('id1', 'Session 1');

      // Delete it
      deleteSession('id1');

      // Should have no sessions and no active session
      expect(getAllSessions()).toHaveLength(0);
      expect(getActiveSessionId()).toBeNull();
    });
  });

  describe('renameSession', () => {
    it('returns false if session does not exist', () => {
      const result = renameSession('non-existent-id', 'New Name');
      expect(result).toBe(false);
    });

    it('renames a session', () => {
      // Create a session
      createSession('id1', 'Session 1');

      // Rename it
      const result = renameSession('id1', 'Renamed Session');

      // Check result
      expect(result).toBe(true);

      // Check session was renamed
      const session = getActiveSession();
      expect(session?.name).toBe('Renamed Session');
    });
  });

  describe('clearAllSessions', () => {
    it('clears all sessions', () => {
      // Create sessions
      createSession('id1', 'Session 1');
      createSession('id2', 'Session 2');

      // Clear all
      clearAllSessions();

      // Check state
      expect(getAllSessions()).toHaveLength(0);
      expect(getActiveSessionId()).toBeNull();
    });
  });
});
