'use client';

/**
 * CLIENT-SIDE SESSION MANAGER
 *
 * This file handles client-side state for chat sessions:
 * - Storing/retrieving session information in localStorage
 * - Managing active session selection
 * - Providing interfaces to create, delete, and modify sessions
 */

// Define types for our session management
export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
}

// Local storage key for session data
const SESSION_STORAGE_KEY = 'claude_chat_sessions';

// Get session state from local storage
export function getSessionState(): SessionState {
  if (typeof window === 'undefined') {
    return { sessions: [], activeSessionId: null };
  }

  try {
    const storedState = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedState) {
      return JSON.parse(storedState);
    }
  } catch (error) {
    console.error('Error reading session state from localStorage:', error);
  }

  return { sessions: [], activeSessionId: null };
}

// Save session state to local storage
export function saveSessionState(state: SessionState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving session state to localStorage:', error);
  }
}

// Create a new session
export function createSession(id: string, name: string): Session {
  const state = getSessionState();

  // Create new session
  const newSession: Session = {
    id,
    name,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  // Update state
  const newState: SessionState = {
    sessions: [...state.sessions, newSession],
    activeSessionId: id,
  };

  saveSessionState(newState);
  return newSession;
}

// Get all sessions
export function getAllSessions(): Session[] {
  return getSessionState().sessions;
}

// Get active session ID
export function getActiveSessionId(): string | null {
  return getSessionState().activeSessionId;
}

// Get active session
export function getActiveSession(): Session | null {
  const state = getSessionState();
  if (!state.activeSessionId) return null;

  return (
    state.sessions.find(session => session.id === state.activeSessionId) || null
  );
}

// Set active session
export function setActiveSession(sessionId: string): boolean {
  const state = getSessionState();

  // Verify session exists
  const sessionExists = state.sessions.some(s => s.id === sessionId);
  if (!sessionExists) return false;

  // Update session's lastUsedAt
  const updatedSessions = state.sessions.map(s =>
    s.id === sessionId ? { ...s, lastUsedAt: Date.now() } : s
  );

  // Update state
  const newState: SessionState = {
    sessions: updatedSessions,
    activeSessionId: sessionId,
  };

  saveSessionState(newState);
  return true;
}

// Delete a session
export function deleteSession(sessionId: string): boolean {
  const state = getSessionState();

  // Filter out the session to delete
  const updatedSessions = state.sessions.filter(s => s.id !== sessionId);

  // If no change, session didn't exist
  if (updatedSessions.length === state.sessions.length) return false;

  // Set new active session if needed
  let newActiveId = state.activeSessionId;
  if (state.activeSessionId === sessionId) {
    if (updatedSessions.length > 0) {
      // Sort sessions by lastUsedAt (most recent first)
      const sortedSessions = [...updatedSessions].sort(
        (a, b) => b.lastUsedAt - a.lastUsedAt
      );
      // Select the most recently used session
      newActiveId = sortedSessions[0].id;
    } else {
      newActiveId = null;
    }
  }

  // Update state
  const newState: SessionState = {
    sessions: updatedSessions,
    activeSessionId: newActiveId,
  };

  saveSessionState(newState);
  return true;
}

// Rename a session
export function renameSession(sessionId: string, newName: string): boolean {
  const state = getSessionState();

  // Update the session name
  const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) return false;

  const updatedSessions = [...state.sessions];
  updatedSessions[sessionIndex] = {
    ...updatedSessions[sessionIndex],
    name: newName,
    lastUsedAt: Date.now(),
  };

  // Update state
  const newState: SessionState = {
    ...state,
    sessions: updatedSessions,
  };

  saveSessionState(newState);
  return true;
}

// Clear all session history (for testing or reset)
export function clearAllSessions(): void {
  saveSessionState({ sessions: [], activeSessionId: null });
}

// Initialize a new session with server-side MCP
export async function initializeNewSession(
  name: string = 'New Session'
): Promise<Session> {
  try {
    // Use the server-side function to create a new MCP session
    const { initializeNewMCPSession } = await import('./serverSessionManager');
    const sessionId = await initializeNewMCPSession();

    // Create local session
    return createSession(sessionId, name);
  } catch (error) {
    console.error('Failed to initialize new session:', error);
    throw error;
  }
}
