import { SessionManager as MCPSessionManager } from '@rinardnick/client_mcp';
import { loadConfig, getDefaultConfigPath } from './configLoader';

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

// Initialize session manager instance
let sessionManager: MCPSessionManager | undefined;

// Get or create the client_mcp session manager
export async function getMCPSessionManager(): Promise<MCPSessionManager> {
  if (!sessionManager) {
    sessionManager = await (async () => {
      try {
        // Get the config path
        const configPath = await getDefaultConfigPath();

        // Load the configuration
        const fullConfig = await loadConfig(configPath);

        // Initialize the session manager with the loaded config
        const manager = new MCPSessionManager({
          useSharedServers: true,
        });

        // Initialize a default session if needed
        const existingSessionId = getActiveSessionId();
        if (!existingSessionId) {
          const session = await manager.initializeSession(fullConfig.llm);
          if (
            typeof session === 'object' &&
            session !== null &&
            'id' in session
          ) {
            createSession(session.id, 'Default Session');
          } else if (typeof session === 'string') {
            createSession(session, 'Default Session');
          }
        }

        return manager;
      } catch (error) {
        console.error('Failed to initialize session manager:', error);
        throw error;
      }
    })();
  }

  return sessionManager;
}

// Local storage key for session data
const SESSION_STORAGE_KEY = 'claude_chat_sessions';

// Get session state from local storage
export function getSessionState(): SessionState {
  if (typeof window === 'undefined') {
    return { sessions: [], activeSessionId: null };
  }

  const storedData = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!storedData) {
    return { sessions: [], activeSessionId: null };
  }

  try {
    return JSON.parse(storedData) as SessionState;
  } catch (e) {
    console.error('Failed to parse session data from localStorage:', e);
    return { sessions: [], activeSessionId: null };
  }
}

// Save session state to local storage
export function saveSessionState(state: SessionState): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save session data to localStorage:', e);
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

  // Add to state
  const newState: SessionState = {
    sessions: [...state.sessions, newSession],
    activeSessionId: newSession.id,
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

  // If we're deleting the active session, set active to the most recently used remaining session
  let newActiveId = state.activeSessionId;
  if (state.activeSessionId === sessionId) {
    const remainingSessions = updatedSessions.sort(
      (a, b) => b.lastUsedAt - a.lastUsedAt
    );
    newActiveId = remainingSessions.length > 0 ? remainingSessions[0].id : null;
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
  const updatedSessions = state.sessions.map(s =>
    s.id === sessionId ? { ...s, name: newName } : s
  );

  // Verify session existed
  if (JSON.stringify(updatedSessions) === JSON.stringify(state.sessions)) {
    return false;
  }

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

// Initialize a new session with client_mcp
export async function initializeNewSession(
  name: string = 'New Session'
): Promise<Session> {
  try {
    const manager = await getMCPSessionManager();
    const configPath = await getDefaultConfigPath();
    const fullConfig = await loadConfig(configPath);

    // Create a new session with client_mcp
    const session = await manager.initializeSession(fullConfig.llm);

    // Extract session ID
    let sessionId: string;
    if (typeof session === 'object' && session !== null && 'id' in session) {
      sessionId = session.id;
    } else if (typeof session === 'string') {
      sessionId = session;
    } else {
      throw new Error('Invalid session format returned');
    }

    // Create local session
    return createSession(sessionId, name);
  } catch (error) {
    console.error('Failed to initialize new session:', error);
    throw error;
  }
}
