'use client';

// Client-side session management functions
// This file contains only browser-safe code with no Node.js dependencies

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

const SESSION_STATE_KEY = 'claude_chat_session_state';

// Get the current session state from localStorage
export function getSessionState(): SessionState {
  if (typeof window === 'undefined') {
    return { sessions: [], activeSessionId: null };
  }

  try {
    const storedState = localStorage.getItem(SESSION_STATE_KEY);
    if (!storedState) {
      return { sessions: [], activeSessionId: null };
    }

    return JSON.parse(storedState);
  } catch (error) {
    console.error('Failed to parse session data from localStorage:', error);
    return { sessions: [], activeSessionId: null };
  }
}

// Save the session state to localStorage
export function saveSessionState(state: SessionState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save session state to localStorage:', error);
  }
}

// Get the active session ID
export function getActiveSessionId(): string | null {
  const state = getSessionState();
  console.log('[CLIENT] Getting active session ID:', state.activeSessionId);
  return state.activeSessionId;
}

// Set the active session ID
export function setActiveSessionId(sessionId: string): void {
  console.log('[CLIENT] Setting active session ID to:', sessionId);
  const state = getSessionState();

  // Update the state
  const updatedState: SessionState = {
    ...state,
    activeSessionId: sessionId,
    sessions: state.sessions.map(session =>
      session.id === sessionId
        ? { ...session, lastUsedAt: Date.now() }
        : session
    ),
  };

  saveSessionState(updatedState);
  console.log('[CLIENT] Active session ID set successfully');
}

// Create a new session
export function createSession(id: string, name: string): Session {
  console.log('[CLIENT] Creating new session with ID:', id, 'and name:', name);
  const state = getSessionState();

  const newSession: Session = {
    id,
    name,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  // Update the state
  const updatedState: SessionState = {
    sessions: [...state.sessions, newSession],
    activeSessionId: id,
  };

  saveSessionState(updatedState);
  console.log('[CLIENT] New session created successfully:', newSession);
  return newSession;
}

// Delete a session
export function deleteSession(sessionId: string): void {
  console.log('[CLIENT] Deleting session with ID:', sessionId);
  const state = getSessionState();

  // Remove the session
  const updatedSessions = state.sessions.filter(
    session => session.id !== sessionId
  );

  // Update the active session if needed
  let activeSessionId = state.activeSessionId;
  if (activeSessionId === sessionId) {
    // Find the most recently used session
    const sortedSessions = [...updatedSessions].sort(
      (a, b) => b.lastUsedAt - a.lastUsedAt
    );
    activeSessionId = sortedSessions.length > 0 ? sortedSessions[0].id : null;
    console.log('[CLIENT] Active session changed to:', activeSessionId);
  }

  // Update the state
  const updatedState: SessionState = {
    sessions: updatedSessions,
    activeSessionId,
  };

  saveSessionState(updatedState);
  console.log('[CLIENT] Session deleted successfully');
}

// Get all sessions
export function getSessions(): Session[] {
  const state = getSessionState();
  return state.sessions;
}

// Get a session by ID
export function getSessionById(sessionId: string): Session | undefined {
  const state = getSessionState();
  return state.sessions.find(session => session.id === sessionId);
}

// Update a session
export function updateSession(
  sessionId: string,
  updates: Partial<Session>
): Session | undefined {
  const state = getSessionState();

  // Find and update the session
  const updatedSessions = state.sessions.map(session =>
    session.id === sessionId
      ? { ...session, ...updates, lastUsedAt: Date.now() }
      : session
  );

  // Check if the session was found
  const updatedSession = updatedSessions.find(
    session => session.id === sessionId
  );
  if (!updatedSession) return undefined;

  // Update the state
  const updatedState: SessionState = {
    ...state,
    sessions: updatedSessions,
  };

  saveSessionState(updatedState);
  return updatedSession;
}
