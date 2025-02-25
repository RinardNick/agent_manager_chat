'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from './ui/card';
import { SessionManager } from '../lib/sessionManager';
import { createConfig } from '../lib/config';

// Create a singleton instance of SessionManager
const sessionManager = new SessionManager();

export function SessionRecoveryDemo() {
  const [activeSessions, setActiveSessions] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load persisted sessions on component mount
  useEffect(() => {
    loadPersistedSessions();
  }, []);

  // Load all persisted sessions
  const loadPersistedSessions = () => {
    try {
      const sessionIds = sessionManager.getPersistedSessionIds();
      setActiveSessions(sessionIds);
    } catch (err) {
      setError(
        `Failed to load persisted sessions: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  };

  // Create a new session
  const createNewSession = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Create a basic config (in a real app, you'd get this from user input or environment)
      const config = createConfig('demo-api-key');

      // Initialize a new session
      const session = await sessionManager.initializeSession(config);

      // Set the current session
      setCurrentSessionId(session.id);

      // Refresh the list of sessions
      loadPersistedSessions();

      setMessage(`Created new session: ${session.id}`);
    } catch (err) {
      setError(
        `Failed to create session: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Recover an existing session
  const recoverSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Recover the session
      const session = await sessionManager.recoverSession(sessionId);

      // Set the current session
      setCurrentSessionId(session.id);

      setMessage(`Recovered session: ${session.id}`);
    } catch (err) {
      setError(
        `Failed to recover session: ${
          err instanceof Error ? err.message : String(err)
        }`
      );

      // Refresh the list of sessions in case the session was deleted
      loadPersistedSessions();
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up a session
  const cleanupSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clean up the session
      await sessionManager.cleanupSession(sessionId);

      // If this was the current session, clear it
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }

      // Refresh the list of sessions
      loadPersistedSessions();

      setMessage(`Cleaned up session: ${sessionId}`);
    } catch (err) {
      setError(
        `Failed to clean up session: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Clean up all expired sessions
  const cleanupExpiredSessions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Clean up expired sessions (default 7 days)
      const expiredIds = sessionManager.cleanupExpiredSessions();

      // Refresh the list of sessions
      loadPersistedSessions();

      if (expiredIds.length > 0) {
        setMessage(`Cleaned up ${expiredIds.length} expired sessions`);
      } else {
        setMessage('No expired sessions found');
      }
    } catch (err) {
      setError(
        `Failed to clean up expired sessions: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get UI state for the current session
  const getCurrentSessionUIState = () => {
    if (!currentSessionId) return null;
    return sessionManager.getUIState(currentSessionId);
  };

  // Render the UI state
  const renderUIState = () => {
    const uiState = getCurrentSessionUIState();
    if (!uiState) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Current Session UI State:</h3>
        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
          {JSON.stringify(uiState, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Session Recovery Demo</h2>
      <p className="text-gray-600">
        This demo showcases the session persistence and recovery functionality.
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button
          onClick={createNewSession}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Create New Session
        </Button>
        <Button
          onClick={cleanupExpiredSessions}
          disabled={isLoading}
          className="bg-amber-600 hover:bg-amber-700"
        >
          Clean Up Expired Sessions
        </Button>
      </div>

      {/* Loading and error states */}
      {isLoading && (
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Loading...</span>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4 border border-red-200 bg-red-50 text-red-700">
          <div className="flex items-start space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-red-500 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-medium">Error</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {message && !error && (
        <Card className="p-4 border border-green-200 bg-green-50 text-green-700">
          <div className="flex items-start space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-green-500 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="font-medium">Success</h3>
              <p className="text-sm">{message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Current session */}
      {currentSessionId && (
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{currentSessionId}</p>
            {renderUIState()}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => cleanupSession(currentSessionId)}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              Clean Up Session
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Persisted sessions */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Persisted Sessions</h3>
        {activeSessions.length === 0 ? (
          <p className="text-gray-500">No persisted sessions found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map(sessionId => (
              <Card key={sessionId}>
                <CardHeader>
                  <CardTitle className="text-base">Session</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-mono truncate">{sessionId}</p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    onClick={() => recoverSession(sessionId)}
                    disabled={isLoading || currentSessionId === sessionId}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Recover
                  </Button>
                  <Button
                    onClick={() => cleanupSession(sessionId)}
                    disabled={isLoading}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Clean Up
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Implementation Notes:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            Sessions are persisted to <code>localStorage</code> for browser
            persistence.
          </li>
          <li>Session UI state is automatically saved during operations.</li>
          <li>
            Sessions can be recovered even after page refresh or browser
            restart.
          </li>
          <li>
            Expired sessions (older than 7 days by default) are automatically
            cleaned up.
          </li>
          <li>
            The implementation handles error cases gracefully, cleaning up
            resources when needed.
          </li>
        </ul>
      </div>
    </div>
  );
}
