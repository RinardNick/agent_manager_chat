'use client';

import { useState, useEffect } from 'react';
import {
  getSessions,
  getActiveSessionId,
  setActiveSessionId as clientSetActiveSessionId,
  createSession,
  updateSession,
  deleteSession,
  Session,
} from '../lib/clientSessionManager';

interface SessionControlsProps {
  onActiveSessionChange: () => void;
}

export default function SessionControls({
  onActiveSessionChange,
}: SessionControlsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions from local storage
  useEffect(() => {
    const loadSessionData = () => {
      const allSessions = getSessions();
      const currentSessionId = getActiveSessionId();

      setSessions(allSessions);
      setActiveSessionId(currentSessionId);
    };

    // Initial load
    loadSessionData();

    // Set up storage event listener for changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'claude_chat_sessions') {
        loadSessionData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Handle session change
  const handleSessionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSessionId = event.target.value;

    if (newSessionId && newSessionId !== activeSessionId) {
      // Update both client-side state manager and component state
      clientSetActiveSessionId(newSessionId);
      setActiveSessionId(newSessionId);
      onActiveSessionChange();
      console.log('Session changed to:', newSessionId);
    }
  };

  // Create a new session
  const handleNewSession = async () => {
    setIsLoading(true);
    try {
      console.log('Starting new session creation...');

      // First, create a server-side MCP session by dynamically importing the server function
      const { initializeNewMCPSession } = await import(
        '../lib/serverSessionManager'
      );
      console.log('Successfully imported initializeNewMCPSession');

      const sessionId = await initializeNewMCPSession();
      console.log('Server session created with ID:', sessionId);

      // Then create a client-side session with the same ID
      const newSession = createSession(sessionId, 'New Session');
      console.log('Client session created:', newSession);

      setSessions(prev => [...prev, newSession]);
      // Update both client-side state manager and component state
      clientSetActiveSessionId(sessionId);
      setActiveSessionId(sessionId);
      onActiveSessionChange();
      console.log('Session state updated successfully');
    } catch (error) {
      console.error('Failed to create new session:', error);
      // Provide more details in the alert
      let errorMessage = 'Failed to create a new session. ';
      if (error instanceof Error) {
        errorMessage += error.message;
      }
      alert(errorMessage + ' Please check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  // Rename the current session
  const handleRenameSession = () => {
    if (!activeSessionId) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    const currentName = currentSession?.name || '';

    const newName = window.prompt(
      'Enter a new name for this session:',
      currentName
    );

    if (newName && newName !== currentName) {
      console.log(
        `Renaming session ${activeSessionId} from "${currentName}" to "${newName}"`
      );
      updateSession(activeSessionId, { name: newName });
      setSessions(getSessions());
      onActiveSessionChange();
      console.log('Session renamed successfully');
    }
  };

  // Delete the current session
  const handleDeleteSession = () => {
    if (!activeSessionId) return;

    const isConfirmed = window.confirm(
      'Are you sure you want to delete this session? This action cannot be undone.'
    );

    if (isConfirmed) {
      console.log('Deleting session:', activeSessionId);
      deleteSession(activeSessionId);
      const updatedSessions = getSessions();
      setSessions(updatedSessions);

      // Get the new active session ID from client session manager
      const newActiveSessionId = getActiveSessionId();
      console.log('New active session ID after deletion:', newActiveSessionId);

      // Update component state
      setActiveSessionId(newActiveSessionId);
      onActiveSessionChange();
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
      <label htmlFor="session-select" className="text-sm font-medium">
        Session:
      </label>

      <select
        id="session-select"
        className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm rounded-md px-2 py-1 min-w-[150px]"
        value={activeSessionId || ''}
        onChange={handleSessionChange}
        disabled={isLoading}
      >
        {sessions.length === 0 && (
          <option value="" disabled>
            No sessions
          </option>
        )}

        {sessions.map(session => (
          <option key={session.id} value={session.id}>
            {session.name}
          </option>
        ))}
      </select>

      <button
        className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-2 py-1 rounded-md disabled:opacity-50"
        onClick={handleNewSession}
        disabled={isLoading}
      >
        {isLoading ? 'Creating...' : 'New'}
      </button>

      <button
        className="bg-gray-500 hover:bg-gray-600 text-white text-sm px-2 py-1 rounded-md disabled:opacity-50"
        onClick={handleRenameSession}
        disabled={!activeSessionId || isLoading}
      >
        Rename
      </button>

      <button
        className="bg-red-500 hover:bg-red-600 text-white text-sm px-2 py-1 rounded-md disabled:opacity-50"
        onClick={handleDeleteSession}
        disabled={!activeSessionId || isLoading || sessions.length <= 1}
      >
        Delete
      </button>
    </div>
  );
}
