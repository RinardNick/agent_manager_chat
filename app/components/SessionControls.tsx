'use client';

import { useState, useEffect } from 'react';
import {
  getAllSessions,
  getActiveSessionId,
  setActiveSession,
  initializeNewSession,
  renameSession,
  deleteSession,
  Session,
} from '../lib/sessionManager';

interface SessionControlsProps {
  onActiveSessionChange: () => void;
}

export default function SessionControls({ onActiveSessionChange }: SessionControlsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions from local storage
  useEffect(() => {
    const loadSessionData = () => {
      const allSessions = getAllSessions();
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
      setActiveSession(newSessionId);
      setActiveSessionId(newSessionId);
      onActiveSessionChange();
    }
  };

  // Create a new session
  const handleNewSession = async () => {
    setIsLoading(true);
    
    try {
      const newSession = await initializeNewSession();
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
      onActiveSessionChange();
    } catch (error) {
      console.error('Failed to create new session:', error);
      alert('Failed to create new session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Rename the current session
  const handleRenameSession = () => {
    if (!activeSessionId) return;
    
    const currentName = sessions.find(s => s.id === activeSessionId)?.name || '';
    const newName = window.prompt('Enter a new name for this session:', currentName);
    
    if (newName && newName !== currentName) {
      renameSession(activeSessionId, newName);
      setSessions(getAllSessions());
      onActiveSessionChange();
    }
  };

  // Delete the current session
  const handleDeleteSession = () => {
    if (!activeSessionId) return;
    
    const isConfirmed = window.confirm(
      'Are you sure you want to delete this session? This action cannot be undone.'
    );
    
    if (isConfirmed) {
      deleteSession(activeSessionId);
      const updatedSessions = getAllSessions();
      setSessions(updatedSessions);
      setActiveSessionId(getActiveSessionId());
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