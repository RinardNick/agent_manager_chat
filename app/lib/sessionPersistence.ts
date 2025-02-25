import { UIState } from './uiState';

// Define the structure of persisted session data
export interface PersistedSession {
  id: string;
  lastActive: number; // timestamp
  uiState: UIState;
  metadata?: Record<string, any>;
}

// Storage keys
const SESSION_IDS_KEY = 'mcp_session_ids';
const SESSION_PREFIX = 'mcp_session_';
const SESSION_EXPIRY_DAYS = 7; // Sessions expire after 7 days by default

/**
 * Session persistence manager that handles saving and loading session data
 */
export class SessionPersistenceManager {
  private storage: Storage;

  constructor(storage: Storage = localStorage) {
    this.storage = storage;
  }

  /**
   * Save a session to persistent storage
   */
  saveSession(sessionData: PersistedSession): void {
    try {
      // Update the session data
      const sessionKey = `${SESSION_PREFIX}${sessionData.id}`;
      this.storage.setItem(sessionKey, JSON.stringify(sessionData));

      // Update the list of active sessions
      const sessionIds = this.getSessionIds();
      if (!sessionIds.includes(sessionData.id)) {
        sessionIds.push(sessionData.id);
        this.storage.setItem(SESSION_IDS_KEY, JSON.stringify(sessionIds));
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Load a session from persistent storage
   */
  loadSession(sessionId: string): PersistedSession | null {
    try {
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      const sessionData = this.storage.getItem(sessionKey);

      if (!sessionData) {
        return null;
      }

      return JSON.parse(sessionData) as PersistedSession;
    } catch (error) {
      console.error(`Failed to load session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Delete a session from persistent storage
   */
  deleteSession(sessionId: string): void {
    try {
      // Remove the session data
      const sessionKey = `${SESSION_PREFIX}${sessionId}`;
      this.storage.removeItem(sessionKey);

      // Update the list of active sessions
      const sessionIds = this.getSessionIds().filter(id => id !== sessionId);
      this.storage.setItem(SESSION_IDS_KEY, JSON.stringify(sessionIds));
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error);
    }
  }

  /**
   * Get all session IDs from persistent storage
   */
  getSessionIds(): string[] {
    try {
      const sessionIdsJson = this.storage.getItem(SESSION_IDS_KEY);
      return sessionIdsJson ? JSON.parse(sessionIdsJson) : [];
    } catch (error) {
      console.error('Failed to get session IDs:', error);
      return [];
    }
  }

  /**
   * Get all sessions from persistent storage
   */
  getAllSessions(): PersistedSession[] {
    try {
      return this.getSessionIds()
        .map(id => this.loadSession(id))
        .filter((session): session is PersistedSession => session !== null);
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAgeDays: number = SESSION_EXPIRY_DAYS): string[] {
    try {
      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      const expiredSessionIds: string[] = [];

      const sessions = this.getAllSessions();

      for (const session of sessions) {
        const sessionAge = now - session.lastActive;
        if (sessionAge > maxAgeMs) {
          this.deleteSession(session.id);
          expiredSessionIds.push(session.id);
        }
      }

      return expiredSessionIds;
    } catch (error) {
      console.error('Failed to clean up expired sessions:', error);
      return [];
    }
  }

  /**
   * Update session activity timestamp
   */
  updateSessionActivity(sessionId: string): void {
    try {
      const session = this.loadSession(sessionId);
      if (session) {
        session.lastActive = Date.now();
        this.saveSession(session);
      }
    } catch (error) {
      console.error(
        `Failed to update session activity for ${sessionId}:`,
        error
      );
    }
  }
}
